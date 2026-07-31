import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AppShell } from "@/components/app-shell";
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
          <AppShell>{children}</AppShell>
          <ServiceWorkerRegistration />
        </ThemeProvider>
      </body>
    </html>
  );
}
