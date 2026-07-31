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

  return (
    <AppShell
      usuario={{ nome: usuario.name, email: usuario.email }}
      workspace={{ nome: workspace.nome, apelido: workspace.displayName }}
    >
      {children}
    </AppShell>
  );
}
