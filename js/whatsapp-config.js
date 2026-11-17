/**
 * whatsapp-config.js — v1.16.2
 * Bindings do modal de configuração do WhatsApp.
 * Depende de: lembretes (abrirWhatsappConfig, salvarWhatsappConfig, atualizarBotaoWhatsappFloat).
 */

import {
  abrirWhatsappConfig,
  salvarWhatsappConfig,
  atualizarBotaoWhatsappFloat
} from "./lembretes.js";

export function ligarWhatsappConfig(openOverlay, closeOverlay, getOpenOverlay, getCloseOverlay){
  // Botão ⚙️ → WhatsApp
  const cfgBtn = document.getElementById("cfgBtnWhatsapp");
  if(cfgBtn){
    cfgBtn.addEventListener("click", () => {
      closeOverlay("overlayConfig");
      abrirWhatsappConfig(openOverlay);
    });
  }

  // Salvar
  const btnSalvar = document.getElementById("btnWaSalvar");
  if(btnSalvar){
    btnSalvar.addEventListener("click", () => {
      salvarWhatsappConfig();
      closeOverlay("overlayWhatsapp");
      alert("Configuração do WhatsApp salva.");
    });
  }

  // Botão flutuante 📲
  const float = document.getElementById("btnWhatsappFloat");
  if(float){
    float.addEventListener("click", () => {
      const abrir = window.__milaAbrirLembretes;
      if(typeof abrir === "function") abrir();
    });
  }

  // Inicializa visibilidade do botão
  atualizarBotaoWhatsappFloat();
}