/**
 * backup-nuvem.js — v1.16.2
 * Backup em nuvem (manual v1.12, automático v1.14, lista v1.13)
 * + sincronização de agenda (v1.16.0 §3).
 * Depende de: constants, helpers, storage, state.
 */

import {
  LS_DEVICE_ID, LS_BACKUP_NUVEM,
  LS_BACKUP_AUTO, LS_BACKUP_PENDENTE, LS_BACKUP_MUDANCA_TS,
  DEBOUNCE_MS, CONFIG_DOM_PADRAO, SETE_DIAS_MS
} from "./constants.js";

import {
  uid, escapeHtml, formatDataHora, formatBytes, formatHaLegivel, abreviarDeviceId
} from "./helpers.js";

import {
  saveTipos, saveAgenda, saveFerias, saveFolgas, saveFeriadosCustom,
  saveConfigDomicilio, saveClientes, saveWhatsapp
} from "./storage.js";

import {
  state,
  setAutoTimer, setAutoEnviando
} from "./state.js";

/* =========================================================
   DEVICE ID
   ========================================================= */
export function obterDeviceId(){
  try{
    let id = localStorage.getItem(LS_DEVICE_ID);
    if(id && typeof id === "string" && /^[A-Za-z0-9_\-]{6,100}$/.test(id)) return id;
    const ts = Date.now().toString(36);
    const rand = Math.random().toString(36).slice(2, 10);
    id = "dev_" + ts + "_" + rand;
    localStorage.setItem(LS_DEVICE_ID, id);
    return id;
  }catch(e){
    return "dev_temp_" + Date.now().toString(36);
  }
}

/* =========================================================
   META LOCAL DO BACKUP
   ========================================================= */
export function lerMetaBackupNuvem(){
  try{
    const raw = localStorage.getItem(LS_BACKUP_NUVEM);
    if(!raw) return null;
    const d = JSON.parse(raw);
    if(!d || typeof d !== "object") return null;
    return d;
  }catch(e){ return null; }
}

export function salvarMetaBackupNuvem(meta){
  try{ localStorage.setItem(LS_BACKUP_NUVEM, JSON.stringify(meta)); }catch(e){}
}

/* =========================================================
   UI DO BLOCO DE BACKUP
   ========================================================= */
export function atualizarUIBackupNuvem(){
  const info         = document.getElementById("cloudInfo");
  const avisoBackend = document.getElementById("cloudAvisoBackend");
  const avisoVelho   = document.getElementById("cloudAvisoVelho");
  const btnEnviar    = document.getElementById("cloudBtnEnviar");
  const btnVerTodos  = document.getElementById("cloudBtnVerTodos");
  if(!info) return;

  const temBackend = !!(state.whatsapp.backendUrl && state.whatsapp.apiKey);
  if(!temBackend){
    info.innerHTML = '<span class="cloud-vazio">Backup em nuvem indisponível</span>';
    avisoBackend.style.display = "flex";
    btnEnviar.disabled = true;
    btnVerTodos.disabled = true;
    return;
  }
  avisoBackend.style.display = "none";
  btnEnviar.disabled = false;
  btnVerTodos.disabled = false;

  const meta = lerMetaBackupNuvem();
  if(!meta || !meta.ultimoEnvio){
    info.innerHTML = '<span class="cloud-vazio">Nenhum backup enviado ainda</span>';
    avisoVelho.style.display = "none";
    return;
  }

  const dataFmt = formatDataHora(meta.ultimoEnvio);
  const tamFmt  = meta.ultimoTamanho ? formatBytes(meta.ultimoTamanho) : "";
  let html = '<div>Último backup: <span class="cloud-data">' + escapeHtml(dataFmt) + '</span></div>';
  if(tamFmt) html += '<div class="cloud-size">' + escapeHtml(tamFmt) + '</div>';
  info.innerHTML = html;

  const msDesde = Date.now() - new Date(meta.ultimoEnvio).getTime();
  avisoVelho.style.display = (msDesde > SETE_DIAS_MS) ? "flex" : "none";
}

export function mostrarStatusNuvem(tipo, texto){
  const el = document.getElementById("cloudStatus");
  if(!el) return;
  el.className = "cloud-status show " + (tipo || "info");
  el.textContent = texto;
}

export function esconderStatusNuvem(){
  const el = document.getElementById("cloudStatus");
  if(!el) return;
  el.className = "cloud-status";
  el.textContent = "";
}

/* =========================================================
   BACKUP OBJ
   ========================================================= */
export function montarBackupObj(){
  return {
    versao: 9,
    exportadoEm: new Date().toISOString(),
    tipos:  state.tipos,
    agenda: state.agenda,
    ferias: state.ferias,
    folgas: state.folgas,
    feriados_custom: state.feriadosCustom,
    config_domicilio: state.configDomicilio,
    clientes: state.clientes,
    whatsapp: {
      backendUrl: state.whatsapp.backendUrl,
      ativo: state.whatsapp.ativo,
      templateName: state.whatsapp.templateName,
      languageCode: state.whatsapp.languageCode
    },
    lembretes_config: {
      modo: state.whatsapp.modo,
      maxReenvios: state.whatsapp.maxReenvios,
      intervaloReenvio: state.whatsapp.intervaloReenvio
    }
  };
}

/* =========================================================
   BACKUP MANUAL (v1.12)
   ========================================================= */
export async function enviarBackupParaNuvem(){
  const cfg = state.whatsapp;
  if(!cfg.backendUrl || !cfg.apiKey){
    mostrarStatusNuvem("erro", "❌ Configure o WhatsApp antes de enviar.");
    return;
  }

  const btn  = document.getElementById("cloudBtnEnviar");
  const btnVT = document.getElementById("cloudBtnVerTodos");
  btn.disabled = true;
  btnVT.disabled = true;
  esconderStatusNuvem();
  mostrarStatusNuvem("info", "⏳ Enviando backup...");

  try{
    const obj = montarBackupObj();
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
    const form = new FormData();
    form.append("file", blob, "backup.json");
    form.append("deviceId", obterDeviceId());
    form.append("versao", String(obj.versao));

    const url = cfg.backendUrl.replace(/\/+$/, "") + "/backup/upload";
    const resp = await fetch(url, { method: "POST", headers: { "x-api-key": cfg.apiKey }, body: form });
    const data = await resp.json().catch(() => ({}));

    if(!resp.ok || !data.ok){
      mostrarStatusNuvem("erro", "❌ Erro " + resp.status + ": " + (data.error || "falha no upload"));
      btn.disabled = false; btnVT.disabled = false;
      return;
    }

    salvarMetaBackupNuvem({
      ultimoEnvio: data.criadoEm || new Date().toISOString(),
      ultimoPath: data.path || "",
      ultimoTamanho: data.tamanho || blob.size
    });

    mostrarStatusNuvem("ok", "✅ Backup enviado (" + formatBytes(data.tamanho || blob.size) + ")");
    atualizarUIBackupNuvem();
    setTimeout(esconderStatusNuvem, 4000);

  }catch(err){
    mostrarStatusNuvem("erro", "❌ Erro de rede: " + err.message);
    btn.disabled = false; btnVT.disabled = false;
  }
}

/* =========================================================
   BACKUP AUTOMÁTICO (v1.14)
   ========================================================= */
export function autoEstaOn(){
  try{ return localStorage.getItem(LS_BACKUP_AUTO) !== "off"; }catch(e){ return true; }
}

let _autoTimerLocal = null;

export function marcarMudanca(){
  try{
    localStorage.setItem(LS_BACKUP_MUDANCA_TS, new Date().toISOString());
    localStorage.setItem(LS_BACKUP_PENDENTE, "true");
  }catch(e){}

  atualizarIndicadorAuto();
  sincronizarAgenda();

  if(autoEstaOn()){
    if(_autoTimerLocal){ clearTimeout(_autoTimerLocal); _autoTimerLocal = null; }
    _autoTimerLocal = setTimeout(() => { _autoTimerLocal = null; enviarBackupAuto(); }, DEBOUNCE_MS);
  }
}

export async function sincronizarAgenda(){
  const cfg = state.whatsapp;
  if(!cfg.backendUrl || !cfg.apiKey) return;
  try{
    await fetch(cfg.backendUrl.replace(/\/+$/, "") + "/sync-agenda", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": cfg.apiKey },
      body: JSON.stringify({
        tipos: state.tipos,
        agenda: state.agenda,
        ferias: state.ferias,
        folgas: state.folgas,
        feriados_custom: state.feriadosCustom,
        config_domicilio: state.configDomicilio
      })
    });
    console.log("[sync] agenda sincronizada com o servidor");
  }catch(err){
    console.warn("[sync] falha ao sincronizar agenda:", err.message);
  }
}

let _autoEnviandoLocal = false;

export async function enviarBackupAuto(){
  if(_autoEnviandoLocal) return;
  if(!autoEstaOn()) return;
  const cfg = state.whatsapp;
  if(!cfg.backendUrl || !cfg.apiKey) return;

  _autoEnviandoLocal = true;
  atualizarIndicadorAuto("enviando");

  try{
    const obj = montarBackupObj();
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
    const form = new FormData();
    form.append("file", blob, "backup.json");
    form.append("deviceId", obterDeviceId());
    form.append("versao", String(obj.versao));

    const url = cfg.backendUrl.replace(/\/+$/, "") + "/backup/upload";
    const resp = await fetch(url, { method: "POST", headers: { "x-api-key": cfg.apiKey }, body: form });
    const data = await resp.json().catch(() => ({}));
    if(!resp.ok || !data.ok) throw new Error(data.error || ("HTTP " + resp.status));

    salvarMetaBackupNuvem({
      ultimoEnvio: data.criadoEm || new Date().toISOString(),
      ultimoPath: data.path || "",
      ultimoTamanho: data.tamanho || blob.size
    });
    try{ localStorage.setItem(LS_BACKUP_PENDENTE, "false"); }catch(e){}
    atualizarUIBackupNuvem();
    atualizarIndicadorAuto("ok");

  }catch(err){
    try{ localStorage.setItem(LS_BACKUP_PENDENTE, "true"); }catch(e){}
    atualizarIndicadorAuto("pendente");
    console.warn("[backup-auto] falha:", err.message);
  }finally{
    _autoEnviandoLocal = false;
  }
}

export function forcarBackupAgora(){
  if(_autoTimerLocal){ clearTimeout(_autoTimerLocal); _autoTimerLocal = null; }
  enviarBackupAuto();
}

export function atualizarIndicadorAuto(forcarEstado){
  const ind    = document.getElementById("cloudIndicador");
  const indTxt = document.getElementById("cloudIndTxt");
  if(!ind || !indTxt) return;

  const antigo = ind.querySelector(".cloud-btn-forcar");
  if(antigo) antigo.remove();

  const temBackend = !!(state.whatsapp.backendUrl && state.whatsapp.apiKey);
  if(!temBackend){
    ind.className = "cloud-indicador cinza";
    indTxt.textContent = "⚙️ Configure o WhatsApp para ativar";
    return;
  }

  if(!autoEstaOn()){
    ind.className = "cloud-indicador cinza";
    indTxt.textContent = "🔕 Backup automático desligado";
    let pendente = false;
    try{ pendente = localStorage.getItem(LS_BACKUP_PENDENTE) === "true"; }catch(e){}
    if(pendente){
      const btn = document.createElement("button");
      btn.className = "cloud-btn-forcar";
      btn.type = "button";
      btn.textContent = "🔄 Enviar agora";
      btn.addEventListener("click", forcarBackupAgora);
      ind.appendChild(btn);
      ind.className = "cloud-indicador laranja";
      indTxt.textContent = "⚠️ 1 mudança pendente";
    }
    return;
  }

  if(forcarEstado === "enviando" || _autoEnviandoLocal){
    ind.className = "cloud-indicador azul";
    indTxt.textContent = "⏳ Sincronizando...";
    return;
  }

  let pendente = false;
  try{ pendente = localStorage.getItem(LS_BACKUP_PENDENTE) === "true"; }catch(e){}

  if(pendente){
    ind.className = "cloud-indicador laranja";
    indTxt.textContent = "⚠️ 1 mudança pendente";
    const btn = document.createElement("button");
    btn.className = "cloud-btn-forcar";
    btn.type = "button";
    btn.textContent = "🔄 Forçar";
    btn.addEventListener("click", forcarBackupAgora);
    ind.appendChild(btn);
    return;
  }

  const meta = lerMetaBackupNuvem();
  if(!meta || !meta.ultimoEnvio){
    ind.className = "cloud-indicador cinza";
    indTxt.textContent = "💾 Nunca sincronizado";
    return;
  }
  ind.className = "cloud-indicador verde";
  indTxt.textContent = "💾 Sincronizado " + formatHaLegivel(meta.ultimoEnvio);
}

export function atualizarToggleAuto(){
  const sw = document.getElementById("cloudSwitchAuto");
  if(!sw) return;
  if(autoEstaOn()){
    sw.classList.add("on");
    sw.setAttribute("aria-checked", "true");
  } else {
    sw.classList.remove("on");
    sw.setAttribute("aria-checked", "false");
  }
}

export function alternarAuto(){
  const agora = !autoEstaOn();
  try{ localStorage.setItem(LS_BACKUP_AUTO, agora ? "on" : "off"); }catch(e){}
  atualizarToggleAuto();

  if(!agora){
    if(_autoTimerLocal){ clearTimeout(_autoTimerLocal); _autoTimerLocal = null; }
    atualizarIndicadorAuto();
  } else {
    let pendente = false;
    try{ pendente = localStorage.getItem(LS_BACKUP_PENDENTE) === "true"; }catch(e){}
    if(pendente && confirm("Houve mudanças enquanto o backup automático estava desligado.\n\nDeseja enviar um backup agora?")){
      forcarBackupAgora();
    }
    atualizarIndicadorAuto();
  }
}

/* =========================================================
   LISTA DE BACKUPS (v1.13)
   ========================================================= */
export async function abrirListaBackups(openOverlay){
  const cfg = state.whatsapp;
  if(!cfg.backendUrl || !cfg.apiKey){
    mostrarStatusNuvem("erro", "❌ Configure o WhatsApp antes de listar.");
    return;
  }
  openOverlay("overlayBackupList");

  const body = document.getElementById("backupListBody");
  body.innerHTML = '<div class="backup-list-carregando">⏳ Carregando...</div>';

  try{
    const resp = await fetch(cfg.backendUrl.replace(/\/+$/, "") + "/backup/list-all", {
      headers: { "x-api-key": cfg.apiKey }
    });
    const data = await resp.json().catch(() => ({}));
    if(!resp.ok || !data.ok){
      body.innerHTML = '<div class="backup-list-empty">❌ Erro ' + resp.status + ':<br>' +
        escapeHtml(data.error || "falha ao listar") + '</div>';
      return;
    }
    renderListaBackups(Array.isArray(data.backups) ? data.backups : []);
  }catch(err){
    body.innerHTML = '<div class="backup-list-empty">❌ Erro de rede:<br>' + escapeHtml(err.message) + '</div>';
  }
}

function renderListaBackups(backups){
  const body = document.getElementById("backupListBody");
  if(!backups.length){
    body.innerHTML = '<div class="backup-list-empty">📭 Nenhum backup encontrado no servidor.<br><br>Vá em <strong>☁️ Enviar agora</strong> para criar o primeiro.</div>';
    return;
  }
  body.innerHTML = "";
  backups.forEach(b => {
    const el = document.createElement("div");
    el.className = "backup-list-item";
    el.innerHTML =
      '<div class="backup-list-info">' +
        '<div class="backup-list-data">📅 ' + escapeHtml(formatDataHora(b.criado_em)) + '</div>' +
        '<div class="backup-list-device">📱 ' + escapeHtml(abreviarDeviceId(b.device_id)) + '</div>' +
        '<div class="backup-list-tamanho">' + escapeHtml(formatBytes(b.tamanho_bytes || 0)) + '</div>' +
      '</div>' +
      '<div class="backup-list-acoes">' +
        '<button class="backup-list-btn restaurar" type="button">📥 Restaurar</button>' +
        '<button class="backup-list-btn excluir" type="button">🗑️ Excluir</button>' +
      '</div>';
    el.querySelector(".restaurar").addEventListener("click", () => restaurarBackupPorPath(b.path, b.criado_em));
    el.querySelector(".excluir").addEventListener("click", () => excluirBackupPorPath(b.path));
    body.appendChild(el);
  });
}

export async function restaurarBackupPorPath(path, criadoEm, closeOverlay, renderGrid){
  const cfg = state.whatsapp;
  if(!cfg.backendUrl || !cfg.apiKey || !path) return;

  const ok = confirm("Restaurar este backup?\n\n📅 Data: " + formatDataHora(criadoEm) +
    "\n\n⚠️ Isto vai SUBSTITUIR TODOS os dados atuais pelos do backup.\nEsta ação NÃO pode ser desfeita.");
  if(!ok) return;

  const body = document.getElementById("backupListBody");
  body.innerHTML = '<div class="backup-list-carregando">⏳ Baixando backup...</div>';

  try{
    const resp = await fetch(cfg.backendUrl.replace(/\/+$/, "") +
      "/backup/download?path=" + encodeURIComponent(path), { headers: { "x-api-key": cfg.apiKey } });

    if(!resp.ok){
      const txt = await resp.text().catch(() => "");
      body.innerHTML = '<div class="backup-list-empty">❌ Erro ' + resp.status + ':<br>' + escapeHtml(txt || "falha ao baixar") + '</div>';
      return;
    }

    let dados;
    try{ dados = JSON.parse(await resp.text()); }
    catch(e){ body.innerHTML = '<div class="backup-list-empty">❌ Backup corrompido: JSON inválido.</div>'; return; }

    if(!dados || typeof dados !== "object" || !Array.isArray(dados.tipos) ||
       typeof dados.agenda !== "object" || !Array.isArray(dados.ferias)){
      body.innerHTML = '<div class="backup-list-empty">❌ Backup inválido: estrutura não reconhecida.</div>';
      return;
    }

    state.tipos  = dados.tipos;
    state.agenda = dados.agenda;
    state.ferias = dados.ferias;
    state.folgas = {};
    if(Array.isArray(dados.folgas)){
      dados.folgas.forEach(k => { state.folgas[k] = "dia-todo"; });
    } else if(dados.folgas && typeof dados.folgas === "object"){
      state.folgas = dados.folgas;
    }
    state.feriadosCustom = Array.isArray(dados.feriados_custom) ? dados.feriados_custom : [];
    state.clientes = [];
    if(Array.isArray(dados.clientes)){
      state.clientes = dados.clientes.filter(c =>
        c && typeof c === "object" && typeof c.nome === "string" && c.nome.trim() !== ""
      ).map(c => ({
        id: c.id || uid(),
        nome: c.nome.trim(),
        telefone: typeof c.telefone === "string" ? c.telefone : "",
        endereco: typeof c.endereco === "string" ? c.endereco : "",
        criadoEm: typeof c.criadoEm === "string" ? c.criadoEm : new Date().toISOString()
      }));
    }
    if(dados.config_domicilio && typeof dados.config_domicilio === "object"){
      state.configDomicilio = {
        taxa: (typeof dados.config_domicilio.taxa === "number" && dados.config_domicilio.taxa >= 0)
              ? dados.config_domicilio.taxa : CONFIG_DOM_PADRAO.taxa,
        duracao: (typeof dados.config_domicilio.duracao === "number" && dados.config_domicilio.duracao > 0)
              ? dados.config_domicilio.duracao : CONFIG_DOM_PADRAO.duracao
      };
    } else {
      state.configDomicilio = { ...CONFIG_DOM_PADRAO };
    }
    if(dados.lembretes_config && typeof dados.lembretes_config === "object"){
      if(dados.lembretes_config.modo === "manual" ||
         dados.lembretes_config.modo === "auto" ||
         dados.lembretes_config.modo === "ambos"){
        state.whatsapp.modo = dados.lembretes_config.modo;
      }
      if(typeof dados.lembretes_config.maxReenvios === "number"){
        state.whatsapp.maxReenvios = dados.lembretes_config.maxReenvios;
      }
      if(typeof dados.lembretes_config.intervaloReenvio === "number"){
        state.whatsapp.intervaloReenvio = dados.lembretes_config.intervaloReenvio;
      }
    }

    saveTipos(state); saveAgenda(state); saveFerias(state); saveFolgas(state);
    saveFeriadosCustom(state); saveConfigDomicilio(state); saveClientes(state); saveWhatsapp(state);

    renderGrid();
    atualizarUIBackupNuvem();
    atualizarIndicadorAuto();
    closeOverlay("overlayBackupList");
    closeOverlay("overlayBackup");
    alert("✅ Backup restaurado com sucesso!");
  }catch(err){
    body.innerHTML = '<div class="backup-list-empty">❌ Erro de rede:<br>' + escapeHtml(err.message) + '</div>';
  }
}

export async function excluirBackupPorPath(path, abrirListaBackupsFn){
  const cfg = state.whatsapp;
  if(!cfg.backendUrl || !cfg.apiKey || !path) return;
  if(!confirm("Excluir este backup?\n\n⚠️ O arquivo será removido permanentemente do servidor.\nEsta ação NÃO pode ser desfeita.")) return;

  try{
    const resp = await fetch(cfg.backendUrl.replace(/\/+$/, "") + "/backup/" + encodeURIComponent(path), {
      method: "DELETE",
      headers: { "x-api-key": cfg.apiKey }
    });
    const data = await resp.json().catch(() => ({}));
    if(!resp.ok || !data.ok){
      alert("❌ Erro ao excluir: " + (data.error || resp.status));
      return;
    }
    abrirListaBackupsFn();
  }catch(err){
    alert("❌ Erro de rede: " + err.message);
  }
}