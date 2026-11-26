/**
 * clientes.js — v1.16.2
 * CRUD de clientes + helpers de cliente.
 * Depende de: constants, helpers, storage, state, backup-nuvem.
 */

import { AVATAR_COLORS } from "./constants.js";
import { uid, escapeHtml } from "./helpers.js";
import { saveClientes } from "./storage.js";
import { state } from "./state.js";
import { marcarMudanca } from "./backup-nuvem.js";

/* Ponte de overlay (evita openClienteForm sem openOverlay no clique da lista) */
let _openOverlayFn = null;

/* =========================================================
   HELPERS
   ========================================================= */
export function getCliente(id){
  return state.clientes.find(c => c.id === id) || null;
}

export function buscarClientesPorNome(termo, limite){
  const t = (termo || "").trim().toLowerCase();
  if(!t) return [];
  const arr = state.clientes.filter(c => c.nome.toLowerCase().indexOf(t) !== -1);
  arr.sort((a,b) => a.nome.localeCompare(b.nome, "pt-BR", {sensitivity:"base"}));
  return limite ? arr.slice(0, limite) : arr;
}

export function clienteExisteComNome(nome){
  const n = (nome || "").trim().toLowerCase();
  if(!n) return false;
  return state.clientes.some(c => c.nome.toLowerCase() === n);
}

export function corAvatarPorNome(nome){
  const s = (nome || "").trim().toLowerCase();
  if(!s) return AVATAR_COLORS[0];
  let h = 0;
  for(let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

export function inicialNome(nome){
  const s = (nome || "").trim();
  return s ? s.charAt(0).toUpperCase() : "?";
}

/* =========================================================
   CRIAR / OFERECER CADASTRO
   ========================================================= */
export function criarCliente(nome, telefone, endereco){
  const c = {
    id: uid(),
    nome: String(nome || "").trim(),
    telefone: String(telefone || "").trim(),
    endereco: String(endereco || "").trim(),
    criadoEm: new Date().toISOString()
  };
  state.clientes.push(c);
  saveClientes(state);
  marcarMudanca();
  return c;
}

export function oferecerCadastroAutomatico(nome, telefone, endereco){
  const n = (nome || "").trim();
  const t = (telefone || "").trim();
  if(!n || !t) return;
  if(clienteExisteComNome(n)) return;
  if(confirm('Salvar "' + n + '" no cadastro de clientes?')){
    criarCliente(n, t, endereco || "");
  }
}

export function oferecerAtualizarEnderecoCliente(nomeCliente, enderecoAgendamento){
  const nome = (nomeCliente || "").trim();
  const end  = (enderecoAgendamento || "").trim();
  if(!nome || !end) return;

  const cliente = state.clientes.find(c => c.nome.toLowerCase() === nome.toLowerCase());
  if(!cliente) return;

  const atual = (cliente.endereco || "").trim();

  if(!atual){
    cliente.endereco = end;
    saveClientes(state);
    marcarMudanca();
    return;
  }
  if(atual.toLowerCase() === end.toLowerCase()) return;

  const ok = confirm(
    'O endereço deste agendamento é diferente do endereço ' +
    'cadastrado da cliente "' + nome + '".\n\n' +
    'Deseja atualizar o cadastro da cliente com este novo endereço?\n\n' +
    '• Cadastro atual: ' + atual + '\n' +
    '• Novo endereço:  ' + end
  );
  if(ok){
    cliente.endereco = end;
    saveClientes(state);
    marcarMudanca();
  }
}

/* =========================================================
   UI — LISTA
   ========================================================= */
export function openClientes(openOverlay){
  if(typeof openOverlay === "function") _openOverlayFn = openOverlay;
  document.getElementById("buscaListaClientes").value = "";
  document.getElementById("btnLimparBuscaClientes").classList.remove("show");
  renderClientesList("");
  (_openOverlayFn || openOverlay)("overlayClientes");
}

export function renderClientesList(filtro){
  const body = document.getElementById("clientesBody");
  body.innerHTML = "";

  const f = (filtro || "").trim().toLowerCase();
  let lista = state.clientes.slice();
  if(f) lista = lista.filter(c => c.nome.toLowerCase().indexOf(f) !== -1);
  lista.sort((a,b) => a.nome.localeCompare(b.nome, "pt-BR", {sensitivity:"base"}));

  if(lista.length === 0){
    body.innerHTML = state.clientes.length === 0
      ? '<div class="empty-msg">Nenhuma cliente cadastrada ainda.<br>Toque em "+ Nova cliente" para começar.</div>'
      : '<div class="empty-msg">Nenhuma cliente encontrada para esta busca.</div>';
    return;
  }

  lista.forEach(c => {
    const el = document.createElement("div");
    el.className = "cli-item";
    const cor = corAvatarPorNome(c.nome);
    const ini = inicialNome(c.nome);
    const telTxt = c.telefone ? escapeHtml(c.telefone) : "sem telefone";
    const telCls = c.telefone ? "" : " sem-tel";
    const endTxt = c.endereco ? escapeHtml(c.endereco) : "sem endereço";
    const endCls = c.endereco ? "" : " sem-end";

    el.innerHTML =
      '<div class="cli-avatar" style="background:' + cor + '">' + escapeHtml(ini) + '</div>' +
      '<div class="cli-info">' +
        '<div class="cli-nome">' + escapeHtml(c.nome) + '</div>' +
        '<div class="cli-tel' + telCls + '">' + telTxt + '</div>' +
        '<div class="cli-end' + endCls + '">📍 ' + endTxt + '</div>' +
      '</div>';

    el.addEventListener("click", () => openClienteForm(c.id, _openOverlayFn));
    body.appendChild(el);
  });
}

/* =========================================================
   UI — FORM
   ========================================================= */
export function openClienteForm(clienteId, openOverlay){
  if(typeof openOverlay === "function") _openOverlayFn = openOverlay;
  const open = openOverlay || _openOverlayFn;
  if(typeof open !== "function"){
    console.error("openClienteForm: openOverlay não registrado");
    return;
  }

  state.editingClienteId = clienteId || null;
  const isEdit = !!clienteId;

  document.getElementById("clienteTitle").textContent = isEdit ? "Editar cliente" : "Nova cliente";
  document.getElementById("btnDeleteCliente").style.display = isEdit ? "block" : "none";

  if(isEdit){
    const c = getCliente(clienteId);
    if(c){
      document.getElementById("clienteNome").value     = c.nome || "";
      document.getElementById("clienteTelefone").value = c.telefone || "";
      document.getElementById("clienteEndereco").value = c.endereco || "";
    }
  } else {
    document.getElementById("clienteNome").value     = "";
    document.getElementById("clienteTelefone").value = "";
    document.getElementById("clienteEndereco").value = "";
  }

  open("overlayCliente");
  setTimeout(() => {
    try{ document.getElementById("clienteNome").focus({preventScroll:true}); }catch(e){}
  }, 100);
}

export function salvarCliente(closeOverlay){
  const nome     = document.getElementById("clienteNome").value.trim();
  const telefone = document.getElementById("clienteTelefone").value.trim();
  const endereco = document.getElementById("clienteEndereco").value.trim();

  if(!nome){ alert("O nome é obrigatório."); return; }

  if(state.editingClienteId){
    const idx = state.clientes.findIndex(c => c.id === state.editingClienteId);
    if(idx >= 0){
      state.clientes[idx].nome     = nome;
      state.clientes[idx].telefone = telefone;
      state.clientes[idx].endereco = endereco;
    }
  } else {
    state.clientes.push({
      id: uid(), nome, telefone, endereco,
      criadoEm: new Date().toISOString()
    });
  }

  saveClientes(state);
  marcarMudanca();
  closeOverlay("overlayCliente");
  renderClientesList(document.getElementById("buscaListaClientes").value || "");
}

export function excluirCliente(closeOverlay){
  if(!state.editingClienteId) return;
  if(!confirm("Excluir esta cliente?\n\nOs agendamentos existentes NÃO serão apagados.")) return;

  state.clientes = state.clientes.filter(c => c.id !== state.editingClienteId);
  saveClientes(state);
  marcarMudanca();
  closeOverlay("overlayCliente");
  renderClientesList(document.getElementById("buscaListaClientes").value || "");
}