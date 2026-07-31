import { and, asc, db, desc, eq, ne, receivables } from "@finara/db";
import { HandCoinsIcon } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import {
  AcoesRecebivel,
  BotaoDesfazerRecebimento,
  BotaoReceber,
  FormRecebivel,
} from "@/components/a-receber/painel-receber";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { paraDataLocal, rotuloData } from "@/lib/datas";
import { formatMoney } from "@/lib/money";
import { listarContas, listarMembrosSimples } from "@/lib/queries/contas";
import { exigirSessao } from "@/lib/session";

export const metadata: Metadata = {
  title: "A receber",
};

export default async function AReceberPage() {
  const { usuario, workspace } = await exigirSessao();

  const [lista, contas, membros, recebidos] = await Promise.all([
    db
      .select()
      .from(receivables)
      .where(
        and(
          eq(receivables.workspaceId, workspace.workspaceId),
          ne(receivables.status, "received"),
          ne(receivables.status, "canceled"),
        ),
      )
      .orderBy(asc(receivables.dueDate), asc(receivables.name)),
    listarContas(workspace.workspaceId),
    listarMembrosSimples(workspace.workspaceId),
    /**
     * Os ja' recebidos aparecem numa secao propria, e nao somem da tela.
     *
     * Sem isto o botao de desfazer nao teria onde morar, e um recebimento
     * lancado na conta errada viraria beco sem saida: o recebivel some, o
     * lancamento fica, e nao ha' caminho de volta pela interface.
     *
     * Limitado aos 8 mais recentes — isto e' area de correcao, nao historico.
     */
    db
      .select()
      .from(receivables)
      .where(
        and(
          eq(receivables.workspaceId, workspace.workspaceId),
          eq(receivables.status, "received"),
        ),
      )
      .orderBy(desc(receivables.receivedAt))
      .limit(8),
  ]);

  const hoje = paraDataLocal();
  const total = lista.reduce((a, r) => a + (r.amount - r.receivedAmount), 0);
  const opcoesContas = contas.map((c) => ({ id: c.id, nome: c.name }));

  return (
    <div className="mx-auto w-full max-w-[1040px] px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
      <header className="flex animate-[fade-up_0.4s_var(--ease-out-quint)_both] items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-text">A receber</h1>
          <p className="mt-1 text-[13.5px] text-muted">
            {lista.length === 0 ? (
              "Nada em aberto"
            ) : (
              <>
                {lista.length} {lista.length === 1 ? "recebível" : "recebíveis"} ·{" "}
                <span className="tabular font-medium text-income">{formatMoney(total)}</span>
              </>
            )}
          </p>
        </div>
        <FormRecebivel temParceiro={membros.length > 1} />
      </header>

      {lista.length === 0 ? (
        <Card
          className="mt-6 animate-[fade-up_0.45s_var(--ease-out-quint)_both]"
          style={{ animationDelay: "60ms" }}
        >
          <EmptyState
            icone={<HandCoinsIcon size={26} weight="duotone" />}
            titulo="Dinheiro que ainda vai entrar"
            descricao="Emprestou para alguém, tem um freela para receber ou um reembolso pendente? Registre aqui para não esquecer — e para o saldo previsto fazer sentido."
          />
        </Card>
      ) : (
        <ul className="mt-6 space-y-2">
          {lista.map((r, i) => {
            const atrasado = r.dueDate ? r.dueDate < hoje : false;

            return (
              <li
                key={r.id}
                className="animate-[fade-up_0.4s_var(--ease-out-quint)_both]"
                style={{ animationDelay: `${60 + i * 40}ms` }}
              >
                <Card>
                  <CardContent className="flex flex-wrap items-center gap-3.5 p-4">
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-income-soft text-income">
                      <HandCoinsIcon size={19} weight="duotone" />
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-[14px] font-semibold text-text">{r.name}</p>
                        {atrasado && <Badge tone="warning">Atrasado</Badge>}
                        {membros.length > 1 && r.ownerId !== null && (
                          <Badge tone="neutral">
                            {r.ownerId === usuario.id ? "Meu" : "Do parceiro"}
                          </Badge>
                        )}
                      </div>
                      <p className="mt-0.5 text-[11.5px] text-subtle">
                        {r.debtor ?? "Sem devedor informado"}
                        {r.dueDate ? ` · previsto ${rotuloData(r.dueDate, hoje)}` : ""}
                      </p>
                    </div>

                    <span className="tabular shrink-0 text-[15px] font-semibold text-income">
                      {formatMoney(r.amount - r.receivedAmount)}
                    </span>

                    <BotaoReceber
                      id={r.id}
                      valor={r.amount - r.receivedAmount}
                      contas={opcoesContas}
                    />

                    <AcoesRecebivel
                      temParceiro={membros.length > 1}
                      recebivel={{
                        id: r.id,
                        nome: r.name,
                        devedor: r.debtor,
                        valor: r.amount,
                        vencimento: r.dueDate,
                        titularidade: r.ownerId === usuario.id ? "meu" : "conjunto",
                      }}
                    />
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      {recebidos.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-2.5 px-1 text-[12px] font-semibold uppercase tracking-wide text-subtle">
            Recebidos recentemente
          </h2>
          <Card className="divide-y divide-border">
            {recebidos.map((r) => (
              <div key={r.id} className="group flex items-center gap-3.5 px-4 py-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-surface-2 text-subtle">
                  <HandCoinsIcon size={17} weight="duotone" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-medium text-text">{r.name}</p>
                  <p className="text-[11.5px] text-subtle">
                    {r.debtor ? `${r.debtor} · ` : ""}
                    recebido
                  </p>
                </div>
                <span className="tabular shrink-0 text-[13.5px] font-semibold text-income">
                  {formatMoney(r.receivedAmount)}
                </span>
                <BotaoDesfazerRecebimento id={r.id} />
              </div>
            ))}
          </Card>
          <p className="mt-2 px-1 text-[12px] text-subtle">
            Desfazer apaga o lançamento que o recebimento criou e devolve o valor ao saldo da conta.
          </p>
        </section>
      )}
    </div>
  );
}
