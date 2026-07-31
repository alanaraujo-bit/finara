import {
  ArrowDownLeftIcon,
  ArrowUpRightIcon,
  CreditCardIcon,
  DotsThreeIcon,
  HandCoinsIcon,
  PlusIcon,
  RepeatIcon,
  TrendDownIcon,
  TrendUpIcon,
} from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { demoCategorias, demoCompromissos, demoLancamentos, demoResumo } from "@/lib/demo-data";
import { formatMoney, formatPercent, splitMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Visão geral",
};

const mesAtual = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(
  new Date(),
);

export default function DashboardPage() {
  const saldo = splitMoney(demoResumo.saldoTotal);
  const totalCategorias = demoCategorias.reduce((acc, c) => acc + c.valor, 0);

  return (
    <div className="mx-auto w-full max-w-[1180px] px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
      {/* ---------- cabecalho ---------- */}
      <header className="flex animate-[fade-up_0.4s_var(--ease-out-quint)_both] flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[13px] text-muted">Bem-vindo de volta, Alan</p>
          <h1 className="mt-0.5 text-2xl font-semibold tracking-tight text-text">Visão geral</h1>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden rounded-lg border border-border bg-surface px-3 py-2 text-[13px] font-medium capitalize text-muted sm:block">
            {mesAtual}
          </span>
          <Button size="md" className="gap-1.5">
            <PlusIcon size={16} weight="bold" />
            Novo lançamento
          </Button>
        </div>
      </header>

      {/* ---------- saldo + indicadores ---------- */}
      <section className="mt-6 grid gap-4 lg:grid-cols-[1.35fr_1fr]">
        <Card
          className="relative animate-[fade-up_0.45s_var(--ease-out-quint)_both] overflow-hidden"
          style={{ animationDelay: "40ms" }}
        >
          {/* Brilho sutil atras do saldo — da' profundidade sem pesar. */}
          <div
            aria-hidden
            className="pointer-events-none absolute -right-16 -top-20 size-64 rounded-full opacity-[0.13] blur-3xl"
            style={{ background: "var(--primary)" }}
          />
          <CardContent className="relative p-6">
            <div className="flex items-center gap-2">
              <p className="text-[13px] font-medium text-muted">Saldo total</p>
              <Badge tone={demoResumo.variacaoMes >= 0 ? "income" : "expense"}>
                {demoResumo.variacaoMes >= 0 ? (
                  <TrendUpIcon size={11} weight="bold" />
                ) : (
                  <TrendDownIcon size={11} weight="bold" />
                )}
                {Math.abs(demoResumo.variacaoMes).toFixed(1).replace(".", ",")}%
              </Badge>
            </div>

            <p className="tabular mt-3 flex items-baseline gap-0.5 text-text">
              <span className="mr-1 text-lg font-medium text-muted">R$</span>
              <span className="text-[42px] font-semibold leading-none tracking-tight sm:text-5xl">
                {saldo.whole}
              </span>
              <span className="text-xl font-medium text-muted">,{saldo.fraction}</span>
            </p>

            <p className="mt-2.5 text-[13px] text-subtle">
              Somando 3 contas e 2 carteiras · atualizado agora
            </p>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <MiniStat
                label="Entradas"
                value={demoResumo.entradas}
                tone="income"
                icon={<ArrowDownLeftIcon size={14} weight="bold" />}
              />
              <MiniStat
                label="Saídas"
                value={demoResumo.saidas}
                tone="expense"
                icon={<ArrowUpRightIcon size={14} weight="bold" />}
              />
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          <StatCard
            label="A receber"
            value={demoResumo.aReceber}
            hint="2 recebíveis em aberto"
            tone="income"
            icon={<HandCoinsIcon size={18} weight="duotone" />}
            delay="80ms"
          />
          <StatCard
            label="Dívidas em aberto"
            value={demoResumo.dividasAbertas}
            hint="1 financiamento ativo"
            tone="expense"
            icon={<TrendDownIcon size={18} weight="duotone" />}
            delay="120ms"
          />
        </div>
      </section>

      {/* ---------- gastos por categoria + proximos vencimentos ---------- */}
      <section className="mt-4 grid gap-4 lg:grid-cols-[1.35fr_1fr]">
        <Card
          className="animate-[fade-up_0.5s_var(--ease-out-quint)_both]"
          style={{ animationDelay: "160ms" }}
        >
          <CardHeader>
            <div>
              <CardTitle>Gastos por categoria</CardTitle>
              <p className="mt-1 text-[13px] text-muted">{formatMoney(totalCategorias)} neste mês</p>
            </div>
            <button
              type="button"
              className="grid size-8 place-items-center rounded-lg text-subtle transition-colors hover:bg-surface-2 hover:text-text"
              aria-label="Mais opções"
            >
              <DotsThreeIcon size={18} weight="bold" />
            </button>
          </CardHeader>

          <CardContent className="space-y-3.5 pt-5">
            {demoCategorias.map((cat, i) => {
              const pct = (cat.valor / totalCategorias) * 100;
              return (
                <div key={cat.nome}>
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
                    {/* Escalonado por item: a lista "desenha" de cima pra baixo. */}
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
            })}
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
            {demoCompromissos.map((c) => (
              <div
                key={c.id}
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
                    vence {c.vence} · em {c.diasRestantes} dias
                  </p>
                </div>

                <span className="tabular shrink-0 text-[13.5px] font-semibold text-text">
                  {formatMoney(c.valor)}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      {/* ---------- lancamentos recentes ---------- */}
      <section className="mt-4">
        <Card
          className="animate-[fade-up_0.5s_var(--ease-out-quint)_both]"
          style={{ animationDelay: "240ms" }}
        >
          <CardHeader>
            <CardTitle>Lançamentos recentes</CardTitle>
            <Button variant="ghost" size="sm">
              Ver todos
            </Button>
          </CardHeader>
          <CardContent className="pt-3">
            <ul className="divide-y divide-border">
              {demoLancamentos.map((l) => (
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
                    <p className="truncate text-[13.5px] font-medium text-text">{l.descricao}</p>
                    <p className="text-[11.5px] text-subtle">
                      {l.categoria} · {l.origem}
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
                    <p className="text-[11.5px] text-subtle">{l.data}</p>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </section>

      <p className="mt-6 text-center text-[11.5px] text-subtle">
        Dados de demonstração — o banco de produção está vazio até a autenticação entrar.
      </p>
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
