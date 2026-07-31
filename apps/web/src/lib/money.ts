/**
 * Dinheiro no Finara e' SEMPRE inteiro em centavos. Nenhum valor monetario
 * transita como float — 0.1 + 0.2 !== 0.3 e' um bug de saldo esperando pra
 * acontecer. A conversao pra texto acontece so' aqui, na borda da UI.
 */

const BRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const BRL_SEM_SIMBOLO = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const COMPACTO = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  notation: "compact",
  maximumFractionDigits: 1,
});

/** 123456 -> "R$ 1.234,56" */
export function formatMoney(cents: number): string {
  return BRL.format(cents / 100);
}

/** 123456 -> "1.234,56" (pra quando o "R$" ja' aparece separado, maior ou menor) */
export function formatMoneyBare(cents: number): string {
  return BRL_SEM_SIMBOLO.format(cents / 100);
}

/** 1234567890 -> "R$ 12,3 mi" — usado em cartao de resumo, nao em extrato. */
export function formatMoneyCompact(cents: number): string {
  return COMPACTO.format(cents / 100);
}

/**
 * Separa a parte inteira dos centavos para renderizar o centavo menor.
 * E' o detalhe que faz o saldo principal parecer desenhado, e nao cuspido.
 */
export function splitMoney(cents: number): {
  sign: string;
  whole: string;
  fraction: string;
} {
  const negative = cents < 0;
  const abs = Math.abs(cents);
  const whole = Math.trunc(abs / 100);
  const fraction = abs % 100;

  return {
    sign: negative ? "-" : "",
    whole: new Intl.NumberFormat("pt-BR").format(whole),
    fraction: String(fraction).padStart(2, "0"),
  };
}

/** "1.234,56" ou "1234.56" -> 123456 centavos. Tolerante ao que o usuario digita. */
export function parseMoney(input: string): number {
  const limpo = input.replace(/[^\d,.-]/g, "").trim();
  if (!limpo) return 0;

  // Se tem virgula, ela e' o separador decimal (padrao pt-BR) e o ponto e' milhar.
  const normalizado = limpo.includes(",")
    ? limpo.replace(/\./g, "").replace(",", ".")
    : limpo;

  const valor = Number.parseFloat(normalizado);
  if (Number.isNaN(valor)) return 0;

  // Arredonda no centavo pra nunca guardar fracao de centavo.
  return Math.round(valor * 100);
}

/** Percentual com uma casa, ja' tratando divisao por zero. */
export function formatPercent(value: number, total: number): string {
  if (total === 0) return "0%";
  const pct = (value / total) * 100;
  return `${pct.toFixed(pct >= 10 ? 0 : 1).replace(".", ",")}%`;
}
