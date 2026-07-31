import { CreditCardIcon } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import { BotaoPagar } from "@/components/cartoes/botao-pagar";
import {
  BotaoDesfazerFatura,
  FormCartao,
  LinhaCartao,
} from "@/components/cartoes/form-cartao";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { rotuloData } from "@/lib/datas";
import { formatMoney, formatPercent } from "@/lib/money";
import { listarCartoes } from "@/lib/queries/cartoes";
import { listarContas, listarMembrosSimples } from "@/lib/queries/contas";
import { exigirSessao } from "@/lib/session";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Cartões e faturas",
};

export default async function CartoesPage() {
  const { usuario, workspace } = await exigirSessao();

  const [cartoes, contas, membros] = await Promise.all([
    listarCartoes(workspace.workspaceId),
    listarContas(workspace.workspaceId),
    listarMembrosSimples(workspace.workspaceId),
  ]);

  const opcoesContas = contas.map((c) => ({ id: c.id, nome: c.name }));

  const totalFaturas = cartoes.reduce((acc, c) => acc + c.faturaTotal, 0);

  return (
    <div className="mx-auto w-full max-w-[1040px] px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
      <header className="flex animate-[fade-up_0.4s_var(--ease-out-quint)_both] items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-text">Cartões e faturas</h1>
          <p className="mt-1 text-[13.5px] text-muted">
            {cartoes.length === 0 ? (
              "Nenhum cartão cadastrado"
            ) : (
              <>
                {cartoes.length} {cartoes.length === 1 ? "cartão" : "cartões"} ·{" "}
                <span className="tabular font-medium text-text">{formatMoney(totalFaturas)}</span>{" "}
                em faturas abertas
              </>
            )}
          </p>
        </div>
        <FormCartao
          contas={opcoesContas}
          temParceiro={membros.length > 1}
        />
      </header>

      {cartoes.length === 0 ? (
        <Card
          className="mt-6 animate-[fade-up_0.45s_var(--ease-out-quint)_both]"
          style={{ animationDelay: "60ms" }}
        >
          <EmptyState
            icone={<CreditCardIcon size={26} weight="duotone" />}
            titulo="Cadastre seus cartões"
            descricao="Informe o dia de fechamento e o de vencimento. Cada compra cai sozinha na fatura certa — inclusive quando você compra depois do fechamento."
          />
        </Card>
      ) : (
        <ul className="mt-6 space-y-3">
          {cartoes.map((c, i) => {
            const usoDoLimite = c.limite > 0 ? (c.faturaTotal / c.limite) * 100 : 0;
            const paga = c.faturaStatus === "paid";

            return (
              <LinhaCartao
                key={c.id}
                contas={opcoesContas}
                temParceiro={membros.length > 1}
                cartao={{
                  id: c.id,
                  nome: c.nome,
                  bandeira: c.bandeira,
                  final: c.finalCartao,
                  limite: c.limite,
                  diaFechamento: c.diaFechamento,
                  diaVencimento: c.diaVencimento,
                  contaPagamentoId: c.contaPagamentoId,
                  titularidade: c.ownerId === usuario.id ? "meu" : "conjunto",
                  // Uma fatura com valor ja' e' compra no historico.
                  temCompras: c.faturaTotal > 0 || c.faturaId !== null,
                }}
                className="animate-[fade-up_0.4s_var(--ease-out-quint)_both]"
                style={{ animationDelay: `${60 + i * 50}ms` }}
              >
                <Card className="overflow-hidden">
                  <CardContent className="p-5">
                    <div className="flex items-start gap-3.5">
                      <span
                        className="grid size-10 shrink-0 place-items-center rounded-xl"
                        style={{ background: `${c.cor}1f`, color: c.cor }}
                      >
                        <CreditCardIcon size={19} weight="duotone" />
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-[14px] font-semibold text-text">{c.nome}</p>
                          {c.finalCartao && (
                            <span className="tabular text-[11.5px] text-subtle">
                              •••• {c.finalCartao}
                            </span>
                          )}
                          {membros.length > 1 && (
                            <Badge tone={c.ownerId === null ? "primary" : "neutral"}>
                              {c.ownerId === null
                                ? "Conjunto"
                                : c.ownerId === usuario.id
                                  ? "Meu"
                                  : "Do parceiro"}
                            </Badge>
                          )}
                        </div>

                        <p className="mt-0.5 text-[11.5px] text-subtle">
                          {c.bandeira ? `${c.bandeira} · ` : ""}
                          fecha dia {c.diaFechamento} · vence dia {c.diaVencimento}
                        </p>
                      </div>

                    </div>

                    {/* ---------- fatura ---------- */}
                    <div className="mt-4 rounded-xl border border-border bg-surface-2/50 p-4">
                      <div className="flex flex-wrap items-end justify-between gap-3">
                        <div>
                          <p className="text-[11.5px] font-medium uppercase tracking-wide text-subtle">
                            {c.faturaReferencia ? "Fatura atual" : "Sem fatura"}
                          </p>
                          <p className="tabular mt-1 text-[24px] font-semibold leading-none text-text">
                            {formatMoney(c.faturaTotal)}
                          </p>
                          {c.faturaVencimento && (
                            <p className="mt-1.5 text-[12px] text-muted">
                              {paga ? "Paga · venceu" : "Vence"}{" "}
                              {rotuloData(c.faturaVencimento)}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          {paga && <Badge tone="income">Paga</Badge>}
                          {/* Desfazer o pagamento e' o que destrava corrigir
                              uma compra que caiu numa fatura ja' quitada. */}
                          {paga && c.faturaId && <BotaoDesfazerFatura faturaId={c.faturaId} />}
                          {!paga && c.faturaId && c.faturaTotal > 0 && (
                            <BotaoPagar
                              faturaId={c.faturaId}
                              valor={formatMoney(c.faturaTotal)}
                            />
                          )}
                        </div>
                      </div>

                      {c.limite > 0 && (
                        <div className="mt-4">
                          <div className="flex items-baseline justify-between text-[11.5px]">
                            <span className="text-muted">
                              Limite usado · {formatPercent(c.faturaTotal, c.limite)}
                            </span>
                            <span className="tabular text-subtle">
                              {formatMoney(Math.max(c.limite - c.faturaTotal, 0))} disponível
                            </span>
                          </div>
                          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-3">
                            <div
                              className={cn(
                                "h-full origin-left rounded-full",
                                // Acima de 80% do limite vira alerta visual:
                                // e' onde o risco de estourar comeca.
                                usoDoLimite >= 80
                                  ? "bg-expense"
                                  : usoDoLimite >= 50
                                    ? "bg-warning"
                                    : "bg-primary",
                              )}
                              style={{
                                width: `${Math.min(usoDoLimite, 100)}%`,
                                animation: `grow-x 0.7s var(--ease-out-quint) ${150 + i * 60}ms both`,
                              }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </LinhaCartao>
            );
          })}
        </ul>
      )}
    </div>
  );
}
