/**
 * feriados.js — v1.16.2
 * CRUD de feriados customizados + listagem de nacionais.
 * Depende de: constants, helpers, storage, state, backup-nuvem.
 */

import { FERIADOS_NACIONAIS } from "./constants.js";
import { uid, pad, escapeHtml } from "./helpers.js";
import { saveFeriadosCustom } from "./storage.js";
import { state } from "./state.js";
import { marcarMudanca } from "./backup-nuvem.js";

/* =========================================================
   UI — LISTA
   ========================================================= */
export function openFeriados(openOverlay){
  renderFeriadosNacionais();
  renderFeriadosCustom();
  openOverlay("overlayFeriados");
}

export function renderFeriadosNacionais(){
  const el = document.getElementById("feriadosNacionaisBody");
  const sorted = FERIADOS_NACIONAIS.slice().sort((a,b) => (a.mes-b.mes) || (a.dia-b.dia));
  el.innerHTML = sorted.map(f =>
    '<div style="padding:3px 0;">' + pad(f.dia) + "/" + pad(f.mes) + " — " + escapeHtml(f.nome) + '</div>'
  ).join("");
}

export function renderFeriadosCustom(){
  const body = document.getElementById("feriadosBody");
  body.innerHTML = "";

  if(state.feriadosCustom.length === 0){
    body.innerHTML = '<div class="empty-msg">Nenhum feriado cadastrado ainda.<br>Toque em "+ Novo feriado" para começar.</div>';
    return;
  }

  const sorted = state.feriadosCustom.slice().sort((a,b) => (a.mes-b.mes) || (a.dia-b.dia));
  sorted.forEach(f => {
    const el = document.createElement("div");
    el.className = "feriado-item";
    const meta = f.anual ? "Anual (repete todo ano)" : ("Somente " + (f.ano || "—"));

    el.innerHTML =
      '<div class="feriado-cor">' + pad(f.dia) + '/' + pad(f.mes) + '</div>' +
      '<div class="feriado-info">' +
        '<div class="feriado-nome">' + escapeHtml(f.nome || "(sem nome)") + '</div>' +
        '<div class="feriado-meta">' + escapeHtml(meta) + '</div>' +
      '</div>';

    el.addEventListener("click", () => openFeriadoForm(f.id));
    body.appendChild(el);
  });
}

/* =========================================================
   UI — FORM
   ========================================================= */
export function openFeriadoForm(feriadoId, openOverlay){
  state.editingFeriadoId = feriadoId || null;
  const isEdit = !!feriadoId;

  document.getElementById("feriadoTitle").textContent = isEdit ? "Editar feriado" : "Novo feriado";
  document.getElementById("btnDeleteFeriado").style.display = isEdit ? "block" : "none";

  if(isEdit){
    const f = state.feriadosCustom.find(x => x.id === feriadoId);
    if(f){
      document.getElementById("feriadoNome").value = f.nome || "";
      document.getElementById("feriadoDia").value  = f.dia || "";
      document.getElementById("feriadoMes").value  = f.mes || 1;
      document.getElementById("feriadoAnual").checked = !!f.anual;
    }
  } else {
    document.getElementById("feriadoNome").value = "";
    document.getElementById("feriadoDia").value  = "";
    document.getElementById("feriadoMes").value  = new Date().getMonth() + 1;
    document.getElementById("feriadoAnual").checked = false;
  }

  openOverlay("overlayFeriado");
}

export function salvarFeriado(closeOverlay, renderGrid){
  const nome  = document.getElementById("feriadoNome").value.trim();
  const dia   = parseInt(document.getElementById("feriadoDia").value, 10);
  const mes   = parseInt(document.getElementById("feriadoMes").value, 10);
  const anual = document.getElementById("feriadoAnual").checked;

  if(!nome){ alert("Digite um nome para o feriado."); return; }
  if(!dia || dia < 1 || dia > 31){ alert("Informe um dia válido (1 a 31)."); return; }

  const anoAtual = new Date().getFullYear();
  const feriado = {
    id: state.editingFeriadoId || uid(),
    nome, dia, mes,
    anual: !!anual,
    ano: anual ? null : anoAtual
  };

  if(state.editingFeriadoId){
    const idx = state.feriadosCustom.findIndex(x => x.id === state.editingFeriadoId);
    if(idx >= 0) state.feriadosCustom[idx] = feriado;
  } else {
    state.feriadosCustom.push(feriado);
  }

  saveFeriadosCustom(state);
  closeOverlay("overlayFeriado");
  renderFeriadosCustom();
  renderGrid();
}

export function excluirFeriado(closeOverlay, renderGrid){
  if(!state.editingFeriadoId) return;
  if(!confirm("Excluir este feriado?")) return;

  state.feriadosCustom = state.feriadosCustom.filter(x => x.id !== state.editingFeriadoId);
  saveFeriadosCustom(state);
  closeOverlay("overlayFeriado");
  renderFeriadosCustom();
  renderGrid();
}