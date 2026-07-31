import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ServiceWorkerRegistration } from "@/components/service-worker";
import { ThemeProvider } from "@/components/theme-provider";
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
   * O iOS ignora os icones do manifesto: na tela de inicio ele usa o
   * `apple-touch-icon`, e sem esta declaracao cai num favicon esticado ou
   * numa miniatura da propria tela. E' a diferenca entre parecer app e
   * parecer atalho de navegador.
   */
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    title: "Finara",
    // "default" mantem a barra de status legivel nos dois temas.
    statusBarStyle: "default",
  },
  formatDetection: {
    // Impede o iOS de transformar valores e datas em links de telefone.
    telephone: false,
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
