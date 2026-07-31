import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ServiceWorkerRegistration } from "@/components/service-worker";
import { ThemeProvider } from "@/components/theme-provider";
import { APARELHOS_IOS, arquivoSplash, mediaSplash } from "@/lib/splash-ios";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Finara",
    template: "%s · Finara",
  },
  description: "Seu dinheiro, inteiro e sob controle.",
  applicationName: "Finara",
  manifest: "/manifest.webmanifest",
  /**
   * `icons` NAO e' declarado aqui de proposito. Os arquivos `favicon.ico`,
   * `icon.svg` e `apple-icon.png` estao em `src/app/` e o Next emite os
   * <link> sozinho a partir deles, com hash de conteudo no URL. Declarar
   * tambem por aqui geraria tags duplicadas e, pior, uma segunda lista para
   * manter em dia toda vez que os assets mudassem de nome.
   *
   * O `apple-icon.png` e' o que faz o app ter cara de app na tela de inicio
   * do iPhone — sem ele o iOS usa uma miniatura da propria tela.
   */
  appleWebApp: {
    capable: true,
    title: "Finara",
    // "default" mantem a barra de status legivel nos dois temas.
    statusBarStyle: "default",
    /**
     * Tela de abertura do iOS. Sem isto o PWA em standalone abre com um
     * retangulo branco ate' o primeiro quadro — e no tema escuro esse flash
     * branco e' agressivo. A lista vem de `lib/splash-ios.ts`, a mesma que o
     * gerador de assets usa, entao nao existe <link> apontando para PNG que
     * nao foi gerado.
     */
    startupImage: APARELHOS_IOS.flatMap((ap) =>
      [false, true].map((escuro) => ({
        url: `/icons/splash/${arquivoSplash(ap, escuro)}`,
        media: mediaSplash(ap, escuro),
      })),
    ),
  },
  formatDetection: {
    // Impede o iOS de transformar valores e datas em links de telefone.
    telephone: false,
  },
  /**
   * Preview de link. `metadataBase` existe porque o og:image precisa de URL
   * absoluta: sem ele o Next monta o caminho relativo e o WhatsApp, o
   * Telegram e o iMessage nao carregam a imagem.
   */
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ??
      (process.env.VERCEL_PROJECT_PRODUCTION_URL
        ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
        : "http://localhost:3000"),
  ),
  openGraph: {
    type: "website",
    siteName: "Finara",
    locale: "pt_BR",
    title: "Finara — seu dinheiro, inteiro",
    description: "Contas, cartões, assinaturas, dívidas e recebíveis no mesmo lugar.",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Finara" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Finara — seu dinheiro, inteiro",
    description: "Contas, cartões, assinaturas, dívidas e recebíveis no mesmo lugar.",
    images: ["/og-image.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Bloquear zoom prejudica acessibilidade; deixamos livre de proposito.
  viewportFit: "cover",
  /**
   * Com o padrao (`resizes-visual`) o teclado do celular sobe POR CIMA da
   * pagina: numa folha ancorada embaixo, o botao de salvar fica escondido
   * atras do teclado. `resizes-content` encolhe a area util, entao a folha
   * sobe junto e o botao continua visivel.
   */
  interactiveWidget: "resizes-content",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfbfd" },
    { media: "(prefers-color-scheme: dark)", color: "#14161c" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="pt-BR"
      // suppressHydrationWarning: o next-themes escreve a classe do tema no
      // <html> antes do React hidratar, o que sempre gera divergencia aqui.
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          {/* O shell (sidebar/barra inferior) vive no grupo (app); as telas de
              login ficam em (auth) e nao devem herdar navegacao nenhuma. */}
          {children}
          <ServiceWorkerRegistration />
        </ThemeProvider>
      </body>
    </html>
  );
}
