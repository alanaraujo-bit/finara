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

/**
 * `maximumFractionDigits: 1` parece pedido razoavel — "manda ate' uma casa" —
 * mas o Intl aplica isso sobre o valor JA' EM REAIS, nao sobre os centavos.
 * R$ 76,50 vira "R$ 76,5": os centavos somem e o que sobra tem CARA de
 * centavo truncado (76 reais e 5 centavos?), nao de arredondamento. Como o
 * uso e' sempre espaço apertado (celula de calendario, cartao de resumo),
 * zero casas resolve: "R$ 77", "R$ 2 mil" — nunca mente sobre precisao
 * porque nao promete nenhuma.
 */
const COMPACTO = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  notation: "compact",
  maximumFractionDigits: 0,
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

/**
 * "1.234,56" ou "1234.56" -> 123456 centavos. Tolerante ao que o usuario digita.
 *
 * A conta e' feita sobre a STRING, digito a digito — nunca com
 * `parseFloat(x) * 100`. Aquele caminho parece inofensivo e falha de verdade:
 * "1,005" vira 100.49999999999999 em ponto flutuante e arredonda pra 100
 * centavos em vez de 101. Um centavo perdido em cada lancamento assim vira
 * saldo errado que ninguem consegue explicar depois.
 */
export function parseMoney(input: string): number {
  const limpo = input.replace(/[^\d,.-]/g, "").trim();
  if (!limpo) return 0;

  const negativo = limpo.startsWith("-");
  const semSinal = limpo.replace(/-/g, "");
  if (!semSinal) return 0;

  let inteiro: string;
  let fracao: string;

  if (semSinal.includes(",")) {
    // Virgula presente: ela e' o decimal (pt-BR), pontos sao milhar.
    const [i = "", f = ""] = semSinal.replace(/\./g, "").split(",");
    inteiro = i;
    fracao = f;
  } else if (semSinal.includes(".")) {
    const partes = semSinal.split(".");
    const ultima = partes[partes.length - 1] ?? "";
    // "1.005" e' mil e cinco (milhar); "100.50" e' cem e cinquenta centavos.
    // O criterio e' o tamanho do ultimo grupo: 1 ou 2 digitos = decimal.
    if (partes.length > 1 && ultima.length > 0 && ultima.length <= 2) {
      fracao = ultima;
      inteiro = partes.slice(0, -1).join("");
    } else {
      inteiro = partes.join("");
      fracao = "";
    }
  } else {
    inteiro = semSinal;
    fracao = "";
  }

  if (!/^\d*$/.test(inteiro) || !/^\d*$/.test(fracao)) return 0;

  // Tres casas: as duas primeiras sao os centavos, a terceira decide o
  // arredondamento (meio centavo sobe).
  const casas = fracao.padEnd(3, "0").slice(0, 3);
  const centavos = Number(inteiro || "0") * 100 + Number(casas.slice(0, 2) || "0");
  const total = centavos + (Number(casas[2] ?? "0") >= 5 ? 1 : 0);

  return negativo ? -total : total;
}

/** Percentual com uma casa, ja' tratando divisao por zero. */
export function formatPercent(value: number, total: number): string {
  if (total === 0) return "0%";
  const pct = (value / total) * 100;
  return `${pct.toFixed(pct >= 10 ? 0 : 1).replace(".", ",")}%`;
}
