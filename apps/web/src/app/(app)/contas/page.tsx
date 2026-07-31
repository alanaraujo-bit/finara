import { and, db, eq, sql, transactions } from "@finara/db";
import { BankIcon, WalletIcon } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import { FormConta, LinhaConta } from "@/components/contas/form-conta";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatMoney } from "@/lib/money";
import { listarContas, listarMembrosSimples } from "@/lib/queries/contas";
import { exigirSessao } from "@/lib/session";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Contas",
};

const ROTULO_TIPO: Record<string, string> = {
  checking: "Conta corrente",
  savings: "Poupança",
  cash: "Dinheiro",
  investment: "Investimentos",
  wallet: "Carteira digital",
  other: "Outro",
};

export default async function ContasPage() {
  const { usuario, workspace } = await exigirSessao();

  const [contas, membros, movimentadas] = await Promise.all([
    listarContas(workspace.workspaceId),
    listarMembrosSimples(workspace.workspaceId),
    /**
     * Quais contas ja' tem lancamento. So' isso decide se o botao de excluir
     * aparece: as FKs sao `SET NULL`, entao apagar uma conta com movimento
     * nao daria erro nenhum — soltaria os lancamentos em silencio e o extrato
     * passaria a mostrar gastos sem origem. Oferecer um botao que a action
     * vai recusar e' pior do que nao oferecer.
     */
    db
      .select({ contaId: transactions.accountId, quantos: sql<number>`count(*)::int` })
      .from(transactions)
      .where(
        and(
          eq(transactions.workspaceId, workspace.workspaceId),
          sql`${transactions.accountId} is not null`,
        ),
      )
      .groupBy(transactions.accountId),
  ]);

  const comLancamento = new Set(movimentadas.map((m) => m.contaId));

  const total = contas
    .filter((c) => !c.excludeFromTotals)
    .reduce((acc, c) => acc + c.currentBalance, 0);

  return (
    <div className="mx-auto w-full max-w-[1040px] px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
      <header className="flex animate-[fade-up_0.4s_var(--ease-out-quint)_both] items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-text">Contas</h1>
          <p className="mt-1 text-[13.5px] text-muted">
            {contas.length === 0 ? (
              "Nenhuma conta cadastrada"
            ) : (
              <>
                {contas.length} {contas.length === 1 ? "conta" : "contas"} ·{" "}
                <span className="tabular font-medium text-text">{formatMoney(total)}</span>
              </>
            )}
          </p>
        </div>
        <FormConta temParceiro={membros.length > 1} />
      </header>

      {contas.length === 0 ? (
        <Card
          className="mt-6 animate-[fade-up_0.45s_var(--ease-out-quint)_both]"
          style={{ animationDelay: "60ms" }}
        >
          <EmptyState
            icone={<BankIcon size={26} weight="duotone" />}
            titulo="Cadastre onde seu dinheiro está"
            descricao="Conta corrente, poupança, carteira digital ou dinheiro em espécie. É o que permite o saldo se atualizar sozinho a cada lançamento."
          />
        </Card>
      ) : (
        <ul className="mt-6 grid gap-3 sm:grid-cols-2">
          {contas.map((c, i) => (
            <LinhaConta
              key={c.id}
              temParceiro={membros.length > 1}
              conta={{
                id: c.id,
                nome: c.name,
                tipo: c.type,
                instituicao: c.institution,
                titularidade: c.ownerId === null ? "conjunta" : "minha",
                saldo: c.currentBalance,
                arquivada: c.isArchived,
                temLancamentos: comLancamento.has(c.id),
              }}
              className="animate-[fade-up_0.4s_var(--ease-out-quint)_both]"
              style={{ animationDelay: `${60 + i * 40}ms` }}
            >
              <Card className="h-full transition-shadow hover:shadow-sm">
                <CardContent className="flex items-start gap-3.5 p-5">
                  <span
                    className="grid size-10 shrink-0 place-items-center rounded-xl"
                    style={{ background: `${c.color}1f`, color: c.color }}
                  >
                    {c.type === "cash" || c.type === "wallet" ? (
                      <WalletIcon size={19} weight="duotone" />
                    ) : (
                      <BankIcon size={19} weight="duotone" />
                    )}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="truncate text-[14px] font-semibold text-text">{c.name}</p>
                      {/* ownerId nulo = conta do casal. */}
                      {membros.length > 1 && (
                        <Badge tone={c.ownerId === null ? "primary" : "neutral"}>
                          {c.ownerId === null
                            ? "Conjunta"
                            : c.ownerId === usuario.id
                              ? "Minha"
                              : "Do parceiro"}
                        </Badge>
                      )}
                    </div>

                    <p className="mt-0.5 text-[11.5px] text-subtle">
                      {ROTULO_TIPO[c.type] ?? c.type}
                      {c.institution ? ` · ${c.institution}` : ""}
                    </p>

                    <p
                      className={cn(
                        "tabular mt-2.5 text-[19px] font-semibold",
                        c.currentBalance < 0 ? "text-expense" : "text-text",
                      )}
                    >
                      {formatMoney(c.currentBalance)}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </LinhaConta>
          ))}
        </ul>
      )}
    </div>
  );
}
