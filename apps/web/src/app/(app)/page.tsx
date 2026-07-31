import {
  ArrowDownLeftIcon,
  ArrowUpRightIcon,
  BankIcon,
  CreditCardIcon,
  HandCoinsIcon,
  PlusIcon,
  ReceiptIcon,
  RepeatIcon,
  TrendDownIcon,
  TrendUpIcon,
} from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { nomeDoMes, paraDataLocal, rotuloData } from "@/lib/datas";
import { formatMoney, formatPercent, splitMoney } from "@/lib/money";
import {
  obterGastosPorCategoria,
  obterLancamentosRecentes,
  obterProximosVencimentos,
  obterResumo,
} from "@/lib/queries/resumo";
import { exigirSessao } from "@/lib/session";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Visão geral",
};

/**
 * A tela de abertura do app — `start_url` do manifesto aponta para cá, então
 * é ela que roda toda vez que alguém toca no ícone.
 *
 * Por isso o cabeçalho está FORA do `<Suspense>` e as consultas estão dentro.
 * Antes, a página inteira era um `await` só: o servidor não mandava byte
 * nenhum enquanto as quatro consultas não voltassem, e o app ficava numa tela
 * vazia esse tempo todo. Agora o primeiro pedaço do HTML — moldura, saudação,
 * botão de lançar — sai imediatamente, e os números chegam por cima quando
 * ficam prontos, sem uma segunda viagem à rede.
 *
 * `exigirSessao()` continua aqui em cima e não custa nada: o layout do grupo
 * já a resolveu, e o `cache()` do React faz esta chamada devolver o mesmo
 * resultado sem tocar no banco de novo.
 */
export default async function DashboardPage() {
  const { usuario, workspace } = await exigirSessao();
  const primeiroNome = workspace.displayName ?? usuario.name.split(/\s+/)[0];

  return (
    <div className="mx-auto w-full max-w-[1320px] px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
      <header className="flex animate-[fade-up_0.4s_var(--ease-out-quint)_both] flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[13px] text-muted">Bem-vindo de volta, {primeiroNome}</p>
          <h1 className="mt-0.5 text-2xl font-semibold tracking-tight text-text">Visão geral</h1>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden rounded-lg border border-border bg-surface px-3 py-2 text-[13px] font-medium capitalize text-muted sm:block">
            {nomeDoMes()}
          </span>
          <Link href="/lancamentos/novo" className={cn(buttonVariants({ size: "md" }), "gap-1.5")}>
            <PlusIcon size={16} weight="bold" />
            Novo lançamento
          </Link>
        </div>
      </header>

      <Suspense fallback={<EsqueletoPainel />}>
        <Painel workspaceId={workspace.workspaceId} />
      </Suspense>
    </div>
  );
}

async function Painel({ workspaceId: ws }: { workspaceId: string }) {
  const [resumo, categorias, recentes, vencimentos] = await Promise.all([
    obterResumo(ws),
    obterGastosPorCategoria(ws),
    obterLancamentosRecentes(ws, 6),
    obterProximosVencimentos(ws),
  ]);

  const saldo = splitMoney(resumo.saldoTotal);
  const totalCategorias = categorias.reduce((acc, c) => acc + c.valor, 0);
  const hoje = paraDataLocal();

  // Conta nova: nada de mostrar seis cartoes zerados, que so' dao a impressao
  // de app quebrado. Mostramos o caminho a seguir.
  const contaVazia = resumo.totalContas === 0 && recentes.length === 0;

  return (
    <>
      {contaVazia ? (
        <Card
          className="mt-6 animate-[fade-up_0.45s_var(--ease-out-quint)_both]"
          style={{ animationDelay: "40ms" }}
        >
          <EmptyState
            icone={<BankIcon size={26} weight="duotone" />}
            titulo="Vamos começar pelo começo"
            descricao="Cadastre onde seu dinheiro está hoje. Depois é só lançar — ou conectar um banco e deixar os lançamentos chegarem sozinhos."
            acao={
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Link href="/contas" className={cn(buttonVariants({ size: "md" }), "gap-1.5")}>
                  <BankIcon size={16} weight="duotone" />
                  Cadastrar conta
                </Link>
                <Link
                  href="/conexoes"
                  className={cn(buttonVariants({ variant: "outline", size: "md" }), "gap-1.5")}
                >
                  Conectar banco
                </Link>
              </div>
            }
          />
        </Card>
      ) : (
        <>
          {/* ---------- saldo + indicadores ---------- */}
          <section className="mt-6 grid gap-4 lg:grid-cols-[1.35fr_1fr]">
            <Card
              className="animate-[fade-up_0.45s_var(--ease-out-quint)_both]"
              style={{ animationDelay: "40ms" }}
            >
              <CardContent className="p-6">
                <div className="flex items-center gap-2">
                  <p className="text-[13px] font-medium text-muted">Saldo total</p>
                  {/* Sem mes anterior nao ha' comparacao honesta: o selo some. */}
                  {resumo.variacaoMes !== null && (
                    <Badge tone={resumo.variacaoMes <= 0 ? "income" : "expense"}>
                      {resumo.variacaoMes <= 0 ? (
                        <TrendDownIcon size={11} weight="bold" />
                      ) : (
                        <TrendUpIcon size={11} weight="bold" />
                      )}
                      {Math.abs(resumo.variacaoMes).toFixed(0)}% em gastos
                    </Badge>
                  )}
                </div>

                <p className="tabular mt-3 flex items-baseline gap-0.5 text-text">
                  <span className="mr-1 text-lg font-medium text-muted">R$</span>
                  <span className="text-[42px] font-semibold leading-none tracking-tight sm:text-5xl">
                    {saldo.sign}
                    {saldo.whole}
                  </span>
                  <span className="text-xl font-medium text-muted">,{saldo.fraction}</span>
                </p>

                <p className="mt-2.5 text-[13px] text-subtle">
                  {resumo.totalContas === 0
                    ? "Nenhuma conta cadastrada ainda"
                    : `Somando ${resumo.totalContas} ${resumo.totalContas === 1 ? "conta" : "contas"}`}
                </p>

                <div className="mt-6 grid grid-cols-2 gap-3">
                  <MiniStat
                    label="Entradas do mês"
                    value={resumo.entradas}
                    tone="income"
                    icon={<ArrowDownLeftIcon size={14} weight="bold" />}
                  />
                  <MiniStat
                    label="Saídas do mês"
                    value={resumo.saidas}
                    tone="expense"
                    icon={<ArrowUpRightIcon size={14} weight="bold" />}
                  />
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
              <StatCard
                label="A receber"
                value={resumo.aReceber}
                hint={resumo.aReceber === 0 ? "Nada em aberto" : "Recebíveis pendentes"}
                tone="income"
                icon={<HandCoinsIcon size={18} weight="duotone" />}
                delay="80ms"
              />
              <StatCard
                label="Dívidas em aberto"
                value={resumo.dividasAbertas}
                hint={resumo.dividasAbertas === 0 ? "Nenhuma dívida ativa" : "Saldo devedor"}
                tone="expense"
                icon={<TrendDownIcon size={18} weight="duotone" />}
                delay="120ms"
              />
            </div>
          </section>

          {/* ---------- categorias + vencimentos ---------- */}
          <section className="mt-4 grid gap-4 lg:grid-cols-[1.35fr_1fr]">
            <Card
              className="animate-[fade-up_0.5s_var(--ease-out-quint)_both]"
              style={{ animationDelay: "160ms" }}
            >
              <CardHeader>
                <div>
                  <CardTitle>Gastos por categoria</CardTitle>
                  <p className="mt-1 text-[13px] text-muted">
                    {totalCategorias === 0
                      ? "Nenhum gasto neste mês"
                      : `${formatMoney(totalCategorias)} neste mês`}
                  </p>
                </div>
              </CardHeader>

              <CardContent className="space-y-3.5 pt-5">
                {categorias.length === 0 ? (
                  <p className="py-6 text-center text-[13px] text-subtle">
                    Assim que você lançar despesas, elas aparecem divididas aqui.
                  </p>
                ) : (
                  categorias.map((cat, i) => {
                    const pct = (cat.valor / totalCategorias) * 100;
                    return (
                      <div key={cat.categoriaId ?? "sem-categoria"}>
                        <div className="flex items-baseline justify-between gap-3 text-[13px]">
                          <span className="flex items-center gap-2 font-medium text-text">
                            <span
                              className="size-2 shrink-0 rounded-full"
                              style={{ background: cat.cor }}
                            />
                            {cat.nome}
                          </span>
                          <span className="tabular flex items-baseline gap-2">
                            <span className="text-subtle">
                              {formatPercent(cat.valor, totalCategorias)}
                            </span>
                            <span className="font-medium text-text">{formatMoney(cat.valor)}</span>
                          </span>
                        </div>
                        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-2">
                          <div
                            className="h-full origin-left rounded-full"
                            style={{
                              width: `${pct}%`,
                              background: cat.cor,
                              animation: `grow-x 0.7s var(--ease-out-quint) ${200 + i * 60}ms both`,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>

            <Card
              className="animate-[fade-up_0.5s_var(--ease-out-quint)_both]"
              style={{ animationDelay: "200ms" }}
            >
              <CardHeader>
                <CardTitle>Próximos vencimentos</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 pt-4">
                {vencimentos.length === 0 ? (
                  <p className="py-6 text-center text-[13px] text-subtle">
                    Nada vencendo nos próximos 30 dias.
                  </p>
                ) : (
                  vencimentos.map((c) => (
                    <div
                      key={`${c.tipo}-${c.id}`}
                      className="flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-surface-2"
                    >
                      <span
                        className={cn(
                          "grid size-9 shrink-0 place-items-center rounded-xl",
                          c.tipo === "fatura" && "bg-info-soft text-info",
                          c.tipo === "assinatura" && "bg-primary-soft text-primary-soft-fg",
                          c.tipo === "divida" && "bg-expense-soft text-expense",
                        )}
                      >
                        {c.tipo === "fatura" ? (
                          <CreditCardIcon size={17} weight="duotone" />
                        ) : c.tipo === "assinatura" ? (
                          <RepeatIcon size={17} weight="duotone" />
                        ) : (
                          <TrendDownIcon size={17} weight="duotone" />
                        )}
                      </span>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13.5px] font-medium text-text">{c.nome}</p>
                        <p className="text-[11.5px] text-subtle">
                          vence {rotuloData(c.vence, hoje)}
                        </p>
                      </div>

                      <span className="tabular shrink-0 text-[13.5px] font-semibold text-text">
                        {formatMoney(c.valor)}
                      </span>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </section>

          {/* ---------- recentes ---------- */}
          <section className="mt-4">
            <Card
              className="animate-[fade-up_0.5s_var(--ease-out-quint)_both]"
              style={{ animationDelay: "240ms" }}
            >
              <CardHeader>
                <CardTitle>Lançamentos recentes</CardTitle>
                <Link
                  href="/lancamentos"
                  className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
                >
                  Ver todos
                </Link>
              </CardHeader>
              <CardContent className="pt-3">
                {recentes.length === 0 ? (
                  <EmptyState
                    icone={<ReceiptIcon size={24} weight="duotone" />}
                    titulo="Nenhum lançamento ainda"
                    descricao="Registre o primeiro gasto ou receita para o painel ganhar vida."
                    acao={
                      <Link
                        href="/lancamentos/novo"
                        className={cn(buttonVariants({ size: "md" }), "gap-1.5")}
                      >
                        <PlusIcon size={16} weight="bold" />
                        Novo lançamento
                      </Link>
                    }
                  />
                ) : (
                  <ul className="divide-y divide-border">
                    {recentes.map((l) => (
                      <li
                        key={l.id}
                        className="-mx-2 flex items-center gap-3 rounded-xl px-2 py-3 transition-colors hover:bg-surface-2"
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
                          <p className="truncate text-[13.5px] font-medium text-text">
                            {l.descricao}
                          </p>
                          <p className="text-[11.5px] text-subtle">
                            {[l.categoria, l.origem].filter(Boolean).join(" · ") || "Sem categoria"}
                          </p>
                        </div>

                        <div className="shrink-0 text-right">
                          <p
                            className={cn(
                              "tabular text-[13.5px] font-semibold",
                              l.tipo === "income" ? "text-income" : "text-text",
                            )}
                          >
                            {l.tipo === "income" ? "+" : "−"}
                            {formatMoney(l.valor)}
                          </p>
                          <p className="text-[11.5px] text-subtle">{rotuloData(l.data, hoje)}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </section>
        </>
      )}
    </>
  );
}

/**
 * O esqueleto do painel.
 *
 * Existe para o conteúdo NÃO pular quando chegar: as caixas têm a grade e as
 * alturas do painel real. Um "carregando" centralizado seria mais fácil de
 * escrever e pior de usar — a tela mudaria de forma duas vezes em vez de uma,
 * e é justamente esse segundo salto que faz um app parecer lento mesmo quando
 * não é.
 */
function EsqueletoPainel() {
  return (
    <div aria-hidden className="animate-[fade-in_0.3s_var(--ease-out-quint)_both]">
      <section className="mt-6 grid gap-4 lg:grid-cols-[1.35fr_1fr]">
        <Card>
          <CardContent className="p-6">
            <div className="skeleton h-4 w-24 rounded-md" />
            <div className="skeleton mt-4 h-11 w-56 rounded-lg" />
            <div className="skeleton mt-3 h-3.5 w-32 rounded-md" />
            <div className="mt-6 grid grid-cols-2 gap-3">
              <div className="skeleton h-[70px] rounded-xl" />
              <div className="skeleton h-[70px] rounded-xl" />
            </div>
          </CardContent>
        </Card>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          <Card>
            <CardContent className="p-5">
              <div className="skeleton h-[62px] rounded-xl" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <div className="skeleton h-[62px] rounded-xl" />
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="mt-4 grid gap-4 lg:grid-cols-[1.35fr_1fr]">
        <Card>
          <CardContent className="space-y-4 p-5">
            {[0, 1, 2, 3].map((i) => (
              <div key={i}>
                <div className="skeleton h-3.5 w-full rounded-md" />
                <div className="skeleton mt-2 h-1.5 w-full rounded-full" />
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-3 p-5">
            {[0, 1, 2].map((i) => (
              <div key={i} className="skeleton h-[42px] rounded-xl" />
            ))}
          </CardContent>
        </Card>
      </section>

      <section className="mt-4">
        <Card>
          <CardContent className="space-y-3 p-5">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="skeleton h-[46px] rounded-xl" />
            ))}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function MiniStat({
  label,
  value,
  tone,
  icon,
}: {
  label: string;
  value: number;
  tone: "income" | "expense";
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface-2/60 p-3">
      <p className="flex items-center gap-1.5 text-[11.5px] font-medium text-muted">
        <span className={tone === "income" ? "text-income" : "text-expense"}>{icon}</span>
        {label}
      </p>
      <p className="tabular mt-1 text-[17px] font-semibold text-text">{formatMoney(value)}</p>
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
  tone,
  icon,
  delay,
}: {
  label: string;
  value: number;
  hint: string;
  tone: "income" | "expense";
  icon: React.ReactNode;
  delay: string;
}) {
  return (
    <Card
      className="animate-[fade-up_0.45s_var(--ease-out-quint)_both] hover:shadow-sm"
      style={{ animationDelay: delay }}
    >
      <CardContent className="flex items-start gap-3.5 p-5">
        <span
          className={cn(
            "grid size-10 shrink-0 place-items-center rounded-xl",
            tone === "income" ? "bg-income-soft text-income" : "bg-expense-soft text-expense",
          )}
        >
          {icon}
        </span>
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-muted">{label}</p>
          <p className="tabular mt-0.5 text-[22px] font-semibold leading-tight text-text">
            {formatMoney(value)}
          </p>
          <p className="mt-0.5 text-[11.5px] text-subtle">{hint}</p>
        </div>
      </CardContent>
    </Card>
  );
}
