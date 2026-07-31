/**
 * Regras de ciclo de fatura de cartao.
 *
 * A pergunta central: uma compra feita no dia X cai em qual fatura?
 * Se a compra acontece DEPOIS do fechamento, ela ja' pertence ao ciclo
 * seguinte. Errar isso e' o defeito classico de app financeiro — o usuario
 * ve' a compra numa fatura que ja' foi paga.
 */

export type CicloFatura = {
  /** Mes de referencia da fatura, 'YYYY-MM'. */
  referencia: string;
  /** Data de fechamento, 'YYYY-MM-DD'. */
  fechamento: string;
  /** Data de vencimento, 'YYYY-MM-DD'. */
  vencimento: string;
};

/** Ultimo dia do mes, tratando ano bissexto. */
function ultimoDiaDoMes(ano: number, mes: number): number {
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate();
}

/**
 * Encaixa um dia do ciclo (1-31) num mes que pode nao te-lo.
 * Fechamento no dia 31 em fevereiro vira dia 28 (ou 29).
 */
function diaValido(ano: number, mes: number, dia: number): number {
  return Math.min(dia, ultimoDiaDoMes(ano, mes));
}

function iso(ano: number, mes: number, dia: number): string {
  return `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

function somarMes(ano: number, mes: number, delta: number): [number, number] {
  const total = (mes - 1) + delta;
  return [ano + Math.floor(total / 12), (((total % 12) + 12) % 12) + 1];
}

/**
 * Ciclo de fatura ao qual uma compra pertence.
 *
 * @param dataCompra 'YYYY-MM-DD'
 * @param diaFechamento 1-31
 * @param diaVencimento 1-31
 */
export function cicloDaCompra(
  dataCompra: string,
  diaFechamento: number,
  diaVencimento: number,
): CicloFatura {
  const [ano, mes, dia] = dataCompra.split("-").map(Number) as [number, number, number];

  const fechamentoDoMes = diaValido(ano, mes, diaFechamento);

  // Comprou ate' o dia do fechamento: entra nesta fatura.
  // Comprou depois: a fatura deste mes ja' fechou, vai pra proxima.
  const [anoRef, mesRef] = dia <= fechamentoDoMes ? [ano, mes] : somarMes(ano, mes, 1);

  const fechamento = iso(anoRef, mesRef, diaValido(anoRef, mesRef, diaFechamento));

  // Vencimento antes do fechamento no calendario significa que ele cai no
  // mes seguinte — o padrao de "fecha dia 28, vence dia 5".
  const [anoVenc, mesVenc] =
    diaVencimento > diaFechamento ? [anoRef, mesRef] : somarMes(anoRef, mesRef, 1);

  return {
    referencia: `${anoRef}-${String(mesRef).padStart(2, "0")}`,
    fechamento,
    vencimento: iso(anoVenc, mesVenc, diaValido(anoVenc, mesVenc, diaVencimento)),
  };
}

/**
 * Soma meses a uma referencia 'YYYY-MM'.
 *
 * E' o que separa as parcelas de uma compra parcelada por fatura: a parcela
 * i pertence ao ciclo `referenciaMaisMeses(cicloDaPrimeira.referencia, i)`,
 * andando mes a mes sobre o MES DE REFERENCIA — nunca inferido de volta a
 * partir de uma data de calendario.
 *
 * A tentacao seria calcular a data da parcela i (dia fixo, mes+i, via
 * `mesmoDiaNoMes`) e jogar essa data em `cicloDaCompra` de novo. Isso quebra:
 * um cartao que fecha dia 28 e uma compra ancorada no dia 31 faz a parcela de
 * fevereiro encolher pro dia 28 — que cai EXATAMENTE no fechamento — e
 * "empata" com a parcela de janeiro, que tambem rola pra fevereiro por ter
 * passado do fechamento no mes dela. Duas parcelas, mesma fatura, uma delas
 * silenciosamente sumida. Andar sobre a referencia elimina essa colisao:
 * cada parcela sempre cai num mes distinto, nao importa o dia do fechamento.
 */
export function referenciaMaisMeses(referencia: string, meses: number): string {
  const [ano, mes] = referencia.split("-").map(Number) as [number, number];
  const [anoNovo, mesNovo] = somarMes(ano, mes, meses);
  return `${anoNovo}-${String(mesNovo).padStart(2, "0")}`;
}

/** Ciclo pelo mes de referencia, para criar faturas futuras ou passadas. */
export function cicloDaReferencia(
  referencia: string,
  diaFechamento: number,
  diaVencimento: number,
): CicloFatura {
  const [ano, mes] = referencia.split("-").map(Number) as [number, number];
  const fechamento = iso(ano, mes, diaValido(ano, mes, diaFechamento));
  const [anoVenc, mesVenc] =
    diaVencimento > diaFechamento ? [ano, mes] : somarMes(ano, mes, 1);

  return {
    referencia,
    fechamento,
    vencimento: iso(anoVenc, mesVenc, diaValido(anoVenc, mesVenc, diaVencimento)),
  };
}
