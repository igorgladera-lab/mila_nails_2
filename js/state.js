/**
 * state.js — v1.16.2
 * Estado global compartilhado.
 * Depende de: constants.js.
 */

import { PRESET_COLORS, CONFIG_DOM_PADRAO } from "./constants.js";

export const state = {
  tipos: [],
  agenda: {},
  ferias: [],
  folgas: {},
  feriadosCustom: [],
  clientes: [],
  viewYear: 0,
  viewMonth: 0,
  editingAgId: null,
  editingAgDate: null,
  editingTipoId: null,
  editingFeriasId: null,
  editingFeriadoId: null,
  editingClienteId: null,
  pickerYear: 0,
  selectedColor: PRESET_COLORS[0],
  buscaTermo: "",
  configDomicilio: { ...CONFIG_DOM_PADRAO },
  whatsapp: {
    backendUrl: "",
    apiKey: "",
    ativo: false,
    templateName: "confirmacao_agendamento",
    languageCode: "pt_BR",
    modo: "ambos",
    maxReenvios: 2,
    intervaloReenvio: 2
  }
};

export let statusLembretesAtual = {};
export let dataLembretesAtual = null;

export function setStatusLembretes(novo){ statusLembretesAtual = novo || {}; }
export function setDataLembretesAtual(d){ dataLembretesAtual = d; }

export let autoTimer = null;
export let autoEnviando = false;
export let indicadorTimer = null;
export let currentDayKey = null;
export let agDomicilioAtivo = false;

export function setAutoTimer(t){ autoTimer = t; }
export function setAutoEnviando(v){ autoEnviando = v; }
export function setIndicadorTimer(t){ indicadorTimer = t; }
export function setCurrentDayKey(k){ currentDayKey = k; }
export function setAgDomicilioAtivo(v){ agDomicilioAtivo = v; }