import type { MetadataRoute } from "next";

/**
 * Manifesto do PWA. O Next serve isto em /manifest.webmanifest.
 *
 * Para o Android oferecer "instalar app" sao obrigatorios: name, short_name,
 * start_url, display standalone e um icone 192 + um 512. O icone `maskable`
 * e' o que evita o app virar um quadrado branco com a logo espremida dentro
 * na tela inicial do Android.
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
    background_color: "#fbfbfd",
    theme_color: "#fbfbfd",
    categories: ["finance", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
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
