/**
 * tipos.js — v1.16.2
 * CRUD de tipos de serviço + paleta de cores.
 * Depende de: constants, helpers, storage, state, backup-nuvem.
 */

import { PRESET_COLORS } from "./constants.js";
import { uid, escapeHtml } from "./helpers.js";
import { saveTipos } from "./storage.js";
import { state } from "./state.js";
import { marcarMudanca } from "./backup-nuvem.js";

let _openOverlayFn = null;

/* =========================================================
   UI — LISTA
   ========================================================= */
export function openTipos(openOverlay){
  if(typeof openOverlay === "function") _openOverlayFn = openOverlay;
  renderTiposList();
  (_openOverlayFn || openOverlay)("overlayTipos");
}

export function renderTiposList(){
  const body = document.getElementById("tiposBody");
  body.innerHTML = "";

  if(state.tipos.length === 0){
    body.innerHTML = '<div class="empty-msg">Nenhum tipo cadastrado ainda.<br>Toque em "+ Novo tipo" para começar.</div>';
    return;
  }

  state.tipos.forEach(t => {
    const el = document.createElement("div");
    el.className = "tipo-item";

    const meta = [];
    if(t.preco !== undefined && t.preco !== null && t.preco !== "")
      meta.push("R$ " + Number(t.preco).toFixed(2).replace(".", ","));
    if(t.duracao) meta.push(t.duracao + " min");

    el.innerHTML =
      '<div class="tipo-cor" style="background:' + t.cor + '"></div>' +
      '<div class="tipo-info">' +
        '<div class="tipo-nome">' + escapeHtml(t.nome || "(sem nome)") + '</div>' +
        (meta.length ? '<div class="tipo-meta">' + escapeHtml(meta.join(" · ")) + '</div>' : '') +
      '</div>';

    el.addEventListener("click", () => openTipoForm(t.id, _openOverlayFn));
    body.appendChild(el);
  });
}

/* =========================================================
   UI — PALETA DE CORES
   ========================================================= */
export function renderColorGrid(){
  const grid = document.getElementById("colorGrid");
  grid.innerHTML = "";

  PRESET_COLORS.forEach(c => {
    const sw = document.createElement("div");
    sw.className = "color-swatch" + (c === state.selectedColor ? " selected" : "");
    sw.style.background = c;
    sw.addEventListener("click", () => {
      state.selectedColor = c;
      renderColorGrid();
    });
    grid.appendChild(sw);
  });

  const custom = document.createElement("div");
  custom.className = "color-swatch custom";
  custom.textContent = "+";
  custom.title = "Escolher cor personalizada";
  custom.addEventListener("click", () => {
    const input = document.createElement("input");
    input.type = "color";
    input.value = state.selectedColor || "#7b1e3a";
    input.addEventListener("input", e => {
      state.selectedColor = e.target.value;
      renderColorGrid();
    });
    input.click();
  });
  grid.appendChild(custom);
}

/* =========================================================
   UI — FORM
   ========================================================= */
export function openTipoForm(tipoId, openOverlay){
  if(typeof openOverlay === "function") _openOverlayFn = openOverlay;
  const open = openOverlay || _openOverlayFn;
  if(typeof open !== "function"){
    console.error("openTipoForm: openOverlay não registrado");
    return;
  }

  state.editingTipoId = tipoId || null;
  const isEdit = !!tipoId;

  document.getElementById("tipoTitle").textContent = isEdit ? "Editar tipo" : "Novo tipo";
  document.getElementById("btnDeleteTipo").style.display = isEdit ? "block" : "none";

  if(isEdit){
    const t = state.tipos.find(x => x.id === tipoId);
    if(t){
      document.getElementById("tipoNome").value    = t.nome || "";
      document.getElementById("tipoPreco").value   = t.preco || "";
      document.getElementById("tipoDuracao").value = t.duracao || "";
      state.selectedColor = t.cor || PRESET_COLORS[0];
    }
  } else {
    document.getElementById("tipoNome").value    = "";
    document.getElementById("tipoPreco").value   = "";
    document.getElementById("tipoDuracao").value = "";
    state.selectedColor = PRESET_COLORS[state.tipos.length % PRESET_COLORS.length];
  }

  renderColorGrid();
  open("overlayTipo");
}

export function salvarTipo(closeOverlay, renderGrid){
  const nome    = document.getElementById("tipoNome").value.trim();
  const preco   = document.getElementById("tipoPreco").value;
  const duracao = document.getElementById("tipoDuracao").value;

  if(!nome){ alert("Digite um nome para o tipo."); return; }

  const tipo = {
    id: state.editingTipoId || uid(),
    nome,
    cor: state.selectedColor || PRESET_COLORS[0],
    preco: preco === "" ? null : Number(preco),
    duracao: duracao === "" ? null : Number(duracao)
  };

  if(state.editingTipoId){
    const idx = state.tipos.findIndex(t => t.id === state.editingTipoId);
    if(idx >= 0) state.tipos[idx] = tipo;
  } else {
    state.tipos.push(tipo);
  }

  saveTipos(state);
  marcarMudanca();
  closeOverlay("overlayTipo");
  renderTiposList();
  renderGrid();
}

export function excluirTipo(closeOverlay, renderGrid, todayKey){
  if(!state.editingTipoId) return;

  const hoje = todayKey();
  let count = 0;
  Object.keys(state.agenda).forEach(k => {
    if(k >= hoje){
      (state.agenda[k] || []).forEach(a => {
        if(a.tipoId === state.editingTipoId) count++;
        if(a.duplo && a.tipoId2 === state.editingTipoId) count++;
      });
    }
  });

  if(count > 0){
    alert("Não é possível excluir: este tipo está em uso em " + count + " agendamento(s) futuro(s).");
    return;
  }
  if(!confirm("Excluir este tipo?")) return;

  state.tipos = state.tipos.filter(t => t.id !== state.editingTipoId);
  saveTipos(state);
  marcarMudanca();
  closeOverlay("overlayTipo");
  renderTiposList();
  renderGrid();
}