/**
 * ui.js — v1.16.2
 * Overlays, tema, autocomplete, banner, select de horários.
 * Depende de: constants, helpers, state.
 */

import {
  LS_TEMA, SS_BANNER, MONTHS, PASSO
} from "./constants.js";

import {
  escapeHtml, todayKey, pad, horaMinutos, minutosHora,
  arredondarParaCima, formatDateBR
} from "./helpers.js";

import { state } from "./state.js";

/* =========================================================
   TEMA
   ========================================================= */
export function temaAtual(){
  return document.documentElement.getAttribute("data-theme") || "light";
}

export function aplicarTema(tema){
  document.documentElement.setAttribute("data-theme", tema);
  try{ localStorage.setItem(LS_TEMA, tema); }catch(e){}
  atualizarToggleTema();
}

export function alternarTema(){
  aplicarTema(temaAtual() === "dark" ? "light" : "dark");
}

export function atualizarToggleTema(){
  const icone  = document.getElementById("temaIcone");
  const titulo = document.getElementById("temaTitulo");
  const sub    = document.getElementById("temaSub");
  if(!icone) return;

  if(temaAtual() === "dark"){
    icone.textContent  = "☀️";
    titulo.textContent = "Modo claro";
    sub.textContent    = "Voltar para o tema claro";
  } else {
    icone.textContent  = "🌙";
    titulo.textContent = "Modo escuro";
    sub.textContent    = "Ativa o tema escuro do app";
  }
}

/* =========================================================
   OVERLAYS
   ========================================================= */
export function openOverlay(id){
  const el = document.getElementById(id);
  if(!el) return;
  el.classList.add("show");
  document.body.classList.add("overlay-open");
}

export function closeOverlay(id){
  const el = document.getElementById(id);
  if(!el) return;
  el.classList.remove("show");
  if(!document.querySelector(".overlay.show")){
    document.body.classList.remove("overlay-open");
  }
}

export function algumaOverlayAberta(){
  return !!document.querySelector(".overlay.show");
}

export function ligarFechamentoOverlays(){
  document.querySelectorAll("[data-close]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-close");
      closeOverlay(id);
    });
  });
  document.querySelectorAll(".overlay").forEach(ov => {
    ov.addEventListener("click", e => {
      if(e.target === ov) closeOverlay(ov.id);
    });
  });
}

/* =========================================================
   AUTOCOMPLETE
   ========================================================= */
const acDropdown = document.getElementById("acDropdown");
let acAtual = null;

export function fecharAc(){
  if(!acDropdown) return;
  acDropdown.classList.remove("show");
  acDropdown.innerHTML = "";
  acAtual = null;
}

function posicionarAc(inputEl){
  const r = inputEl.getBoundingClientRect();
  const maxH = 220;
  const espacoAbaixo = window.innerHeight - r.bottom - 8;
  const espacoAcima = r.top - 8;

  if(espacoAbaixo >= 80 || espacoAbaixo >= espacoAcima){
    acDropdown.style.top    = (r.bottom + 4) + "px";
    acDropdown.style.bottom = "auto";
    acDropdown.style.maxHeight = Math.min(maxH, Math.max(80, espacoAbaixo)) + "px";
  } else {
    acDropdown.style.bottom = (window.innerHeight - r.top + 4) + "px";
    acDropdown.style.top    = "auto";
    acDropdown.style.maxHeight = Math.min(maxH, Math.max(80, espacoAcima)) + "px";
  }
  acDropdown.style.left  = r.left + "px";
  acDropdown.style.width = r.width + "px";
}

function renderAc(itens, inputEl, telefoneEl, enderecoEl, onSelect){
  if(!itens.length){ fecharAc(); return; }
  acAtual = { inputEl, telefoneEl, enderecoEl, itens };
  acDropdown.innerHTML = "";

  itens.forEach(c => {
    const el = document.createElement("div");
    el.className = "ac-item";
    const cor = corAvatarPorNomeLocal(c.nome);
    const ini = inicialNomeLocal(c.nome);
    const telTxt = c.telefone ? escapeHtml(c.telefone) : "sem telefone";
    const telCls = c.telefone ? "" : " sem-tel";

    el.innerHTML =
      '<div class="ac-avatar" style="background:' + cor + '">' + escapeHtml(ini) + '</div>' +
      '<div class="ac-info">' +
        '<div class="ac-nome">' + escapeHtml(c.nome) + '</div>' +
        '<div class="ac-tel' + telCls + '">' + telTxt + '</div>' +
      '</div>';

    el.addEventListener("mousedown", e => {
      e.preventDefault();
      if(onSelect) onSelect(c);
      fecharAc();
      try{ inputEl.blur(); }catch(e){}
    });
    el.addEventListener("touchstart", e => {
      e.preventDefault();
      if(onSelect) onSelect(c);
      fecharAc();
      try{ inputEl.blur(); }catch(e){}
    }, {passive:false});

    acDropdown.appendChild(el);
  });

  posicionarAc(inputEl);
  acDropdown.classList.add("show");
}

function corAvatarPorNomeLocal(nome){
  const AV = ["#e57373","#f06292","#ba68c8","#9575cd","#7986cb",
              "#64b5f6","#4fc3f7","#4db6ac","#81c784","#dce775",
              "#ffb74d","#a1887f"];
  const s = (nome || "").trim().toLowerCase();
  if(!s) return AV[0];
  let h = 0;
  for(let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return AV[h % AV.length];
}
function inicialNomeLocal(nome){
  const s = (nome || "").trim();
  return s ? s.charAt(0).toUpperCase() : "?";
}

export function ligarAutocomplete(inputEl, telefoneEl, enderecoEl, buscarFn, onSelect, onInputCb){
  if(!inputEl) return;

  const handler = () => {
    const termo = inputEl.value.trim();
    if(termo.length < 1){ fecharAc(); return; }
    const itens = buscarFn(termo, 5);
    if(!itens.length){ fecharAc(); return; }
    renderAc(itens, inputEl, telefoneEl, enderecoEl, onSelect);
  };

  inputEl.addEventListener("input", handler);
  inputEl.addEventListener("focus", handler);
  inputEl.addEventListener("blur", () => setTimeout(fecharAc, 150));
  inputEl.addEventListener("keydown", e => { if(e.key === "Escape") fecharAc(); });

  if(onInputCb) inputEl.addEventListener("input", onInputCb);
}

/* =========================================================
   BANNER DE BOAS-VINDAS
   ========================================================= */
function contarClientesHoje(){
  const key = todayKey();
  const ags = state.agenda[key] || [];
  const agora = new Date();
  const agoraMin = agora.getHours()*60 + agora.getMinutes();
  let n = 0;

  ags.forEach(a => {
    if(!a) return;
    const temC1 = a.cliente && String(a.cliente).trim() !== "";
    const temC2 = a.duplo && !a.domicilio && a.cliente2 && String(a.cliente2).trim() !== "";
    if(!temC1 && !temC2) return;
    if(!a.hora){ if(temC1) n++; if(temC2) n++; return; }

    const h = horaMinutos(a.hora);
    if(h === null){ if(temC1) n++; if(temC2) n++; return; }

    if(temC1){
      const d1 = a.domicilio ? state.configDomicilio.duracao : (Number(a.duracao) > 0 ? Number(a.duracao) : 30);
      if(h + d1 > agoraMin) n++;
    }
    if(temC2){
      const d1 = Number(a.duracao) > 0 ? Number(a.duracao) : 30;
      const ini2 = arredondarParaCima(h + d1, PASSO);
      if(ini2 > agoraMin) n++;
    }
  });
  return n;
}

function saudacaoPorHora(){
  const h = new Date().getHours();
  if(h < 12) return "Bom dia";
  if(h < 18) return "Boa tarde";
  return "Boa noite";
}

function bannerJaMostradoHoje(){
  try{ return sessionStorage.getItem(SS_BANNER) === todayKey(); }catch(e){ return false; }
}
function marcarBannerMostrado(){
  try{ sessionStorage.setItem(SS_BANNER, todayKey()); }catch(e){}
}

export function mostrarBannerBoasVindas(){
  if(bannerJaMostradoHoje()) return;
  const n = contarClientesHoje();
  if(n === 0) return;

  const wrap = document.getElementById("bannerWrap");
  if(!wrap) return;

  const saud = saudacaoPorHora();
  const texto = n === 1
    ? (saud + "! Você ainda tem <strong>1 cliente</strong> hoje.")
    : (saud + "! Você ainda tem <strong>" + n + " clientes</strong> hoje.");

  wrap.innerHTML =
    '<div class="banner-boas-vindas" id="bannerBoasVindas">' +
      '<span class="bb-icon">📅</span>' +
      '<span class="bb-texto">' + texto + '</span>' +
      '<button class="bb-fechar" type="button" aria-label="Fechar">✕</button>' +
    '</div>';

  const banner = document.getElementById("bannerBoasVindas");
  const fechar = () => {
    if(!banner) return;
    banner.classList.add("saindo");
    setTimeout(() => { if(banner && banner.parentNode) banner.parentNode.removeChild(banner); }, 300);
  };
  banner.querySelector(".bb-fechar").addEventListener("click", fechar);
  setTimeout(fechar, 8000);
  marcarBannerMostrado();
}

/* =========================================================
   SELECT DE HORÁRIOS
   ========================================================= */
export function popularHorarios(valorAtual, idAtual){
  const sel = document.getElementById("agHora");
  if(!sel) return;
  sel.innerHTML = '<option value="">— Sem horário —</option>';

  const ocupados = {};
  const ags = state.agenda[currentDayKeyLocal()] || [];
  ags.forEach(ag => {
    if(!ag.hora) return;
    if(idAtual && ag.id === idAtual) return;

    const h = horaMinutos(ag.hora);
    if(h === null) return;
    let dur;
    if(ag.domicilio){ dur = state.configDomicilio.duracao; }
    else {
      const d1 = Number(ag.duracao) > 0 ? Number(ag.duracao) : 30;
      if(ag.duplo){
        const d2 = Number(ag.duracao2) > 0 ? Number(ag.duracao2) : 0;
        const ini2 = arredondarParaCima(h + d1, PASSO);
        dur = Math.max(h + d1, ini2 + d2) - h;
      } else {
        dur = d1;
      }
    }
    for(let t = h; t < h + dur; t += PASSO){
      ocupados[pad(Math.floor(t/60)) + ":" + pad(t % 60)] = true;
    }
  });

  const manha = [], tarde = [], noite = [];
  for(let h = 7; h <= 22; h++){
    const hh = pad(h);
    const slots = (h < 22) ? [hh+":00", hh+":15", hh+":30", hh+":45"] : [hh+":00"];
    slots.forEach(t => {
      const hhNum = parseInt(t.split(":")[0], 10);
      const opt = { value: t, label: t, ocupado: !!ocupados[t] };
      if(hhNum < 12) manha.push(opt);
      else if(hhNum < 18) tarde.push(opt);
      else noite.push(opt);
    });
  }

  let custom = null;
  if(valorAtual){
    const all = manha.concat(tarde, noite).map(o => o.value);
    if(all.indexOf(valorAtual) === -1) custom = valorAtual;
  }

  function addGroup(label, list){
    if(!list.length) return;
    const grp = document.createElement("optgroup");
    grp.label = label;
    list.forEach(o => {
      const opt = document.createElement("option");
      opt.value = o.value;
      opt.textContent = o.ocupado ? (o.label + "  (ocupado)") : o.label;
      grp.appendChild(opt);
    });
    sel.appendChild(grp);
  }

  if(custom){
    const grp = document.createElement("optgroup");
    grp.label = "Atual";
    const opt = document.createElement("option");
    opt.value = custom;
    opt.textContent = custom + " (atual)";
    grp.appendChild(opt);
    sel.appendChild(grp);
  }

  addGroup("Manhã", manha);
  addGroup("Tarde", tarde);
  addGroup("Noite", noite);
  sel.value = valorAtual || "";
}

let _currentDayKeyLocal = null;
export function setCurrentDayKeyLocal(k){ _currentDayKeyLocal = k; }
function currentDayKeyLocal(){ return _currentDayKeyLocal; }