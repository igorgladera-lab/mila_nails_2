/**
 * lembretes.js — v1.16.2
 * Tela de lembretes, status, reenvio individual (Opção A),
 * envio em lote (intocado).
 * Depende de: constants, helpers, storage, state, agenda, backup-nuvem.
 */

import { LS_WHATSAPP } from "./constants.js";
import {
  escapeHtml, formatDateLong, formatDateBR, formatDataHora,
  dataAmanhaKey, diaSemanaCurto
} from "./helpers.js";
import { saveWhatsapp } from "./storage.js";
import {
  state,
  setStatusLembretes, setDataLembretesAtual,
  dataLembretesAtual, statusLembretesAtual
} from "./state.js";
import { feriadoNaData, feriasNaData, folgaNaData } from "./agenda.js";

/* =========================================================
   WHATSAPP CONFIG
   ========================================================= */
export function atualizarBotaoWhatsappFloat(){
  const btn = document.getElementById("btnWhatsappFloat");
  if(!btn) return;
  const ok = state.whatsapp.ativo && state.whatsapp.backendUrl && state.whatsapp.apiKey;
  btn.style.display = ok ? "flex" : "none";
}

export function abrirWhatsappConfig(openOverlay){
  document.getElementById("waBackendUrl").value   = state.whatsapp.backendUrl || "";
  document.getElementById("waApiKey").value       = state.whatsapp.apiKey || "";
  document.getElementById("waAtivo").checked      = !!state.whatsapp.ativo;
  document.getElementById("waTemplateName").value = state.whatsapp.templateName || "confirmacao_agendamento";
  document.getElementById("waLanguageCode").value = state.whatsapp.languageCode || "pt_BR";
  document.getElementById("waModo").value            = state.whatsapp.modo || "ambos";
  document.getElementById("waMaxReenvios").value     = String(state.whatsapp.maxReenvios ?? 2);
  document.getElementById("waIntervaloReenvio").value = String(state.whatsapp.intervaloReenvio ?? 2);

  const statusEl = document.getElementById("waStatus");
  if(state.whatsapp.backendUrl && state.whatsapp.apiKey){
    statusEl.innerHTML = "✅ Configuração salva. URL: <strong>" + escapeHtml(state.whatsapp.backendUrl) + "</strong>";
  } else {
    statusEl.textContent = "Preencha a URL do backend e a API Key para ativar.";
  }
  openOverlay("overlayWhatsapp");
}

export function salvarWhatsappConfig(){
  const url  = document.getElementById("waBackendUrl").value.trim();
  const key  = document.getElementById("waApiKey").value.trim();
  const ativ = document.getElementById("waAtivo").checked;
  const tpl  = document.getElementById("waTemplateName").value.trim() || "confirmacao_agendamento";
  const lang = document.getElementById("waLanguageCode").value.trim() || "pt_BR";
  const modo = document.getElementById("waModo").value;
  const max  = parseInt(document.getElementById("waMaxReenvios").value, 10);
  const intv = parseInt(document.getElementById("waIntervaloReenvio").value, 10);

  if(ativ && (!url || !key)){ alert("Para ativar, preencha a URL do backend e a API Key."); return; }
  if(url && !/^https?:\/\//i.test(url)){ alert("A URL do backend deve começar com http:// ou https://"); return; }

  state.whatsapp = {
    backendUrl: url.replace(/\/+$/, ""),
    apiKey: key, ativo: ativ, templateName: tpl, languageCode: lang,
    modo: (modo === "manual" || modo === "auto" || modo === "ambos") ? modo : "ambos",
    maxReenvios: (isFinite(max) && max >= 0) ? max : 2,
    intervaloReenvio: (isFinite(intv) && intv > 0) ? intv : 2
  };
  saveWhatsapp(state);
  atualizarBotaoWhatsappFloat();
}

/* =========================================================
   ABRIR / CARREGAR / RENDER
   ========================================================= */
export function abrirLembretes(dataKey, openOverlay){
  dataKey = dataKey || dataAmanhaKey();
  setDataLembretesAtual(dataKey);
  document.getElementById("lembretesTitle").textContent = "Lembretes de " + formatDateLong(dataKey);
  document.getElementById("lembretesResultado").innerHTML = "";
  renderLembretesPreview(dataKey);
  carregarStatusLembretes(dataKey);
  openOverlay("overlayLembretes");
}

export async function carregarStatusLembretes(dataKey){
  const cfg = state.whatsapp;
  if(!cfg.backendUrl || !cfg.apiKey) return;
  try{
    const resp = await fetch(cfg.backendUrl.replace(/\/+$/, "") +
      "/lembretes-status?data=" + encodeURIComponent(dataKey), { headers: { "x-api-key": cfg.apiKey } });
    const data = await resp.json().catch(() => ({}));
    if(!resp.ok || !data.ok){ console.warn("[lembretes-status] erro:", data.error || resp.status); return; }

    const novo = {};
    (data.lembretes || []).forEach(l => { novo[l.telefone] = l; });
    setStatusLembretes(novo);
    if(dataLembretesAtual === dataKey) renderLembretesPreview(dataKey);
  }catch(err){
    console.warn("[lembretes-status] exceção:", err.message);
  }
}

function normalizarTel(tel){
  let n = tel ? String(tel).replace(/\D/g, "") : "";
  if(n && !n.startsWith("55") && n.length >= 10) n = "55" + n;
  return n;
}

export function renderLembretesPreview(dataKey){
  const body = document.getElementById("lembretesBody");
  body.innerHTML = "";

  const fer   = feriadoNaData(dataKey);
  const fer2  = feriasNaData(dataKey);
  const folga = folgaNaData(dataKey);

  if(fer){
    const el = document.createElement("div");
    el.className = "feriado-banner";
    el.innerHTML = '<span class="fb-icon">' + (fer.tipo === "nacional" ? "🇧🇷" : "🎉") + '</span><span>' +
      escapeHtml(fer.nome) + ' — o backend vai recusar o envio neste dia.</span>';
    body.appendChild(el);
  }
  if(fer2){
    const el = document.createElement("div");
    el.className = "vacation-banner";
    el.innerHTML = '<div class="vb-text">🏖️ Período de férias — o backend vai recusar o envio.</div>';
    body.appendChild(el);
  }
  if(folga){
    const el = document.createElement("div");
    el.className = "folga-banner";
    el.innerHTML = '<span class="fb-icon">🛌</span><span>Folga marcada (' + escapeHtml(folga) + ') — o backend vai recusar o envio.</span>';
    body.appendChild(el);
  }

  const ags = (state.agenda[dataKey] || []).slice();
  if(ags.length === 0){
    const el = document.createElement("div");
    el.className = "empty-msg";
    el.textContent = "Nenhum agendamento para este dia.";
    body.appendChild(el);
    return;
  }
  ags.sort((a,b) => (a.hora || "99:99").localeCompare(b.hora || "99:99"));

  ags.forEach(ag => {
    const tipo = state.tipos.find(t => t.id === ag.tipoId) || null;
    const nomeTipo = tipo ? tipo.nome : "Sem tipo";
    const tel = ag.telefone ? escapeHtml(ag.telefone) : "<em>sem telefone</em>";
    const telNorm = normalizarTel(ag.telefone);

    const el = document.createElement("div");
    el.className = "lembrete-item";
    el.style.borderLeftColor = tipo ? tipo.cor : "#bdbdbd";

    let extra = "";
    if(ag.duplo && !ag.domicilio && ag.cliente2){
      const tel2 = ag.telefone2 ? escapeHtml(ag.telefone2) : "<em>sem telefone</em>";
      extra = '<div class="ag-cliente2-bloco"><div class="ag-cliente2-head">' +
        '<div class="ag-hora2">2ª</div><div class="ag-cliente2">' + escapeHtml(ag.cliente2) + '</div>' +
        '</div><div class="ag-obs">📞 ' + tel2 + '</div></div>';
    }
    let endExtra = (ag.domicilio && ag.endereco) ? '<div class="ag-obs">📍 ' + escapeHtml(ag.endereco) + '</div>' : "";

    let statusHtml = "";
    let btnHtml = "";

    if(telNorm){
      const st = statusLembretesAtual[telNorm] || statusLembretesAtual[ag.telefone] || null;

      if(!st){
        statusHtml = '<div class="lembrete-status muted"><span>⏳ Aguardando envio</span></div>';
      } else if(st.respondeu){
        statusHtml = '<div class="lembrete-status ok"><span>✅ Respondeu' +
          (st.resposta_texto ? ': "' + escapeHtml(st.resposta_texto.slice(0, 80)) + '"' : '') + '</span></div>';
      } else if(st.motivo_bloqueio === "limite_atingido"){
        statusHtml = '<div class="lembrete-status warn"><span>⛔ Limite atingido (' +
          st.reenvios + '/' + (st.reenvios) + ')</span></div>';
      } else if(st.motivo_bloqueio === "intervalo_minimo"){
        const quando = st.proximo_envio_permitido_em
          ? formatDataHora(st.proximo_envio_permitido_em).slice(-5) : "—";
        const rotulo = st.reenvios > 0 ? "Reenviado " + st.reenvios + "x" : "Enviado";
        statusHtml = '<div class="lembrete-status warn"><span>⏳ ' + rotulo + ' · aguarde até ' + escapeHtml(quando) + '</span></div>';
        btnHtml = '<div class="lembrete-acoes"><button class="lembrete-btn reenviar aviso" type="button" ' +
          'data-tel="' + escapeHtml(telNorm) + '" ' +
          'data-nome="' + escapeHtml(ag.cliente || "") + '" ' +
          'data-hora="' + escapeHtml(ag.hora || "") + '" ' +
          'data-tipo="' + escapeHtml(nomeTipo) + '" ' +
          'data-aviso="1">🔁 Reenviar</button></div>';
      } else if(st.motivo_bloqueio === "dia_passou"){
        statusHtml = '<div class="lembrete-status muted"><span>📅 Dia já passou</span></div>';
      } else if(st.motivo_bloqueio === "config_desligado"){
        statusHtml = '<div class="lembrete-status muted"><span>⛔ Reenvio desligado</span></div>';
      } else if(st.reenvios > 0){
        statusHtml = '<div class="lembrete-status info"><span>🔁 Reenviado ' + st.reenvios + 'x</span></div>';
        btnHtml = '<div class="lembrete-acoes"><button class="lembrete-btn reenviar" type="button" ' +
          'data-tel="' + escapeHtml(telNorm) + '" data-nome="' + escapeHtml(ag.cliente || "") + '" ' +
          'data-hora="' + escapeHtml(ag.hora || "") + '" data-tipo="' + escapeHtml(nomeTipo) + '">🔁 Reenviar</button></div>';
      } else {
        statusHtml = '<div class="lembrete-status muted"><span>⏳ Aguardando resposta</span></div>';
        btnHtml = '<div class="lembrete-acoes"><button class="lembrete-btn reenviar" type="button" ' +
          'data-tel="' + escapeHtml(telNorm) + '" data-nome="' + escapeHtml(ag.cliente || "") + '" ' +
          'data-hora="' + escapeHtml(ag.hora || "") + '" data-tipo="' + escapeHtml(nomeTipo) + '">🔁 Reenviar</button></div>';
      }
    }

    el.innerHTML =
      '<div class="lembrete-head"><div class="lembrete-hora">' + escapeHtml(ag.hora || "--:--") + '</div>' +
      '<div class="lembrete-cliente">' + escapeHtml(ag.cliente || "(sem nome)") + '</div></div>' +
      '<div class="lembrete-tipo">' + escapeHtml(nomeTipo) + '</div>' +
      '<div class="ag-obs">📞 ' + tel + '</div>' +
      endExtra + extra + statusHtml + btnHtml;

    body.appendChild(el);
  });

  body.querySelectorAll(".lembrete-btn.reenviar").forEach(btn => {
    btn.addEventListener("click", () => {
      reenviarLembreteIndividual(btn.dataset.tel, btn.dataset.nome, dataKey, btn);
    });
  });
}

/* =========================================================
   REENVIO INDIVIDUAL — Opção A (v1.16.2 §6)
   ========================================================= */
export async function reenviarLembreteIndividual(telefone, nome, dataKey, btnEl){
  const cfg = state.whatsapp;
  if(!cfg.backendUrl || !cfg.apiKey) return;

  const avisoIntervalo = btnEl && btnEl.dataset.aviso === "1";
  const horaEnvio = btnEl ? btnEl.dataset.hora : "";
  const tipoEnvio = btnEl ? btnEl.dataset.tipo : "";
  const fer   = feriadoNaData(dataKey);
  const fer2  = feriasNaData(dataKey);
  const folga = folgaNaData(dataKey);
  const temAvisoDia = !!(fer || fer2 || folga);

  let msg = "Reenviar lembrete para " + (nome || "esta cliente") + "?";
  if(temAvisoDia){
    const partes = [];
    if(fer) partes.push("feriado (" + fer.nome + ")");
    if(fer2) partes.push("férias");
    if(folga) partes.push("folga");
    msg = "⚠️ Este dia tem " + partes.join(", ") + ".\n\n" + msg;
  }
  if(avisoIntervalo) msg = "⚠️ O intervalo mínimo entre envios não foi atingido.\n\n" + msg;
  if(!confirm(msg)) return;

  const forcar = avisoIntervalo || temAvisoDia;
  if(btnEl){ btnEl.disabled = true; btnEl.textContent = "⏳ Enviando..."; }

  try{
    const url = cfg.backendUrl.replace(/\/+$/, "") + "/send-reminder-individual";
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": cfg.apiKey },
      body: JSON.stringify({
        telefone, nome: nome || "", data: dataKey,
        dia_semana: diaSemanaCurto(dataKey),
        hora: horaEnvio, tipo: tipoEnvio, force: forcar
      })
    });
    const data = await resp.json().catch(() => ({}));

    if(resp.status === 409 && data.error === "intervalo_minimo_nao_atingido"){
      const forcar2 = confirm("O intervalo mínimo não foi atingido.\n\nDeseja realmente reenviar agora?");
      if(forcar2){
        const resp2 = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-api-key": cfg.apiKey },
          body: JSON.stringify({
            telefone, nome: nome || "", data: dataKey,
            dia_semana: diaSemanaCurto(dataKey),
            hora: horaEnvio, tipo: tipoEnvio, force: true
          })
        });
        const data2 = await resp2.json().catch(() => ({}));
        if(resp2.ok && data2.ok){ await carregarStatusLembretes(dataKey); return; }
        alert("❌ Erro: " + (data2.error || resp2.status));
      }
      if(btnEl){ btnEl.disabled = false; btnEl.textContent = "🔁 Reenviar"; }
      return;
    }

    if(!resp.ok || !data.ok){
      alert("❌ Erro: " + (data.error || resp.status) + (data.message ? "\n\n" + data.message : ""));
      if(btnEl){ btnEl.disabled = false; btnEl.textContent = "🔁 Reenviar"; }
      return;
    }
    await carregarStatusLembretes(dataKey);
  }catch(err){
    alert("❌ Erro de rede: " + err.message);
    if(btnEl){ btnEl.disabled = false; btnEl.textContent = "🔁 Reenviar"; }
  }
}

/* =========================================================
   ENVIO EM LOTE (intocado — v1.16.2 §3 Decisão 2)
   ========================================================= */
export async function enviarLembretesLote(){
  const cfg = state.whatsapp;
  if(!cfg.ativo || !cfg.backendUrl || !cfg.apiKey){ alert("Configure o WhatsApp antes de enviar."); return; }

  const dataKey = dataLembretesAtual || dataAmanhaKey();
  const ags = state.agenda[dataKey] || [];
  if(ags.length === 0){ alert("Não há agendamentos para este dia."); return; }

  const btn = document.getElementById("btnEnviarLembretes");
  const res = document.getElementById("lembretesResultado");
  btn.disabled = true; btn.textContent = "⏳ Enviando...";
  res.innerHTML = '<div class="busca-resultado">Contatando o backend...</div>';

  const fer   = feriadoNaData(dataKey);
  const fer2  = feriasNaData(dataKey);
  const folga = folgaNaData(dataKey);
  const temAviso = !!(fer || fer2 || folga);
  let force = false;

  if(temAviso){
    const partes = [];
    if(fer) partes.push("feriado (" + fer.nome + ")");
    if(fer2) partes.push("férias");
    if(folga) partes.push("folga");
    const ok = confirm("⚠️ Este dia tem " + partes.join(", ") + ".\n\nDeseja enviar os lembretes mesmo assim?");
    if(!ok){ btn.disabled = false; btn.textContent = "📲 Enviar lembretes"; res.innerHTML = ""; return; }
    force = true;
  }

  const payload = {
    dataKey, agenda: state.agenda, tipos: state.tipos, ferias: state.ferias,
    folgas: state.folgas, feriados_custom: state.feriadosCustom,
    config_domicilio: state.configDomicilio,
    templateName: cfg.templateName, languageCode: cfg.languageCode,
    auto: false, force
  };

  try{
    const resp = await fetch(cfg.backendUrl + "/send-reminders", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": cfg.apiKey },
      body: JSON.stringify(payload)
    });
    const data = await resp.json().catch(() => ({}));
    if(!resp.ok){
      res.innerHTML = '<div class="feriado-banner"><span class="fb-icon">⚠️</span><span>Erro ' +
        resp.status + ': ' + escapeHtml(data.error || "falha no backend") + '</span></div>';
      return;
    }

    let html = '<div class="config-secao" style="margin-top:12px;"><div class="config-titulo">📊 Resultado</div>' +
      '<div style="font-size:14px;margin-bottom:8px;">✅ Enviados: <strong>' + (data.enviados || 0) +
      '</strong><br>⏭️ Ignorados: <strong>' + (data.ignorados || 0) + '</strong>';
    if(data.motivo) html += '<br><em>' + escapeHtml(data.motivo) + '</em>';
    html += '</div>';
    if(Array.isArray(data.resultados) && data.resultados.length > 0){
      html += '<div style="font-size:12px;color:var(--muted);max-height:180px;overflow-y:auto;">';
      data.resultados.forEach(r => {
        const st = r.status === "enviado" ? "✅" : (r.status === "ignorado" ? "⏭️" : "❌");
        html += '<div class="wa-resultado-item">' + st + ' ' + escapeHtml(r.cliente || "") +
          (r.motivo ? ' — <em>' + escapeHtml(r.motivo) + '</em>' : '') + '</div>';
      });
      html += '</div>';
    }
    html += '</div>';
    res.innerHTML = html;
    await carregarStatusLembretes(dataKey);
  }catch(err){
    res.innerHTML = '<div class="feriado-banner"><span class="fb-icon">⚠️</span><span>Erro de rede: ' +
      escapeHtml(err.message) + '</span></div>';
  }finally{
    btn.disabled = false; btn.textContent = "📲 Enviar lembretes";
  }
}