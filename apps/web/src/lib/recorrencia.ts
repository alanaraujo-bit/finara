/**
 * Calculo da proxima cobranca de uma assinatura.
 *
 * O caso chato e' o mensal com dia 31: em fevereiro nao existe, e a cobranca
 * precisa cair no ultimo dia do mes — sem "vazar" pro dia 3 de marco, que e'
 * o que acontece quando se usa `new Date(ano, mes, 31)` ingenuamente.
 */

export type Ciclo =
  | "weekly"
  | "biweekly"
  | "monthly"
  | "bimonthly"
  | "quarterly"
  | "semiannual"
  | "yearly";

export const ROTULO_CICLO: Record<Ciclo, string> = {
  weekly: "Semanal",
  biweekly: "Quinzenal",
  monthly: "Mensal",
  bimonthly: "Bimestral",
  quarterly: "Trimestral",
  semiannual: "Semestral",
  yearly: "Anual",
};

/** Quantos meses cada ciclo avanca. Semanal/quinzenal andam em dias. */
const MESES_POR_CICLO: Partial<Record<Ciclo, number>> = {
  monthly: 1,
  bimonthly: 2,
  quarterly: 3,
  semiannual: 6,
  yearly: 12,
};

const DIAS_POR_CICLO: Partial<Record<Ciclo, number>> = {
  weekly: 7,
  biweekly: 14,
};

function ultimoDiaDoMes(ano: number, mes: number): number {
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate();
}

function iso(ano: number, mes: number, dia: number): string {
  return `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

/**
 * Proxima data de cobranca estritamente DEPOIS de `referencia`.
 *
 * @param inicio     data em que a assinatura comecou, 'YYYY-MM-DD'
 * @param ciclo      periodicidade
 * @param referencia a partir de quando procurar (normalmente hoje)
 */
export function proximaCobranca(inicio: string, ciclo: Ciclo, referencia: string): string {
  const dias = DIAS_POR_CICLO[ciclo];

  if (dias) {
    // Ciclos em dias: avanca de bloco em bloco ate' passar a referencia.
    const [a, m, d] = inicio.split("-").map(Number) as [number, number, number];
    const base = Date.UTC(a, m - 1, d);
    const [ra, rm, rd] = referencia.split("-").map(Number) as [number, number, number];
    const alvo = Date.UTC(ra, rm - 1, rd);

    const passo = dias * 24 * 60 * 60 * 1000;
    // Quantos blocos inteiros ja' passaram, +1 para cair no proximo.
    const blocos = Math.max(0, Math.floor((alvo - base) / passo) + 1);
    return new Date(base + blocos * passo).toISOString().slice(0, 10);
  }

  const meses = MESES_POR_CICLO[ciclo] ?? 1;
  const [anoInicio, mesInicio, diaInicio] = inicio.split("-").map(Number) as [
    number,
    number,
    number,
  ];

  let ano = anoInicio;
  let mes = mesInicio;

  // Avanca de ciclo em ciclo ate' ultrapassar a referencia. O limite de 600
  // iteracoes cobre 50 anos de ciclo mensal e evita laco infinito se alguem
  // cadastrar uma data absurda.
  for (let i = 0; i < 600; i++) {
    const dia = Math.min(diaInicio, ultimoDiaDoMes(ano, mes));
    const candidata = iso(ano, mes, dia);

    if (candidata > referencia) return candidata;

    const total = mes - 1 + meses;
    ano += Math.floor(total / 12);
    mes = (total % 12) + 1;
  }

  return iso(ano, mes, Math.min(diaInicio, ultimoDiaDoMes(ano, mes)));
}

/** Custo mensal equivalente, para somar assinaturas de ciclos diferentes. */
export function custoMensalEquivalente(valor: number, ciclo: Ciclo): number {
  switch (ciclo) {
    case "weekly":
      // 52 semanas / 12 meses — mais honesto que "4 semanas por mes".
      return Math.round((valor * 52) / 12);
    case "biweekly":
      return Math.round((valor * 26) / 12);
    case "monthly":
      return valor;
    case "bimonthly":
      return Math.round(valor / 2);
    case "quarterly":
      return Math.round(valor / 3);
    case "semiannual":
      return Math.round(valor / 6);
    case "yearly":
      return Math.round(valor / 12);
  }
}
