import type { MetadataRoute } from "next";

/**
 * Manifesto do PWA. O Next serve isto em /manifest.webmanifest.
 *
 * Para o Android oferecer "instalar app" sao obrigatorios: name, short_name,
 * start_url, display standalone e um icone 192 + um 512.
 *
 * Os tres propositos de icone resolvem coisas diferentes e nenhum substitui o
 * outro:
 *  - `any`        arte com silhueta propria, para contextos que NAO mascaram:
 *                 aba do navegador, atalho de desktop, aviso de instalar.
 *  - `maskable`   arte sangrando ate' a borda, para o launcher do Android
 *                 recortar no formato do aparelho. Sem ela a logo aparece
 *                 espremida dentro de um quadrado branco na tela inicial.
 *  - `monochrome` so' o traco em fundo transparente, que o Android 13+ pinta
 *                 com a cor do papel de parede nos "icones tematicos".
 *
 * Todos saem de `scripts/gen-icons.mjs`, a partir da geometria de
 * `lib/marca.ts`.
 *
 * O iOS ignora boa parte deste arquivo e usa as meta tags apple-* que estao
 * no layout — por isso as duas coisas precisam existir.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Finara — seu dinheiro, inteiro",
    short_name: "Finara",
    description: "Controle financeiro pessoal: contas, cartões, assinaturas, dívidas e recebíveis.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    lang: "pt-BR",
    dir: "ltr",
    // Cor da tela que o Android desenha sozinho na abertura, e da barra do
    // sistema. E' o --canvas do tema claro.
    background_color: "#fbfbfd",
    theme_color: "#fbfbfd",
    categories: ["finance", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icons/monochrome-512.png", sizes: "512x512", type: "image/png", purpose: "monochrome" },
    ],
    shortcuts: [
      {
        name: "Novo lançamento",
        short_name: "Lançar",
        url: "/lancamentos/novo",
      },
      {
        name: "Calendário de gastos",
        short_name: "Calendário",
        url: "/calendario",
      },
    ],
  };
}
