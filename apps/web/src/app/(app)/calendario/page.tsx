import { CaretLeftIcon, CaretRightIcon } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { limitesDoMes, mesReferencia, nomeDoMes, paraDataLocal } from "@/lib/datas";
import { formatMoney, formatMoneyCompact } from "@/lib/money";
import { obterMesDoCalendario } from "@/lib/queries/calendario";
import { exigirSessao } from "@/lib/session";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Calendário de gastos",
};

const DIAS_SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

function mesVizinho(referencia: string, delta: number): string {
  const [ano, mes] = referencia.split("-").map(Number) as [number, number];
  const total = mes - 1 + delta;
  const novoAno = ano + Math.floor(total / 12);
  const novoMes = (((total % 12) + 12) % 12) + 1;
  return `${novoAno}-${String(novoMes).padStart(2, "0")}`;
}

export default async function CalendarioPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  const { workspace } = await exigirSessao();
  const params = await searchParams;

  const referencia = /^\d{4}-\d{2}$/.test(params.mes ?? "") ? params.mes! : mesReferencia();
  const dias = await obterMesDoCalendario(workspace.workspaceId, referencia);

  const { inicio, fim } = limitesDoMes(referencia);
  const [ano, mes] = referencia.split("-").map(Number) as [number, number];
  const ultimoDia = Number(fim.slice(-2));

  // getUTCDay em data UTC pura evita o deslocamento de fuso que faria o mes
  // comecar na coluna errada.
  const primeiraColuna = new Date(`${inicio}T00:00:00Z`).getUTCDay();

  const hoje = paraDataLocal();
  const totalGasto = [...dias.values()].reduce((a, d) => a + d.gasto, 0);
  const totalEntrada = [...dias.values()].reduce((a, d) => a + d.entrada, 0);

  // O degrau da escala vem do maior gasto do mes: assim o contraste se
  // ajusta ao mes, em vez de um teto fixo que achata meses tranquilos.
  const maiorGasto = Math.max(...[...dias.values()].map((d) => d.gasto), 0);

  function nivel(gasto: number): number {
    if (gasto <= 0 || maiorGasto <= 0) return 0;
    const proporcao = gasto / maiorGasto;
    if (proporcao > 0.75) return 4;
    if (proporcao > 0.5) return 3;
    if (proporcao > 0.25) return 2;
    return 1;
  }

  const celulas: (number | null)[] = [
    ...Array.from({ length: primeiraColuna }, () => null),
    ...Array.from({ length: ultimoDia }, (_, i) => i + 1),
  ];

  return (
    <div className="mx-auto w-full max-w-[980px] px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
      <header className="flex animate-[fade-up_0.4s_var(--ease-out-quint)_both] flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-text">Calendário de gastos</h1>
          <p className="mt-1 text-[13.5px] text-muted">
            <span className="tabular font-medium text-expense">{formatMoney(totalGasto)}</span> em
            saídas
            {totalEntrada > 0 && (
              <>
                {" · "}
                <span className="tabular font-medium text-income">
                  {formatMoney(totalEntrada)}
                </span>{" "}
                em entradas
              </>
            )}
          </p>
        </div>

        <div className="flex items-center gap-1 rounded-xl border border-border bg-surface p-1">
          <Link
            href={`/calendario?mes=${mesVizinho(referencia, -1)}`}
            aria-label="Mês anterior"
            className="grid size-9 place-items-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-text"
          >
            <CaretLeftIcon size={16} weight="bold" />
          </Link>
          <span className="min-w-[132px] text-center text-[13px] font-medium capitalize text-text">
            {nomeDoMes(referencia)}
          </span>
          <Link
            href={`/calendario?mes=${mesVizinho(referencia, 1)}`}
            aria-label="Próximo mês"
            className="grid size-9 place-items-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-text"
          >
            <CaretRightIcon size={16} weight="bold" />
          </Link>
        </div>
      </header>

      <Card
        className="mt-6 animate-[fade-up_0.45s_var(--ease-out-quint)_both]"
        style={{ animationDelay: "60ms" }}
      >
        <CardContent className="p-3 sm:p-5">
          <div className="grid grid-cols-7 gap-1 sm:gap-2">
            {DIAS_SEMANA.map((d) => (
              <div
                key={d}
                className="pb-1 text-center text-[10.5px] font-semibold uppercase tracking-wide text-subtle"
              >
                {d}
              </div>
            ))}

            {celulas.map((dia, i) => {
              if (dia === null) return <div key={`vazio-${i}`} />;

              const data = `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
              const info = dias.get(data);
              const n = nivel(info?.gasto ?? 0);
              const ehHoje = data === hoje;
              const temCompromisso = (info?.compromissos.length ?? 0) > 0;

              return (
                <div
                  key={data}
                  className={cn(
                    "relative flex aspect-square flex-col rounded-xl p-1.5 sm:p-2",
                    "transition-transform duration-200 ease-[var(--ease-out-quint)]",
                    n > 0 && "hover:scale-[1.04]",
                    ehHoje && "ring-2 ring-primary ring-offset-2 ring-offset-surface",
                  )}
                  style={{ background: `var(--heat-${n})` }}
                  title={
                    info?.gasto
                      ? `${dia}: ${formatMoney(info.gasto)} em ${info.lancamentos} ${info.lancamentos === 1 ? "lançamento" : "lançamentos"}`
                      : `${dia}: sem gastos`
                  }
                >
                  <span
                    className="text-[11px] font-semibold leading-none"
                    style={{
                      // Os dois degraus mais fortes exigem texto invertido
                      // para o numero do dia continuar legivel.
                      color: n >= 3 ? "var(--heat-fg-escuro)" : "var(--heat-fg-claro)",
                    }}
                  >
                    {dia}
                  </span>

                  {info && info.gasto > 0 && (
                    <span
                      className="tabular mt-auto text-[9.5px] font-medium leading-none sm:text-[10.5px]"
                      style={{ color: n >= 3 ? "var(--heat-fg-escuro)" : "var(--heat-fg-claro)" }}
                    >
                      {formatMoneyCompact(info.gasto).replace("R$ ", "")}
                    </span>
                  )}

                  {/* Ponto de compromisso: o dia tem algo a vencer, mesmo
                      que ainda nao tenha gasto lancado. */}
                  {temCompromisso && (
                    <span
                      aria-label="Tem vencimento neste dia"
                      className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-warning"
                    />
                  )}
                </div>
              );
            })}
          </div>

          {/* ---------- legenda ---------- */}
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-subtle">menos</span>
              {[0, 1, 2, 3, 4].map((n) => (
                <span
                  key={n}
                  className="size-3.5 rounded"
                  style={{ background: `var(--heat-${n})` }}
                />
              ))}
              <span className="text-[11px] text-subtle">mais</span>
            </div>

            <div className="flex items-center gap-4 text-[11px] text-subtle">
              <span className="flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-warning" />
                vencimento
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-3 rounded ring-2 ring-primary" />
                hoje
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ---------- vencimentos do mes ---------- */}
      {[...dias.values()].some((d) => d.compromissos.length > 0) && (
        <Card
          className="mt-4 animate-[fade-up_0.5s_var(--ease-out-quint)_both]"
          style={{ animationDelay: "120ms" }}
        >
          <CardContent className="p-5">
            <h2 className="text-sm font-semibold text-text">Vencimentos deste mês</h2>
            <ul className="mt-3 divide-y divide-border">
              {[...dias.values()]
                .filter((d) => d.compromissos.length > 0)
                .sort((a, b) => a.data.localeCompare(b.data))
                .flatMap((d) =>
                  d.compromissos.map((c, i) => (
                    <li
                      key={`${d.data}-${i}`}
                      className="flex items-center gap-3 py-2.5 text-[13px]"
                    >
                      <span className="tabular w-9 shrink-0 text-center text-[11.5px] font-semibold text-subtle">
                        {d.data.slice(-2)}
                      </span>
                      <span
                        className={cn(
                          "size-2 shrink-0 rounded-full",
                          c.tipo === "fatura" && "bg-info",
                          c.tipo === "assinatura" && "bg-primary",
                          c.tipo === "divida" && "bg-expense",
                        )}
                      />
                      <span className="min-w-0 flex-1 truncate font-medium text-text">
                        {c.nome}
                      </span>
                      <span className="tabular shrink-0 font-semibold text-text">
                        {formatMoney(c.valor)}
                      </span>
                    </li>
                  )),
                )}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
