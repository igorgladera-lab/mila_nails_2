/**
 * ferias.js — v1.16.2
 * CRUD de períodos de férias.
 * Depende de: helpers, storage, state, backup-nuvem.
 */

import { uid, escapeHtml, formatDateBR } from "./helpers.js";
import { saveFerias } from "./storage.js";
import { state } from "./state.js";
import { marcarMudanca } from "./backup-nuvem.js";

/* =========================================================
   UI — FORM
   ========================================================= */
export function openFeriasForm(feriasId, openOverlay){
  state.editingFeriasId = feriasId || null;
  const isEdit = !!feriasId;

  document.getElementById("feriasTitle").textContent = isEdit ? "Editar férias" : "Marcar férias";
  document.getElementById("btnDeleteFerias").style.display = isEdit ? "block" : "none";

  const listWrap = document.getElementById("feriasListWrap");
  listWrap.innerHTML = "";

  if(state.ferias.length > 0){
    const title = document.createElement("div");
    title.style.cssText = "font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;";
    title.textContent = "Períodos cadastrados";
    listWrap.appendChild(title);

    const sorted = state.ferias.slice().sort((a,b) => a.inicio.localeCompare(b.inicio));
    sorted.forEach(f => {
      const el = document.createElement("div");
      el.className = "vacation-list-item";
      const ini = formatDateBR(f.inicio);
      const fim = formatDateBR(f.fim || f.inicio);
      const sub = (f.fim && f.fim !== f.inicio) ? (ini + " até " + fim) : ini;
      el.innerHTML =
        '<div class="vl-info">' +
          '<div class="vl-title">🏖️ Período de férias</div>' +
          '<div class="vl-sub">' + escapeHtml(sub) + '</div>' +
        '</div>';
      el.addEventListener("click", () => openFeriasForm(f.id, openOverlay));
      listWrap.appendChild(el);
    });

    const hr = document.createElement("div");
    hr.style.cssText = "height:1px;background:var(--border);margin:12px 0;";
    listWrap.appendChild(hr);
  }

  if(isEdit){
    const f = state.ferias.find(x => x.id === feriasId);
    if(f){
      document.getElementById("feriasInicio").value = f.inicio || "";
      document.getElementById("feriasFim").value    = f.fim || "";
    }
  } else {
    document.getElementById("feriasInicio").value = state.currentDayKey || window.__milaCurrentDayKey || "";
    document.getElementById("feriasFim").value    = "";
  }

  openOverlay("overlayFerias");
}

/* =========================================================
   SALVAR / EXCLUIR
   ========================================================= */
export function salvarFerias(closeOverlay, renderGrid){
  const inicio = document.getElementById("feriasInicio").value;
  const fim    = document.getElementById("feriasFim").value;

  if(!inicio){ alert("Informe a data inicial."); return; }

  let fimFinal = fim || inicio;
  if(fimFinal < inicio){
    alert("A data final não pode ser anterior à data inicial.");
    return;
  }

  if(state.editingFeriasId){
    const idx = state.ferias.findIndex(x => x.id === state.editingFeriasId);
    if(idx >= 0){
      state.ferias[idx] = { id: state.editingFeriasId, inicio, fim: fimFinal };
    }
  } else {
    state.ferias.push({ id: uid(), inicio, fim: fimFinal });
  }

  saveFerias(state);
  marcarMudanca();
  closeOverlay("overlayFerias");
  renderGrid();
}

export function excluirFerias(closeOverlay, renderGrid){
  if(!state.editingFeriasId) return;
  if(!confirm("Remover este período de férias?")) return;

  state.ferias = state.ferias.filter(x => x.id !== state.editingFeriasId);
  saveFerias(state);
  marcarMudanca();
  closeOverlay("overlayFerias");
  renderGrid();
}