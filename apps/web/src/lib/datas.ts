/**
 * Datas do Finara.
 *
 * Regra unica: data de fato ('YYYY-MM-DD') e' sempre calculada no fuso de
 * Sao Paulo, nunca em UTC. Um gasto lancado as 22h do dia 31 precisa cair no
 * dia 31 do calendario — `toISOString()` o jogaria pro dia 1 do mes seguinte.
 *
 * 'en-CA' e' o atalho que devolve o formato ISO ja' no fuso pedido.
 */

const FUSO = "America/Sao_Paulo";

const fmtData = new Intl.DateTimeFormat("en-CA", {
  timeZone: FUSO,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Data no formato 'YYYY-MM-DD', no fuso de Sao Paulo. */
export function paraDataLocal(data: Date = new Date()): string {
  return fmtData.format(data);
}

/** Mes de referencia 'YYYY-MM'. */
export function mesReferencia(data: Date = new Date()): string {
  return paraDataLocal(data).slice(0, 7);
}

/** Primeiro e ultimo dia do mes, como strings de data. */
export function limitesDoMes(referencia: string = mesReferencia()): {
  inicio: string;
  fim: string;
} {
  const [ano, mes] = referencia.split("-").map(Number) as [number, number];
  // Dia 0 do mes seguinte = ultimo dia deste mes, ja' tratando ano bissexto.
  const ultimoDia = new Date(Date.UTC(ano, mes, 0)).getUTCDate();

  return {
    inicio: `${referencia}-01`,
    fim: `${referencia}-${String(ultimoDia).padStart(2, "0")}`,
  };
}

/** Soma dias a uma data 'YYYY-MM-DD' sem passar por fuso nenhum. */
export function somarDias(dataIso: string, dias: number): string {
  const [ano, mes, dia] = dataIso.split("-").map(Number) as [number, number, number];
  const d = new Date(Date.UTC(ano, mes - 1, dia + dias));
  return d.toISOString().slice(0, 10);
}

const fmtDiaMes = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "UTC",
  day: "2-digit",
  month: "short",
});

/**
 * Rotulo curto para o extrato: "Hoje", "Ontem" ou "28 jul".
 * Recebe a string do banco e a interpreta como UTC de proposito — ela ja' e'
 * uma data de calendario, sem hora, entao nao pode sofrer conversao de fuso.
 */
export function rotuloData(dataIso: string, hoje: string = paraDataLocal()): string {
  if (dataIso === hoje) return "Hoje";
  if (dataIso === somarDias(hoje, -1)) return "Ontem";
  if (dataIso === somarDias(hoje, 1)) return "Amanhã";

  const [ano, mes, dia] = dataIso.split("-").map(Number) as [number, number, number];
  return fmtDiaMes.format(new Date(Date.UTC(ano, mes - 1, dia))).replace(".", "");
}

/** Nome do mes por extenso, para cabecalho: "julho de 2026". */
export function nomeDoMes(referencia: string = mesReferencia()): string {
  const [ano, mes] = referencia.split("-").map(Number) as [number, number];
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "UTC",
    month: "long",
    year: "numeric",
  }).format(new Date(Date.UTC(ano, mes - 1, 1)));
}
