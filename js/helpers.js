/**
 * helpers.js — v1.16.2
 * Funções utilitárias puras.
 * Depende de: constants.js.
 */

import { WEEKDAYS, MONTHS, PASSO } from "./constants.js";

export function uid(){
  return Date.now().toString(36) + Math.random().toString(36).slice(2,7);
}

export function pad(n){
  return String(n).padStart(2,"0");
}

export function escapeHtml(s){
  if(s === undefined || s === null) return "";
  return String(s)
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;").replace(/'/g,"&#039;");
}

export function dateKey(y,m,d){
  return y + "-" + pad(m+1) + "-" + pad(d);
}

export function todayKey(){
  const t = new Date();
  return dateKey(t.getFullYear(), t.getMonth(), t.getDate());
}

export function dataKeyDe(diasAFrente){
  const d = new Date();
  d.setDate(d.getDate() + diasAFrente);
  return dateKey(d.getFullYear(), d.getMonth(), d.getDate());
}

export function dataAmanhaKey(){
  return dataKeyDe(1);
}

export function diaSemanaCurto(key){
  if(!key) return "";
  const [y,m,d] = key.split("-").map(Number);
  const dt = new Date(y, m-1, d);
  if(isNaN(dt.getTime())) return "";
  return WEEKDAYS[dt.getDay()];
}

export function formatDateLong(key){
  const [y,m,d] = key.split("-").map(Number);
  const dt = new Date(y, m-1, d);
  const wd = WEEKDAYS[dt.getDay()];
  return wd + ", " + d + " de " + MONTHS[m-1] + " de " + y;
}

export function formatDateBR(key){
  if(!key) return "";
  const [y,m,d] = key.split("-");
  return d + "/" + m + "/" + y;
}

export function formatDataHora(iso){
  if(!iso) return "";
  try{
    const d = new Date(iso);
    return pad(d.getDate()) + "/" + pad(d.getMonth()+1) + "/" + d.getFullYear() +
           " " + pad(d.getHours()) + ":" + pad(d.getMinutes());
  }catch(e){ return ""; }
}

export function formatHaLegivel(iso){
  if(!iso) return "";
  try{
    const ms = Date.now() - new Date(iso).getTime();
    if(ms < 0) return "agora";
    const seg = Math.floor(ms / 1000);
    if(seg < 60) return "há " + seg + "s";
    const min = Math.floor(seg / 60);
    if(min < 60) return "há " + min + " min";
    const h = Math.floor(min / 60);
    if(h < 24) return "há " + h + "h";
    return "há " + Math.floor(h / 24) + "d";
  }catch(e){ return ""; }
}

export function periodOf(hora){
  if(!hora) return 0;
  const [h,m] = hora.split(":").map(Number);
  const mins = h*60 + (m||0);
  if(mins < 8*60)   return 0;
  if(mins < 12*60)  return 1;
  if(mins < 18*60)  return 2;
  if(mins < 22*60)  return 3;
  return 0;
}

export function horaMinutos(hora){
  if(!hora) return null;
  const [h,m] = hora.split(":").map(Number);
  if(isNaN(h) || isNaN(m)) return null;
  return h*60 + m;
}

export function minutosHora(min){
  min = Math.max(0, Math.round(min));
  return pad(Math.floor(min / 60) % 24) + ":" + pad(min % 60);
}

export function arredondarParaCima(min, passo){
  passo = passo || PASSO;
  return Math.ceil(min / passo) * passo;
}

export function formatBRL(v){
  const n = Number(v);
  if(!isFinite(n)) return "R$ 0,00";
  return "R$ " + n.toFixed(2).replace(".", ",");
}

export function formatBytes(n){
  n = Number(n) || 0;
  if(n < 1024) return n + " B";
  if(n < 1024*1024) return (n/1024).toFixed(1) + " KB";
  return (n/(1024*1024)).toFixed(2) + " MB";
}

export function abreviarDeviceId(id){
  if(!id || typeof id !== "string") return "(sem device)";
  if(id.length <= 14) return id;
  return id.slice(0, 10) + "…";
}