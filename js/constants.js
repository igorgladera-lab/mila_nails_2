/**
 * constants.js — v1.16.2
 * Constantes globais do app.
 * Depende de: nada.
 */

export const LS_TIPOS       = "mila_nails_tipos";
export const LS_AGENDA      = "mila_nails_agenda";
export const LS_FERIAS      = "mila_nails_ferias";
export const LS_FOLGAS      = "mila_nails_folgas";
export const LS_FERIADOS    = "mila_nails_feriados_custom";
export const LS_CONFIG      = "mila_nails_config";
export const LS_TEMA        = "mila_nails_tema";
export const LS_CONFIG_DOM  = "mila_nails_config_domicilio";
export const LS_WHATSAPP    = "mila_nails_whatsapp";
export const LS_CLIENTES    = "mila_nails_clientes";
export const SS_BANNER      = "mila_nails_banner_data";

export const LS_DEVICE_ID     = "mila_nails_device_id";
export const LS_BACKUP_NUVEM  = "mila_nails_backup_nuvem";

export const LS_BACKUP_AUTO        = "mila_nails_backup_auto";
export const LS_BACKUP_PENDENTE    = "mila_nails_backup_pendente";
export const LS_BACKUP_MUDANCA_TS  = "mila_nails_backup_mudanca_ts";

export const DEBOUNCE_MS = 60 * 1000;

export const WEEKDAYS = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];

export const MONTHS = [
  "janeiro","fevereiro","março","abril","maio","junho",
  "julho","agosto","setembro","outubro","novembro","dezembro"
];

export const PRESET_COLORS = [
  "#e57373","#f06292","#ba68c8","#64b5f6","#4db6ac",
  "#ffb74d","#a1887f","#9575cd","#81c784","#7986cb",
  "#4fc3f7","#dce775"
];

export const AVATAR_COLORS = [
  "#e57373","#f06292","#ba68c8","#9575cd","#7986cb",
  "#64b5f6","#4fc3f7","#4db6ac","#81c784","#dce775",
  "#ffb74d","#a1887f"
];

export const PASSO = 15;

export const CONFIG_DOM_PADRAO = { taxa: 20.00, duracao: 150 };

export const FERIADOS_NACIONAIS = [
  { mes: 1,  dia: 1,  nome: "Confraternização Universal" },
  { mes: 4,  dia: 21, nome: "Tiradentes" },
  { mes: 5,  dia: 1,  nome: "Dia do Trabalho" },
  { mes: 9,  dia: 7,  nome: "Independência do Brasil" },
  { mes: 10, dia: 12, nome: "Nossa Senhora Aparecida" },
  { mes: 11, dia: 2,  nome: "Finados" },
  { mes: 11, dia: 15, nome: "Proclamação da República" },
  { mes: 11, dia: 20, nome: "Consciência Negra" },
  { mes: 12, dia: 25, nome: "Natal" }
];

export const SETE_DIAS_MS = 7 * 24 * 60 * 60 * 1000;