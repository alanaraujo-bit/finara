"use client";

import { useEffect } from "react";

/**
 * COMPORTAMENTOS QUE SO' O JAVASCRIPT RESOLVE
 *
 * O grosso de "parecer nativo" e' CSS e viewport. Sobram dois casos que o
 * navegador so' entrega por evento, e os dois valem apenas dentro do app
 * instalado — numa aba comum o Finara continua se comportando como site.
 *
 * **Pinca no iOS.** O Safari ignora `user-scalable=no` desde o iOS 10, e a
 * unica forma de recusar a ampliacao e' cancelar os eventos `gesture*`, que
 * sao proprietarios da Apple e nao existem em mais lugar nenhum. Sem isto o
 * app instalado ainda dava zoom com dois dedos — e, sem barra de endereco, nao
 * ha' como voltar ao 1:1 depois.
 *
 * O toque-duplo NAO e' tratado aqui de proposito. `touch-action: manipulation`
 * ja' o desarma no CSS, e a versao em JavaScript (cancelar o segundo `touchend`
 * dentro de 300ms) cancela junto o `click` que viria depois — dois toques
 * rapidos em botoes diferentes perderiam o segundo. O remedio seria pior.
 */
export function AppNativo() {
  useEffect(() => {
    const instalado =
      window.matchMedia("(display-mode: standalone)").matches ||
      window.matchMedia("(display-mode: fullscreen)").matches ||
      // O iOS nao implementa `display-mode` no PWA; expoe esta propriedade.
      (window.navigator as { standalone?: boolean }).standalone === true;

    if (!instalado) return;

    const recusar = (evento: Event) => evento.preventDefault();

    // `passive: false` e' obrigatorio: sem ele o navegador ignora o
    // preventDefault e o gesto acontece assim mesmo.
    const opcoes = { passive: false } as const;
    document.addEventListener("gesturestart", recusar, opcoes);
    document.addEventListener("gesturechange", recusar, opcoes);
    document.addEventListener("gestureend", recusar, opcoes);

    return () => {
      document.removeEventListener("gesturestart", recusar);
      document.removeEventListener("gesturechange", recusar);
      document.removeEventListener("gestureend", recusar);
    };
  }, []);

  return null;
}
