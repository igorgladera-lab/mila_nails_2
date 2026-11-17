/**
 * agenda.js — v1.16.2
 * Renderização do calendário, modal do dia, form de agendamento,
 * folga, férias (helpers de domínio de data), botão "enviar dia futuro".
 */

import {
  FERIADOS_NACIONAIS, PASSO, SS_BANNER
} from "./constants.js";

import {
  escapeHtml, dateKey, todayKey, formatDateLong, formatDateBR,
  periodOf, horaMinutos, minutosHora, arredondarParaCima,
  formatBRL, diaSemanaCurto
} from "./helpers.js";

import { saveAgenda, saveFolgas, saveFerias } from "./storage.js";

import {
  state,
  setCurrentDayKey, setAgDomicilioAtivo
} from "./state.js";

import { marcarMudanca } from "./backup-nuvem.js";

/* =========================================================
   HELPERS DE DOMÍNIO
   ========================================================= */
export function duracao1Min(ag){
  if(ag && ag.domicilio) return state.configDomicilio.duracao;
  const d = Number(ag.duracao);
  return d > 0 ? d : 30;
}
export function duracao2Min(ag){
  if(!ag.duplo) return 0;
  if(ag.domicilio) return 0;
  const d = Number(ag.duracao2);
  return d > 0 ? d : 0;
}
export function inicioCliente2Min(ag){
  if(!ag.duplo) return null;
  if(ag.domicilio) return null;
  const h = horaMinutos(ag.hora);
  if(h === null) return null;
  return arredondarParaCima(h + duracao1Min(ag), PASSO);
}
export function intervaloMinutos(ag){
  const h = horaMinutos(ag.hora);
  if(h === null) return null;
  if(ag.domicilio){
    const dur = state.configDomicilio.duracao;
    return { start: h, end: h + dur };
  }
  const d1 = duracao1Min(ag);
  const d2 = duracao2Min(ag);
  if(ag.duplo){
    const ini2 = arredondarParaCima(h + d1, PASSO);
    return { start: h, end: Math.max(h + d1, ini2 + d2) };
  }
  return { start: h, end: h + d1 };
}
export function overlaps(a, b){
  const ia = intervaloMinutos(a);
  const ib = intervaloMinutos(b);
  if(!ia || !ib) return false;
  return ia.start < ib.end && ib.start < ia.end;
}
export function feriasNaData(key){
  return state.ferias.find(f => {
    const ini = f.inicio, fim = f.fim || f.inicio;
    return key >= ini && key <= fim;
  }) || null;
}
export function folgaNaData(key){ return state.folgas[key] || null; }
export function temFolgaDiaTodo(key){
  const v = state.folgas[key];
  return v === "dia-todo" || v === "ambos";
}
export function temFolgaManha(key){
  const v = state.folgas[key];
  return v === "manha" || v === "dia-todo" || v === "ambos";
}
export function temFolgaTarde(key){
  const v = state.folgas[key];
  return v === "tarde" || v === "dia-todo" || v === "ambos";
}
export function setFolga(key, tipo){
  if(!tipo) delete state.folgas[key];
  else state.folgas[key] = tipo;
  saveFolgas(state);
  marcarMudanca();
}
export function feriadoNaData(key){
  if (!key) return null; // Proteção extra
  const [y,m,d] = key.split("-").map(Number);
  for(const f of FERIADOS_NACIONAIS){
    if(f.mes === m && f.dia === d) return { tipo: "nacional", nome: f.nome };
  }
  for(const f of state.feriadosCustom){
    if(f.mes === m && f.dia === d){
      if(f.anual) return { tipo: "custom", nome: f.nome };
      if(f.ano === y) return { tipo: "custom", nome: f.nome };
    }
  }
  return null;
}

/* =========================================================
   RENDER DO CALENDÁRIO
   ========================================================= */
export function renderMonthLabel(){
  document.getElementById("monthLabel").textContent =
    ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto",
     "setembro","outubro","novembro","dezembro"][state.viewMonth] + " " + state.viewYear;
}

export function renderFiltroBanner(){
  const banner = document.getElementById("filtroBanner");
  const texto  = document.getElementById("filtroTexto");
  const termo  = (state.buscaTermo || "").trim();

  if(termo){
    const n = contarDiasComMatch(termo);
    texto.textContent = '🔍 Buscando: "' + termo + '" — ' + n + (n === 1 ? " dia" : " dias");
    banner.classList.add("show");
    document.body.classList.add("filtro-ativo");
    document.getElementById("btnBuscaFloat").classList.add("ativo");
  } else {
    banner.classList.remove("show");
    document.body.classList.remove("filtro-ativo");
    document.getElementById("btnBuscaFloat").classList.remove("ativo");
  }
}

function contarDiasComMatch(termo){
  if(!termo) return 0;
  termo = termo.toLowerCase();
  const y = state.viewYear, m = state.viewMonth;
  const diasNoMes = new Date(y, m+1, 0).getDate();
  let n = 0;
  for(let d = 1; d <= diasNoMes; d++){
    const key = dateKey(y, m, d);
    const ags = state.agenda[key] || [];
    if(ags.some(a => {
      const c1 = (a.cliente || "").toLowerCase();
      const c2 = a.duplo ? (a.cliente2 || "").toLowerCase() : "";
      return c1.indexOf(termo) !== -1 || c2.indexOf(termo) !== -1;
    })) n++;
  }
  return n;
}

export function renderGrid(){
  const grid = document.getElementById("grid");
  grid.innerHTML = "";

  const y = state.viewYear, m = state.viewMonth;
  const firstDay = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m+1, 0).getDate();
  const daysInPrev  = new Date(y, m, 0).getDate();
  const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7;
  const today = todayKey();
  const termo = (state.buscaTermo || "").trim().toLowerCase();

  for(let i = 0; i < totalCells; i++){
    const cell = document.createElement("div");
    cell.className = "day";

    let dayNum, cellMonth = m, cellYear = y;

    if(i < firstDay){
      dayNum = daysInPrev - firstDay + 1 + i;
      cellMonth = m - 1;
      if(cellMonth < 0){ cellMonth = 11; cellYear--; }
      cell.classList.add("other-month");
    } else if(i >= firstDay + daysInMonth){
      dayNum = i - (firstDay + daysInMonth) + 1;
      cellMonth = m + 1;
      if(cellMonth > 11){ cellMonth = 0; cellYear++; }
      cell.classList.add("other-month");
    } else {
      dayNum = i - firstDay + 1;
    }

    const cellKey = dateKey(cellYear, cellMonth, dayNum);
    if(cellKey === today) cell.classList.add("today");

    const f = feriasNaData(cellKey);
    if(f) cell.classList.add("vacation");

    const folga = folgaNaData(cellKey);
    if(folga === "dia-todo" || folga === "ambos") cell.classList.add("folga-dia-todo");

    const fer = feriadoNaData(cellKey);
    if(fer) cell.classList.add("feriado");

    if(termo){
      const ags = state.agenda[cellKey] || [];
      const temMatch = ags.some(a => {
        const c1 = (a.cliente || "").toLowerCase();
        const c2 = a.duplo ? (a.cliente2 || "").toLowerCase() : "";
        return c1.indexOf(termo) !== -1 || c2.indexOf(termo) !== -1;
      });
      cell.classList.add(temMatch ? "destaque-busca" : "sem-match");
    }

    const numEl = document.createElement("div");
    numEl.className = "day-number";
    numEl.textContent = dayNum;
    cell.appendChild(numEl);

    let iconHTML = "";
    if(fer) iconHTML += fer.tipo === "nacional" ? "🇧🇷" : "🎉";
    if(f)   iconHTML += (iconHTML ? " " : "") + "🏖️";
    if(folga) iconHTML += (iconHTML ? " " : "") + "🛌";
    if(iconHTML){
      const icon = document.createElement("div");
      icon.className = "vacation-icon";
      icon.textContent = iconHTML;
      cell.appendChild(icon);
    }

    renderDaySlots(cell, state.agenda[cellKey] || [], cellKey);
    cell.addEventListener("click", () => openDayModal(cellKey));
    grid.appendChild(cell);
  }
  renderFiltroBanner();
}

function renderDaySlots(cell, ags, cellKey){
  const byPeriod = {0:[],1:[],2:[],3:[]};
  ags.forEach(a => byPeriod[periodOf(a.hora)].push(a));
  [0,1,2,3].forEach(p => byPeriod[p].sort((a,b) => (a.hora||"").localeCompare(b.hora||"")));

  const folgaManha = temFolgaManha(cellKey);
  const folgaTarde = temFolgaTarde(cellKey);
  const periodsToRender = [1,2,3];
  if(byPeriod[0].length > 0) periodsToRender.unshift(0);

  periodsToRender.forEach(p => {
    const slot = document.createElement("div");
    slot.className = "slot";
    if(byPeriod[p].length > 0) slot.classList.add("has-items");
    if(p === 1 && folgaManha) slot.classList.add("folga-manha");
    if(p === 2 && folgaTarde) slot.classList.add("folga-tarde");

    groupIntoRows(byPeriod[p]).forEach(rowItems => {
      rowItems.forEach(ag => {
        if(ag.duplo && !ag.domicilio){
          const t1 = state.tipos.find(t => t.id === ag.tipoId);
          const t2 = ag.tipoId2 ? state.tipos.find(t => t.id === ag.tipoId2) : null;
          const cor1 = t1 ? t1.cor : "#bdbdbd";
          const cor2 = t2 ? t2.cor : "#90caf9";
          const r1 = document.createElement("div"); r1.className = "slot-row";
          const l1 = document.createElement("div"); l1.className = "line"; l1.style.background = cor1;
          r1.appendChild(l1); slot.appendChild(r1);
          const r2 = document.createElement("div"); r2.className = "slot-row";
          const l2 = document.createElement("div"); l2.className = "line"; l2.style.background = cor2;
          r2.appendChild(l2); slot.appendChild(r2);
        } else {
          const row = document.createElement("div"); row.className = "slot-row";
          const line = document.createElement("div"); line.className = "line";
          const tipo = state.tipos.find(t => t.id === ag.tipoId);
          const cor = tipo ? tipo.cor : "#bdbdbd";
          if(ag.domicilio){
            line.style.backgroundImage = "repeating-linear-gradient(45deg," + cor + " 0," + cor + " 3px,rgba(255,255,255,.55) 3px,rgba(255,255,255,.55) 6px)";
          } else {
            line.style.background = cor;
          }
          row.appendChild(line); slot.appendChild(row);
        }
      });
    });
    cell.appendChild(slot);
  });
}

function groupIntoRows(items){
  const rows = [];
  items.forEach(ag => {
    let placed = false;
    for(const row of rows){
      if(row.some(other => overlaps(ag, other))){ row.push(ag); placed = true; break; }
    }
    if(!placed) rows.push([ag]);
  });
  return rows;
}

/* =========================================================
   MODAL DO DIA
   ========================================================= */
export function openDayModal(key){
  setCurrentDayKey(key); // Atualiza no state.js
  document.getElementById("dayTitle").textContent = formatDateLong(key);
  renderDayBody();
  atualizarChipFolga();
  document.getElementById("overlayDay").classList.add("show");
  document.body.classList.add("overlay-open");
}

export function atualizarChipFolga(){
  const chip = document.getElementById("chipFolga");
  if(!state.currentDayKey){ chip.classList.remove("ativo"); return; }
  if(folgaNaData(state.currentDayKey)) chip.classList.add("ativo");
  else chip.classList.remove("ativo");
}

export function renderDayBody(){
  const body = document.getElementById("dayBody");
  body.innerHTML = "";

  const currentDayKey = state.currentDayKey; // Lê do state global

  const fer = feriadoNaData(currentDayKey);
  if(fer){
    const b = document.createElement("div");
    b.className = "feriado-banner";
    b.innerHTML = '<span class="fb-icon">' + (fer.tipo === "nacional" ? "🇧🇷" : "🎉") + '</span><span>' + escapeHtml(fer.nome) + '</span>';
    body.appendChild(b);
  }
  const folga = folgaNaData(currentDayKey);
  if(folga){
    const b = document.createElement("div");
    b.className = "folga-banner";
    let txt = "🛌 Folga";
    if(folga === "manha") txt = "☀️ Folga pela manhã";
    else if(folga === "tarde") txt = "🌙 Folga pela tarde";
    else if(folga === "dia-todo" || folga === "ambos") txt = "🛌 Folga o dia inteiro";
    b.innerHTML = '<span class="fb-icon">🛌</span><span>' + txt + '</span>';
    body.appendChild(b);
  }
  const f = feriasNaData(currentDayKey);
  if(f){
    const b = document.createElement("div");
    b.className = "vacation-banner";
    const ini = formatDateBR(f.inicio), fim = formatDateBR(f.fim || f.inicio);
    const txt = (f.fim && f.fim !== f.inicio) ? ("🏖️ Férias: " + ini + " até " + fim) : ("🏖️ Férias em " + ini);
    b.innerHTML = '<div class="vb-text">' + escapeHtml(txt) + '</div><button type="button">Editar</button>';
    b.querySelector("button").addEventListener("click", (e) => {
      e.stopPropagation();
      document.getElementById("overlayDay").classList.remove("show");
      openFeriasForm(f.id);
    });
    body.appendChild(b);
  }

  const ags = (state.agenda[currentDayKey] || []).slice();
  if(ags.length === 0){
    const empty = document.createElement("div");
    empty.className = "empty-msg";
    empty.textContent = "Nenhum agendamento neste dia.";
    body.appendChild(empty);
    renderBotaoEnviarDiaFuturo(body, abrirLembretesFn);
    return;
  }
  ags.sort((a,b) => (a.hora || "99:99").localeCompare(b.hora || "99:99"));

  ags.forEach(ag => {
    const tipo = state.tipos.find(t => t.id === ag.tipoId);
    const cor = tipo ? tipo.cor : "#bdbdbd";
    const nomeTipo = tipo ? tipo.nome : "Tipo removido";
    const dur = duracao1Min(ag);
    const juntos = ags.filter(o => o.id !== ag.id && overlaps(ag, o));

    const el = document.createElement("div");
    el.className = "ag-item";
    el.style.borderLeftColor = cor;

    let html = '<div class="ag-head"><div class="ag-hora">' + escapeHtml(ag.hora || "--:--") + '</div>' +
      '<div class="ag-cliente">' + escapeHtml(ag.cliente || "(sem nome)") + '</div></div>' +
      '<div class="ag-tipo"><span class="ag-tipo-dot" style="background:' + cor + '"></span>' +
      escapeHtml(nomeTipo) + ' · ' + escapeHtml(dur) + ' min</div>';

    if(ag.duplo && !ag.domicilio){
      const t2 = ag.tipoId2 ? state.tipos.find(t => t.id === ag.tipoId2) : null;
      const cor2 = t2 ? t2.cor : "#90caf9";
      const nomeTipo2 = t2 ? t2.nome : "Sem tipo";
      const nomeC2 = ag.cliente2 || "(sem nome)";
      let hora2 = "--:--";
      const ini2 = inicioCliente2Min(ag);
      if(ini2 !== null) hora2 = minutosHora(ini2);
      html += '<div class="ag-badge duplo">👥 Duas clientes</div>' +
        '<div class="ag-cliente2-bloco"><div class="ag-cliente2-head">' +
        '<div class="ag-hora2">' + escapeHtml(hora2) + '</div>' +
        '<div class="ag-cliente2">' + escapeHtml(nomeC2) + '</div></div>' +
        '<div class="ag-tipo2"><span class="ag-tipo-dot" style="background:' + cor2 + '"></span>' +
        escapeHtml(nomeTipo2) + (ag.duracao2 ? ' · ' + escapeHtml(ag.duracao2) + ' min' : '') + '</div>' +
        (ag.telefone2 ? '<div class="ag-obs">📞 ' + escapeHtml(ag.telefone2) + '</div>' : '') +
        '</div>';
    }

    if(ag.domicilio){
      html += '<div class="ag-badge domicilio">🏠 Atendimento a domicílio</div>';
      const end = (ag.endereco || "").trim();
      const endHtml = end
        ? '<span class="dom-end-valor">' + escapeHtml(end) + '</span>' +
          '<button type="button" class="btn-abrir-maps" data-end="' + escapeHtml(end) + '">📍 Abrir no Maps</button>'
        : '<span class="dom-end-valor vazio">Endereço não informado</span>';
      html += '<div class="dom-endereco"><span class="dom-end-label">📍 Endereço:</span>' + endHtml + '</div>';
      const base = (tipo && typeof tipo.preco === "number") ? tipo.preco : 0;
      const taxa = state.configDomicilio.taxa;
      const total = base + taxa;
      if(base > 0 || taxa > 0){
        html += '<div class="ag-preco-linha"><span class="ag-preco-label">Taxa de domicílio:</span>' +
          '<span class="ag-preco-valor">' + escapeHtml(formatBRL(taxa)) + '</span></div>' +
          '<div class="ag-preco-total"><span>💰 Total:</span><span>' + escapeHtml(formatBRL(total)) + '</span></div>';
      }
    }
    if(juntos.length > 0){
      const nomes = juntos.map(j => j.cliente || "(sem nome)").join(", ");
      html += '<div class="ag-badge">⧉ Junto com: ' + escapeHtml(nomes) + '</div>';
    }
    if(ag.telefone) html += '<div class="ag-obs">📞 ' + escapeHtml(ag.telefone) + '</div>';
    if(ag.obs)      html += '<div class="ag-obs">' + escapeHtml(ag.obs) + '</div>';

    el.innerHTML = html;
    el.addEventListener("click", () => {
      document.getElementById("overlayDay").classList.remove("show");
      openAgForm(ag.id);
    });
    body.appendChild(el);
  });

  body.querySelectorAll(".btn-abrir-maps").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const end = btn.dataset.end;
      if(!end) return;
      window.open("https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(end), "_blank");
    });
  });

  renderBotaoEnviarDiaFuturo(body, abrirLembretesFn);
}

/* =========================================================
   BOTÃO "ENVIAR LEMBRETES DESTE DIA"
   ========================================================= */
let abrirLembretesFn = null;
export function setAbrirLembretesFn(fn){ abrirLembretesFn = fn; }

export function renderBotaoEnviarDiaFuturo(body){
  const currentDayKey = state.currentDayKey;
  if(!currentDayKey) return;
  if(currentDayKey <= todayKey()) return;
  const cfg = state.whatsapp;
  if(!cfg.ativo || !cfg.backendUrl || !cfg.apiKey) return;
  const ags = state.agenda[currentDayKey] || [];
  if(!ags.some(a => a.telefone || (a.duplo && a.telefone2))) return;

  const fer = feriadoNaData(currentDayKey);
  const feria = feriasNaData(currentDayKey);
  const folga = folgaNaData(currentDayKey);
  const temAviso = !!(fer || feria || folga);

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "btn-enviar-dia" + (temAviso ? " aviso-force" : "");
  btn.id = "btnEnviarLembretesDia";
  btn.innerHTML = "📲 Enviar lembretes deste dia" + (temAviso ? " ⚠️" : "");

  if(temAviso){
    const partes = [];
    if(fer) partes.push("feriado (" + fer.nome + ")");
    if(feria) partes.push("férias");
    if(folga) partes.push("folga");
    btn.title = "Este dia tem " + partes.join(", ") + ". O envio pedirá confirmação.";
  }

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    if(temAviso){
      const ok = confirm("⚠️ Este dia tem " + (fer ? "feriado" : (feria ? "férias" : "folga")) +
        ".\n\nDeseja enviar os lembretes mesmo assim?");
      if(!ok) return;
    }
    document.getElementById("overlayDay").classList.remove("show");
    if(abrirLembretesFn) abrirLembretesFn(currentDayKey, temAviso);
  });
  body.appendChild(btn);
}