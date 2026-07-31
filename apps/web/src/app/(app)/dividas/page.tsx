import { and, asc, db, debtInstallments, debts, desc, eq, ne } from "@finara/db";
import { TrendDownIcon } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import {
  AcoesDivida,
  BotaoDesfazerParcela,
  BotaoPagarParcela,
  FormDivida,
} from "@/components/dividas/painel-dividas";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { paraDataLocal, rotuloData } from "@/lib/datas";
import { formatMoney, formatPercent } from "@/lib/money";
import { listarContas, listarMembrosSimples } from "@/lib/queries/contas";
import { exigirSessao } from "@/lib/session";

export const metadata: Metadata = {
  title: "Dívidas",
};

export default async function DividasPage() {
  const { usuario, workspace } = await exigirSessao();

  const [lista, parcelas, contas, membros, pagas] = await Promise.all([
    db
      .select()
      .from(debts)
      // Quitada some sozinha; "canceled" e' a divida arquivada pela pessoa.
      .where(
        and(
          eq(debts.workspaceId, workspace.workspaceId),
          ne(debts.status, "paid"),
          ne(debts.status, "canceled"),
        ),
      )
      .orderBy(asc(debts.name)),
    db
      .select()
      .from(debtInstallments)
      .where(
        and(
          eq(debtInstallments.workspaceId, workspace.workspaceId),
          eq(debtInstallments.status, "pending"),
        ),
      )
      .orderBy(asc(debtInstallments.dueDate)),
    listarContas(workspace.workspaceId),
    listarMembrosSimples(workspace.workspaceId),
    /**
     * A ultima parcela PAGA de cada divida. E' o que o botao de desfazer
     * precisa: sem ele, uma parcela quitada com valor ou conta errada nao
     * teria caminho de volta pela interface.
     *
     * So' a ultima de cada uma: desfazer no meio deixaria a contagem de
     * "quantas ja' paguei" furada.
     */
    db
      .select()
      .from(debtInstallments)
      .where(
        and(
          eq(debtInstallments.workspaceId, workspace.workspaceId),
          eq(debtInstallments.status, "paid"),
        ),
      )
      .orderBy(desc(debtInstallments.number)),
  ]);

  const hoje = paraDataLocal();
  const totalDevido = lista.reduce((a, d) => a + (d.totalAmount - d.paidAmount), 0);
  const opcoesContas = contas.map((c) => ({ id: c.id, nome: c.name }));

  return (
    <div className="mx-auto w-full max-w-[1040px] px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
      <header className="flex animate-[fade-up_0.4s_var(--ease-out-quint)_both] items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-text">Dívidas</h1>
          <p className="mt-1 text-[13.5px] text-muted">
            {lista.length === 0 ? (
              "Nenhuma dívida ativa"
            ) : (
              <>
                {lista.length} {lista.length === 1 ? "dívida" : "dívidas"} ·{" "}
                <span className="tabular font-medium text-expense">
                  {formatMoney(totalDevido)}
                </span>{" "}
                em aberto
              </>
            )}
          </p>
        </div>
        <FormDivida dataPadrao={hoje} temParceiro={membros.length > 1} />
      </header>

      {lista.length === 0 ? (
        <Card
          className="mt-6 animate-[fade-up_0.45s_var(--ease-out-quint)_both]"
          style={{ animationDelay: "60ms" }}
        >
          <EmptyState
            icone={<TrendDownIcon size={26} weight="duotone" />}
            titulo="Nenhuma dívida por aqui"
            descricao="Financiamento, empréstimo ou aquele dinheiro que você pegou emprestado. O Finara gera as parcelas e coloca cada vencimento no calendário."
          />
        </Card>
      ) : (
        <ul className="mt-6 space-y-3">
          {lista.map((d, i) => {
            const pago = d.paidAmount;
            const restante = d.totalAmount - pago;
            const proxima = parcelas.find((p) => p.debtId === d.id);
            // A lista de pagas ja' vem ordenada por numero decrescente, entao
            // o primeiro achado e' a ultima parcela quitada desta divida.
            const ultimaPaga = pagas.find((p) => p.debtId === d.id);
            const atrasada = proxima ? proxima.dueDate < hoje : false;

            return (
              <li
                key={d.id}
                className="animate-[fade-up_0.4s_var(--ease-out-quint)_both]"
                style={{ animationDelay: `${60 + i * 50}ms` }}
              >
                <Card className="group">
                  <CardContent className="p-5">
                    <div className="flex items-start gap-3.5">
                      <span
                        className="grid size-10 shrink-0 place-items-center rounded-xl"
                        style={{ background: `${d.color}1f`, color: d.color }}
                      >
                        <TrendDownIcon size={19} weight="duotone" />
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-[14px] font-semibold text-text">{d.name}</p>
                          {atrasada && <Badge tone="expense">Atrasada</Badge>}
                          {membros.length > 1 && d.ownerId !== null && (
                            <Badge tone="neutral">
                              {d.ownerId === usuario.id ? "Minha" : "Do parceiro"}
                            </Badge>
                          )}
                        </div>
                        <p className="mt-0.5 text-[11.5px] text-subtle">
                          {d.creditor ? `${d.creditor} · ` : ""}
                          {d.installmentsPaid} de {d.installmentsTotal} parcelas pagas
                        </p>
                      </div>

                      <div className="shrink-0 text-right">
                        <p className="tabular text-[17px] font-semibold text-text">
                          {formatMoney(restante)}
                        </p>
                        <p className="text-[11px] text-subtle">de {formatMoney(d.totalAmount)}</p>
                      </div>

                      <AcoesDivida
                        dataPadrao={hoje}
                        temParceiro={membros.length > 1}
                        divida={{
                          id: d.id,
                          nome: d.name,
                          credor: d.creditor,
                          parcelasTotal: d.installmentsTotal,
                          parcelasPagas: d.installmentsPaid,
                          valorParcela: proxima?.amount ?? 0,
                          proximoVencimento: proxima?.dueDate ?? hoje,
                          titularidade: d.ownerId === usuario.id ? "meu" : "conjunto",
                        }}
                      />
                    </div>

                    {/* progresso da quitacao */}
                    <div className="mt-4">
                      <div className="flex items-baseline justify-between text-[11.5px]">
                        <span className="text-muted">
                          {formatPercent(pago, d.totalAmount)} quitado
                        </span>
                        <span className="tabular text-subtle">{formatMoney(pago)} pago</span>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-2">
                        <div
                          className="h-full origin-left rounded-full bg-income"
                          style={{
                            width: `${d.totalAmount > 0 ? (pago / d.totalAmount) * 100 : 0}%`,
                            animation: `grow-x 0.7s var(--ease-out-quint) ${150 + i * 60}ms both`,
                          }}
                        />
                      </div>
                    </div>

                    {proxima && (
                      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface-2/50 px-3.5 py-3">
                        <div>
                          <p className="text-[11.5px] text-subtle">
                            Parcela {proxima.number}/{d.installmentsTotal}
                          </p>
                          <p className="text-[13px] font-medium text-text">
                            vence {rotuloData(proxima.dueDate, hoje)}
                          </p>
                        </div>
                        <BotaoPagarParcela
                          parcelaId={proxima.id}
                          valor={proxima.amount}
                          contas={opcoesContas}
                        />
                      </div>
                    )}

                    {/* `div`, e nao `p`: o botao de desfazer renderiza um
                        `div` dentro, e `div` dentro de `p` e' HTML invalido —
                        o navegador reescreve a arvore e o React acusa erro de
                        hidratacao. */}
                    {ultimaPaga && (
                      <div className="mt-2.5 flex items-center justify-end gap-1.5 text-[11.5px] text-subtle">
                        <span>Parcela {ultimaPaga.number} paga</span>
                        <BotaoDesfazerParcela parcelaId={ultimaPaga.id} />
                      </div>
                    )}
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
