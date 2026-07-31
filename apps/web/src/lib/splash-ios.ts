/**
 * TELAS DE ABERTURA DO iOS
 *
 * O iOS ignora `background_color` do manifesto: um PWA em `standalone` abre
 * com um retangulo branco ate' o primeiro quadro, a nao ser que exista um
 * `apple-touch-startup-image` casando com o aparelho.
 *
 * E casando literalmente: o iOS nao redimensiona nem escolhe o mais proximo.
 * Se a media query nao bater em `device-width`, `device-height` E
 * `-webkit-device-pixel-ratio`, ele simplesmente nao usa imagem nenhuma. Por
 * isso a lista e' de pares exatos, e por isso 414x896 aparece duas vezes (o
 * 11/XR e' @2x, o 11 Pro Max/XS Max e' @3x, e a media query e' o unico jeito
 * de distinguir os dois).
 *
 * Esta lista e' lida pelo `layout.tsx` (para emitir os <link>) e pelo
 * `scripts/gen-icons.mjs` (para gerar os PNGs). Uma lista so', para nao
 * existir <link> apontando para arquivo que nao foi gerado.
 */

export type AparelhoIOS = {
  /** largura em pontos CSS */
  l: number;
  /** altura em pontos CSS */
  a: number;
  /** densidade de pixel */
  dpr: number;
  /** so' para leitura humana */
  modelos: string;
};

export const APARELHOS_IOS: AparelhoIOS[] = [
  { l: 440, a: 956, dpr: 3, modelos: "16 Pro Max" },
  { l: 430, a: 932, dpr: 3, modelos: "15 Pro Max · 15 Plus · 14 Pro Max" },
  { l: 428, a: 926, dpr: 3, modelos: "14 Plus · 13 Pro Max · 12 Pro Max" },
  { l: 402, a: 874, dpr: 3, modelos: "16 Pro" },
  { l: 393, a: 852, dpr: 3, modelos: "16 · 15 Pro · 15 · 14 Pro" },
  { l: 390, a: 844, dpr: 3, modelos: "14 · 13 · 13 Pro · 12 · 12 Pro" },
  { l: 375, a: 812, dpr: 3, modelos: "13 mini · 12 mini · 11 Pro · XS · X" },
  { l: 414, a: 896, dpr: 3, modelos: "11 Pro Max · XS Max" },
  { l: 414, a: 896, dpr: 2, modelos: "11 · XR" },
  { l: 375, a: 667, dpr: 2, modelos: "SE 2/3 · 8 · 7 · 6s" },
];

/** Nome do arquivo gerado para um aparelho, em `public/icons/splash/`. */
export function arquivoSplash(ap: AparelhoIOS, escuro: boolean): string {
  return `${ap.l * ap.dpr}x${ap.a * ap.dpr}${escuro ? "-dark" : ""}.png`;
}

/**
 * A media query do <link>. O `prefers-color-scheme` entra junto para o
 * aparelho no tema escuro nao abrir num flash branco — que e' exatamente o
 * problema que a tela de abertura existe para resolver.
 */
export function mediaSplash(ap: AparelhoIOS, escuro: boolean): string {
  return [
    `(prefers-color-scheme: ${escuro ? "dark" : "light"})`,
    `(device-width: ${ap.l}px)`,
    `(device-height: ${ap.a}px)`,
    `(-webkit-device-pixel-ratio: ${ap.dpr})`,
    "(orientation: portrait)",
  ].join(" and ");
}
