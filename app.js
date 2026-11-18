/**
 * app.js — v1.16.2
 * Orquestrador. Importa todos os módulos, liga eventos e chama boot().
 */

/* =========================================================
   IMPORTS
   ========================================================= */
import { LS_BACKUP_PENDENTE } from "./constants.js";
import { uid, pad, dateKey, todayKey, formatDateBR } from "./helpers.js";
import { load } from "./storage.js";
import { state, setStatusLembretes, setDataLembretesAtual, setCurrentDayKey, setAgDomicilioAtivo } from "./state.js";

import {
  obterDeviceId, atualizarUIBackupNuvem, mostrarStatusNuvem, esconderStatusNuvem,
  montarBackupObj, enviarBackupParaNuvem, autoEstaOn, marcarMudanca,
  enviarBackupAuto, atualizarIndicadorAuto, atualizarToggleAuto, alternarAuto,
  abrirListaBackups
} from "./backup-nuvem.js";

import {
  atualizarBotaoWhatsappFloat, abrirWhatsappConfig, salvarWhatsappConfig,
  abrirLembretes, carregarStatusLembretes, reenviarLembreteIndividual,
  enviarLembretesLote
} from "./lembretes.js";

import {
  setFolga,
  renderMonthLabel, renderGrid, openDayModal,
  feriadoNaData,
  setAbrirLembretesFn
} from "./agenda.js";

import {
  buscarClientesPorNome, oferecerCadastroAutomatico,
  oferecerAtualizarEnderecoCliente,
  openClientes, renderClientesList, openClienteForm,
  salvarCliente, excluirCliente
} from "./clientes.js";

import {
  openTipos, openTipoForm, salvarTipo, excluirTipo
} from "./tipos.js";

import {
  openFeriados, openFeriadoForm, salvarFeriado, excluirFeriado
} from "./feriados.js";

import { salvarFerias, excluirFerias, openFeriasForm } from "./ferias.js";

import {
  alternarTema, atualizarToggleTema,
  openOverlay, closeOverlay, algumaOverlayAberta, ligarFechamentoOverlays,
  fecharAc, ligarAutocomplete, mostrarBannerBoasVindas, popularHorarios
} from "./ui.js";

import { ligarWhatsappConfig } from "./whatsapp-config.js";

/* =========================================================
   PONTES / DEPENDÊNCIAS CIRCULARES
   ========================================================= */
setAbrirLembretesFn((dataKey, avisoForce) => abrirLembretes(dataKey, openOverlay));
window.__milaAbrirLembretes = () => abrirLembretes(null, openOverlay);

/* =========================================================
   TEMA
   ========================================================= */
const temaToggleEl = document.getElementById("temaToggle");
if(temaToggleEl){
  temaToggleEl.addEventListener("click", alternarTema);
  temaToggleEl.addEventListener("keydown", e => {
    if(e.key === "Enter" || e.key === " "){ e.preventDefault(); alternarTema(); }
  });
}

ligarFechamentoOverlays();

/* =========================================================
   BUSCA
   ========================================================= */
const inputBusca = document.getElementById("buscaCliente");

function abrirBusca(){
  inputBusca.value = state.buscaTermo || "";
  document.getElementById("btnLimparBusca").classList.toggle("show", inputBusca.value.length > 0);
  atualizarResultadoBusca();
  openOverlay("overlayBusca");
  setTimeout(() => {
    try{ inputBusca.focus({ preventScroll: true }); }catch(e){ inputBusca.focus(); }
  }, 100);
}

function atualizarResultadoBusca(){
  const el = document.getElementById("buscaResultado");
  const termo = (inputBusca.value || "").trim();
  if(!termo){ el.textContent = "Digite para filtrar"; return; }

  let n = 0;
  const y = state.viewYear, m = state.viewMonth;
  const diasNoMes = new Date(y, m+1, 0).getDate();
  for(let d = 1; d <= diasNoMes; d++){
    const key = dateKey(y, m, d);
    const ags = state.agenda[key] || [];
    if(ags.some(a => {
      const c1 = (a.cliente || "").toLowerCase();
      const c2 = a.duplo ? (a.cliente2 || "").toLowerCase() : "";
      return c1.indexOf(termo.toLowerCase()) !== -1 || c2.indexOf(termo.toLowerCase()) !== -1;
    })) n++;
  }
  el.innerHTML = '<span class="num">' + n + '</span>' +
    (n === 1 ? "dia encontrado neste mês" : "dias encontrados neste mês");
}

inputBusca.addEventListener("input", e => {
  document.getElementById("btnLimparBusca").classList.toggle("show", e.target.value.length > 0);
  atualizarResultadoBusca();
});

document.getElementById("btnLimparBusca").addEventListener("click", () => {
  inputBusca.value = "";
  document.getElementById("btnLimparBusca").classList.remove("show");
  atualizarResultadoBusca();
  try{ inputBusca.focus({ preventScroll: true }); }catch(e){ inputBusca.focus(); }
});

document.getElementById("btnOkBusca").addEventListener("click", () => {
  const termo = (inputBusca.value || "").trim();
  closeOverlay("overlayBusca");
  try{ inputBusca.blur(); }catch(e){}
  state.buscaTermo = termo;
  renderGrid();
});

document.getElementById("btnBuscaFloat").addEventListener("click", abrirBusca);
document.getElementById("btnLimparFiltro").addEventListener("click", () => {
  state.buscaTermo = "";
  renderGrid();
});

/* =========================================================
   MODAL DO DIA
   ========================================================= */
document.getElementById("chipFolga").addEventListener("click", (e) => {
  e.stopPropagation();
  if(!state.currentDayKey) return;
  closeOverlay("overlayDay");
  openOverlay("overlayFolga");
});

document.getElementById("btnVacation").addEventListener("click", (e) => {
  e.stopPropagation();
  closeOverlay("overlayDay");
  openFeriasForm(null, openOverlay);
});

document.getElementById("btnAddAg").addEventListener("click", (e) => {
  e.stopPropagation();
  closeOverlay("overlayDay");
  openAgForm(null);
});

/* =========================================================
   FOLGA
   ========================================================= */
document.getElementById("folgaOpDiaTodo").addEventListener("click", () => {
  const k = state.currentDayKey;
  if(!k) return;
  if(state.folgas[k] === "dia-todo") setFolga(k, null);
  else setFolga(k, "dia-todo");
  closeOverlay("overlayFolga");
  renderGrid();
});

document.getElementById("folgaOpPeriodo").addEventListener("click", () => {
  closeOverlay("overlayFolga");
  atualizarOverlayFolgaPeriodo();
  openOverlay("overlayFolgaPeriodo");
});

function atualizarOverlayFolgaPeriodo(){
  const k = state.currentDayKey;
  const opM = document.getElementById("folgaOpManha");
  const opT = document.getElementById("folgaOpTarde");
  opM.classList.remove("ativo"); opT.classList.remove("ativo");
  if(!k) return;
  const v = state.folgas[k];
  if(v === "manha" || v === "dia-todo" || v === "ambos") opM.classList.add("ativo");
  if(v === "tarde" || v === "dia-todo" || v === "ambos") opT.classList.add("ativo");
}

document.getElementById("folgaOpManha").addEventListener("click", () => {
  const k = state.currentDayKey;
  if(!k) return;
  const v = state.folgas[k];
  if(v === "manha") setFolga(k, null);
  else if(v === "dia-todo" || v === "ambos") setFolga(k, "tarde");
  else if(v === "tarde") setFolga(k, "ambos");
  else setFolga(k, "manha");
  closeOverlay("overlayFolgaPeriodo");
  renderGrid();
});

document.getElementById("folgaOpTarde").addEventListener("click", () => {
  const k = state.currentDayKey;
  if(!k) return;
  const v = state.folgas[k];
  if(v === "tarde") setFolga(k, null);
  else if(v === "dia-todo" || v === "ambos") setFolga(k, "manha");
  else if(v === "manha") setFolga(k, "ambos");
  else setFolga(k, "tarde");
  closeOverlay("overlayFolgaPeriodo");
  renderGrid();
});

document.getElementById("btnVoltarFolga").addEventListener("click", () => {
  closeOverlay("overlayFolgaPeriodo");
  openOverlay("overlayFolga");
});

document.getElementById("btnLimparFolga").addEventListener("click", () => {
  const k = state.currentDayKey;
  if(!k) return;
  setFolga(k, null);
  closeOverlay("overlayFolgaPeriodo");
  renderGrid();
});

/* =========================================================
   FORM AGENDAMENTO
   ========================================================= */
const chkDuplo = document.getElementById("agDuplo");
const checkDuploWrap = document.getElementById("checkDuploWrap");
const blocoCliente2 = document.getElementById("cliente2Bloco");
const cliente2Horario = document.getElementById("cliente2Horario");
const chipDomicilio = document.getElementById("chipDomicilio");
const chipDomicilioInfo = document.getElementById("chipDomicilioInfo");
const agEnderecoWrap = document.getElementById("agEnderecoWrap");
const agEndereco     = document.getElementById("agEndereco");
const btnAbrirMaps   = document.getElementById("btnAbrirMaps");
const inputAgCliente    = document.getElementById("agCliente");
const inputAgTelefone   = document.getElementById("agTelefone");
const inputAgCliente2   = document.getElementById("agCliente2");
const inputAgTelefone2  = document.getElementById("agTelefone2");

let agDomicilioAtivoLocal = false;

ligarAutocomplete(inputAgCliente, inputAgTelefone, agEndereco,
  buscarClientesPorNome,
  (c) => {
    inputAgCliente.value = c.nome;
    if(!inputAgTelefone.value.trim() && c.telefone) inputAgTelefone.value = c.telefone;
    if(agDomicilioAtivoLocal && agEndereco && !agEndereco.value.trim() && c.endereco){
      agEndereco.value = c.endereco;
      btnAbrirMaps.disabled = false;
    }
    atualizarHorarioCliente2Form();
  });

ligarAutocomplete(inputAgCliente2, inputAgTelefone2, null,
  buscarClientesPorNome,
  (c) => {
    inputAgCliente2.value = c.nome;
    if(!inputAgTelefone2.value.trim() && c.telefone) inputAgTelefone2.value = c.telefone;
  });

function toggleCliente2(){
  if(chkDuplo.checked && !agDomicilioAtivoLocal){
    blocoCliente2.classList.add("show");
    atualizarHorarioCliente2Form();
  } else {
    blocoCliente2.classList.remove("show");
  }
}
chkDuplo.addEventListener("change", toggleCliente2);

function atualizarHorarioCliente2Form(){
  if(agDomicilioAtivoLocal) return;
  const hora = document.getElementById("agHora").value;
  const dur1 = Number(document.getElementById("agDuracao").value);
  if(!hora){ cliente2Horario.textContent = "—"; cliente2Horario.classList.add("vazio"); return; }
  const h = horaMinutos(hora);
  if(h === null){ cliente2Horario.textContent = "—"; cliente2Horario.classList.add("vazio"); return; }
  const ini2 = arredondarParaCima(h + (dur1 > 0 ? dur1 : 30), PASSO);
  cliente2Horario.textContent = "início: " + minutosHora(ini2);
  cliente2Horario.classList.remove("vazio");
}
document.getElementById("agHora").addEventListener("change", atualizarHorarioCliente2Form);
document.getElementById("agDuracao").addEventListener("input", atualizarHorarioCliente2Form);

function atualizarChipDomicilio(){
  if(agDomicilioAtivoLocal){
    chipDomicilio.classList.add("ativo");
    chipDomicilioInfo.textContent = "Duração fixa de " + state.configDomicilio.duracao +
      " min · Taxa: " + formatBRL(state.configDomicilio.taxa);
    const durInput = document.getElementById("agDuracao");
    durInput.disabled = true;
    durInput.value = state.configDomicilio.duracao;
    checkDuploWrap.classList.add("desabilitado");
    if(chkDuplo.checked){ chkDuplo.checked = false; toggleCliente2(); }
    agEnderecoWrap.classList.add("show");
  } else {
    chipDomicilio.classList.remove("ativo");
    chipDomicilioInfo.textContent = "";
    document.getElementById("agDuracao").disabled = false;
    checkDuploWrap.classList.remove("desabilitado");
    const tipoId = document.getElementById("agTipo").value;
    const t = tipoId ? state.tipos.find(x => x.id === tipoId) : null;
    document.getElementById("agDuracao").value = (t && t.duracao) ? t.duracao : "";
    atualizarHorarioCliente2Form();
    agEnderecoWrap.classList.remove("show");
    agEndereco.value = "";
    btnAbrirMaps.disabled = true;
  }
}

function alternarDomicilio(){
  agDomicilioAtivoLocal = !agDomicilioAtivoLocal;
  setAgDomicilioAtivo(agDomicilioAtivoLocal);
  atualizarChipDomicilio();
  if(agDomicilioAtivoLocal && !agEndereco.value.trim()){
    const nome = inputAgCliente.value.trim();
    const c = state.clientes.find(x => x.nome.toLowerCase() === nome.toLowerCase());
    if(c && c.endereco){ agEndereco.value = c.endereco; btnAbrirMaps.disabled = false; }
  }
}
chipDomicilio.addEventListener("click", alternarDomicilio);
chipDomicilio.addEventListener("keydown", e => {
  if(e.key === "Enter" || e.key === " "){ e.preventDefault(); alternarDomicilio(); }
});

agEndereco.addEventListener("input", e => {
  btnAbrirMaps.disabled = e.target.value.trim().length === 0;
});

btnAbrirMaps.addEventListener("click", () => {
  const end = agEndereco.value.trim();
  if(!end) return;
  window.open("https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(end), "_blank");
});

function popularSelectTipo(sel, valorAtual){
  sel.innerHTML = '<option value="">— Sem tipo —</option>';
  state.tipos.forEach(t => {
    const opt = document.createElement("option");
    opt.value = t.id; opt.textContent = t.nome;
    sel.appendChild(opt);
  });
  sel.value = valorAtual || "";
  sel.dataset.tipoAnterior = valorAtual || "";
}

function openAgForm(agId){
  state.editingAgId = agId || null;
  const isEdit = !!agId;
  const k = state.currentDayKey;

  document.getElementById("agTitle").textContent = isEdit ? "Editar agendamento" : "Novo agendamento";
  document.getElementById("btnDeleteAg").style.display = isEdit ? "block" : "none";

  const selTipo  = document.getElementById("agTipo");
  const selTipo2 = document.getElementById("agTipo2");

  agDomicilioAtivoLocal = false;
  setAgDomicilioAtivo(false);

  if(isEdit){
    const ag = (state.agenda[k] || []).find(a => a.id === agId);
    if(ag){
      popularHorarios(ag.hora || "", ag.id);
      chkDuplo.checked = !!ag.duplo;
      popularSelectTipo(selTipo,  ag.tipoId  || "");
      popularSelectTipo(selTipo2, ag.tipoId2 || "");
      document.getElementById("agCliente").value   = ag.cliente || "";
      document.getElementById("agTelefone").value  = ag.telefone || "";
      document.getElementById("agDuracao").value   = ag.duracao || "";
      document.getElementById("agObs").value       = ag.obs || "";
      document.getElementById("agCliente2").value  = ag.cliente2 || "";
      document.getElementById("agTelefone2").value = ag.telefone2 || "";
      document.getElementById("agDuracao2").value  = ag.duracao2 || "";
      agDomicilioAtivoLocal = !!ag.domicilio;
      setAgDomicilioAtivo(agDomicilioAtivoLocal);
      agEndereco.value = ag.endereco || "";
      btnAbrirMaps.disabled = !(ag.endereco || "").trim();
    }
  } else {
    popularHorarios("", null);
    popularSelectTipo(selTipo,  "");
    popularSelectTipo(selTipo2, "");
    chkDuplo.checked = false;
    ["agCliente","agTelefone","agDuracao","agObs",
     "agCliente2","agTelefone2","agDuracao2"].forEach(id => document.getElementById(id).value = "");
    agEndereco.value = "";
    btnAbrirMaps.disabled = true;
  }

  atualizarChipDomicilio();
  toggleCliente2();
  fecharAc();
  openOverlay("overlayAg");
}

document.getElementById("agTipo").addEventListener("change", e => {
  const novoTipoId = e.target.value;
  const tipoAnteriorId = e.target.dataset.tipoAnterior || "";
  if(agDomicilioAtivoLocal){ e.target.dataset.tipoAnterior = novoTipoId; return; }
  if(novoTipoId !== tipoAnteriorId){
    const t = state.tipos.find(x => x.id === novoTipoId);
    if(t && t.duracao){
      document.getElementById("agDuracao").value = t.duracao;
      atualizarHorarioCliente2Form();
    }
  }
  e.target.dataset.tipoAnterior = novoTipoId;
});

document.getElementById("agTipo2").addEventListener("change", e => {
  const novoTipoId = e.target.value;
  const tipoAnteriorId = e.target.dataset.tipoAnterior || "";
  if(novoTipoId !== tipoAnteriorId){
    const t = state.tipos.find(x => x.id === novoTipoId);
    if(t && t.duracao) document.getElementById("agDuracao2").value = t.duracao;
  }
  e.target.dataset.tipoAnterior = novoTipoId;
});

document.getElementById("btnSaveAg").addEventListener("click", () => {
  const k = state.currentDayKey;
  
  if (!k) {
    alert("Erro: O dia não foi selecionado corretamente. Feche o modal e abra o dia novamente.");
    return;
  }

  const hora     = document.getElementById("agHora").value.trim();
  const cliente  = document.getElementById("agCliente").value.trim();
  const telefone = document.getElementById("agTelefone").value.trim();
  const tipoId   = document.getElementById("agTipo").value;
  const duracao  = document.getElementById("agDuracao").value;
  const obs      = document.getElementById("agObs").value.trim();
  const duplo    = chkDuplo.checked && !agDomicilioAtivoLocal;
  const domicilio = agDomicilioAtivoLocal;
  const endereco = agDomicilioAtivoLocal ? agEndereco.value.trim() : "";
  const cliente2  = (duplo && !domicilio) ? document.getElementById("agCliente2").value.trim() : "";
  const telefone2 = (duplo && !domicilio) ? document.getElementById("agTelefone2").value.trim() : "";
  const tipoId2   = (duplo && !domicilio) ? document.getElementById("agTipo2").value : "";
  const duracao2  = (duplo && !domicilio) ? document.getElementById("agDuracao2").value : "";

  const fer = feriadoNaData(k);
  if(fer){
    const tipo = fer.tipo === "nacional" ? "feriado nacional" : "feriado";
    if(!confirm("⚠ " + formatDateBR(k) + " é " + tipo + ":\n\n" + fer.nome + "\n\nDeseja continuar mesmo assim?")) return;
  }

  const ag = {
    id: state.editingAgId || uid(),
    hora, cliente, telefone, tipoId, obs,
    duplo, duracao: duracao ? Number(duracao) : null,
    cliente2: cliente2 || "", telefone2: telefone2 || "",
    tipoId2: tipoId2 || "", duracao2: duracao2 ? Number(duracao2) : null,
    domicilio, endereco
  };

  if(!state.agenda[k]) state.agenda[k] = [];

  if(state.editingAgId){
    const list = state.agenda[k];
    const idx = list.findIndex(a => a.id === state.editingAgId);
    if(idx >= 0) list[idx] = ag;
  } else {
    state.agenda[k].push(ag);
  }

  import("./storage.js").then(m => m.saveAgenda(state));
  marcarMudanca();
  closeOverlay("overlayAg");
  renderGrid();

  if(!state.editingAgId){
    setTimeout(() => {
      if(cliente && telefone) oferecerCadastroAutomatico(cliente, telefone, domicilio ? endereco : "");
      if(cliente2 && telefone2) oferecerCadastroAutomatico(cliente2, telefone2, "");
      if(domicilio && endereco && cliente) oferecerAtualizarEnderecoCliente(cliente, endereco);
    }, 200);
  }
});

document.getElementById("btnDeleteAg").addEventListener("click", () => {
  const k = state.currentDayKey;
  if(!k || !state.editingAgId) return;
  if(!confirm("Excluir este agendamento?")) return;
  state.agenda[k] = (state.agenda[k] || []).filter(a => a.id !== state.editingAgId);
  import("./storage.js").then(m => m.saveAgenda(state));
  marcarMudanca();
  closeOverlay("overlayAg");
  renderGrid();
});

/* =========================================================
   CLIENTES
   ========================================================= */
document.getElementById("btnAddCliente").addEventListener("click", () => openClienteForm(null, openOverlay));
document.getElementById("btnSaveCliente").addEventListener("click", () => salvarCliente(closeOverlay));
document.getElementById("btnDeleteCliente").addEventListener("click", () => excluirCliente(closeOverlay));

const inputBuscaListaCli = document.getElementById("buscaListaClientes");
inputBuscaListaCli.addEventListener("input", e => {
  document.getElementById("btnLimparBuscaClientes").classList.toggle("show", e.target.value.length > 0);
  renderClientesList(e.target.value);
});
document.getElementById("btnLimparBuscaClientes").addEventListener("click", () => {
  inputBuscaListaCli.value = "";
  document.getElementById("btnLimparBuscaClientes").classList.remove("show");
  renderClientesList("");
  try{ inputBuscaListaCli.focus({preventScroll:true}); }catch(e){}
});

/* =========================================================
   TIPOS
   ========================================================= */
document.getElementById("btnAddTipo").addEventListener("click", () => openTipoForm(null, openOverlay));
document.getElementById("btnSaveTipo").addEventListener("click", () => salvarTipo(closeOverlay, renderGrid));
document.getElementById("btnDeleteTipo").addEventListener("click", () => excluirTipo(closeOverlay, renderGrid, todayKey));

/* =========================================================
   FERIADOS
   ========================================================= */
document.getElementById("btnAddFeriado").addEventListener("click", () => openFeriadoForm(null, openOverlay));
document.getElementById("btnSaveFeriado").addEventListener("click", () => salvarFeriado(closeOverlay, renderGrid));
document.getElementById("btnDeleteFeriado").addEventListener("click", () => excluirFeriado(closeOverlay, renderGrid));

/* =========================================================
   FÉRIAS
   ========================================================= */
document.getElementById("btnSaveFerias").addEventListener("click", () => salvarFerias(closeOverlay, renderGrid));
document.getElementById("btnDeleteFerias").addEventListener("click", () => excluirFerias(closeOverlay, renderGrid));

/* =========================================================
   BACKUP — botões
   ========================================================= */
document.getElementById("btnBackupFloat").addEventListener("click", () => {
  atualizarToggleTema();
  atualizarUIBackupNuvem();
  atualizarToggleAuto();
  atualizarIndicadorAuto();
  esconderStatusNuvem();
  openOverlay("overlayBackup");
});

document.getElementById("cloudBtnEnviar").addEventListener("click", enviarBackupParaNuvem);
document.getElementById("cloudBtnVerTodos").addEventListener("click", () => abrirListaBackups(openOverlay, renderGrid)); // <-- renderGrid passado
document.getElementById("cloudSwitchAuto").addEventListener("click", alternarAuto);
document.getElementById("cloudSwitchAuto").addEventListener("keydown", e => {
  if(e.key === "Enter" || e.key === " "){ e.preventDefault(); alternarAuto(); }
});

// ... (resto do código de import/export e botões normais)

document.getElementById("btnConfig").addEventListener("click", () => openOverlay("overlayConfig"));
document.getElementById("cfgBtnClientes").addEventListener("click", () => { closeOverlay("overlayConfig"); openClientes(openOverlay); });
document.getElementById("cfgBtnTipos").addEventListener("click",    () => { closeOverlay("overlayConfig"); openTipos(openOverlay); });
document.getElementById("cfgBtnFeriados").addEventListener("click", () => { closeOverlay("overlayConfig"); openFeriados(openOverlay); });
document.getElementById("cfgBtnDomicilio").addEventListener("click", () => {
  closeOverlay("overlayConfig");
  document.getElementById("cfgTaxaDomicilio").value = Number(state.configDomicilio.taxa).toFixed(2);
  document.getElementById("cfgDuracaoDomicilio").value = state.configDomicilio.duracao;
  openOverlay("overlayDomicilio");
});
document.getElementById("cfgTaxaDomicilio").addEventListener("input", e => {
  let v = parseFloat(e.target.value);
  if(!isFinite(v) || v < 0) v = 0;
  state.configDomicilio.taxa = v;
  import("./storage.js").then(m => m.saveConfigDomicilio(state));
});
document.getElementById("cfgDuracaoDomicilio").addEventListener("input", e => {
  let v = parseInt(e.target.value, 10);
  if(!isFinite(v) || v <= 0) v = CONFIG_DOM_PADRAO.duracao;
  state.configDomicilio.duracao = v;
  import("./storage.js").then(m => m.saveConfigDomicilio(state));
});

ligarWhatsappConfig(openOverlay, closeOverlay);
document.getElementById("btnEnviarLembretes").addEventListener("click", enviarLembretesLote);

function irMesAnterior(){
  state.viewMonth--;
  if(state.viewMonth < 0){ state.viewMonth = 11; state.viewYear--; }
  renderMonthLabel(); renderGrid();
}
function irProximoMes(){
  state.viewMonth++;
  if(state.viewMonth > 11){ state.viewMonth = 0; state.viewYear++; }
  renderMonthLabel(); renderGrid();
}
document.getElementById("btnPrev").addEventListener("click", irMesAnterior);
document.getElementById("btnNext").addEventListener("click", irProximoMes);

document.getElementById("btnMonthPicker").addEventListener("click", () => {
  state.pickerYear = state.viewYear;
  renderMonthPicker();
  openOverlay("overlayMonth");
});

function renderMonthPicker(){
  document.getElementById("yearLabel").textContent = state.pickerYear;
  const grid = document.getElementById("monthGrid");
  grid.innerHTML = "";
  MONTHS.forEach((name, idx) => {
    const b = document.createElement("button");
    b.className = "month-btn";
    b.textContent = name;
    if(state.pickerYear === state.viewYear && idx === state.viewMonth) b.classList.add("current");
    b.addEventListener("click", () => {
      state.viewYear = state.pickerYear;
      state.viewMonth = idx;
      renderMonthLabel(); renderGrid();
      closeOverlay("overlayMonth");
    });
    grid.appendChild(b);
  });
}
document.getElementById("yearPrev").addEventListener("click", () => { state.pickerYear--; renderMonthPicker(); });
document.getElementById("yearNext").addEventListener("click", () => { state.pickerYear++; renderMonthPicker(); });

(function configurarSwipe(){
  const el = document.getElementById("calendarWrap");
  let startX = 0, startY = 0, startT = 0, tracking = false;

  el.addEventListener("touchstart", e => {
    if(algumaOverlayAberta()){ tracking = false; return; }
    if(e.touches.length !== 1){ tracking = false; return; }
    tracking = true;
    startX = e.touches[0].clientX; startY = e.touches[0].clientY; startT = Date.now();
  }, {passive:true});

  el.addEventListener("touchend", e => {
    if(!tracking) return;
    tracking = false;
    if(algumaOverlayAberta()) return;
    if(!e.changedTouches || !e.changedTouches.length) return;
    const dx = e.changedTouches[0].clientX - startX;
    const dy = e.changedTouches[0].clientY - startY;
    const dt = Date.now() - startT;
    const absX = Math.abs(dx), absY = Math.abs(dy);
    if(absX < 60) return;
    if(absX < absY * 1.5) return;
    if(dt > 600) return;
    if(dx < 0) irProximoMes(); else irMesAnterior();
  }, {passive:true});

  el.addEventListener("touchcancel", () => { tracking = false; }, {passive:true});
})();

window.addEventListener("resize", fecharAc);
window.addEventListener("scroll", fecharAc, true);
document.getElementById("calendarWrap").addEventListener("scroll", fecharAc, {passive:true});

function boot(){
  load(state);
  const now = new Date();
  state.viewYear  = now.getFullYear();
  state.viewMonth = now.getMonth();
  renderMonthLabel();
  renderGrid();
  atualizarToggleTema();
  atualizarBotaoWhatsappFloat();
  obterDeviceId();
  atualizarToggleAuto();
  atualizarIndicadorAuto();

  setInterval(() => atualizarIndicadorAuto(), 30 * 1000);

  try{
    const pendente = localStorage.getItem(LS_BACKUP_PENDENTE) === "true";
    if(pendente && autoEstaOn()){
      setTimeout(() => enviarBackupAuto(), 30 * 1000);
    }
  }catch(e){}

  setTimeout(mostrarBannerBoasVindas, 400);
}

boot();