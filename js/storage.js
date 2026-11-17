/**
 * storage.js — v1.16.2
 * Persistência em localStorage.
 * Depende de: constants.js, helpers.js.
 */

import {
  LS_TIPOS, LS_AGENDA, LS_FERIAS, LS_FOLGAS, LS_FERIADOS, LS_CONFIG,
  LS_CONFIG_DOM, LS_WHATSAPP, LS_CLIENTES,
  LS_BACKUP_AUTO, LS_BACKUP_PENDENTE, LS_BACKUP_MUDANCA_TS,
  CONFIG_DOM_PADRAO
} from "./constants.js";

import { uid } from "./helpers.js";

export function load(state){
  try{
    state.tipos  = JSON.parse(localStorage.getItem(LS_TIPOS)  || "[]");
    state.agenda = JSON.parse(localStorage.getItem(LS_AGENDA) || "{}");
    state.ferias = JSON.parse(localStorage.getItem(LS_FERIAS) || "[]");
    state.feriadosCustom = JSON.parse(localStorage.getItem(LS_FERIADOS) || "[]");
    state.clientes = JSON.parse(localStorage.getItem(LS_CLIENTES) || "[]");

    const rawFolgas = JSON.parse(localStorage.getItem(LS_FOLGAS) || "null");
    state.folgas = {};
    if(Array.isArray(rawFolgas)){
      rawFolgas.forEach(k => { state.folgas[k] = "dia-todo"; });
    } else if(rawFolgas && typeof rawFolgas === "object"){
      state.folgas = rawFolgas;
    }

    if(!Array.isArray(state.tipos))  state.tipos = [];
    if(typeof state.agenda !== "object" || state.agenda === null) state.agenda = {};
    if(!Array.isArray(state.ferias)) state.ferias = [];
    if(!Array.isArray(state.feriadosCustom)) state.feriadosCustom = [];
    if(!Array.isArray(state.clientes)) state.clientes = [];

    state.clientes = state.clientes.filter(c =>
      c && typeof c === "object" && typeof c.nome === "string" && c.nome.trim() !== ""
    ).map(c => ({
      id: c.id || uid(),
      nome: c.nome.trim(),
      telefone: typeof c.telefone === "string" ? c.telefone : "",
      endereco: typeof c.endereco === "string" ? c.endereco : "",
      criadoEm: typeof c.criadoEm === "string" ? c.criadoEm : new Date().toISOString()
    }));
  }catch(e){
    state.tipos = [];
    state.agenda = {};
    state.ferias = [];
    state.folgas = {};
    state.feriadosCustom = [];
    state.clientes = [];
  }

  try{
    const cd = JSON.parse(localStorage.getItem(LS_CONFIG_DOM) || "null");
    if(cd && typeof cd === "object"){
      state.configDomicilio = {
        taxa: (typeof cd.taxa === "number" && cd.taxa >= 0) ? cd.taxa : CONFIG_DOM_PADRAO.taxa,
        duracao: (typeof cd.duracao === "number" && cd.duracao > 0) ? cd.duracao : CONFIG_DOM_PADRAO.duracao
      };
    }
  }catch(e){}

  try{
    const wa = JSON.parse(localStorage.getItem(LS_WHATSAPP) || "null");
    if(wa && typeof wa === "object"){
      state.whatsapp = {
        backendUrl: typeof wa.backendUrl === "string" ? wa.backendUrl : "",
        apiKey: typeof wa.apiKey === "string" ? wa.apiKey : "",
        ativo: !!wa.ativo,
        templateName: (typeof wa.templateName === "string" && wa.templateName)
          ? wa.templateName : "confirmacao_agendamento",
        languageCode: (typeof wa.languageCode === "string" && wa.languageCode)
          ? wa.languageCode : "pt_BR",
        modo: (wa.modo === "manual" || wa.modo === "auto" || wa.modo === "ambos")
          ? wa.modo : "ambos",
        maxReenvios: (typeof wa.maxReenvios === "number" && wa.maxReenvios >= 0)
          ? wa.maxReenvios : 2,
        intervaloReenvio: (typeof wa.intervaloReenvio === "number" && wa.intervaloReenvio > 0)
          ? wa.intervaloReenvio : 2
      };
    }
  }catch(e){}

  try{
    let cfg = JSON.parse(localStorage.getItem(LS_CONFIG) || "null");
    if(!cfg || typeof cfg !== "object" || cfg.versao < 25){
      cfg = { versao: 25 };
      localStorage.setItem(LS_CONFIG, JSON.stringify(cfg));
    }
  }catch(e){
    localStorage.setItem(LS_CONFIG, JSON.stringify({versao: 25}));
  }

  try{
    const auto = localStorage.getItem(LS_BACKUP_AUTO);
    if(auto !== "on" && auto !== "off"){
      localStorage.setItem(LS_BACKUP_AUTO, "on");
    }
  }catch(e){}
}

export function saveTipos(state){  localStorage.setItem(LS_TIPOS,  JSON.stringify(state.tipos));  }
export function saveAgenda(state){ localStorage.setItem(LS_AGENDA, JSON.stringify(state.agenda)); }
export function saveFerias(state){ localStorage.setItem(LS_FERIAS, JSON.stringify(state.ferias)); }
export function saveFolgas(state){ localStorage.setItem(LS_FOLGAS, JSON.stringify(state.folgas)); }
export function saveFeriadosCustom(state){ localStorage.setItem(LS_FERIADOS, JSON.stringify(state.feriadosCustom)); }
export function saveConfigDomicilio(state){ localStorage.setItem(LS_CONFIG_DOM, JSON.stringify(state.configDomicilio)); }
export function saveWhatsapp(state){ localStorage.setItem(LS_WHATSAPP, JSON.stringify(state.whatsapp)); }
export function saveClientes(state){ localStorage.setItem(LS_CLIENTES, JSON.stringify(state.clientes)); }