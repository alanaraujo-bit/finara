import { UsersThreeIcon } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import { ConviteParceiro } from "@/components/ajustes/convite-parceiro";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { exigirSessao } from "@/lib/session";
import { listarMembros } from "@/lib/workspace";

export const metadata: Metadata = {
  title: "Ajustes",
};

export default async function AjustesPage() {
  const { usuario, workspace } = await exigirSessao();
  const membros = await listarMembros(workspace.workspaceId);

  return (
    <div className="mx-auto w-full max-w-[820px] px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
      <header className="animate-[fade-up_0.4s_var(--ease-out-quint)_both]">
        <h1 className="text-2xl font-semibold tracking-tight text-text">Ajustes</h1>
        <p className="mt-1 text-[13.5px] text-muted">
          {workspace.nome} · {membros.length === 1 ? "só você" : `${membros.length} pessoas`}
        </p>
      </header>

      <Card
        className="mt-6 animate-[fade-up_0.45s_var(--ease-out-quint)_both]"
        style={{ animationDelay: "60ms" }}
      >
        <CardHeader>
          <div className="flex items-start gap-3.5">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary-soft-fg">
              <UsersThreeIcon size={19} weight="duotone" />
            </span>
            <div>
              <CardTitle>Modo casal</CardTitle>
              <CardDescription className="mt-1">
                Convide alguém para dividir este espaço. Cada um entra com o próprio login, e todo
                lançamento pode ser marcado como individual ou conjunto.
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-5">
          <ul className="mb-5 space-y-2">
            {membros.map((m) => (
              <li
                key={m.userId}
                className="flex items-center gap-3 rounded-xl border border-border bg-surface-2/50 px-3 py-2.5"
              >
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ background: m.color }}
                  aria-hidden
                />
                <span className="flex-1 text-[13.5px] font-medium text-text">
                  {m.displayName ?? "Sem apelido"}
                  {m.userId === usuario.id && (
                    <span className="ml-1.5 text-[12px] font-normal text-subtle">(você)</span>
                  )}
                </span>
                <Badge tone={m.role === "owner" ? "primary" : "neutral"}>
                  {m.role === "owner" ? "Dono" : "Parceiro"}
                </Badge>
              </li>
            ))}
          </ul>

          <ConviteParceiro podeConvidar={membros.length < 2} />
        </CardContent>
      </Card>
    </div>
  );
}
