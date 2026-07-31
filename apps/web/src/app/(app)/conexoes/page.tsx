import { db, desc, eq, openFinanceConnections } from "@finara/db";
import { InfoIcon, PlugsConnectedIcon } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import { ConectarBanco } from "@/components/openfinance/conectar-banco";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { exigirSessao } from "@/lib/session";

export const metadata: Metadata = {
  title: "Conexões",
};

const ROTULO_STATUS: Record<string, { texto: string; tom: "income" | "warning" | "expense" | "neutral" }> = {
  active: { texto: "Conectado", tom: "income" },
  pending: { texto: "Aguardando", tom: "neutral" },
  needs_action: { texto: "Precisa de ação", tom: "warning" },
  consent_expired: { texto: "Consentimento expirado", tom: "warning" },
  error: { texto: "Com erro", tom: "expense" },
  disconnected: { texto: "Desconectado", tom: "neutral" },
};

export default async function ConexoesPage() {
  const { workspace } = await exigirSessao();

  const conexoes = await db
    .select()
    .from(openFinanceConnections)
    .where(eq(openFinanceConnections.workspaceId, workspace.workspaceId))
    .orderBy(desc(openFinanceConnections.createdAt));

  // Sandbox só faz sentido enquanto não estamos em produção de verdade.
  const incluirSandbox = process.env.NODE_ENV !== "production";

  return (
    <div className="mx-auto w-full max-w-[820px] px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
      <header className="animate-[fade-up_0.4s_var(--ease-out-quint)_both]">
        <h1 className="text-2xl font-semibold tracking-tight text-text">Conexões</h1>
        <p className="mt-1 text-[13.5px] text-muted">
          Traga seus lançamentos automaticamente pelo Open Finance.
        </p>
      </header>

      <Card
        className="mt-6 animate-[fade-up_0.45s_var(--ease-out-quint)_both]"
        style={{ animationDelay: "60ms" }}
      >
        <CardHeader>
          <div className="flex items-start gap-3.5">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary-soft-fg">
              <PlugsConnectedIcon size={19} weight="duotone" />
            </span>
            <div>
              <CardTitle>Open Finance</CardTitle>
              <CardDescription className="mt-1">
                O Finara funciona 100% no manual. Conectar um banco é só um atalho: os lançamentos
                passam a chegar sozinhos, e você segue podendo editar tudo.
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-5">
          {conexoes.length > 0 && (
            <ul className="mb-5 space-y-2">
              {conexoes.map((c) => {
                const rotulo = ROTULO_STATUS[c.status] ?? ROTULO_STATUS.pending!;
                return (
                  <li
                    key={c.id}
                    className="flex items-center gap-3 rounded-xl border border-border bg-surface-2/50 px-3 py-2.5"
                  >
                    <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-surface text-subtle">
                      <PlugsConnectedIcon size={16} weight="duotone" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13.5px] font-medium text-text">
                        {c.institutionName}
                      </p>
                      <p className="text-[11.5px] text-subtle">
                        {c.lastSyncedAt
                          ? `Sincronizado em ${new Intl.DateTimeFormat("pt-BR", {
                              dateStyle: "short",
                              timeStyle: "short",
                            }).format(c.lastSyncedAt)}`
                          : "Ainda não sincronizado"}
                      </p>
                    </div>
                    <Badge tone={rotulo.tom}>{rotulo.texto}</Badge>
                  </li>
                );
              })}
            </ul>
          )}

          <ConectarBanco incluirSandbox={incluirSandbox} />

          <div className="mt-5 flex gap-2.5 rounded-xl border border-border bg-surface-2/50 p-3">
            <InfoIcon size={16} weight="duotone" className="mt-0.5 shrink-0 text-info" />
            <p className="text-[12.5px] leading-relaxed text-muted">
              Depois de autorizar, o banco avisa o Pluggy e o Pluggy avisa o Finara — a importação
              roda fora desta tela e leva alguns minutos. Atualize a página para ver a data da
              última sincronização mudar.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
