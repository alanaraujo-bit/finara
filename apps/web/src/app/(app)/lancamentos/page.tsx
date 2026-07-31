import {
  ArrowDownLeftIcon,
  ArrowUpRightIcon,
  PlusIcon,
  ReceiptIcon,
  SparkleIcon,
} from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { paraDataLocal, rotuloData } from "@/lib/datas";
import { formatMoney } from "@/lib/money";
import { contarLancamentos, listarLancamentos } from "@/lib/queries/contas";
import { exigirSessao } from "@/lib/session";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Lançamentos",
};

export default async function LancamentosPage() {
  const { workspace } = await exigirSessao();

  const [lancamentos, total] = await Promise.all([
    listarLancamentos({ workspaceId: workspace.workspaceId, limite: 100 }),
    contarLancamentos(workspace.workspaceId),
  ]);

  const hoje = paraDataLocal();

  // Agrupa por dia: no extrato, ver o total do dia importa mais que a hora.
  const porDia = new Map<string, typeof lancamentos>();
  for (const l of lancamentos) {
    const lista = porDia.get(l.data) ?? [];
    lista.push(l);
    porDia.set(l.data, lista);
  }

  return (
    <div className="mx-auto w-full max-w-[1040px] px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
      <header className="flex animate-[fade-up_0.4s_var(--ease-out-quint)_both] items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-text">Lançamentos</h1>
          <p className="mt-1 text-[13.5px] text-muted">
            {total === 0
              ? "Nenhum lançamento ainda"
              : `${total} ${total === 1 ? "lançamento" : "lançamentos"}`}
          </p>
        </div>
        <Link href="/lancamentos/novo" className={cn(buttonVariants({ size: "md" }), "gap-1.5")}>
          <PlusIcon size={16} weight="bold" />
          Novo
        </Link>
      </header>

      <Card
        className="mt-6 animate-[fade-up_0.45s_var(--ease-out-quint)_both] overflow-hidden"
        style={{ animationDelay: "60ms" }}
      >
        {lancamentos.length === 0 ? (
          <EmptyState
            icone={<ReceiptIcon size={26} weight="duotone" />}
            titulo="Seu extrato começa aqui"
            descricao="Lance o primeiro gasto ou receita. Leva alguns segundos, e o saldo se atualiza na hora."
            acao={
              <Link href="/lancamentos/novo" className={cn(buttonVariants({ size: "md" }), "gap-1.5")}>
                <PlusIcon size={16} weight="bold" />
                Novo lançamento
              </Link>
            }
          />
        ) : (
          <CardContent className="p-0">
            {[...porDia.entries()].map(([dia, itens], grupo) => {
              const totalDia = itens.reduce(
                (acc, i) => acc + (i.tipo === "income" ? i.valor : -i.valor),
                0,
              );

              return (
                <section key={dia}>
                  <div className="flex items-baseline justify-between gap-3 border-b border-border bg-surface-2/50 px-5 py-2">
                    <span className="text-[12px] font-semibold uppercase tracking-wide text-subtle">
                      {rotuloData(dia, hoje)}
                    </span>
                    <span
                      className={cn(
                        "tabular text-[12.5px] font-medium",
                        totalDia >= 0 ? "text-income" : "text-muted",
                      )}
                    >
                      {totalDia >= 0 ? "+" : "−"}
                      {formatMoney(Math.abs(totalDia))}
                    </span>
                  </div>

                  <ul className="divide-y divide-border">
                    {itens.map((l, i) => (
                      <li
                        key={l.id}
                        className="flex animate-[fade-up_0.35s_var(--ease-out-quint)_both] items-center gap-3 px-5 py-3 transition-colors hover:bg-surface-2"
                        style={{ animationDelay: `${Math.min(grupo * 40 + i * 20, 300)}ms` }}
                      >
                        <span
                          className={cn(
                            "grid size-9 shrink-0 place-items-center rounded-full",
                            l.tipo === "income"
                              ? "bg-income-soft text-income"
                              : "bg-expense-soft text-expense",
                          )}
                        >
                          {l.tipo === "income" ? (
                            <ArrowDownLeftIcon size={16} weight="bold" />
                          ) : (
                            <ArrowUpRightIcon size={16} weight="bold" />
                          )}
                        </span>

                        <div className="min-w-0 flex-1">
                          <p className="flex items-center gap-1.5 truncate text-[13.5px] font-medium text-text">
                            {l.descricao}
                            {/* Compra parcelada: sem isto, doze linhas iguais
                                no extrato parecem doze compras repetidas. */}
                            {l.parcela && l.parcelasTotal && (
                              <span className="tabular shrink-0 rounded-md bg-surface-2 px-1.5 py-0.5 text-[10.5px] font-medium text-muted">
                                {l.parcela}/{l.parcelasTotal}
                              </span>
                            )}
                            {l.importado && (
                              <SparkleIcon
                                size={12}
                                weight="fill"
                                className="shrink-0 text-primary"
                                aria-label="Importado automaticamente"
                              />
                            )}
                          </p>
                          <p className="flex items-center gap-1.5 text-[11.5px] text-subtle">
                            {l.categoria && (
                              <span className="flex items-center gap-1">
                                <span
                                  className="size-1.5 rounded-full"
                                  style={{ background: l.categoriaCor ?? "var(--text-subtle)" }}
                                />
                                {l.categoria}
                              </span>
                            )}
                            {l.categoria && l.origem && <span>·</span>}
                            {l.origem}
                          </p>
                        </div>

                        <div className="flex shrink-0 items-center gap-2.5">
                          {l.status === "pending" && <Badge tone="warning">Previsto</Badge>}
                          <span
                            className={cn(
                              "tabular text-[13.5px] font-semibold",
                              l.tipo === "income" ? "text-income" : "text-text",
                            )}
                          >
                            {l.tipo === "income" ? "+" : "−"}
                            {formatMoney(l.valor)}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </CardContent>
        )}
      </Card>
    </div>
  );
}
