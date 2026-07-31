"use client";

import { useEffect } from "react";

/**
 * Registra o service worker que torna o app instalavel e utilizavel offline.
 *
 * So' registra em producao: em desenvolvimento o SW intercepta o hot reload e
 * o Alan acabaria vendo tela velha achando que o codigo nao subiu.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    const registrar = () => {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((erro) => {
        console.error("[finara] falha ao registrar o service worker:", erro);
      });
    };

    // Espera o load pra nao disputar banda com o primeiro render.
    if (document.readyState === "complete") {
      registrar();
    } else {
      window.addEventListener("load", registrar, { once: true });
      return () => window.removeEventListener("load", registrar);
    }
  }, []);

  return null;
}
