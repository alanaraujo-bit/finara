import { cookies } from "next/headers";
import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { exigirSessao } from "@/lib/session";

/**
 * Tudo dentro de (app) exige login. A verificacao mora aqui, no layout do
 * grupo, e nao em cada pagina — assim uma tela nova nasce protegida por
 * padrao, em vez de depender de alguem lembrar de proteger.
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const { usuario, workspace } = await exigirSessao();

  // Lido aqui, no servidor, para o HTML ja' chegar do jeito certo — sem isso
  // a sidebar apareceria aberta por um instante a cada carregamento antes do
  // JavaScript aplicar a preferencia salva.
  const cookieStore = await cookies();
  const sidebarRecolhida = cookieStore.get("sidebar-recolhida")?.value === "1";

  return (
    <AppShell
      usuario={{ nome: usuario.name, email: usuario.email }}
      workspace={{ nome: workspace.nome, apelido: workspace.displayName }}
      sidebarRecolhidaInicial={sidebarRecolhida}
    >
      {children}
    </AppShell>
  );
}
