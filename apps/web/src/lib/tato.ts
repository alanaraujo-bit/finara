/**
 * RESPOSTA TATIL
 *
 * O que separa um gesto que "funciona" de um gesto que parece nativo e' a
 * confirmacao no dedo. Quando a gaveta trava aberta, quando o arrasto passa do
 * ponto de nao-volta, quando o botao do meio da barra aceita o toque — em app
 * nativo cada um desses momentos tem um pulso. Sem ele o gesto vira adivinhacao
 * visual: a pessoa precisa OLHAR pra saber que deu certo.
 *
 * `navigator.vibrate` existe no Android e nao existe no iOS (o Safari nunca
 * expos a Taptic Engine para a web). Nao ha' contorno honesto — os truques com
 * <input switch> escondido pararam de funcionar. Entao isto e' melhoria
 * progressiva de verdade: onde existe, some ao gesto; onde nao existe, o
 * movimento e o encaixe visual seguram sozinhos.
 *
 * Quem pediu menos movimento no sistema tambem nao quer o aparelho tremendo na
 * mao — `prefers-reduced-motion` desliga tudo aqui.
 */

/**
 * Duracoes em milissegundos. Curtas de proposito: acima de ~20ms deixa de ser
 * "toque" e vira "alerta", que e' outro significado.
 */
export const TATO = {
  /** Encaixe, troca de aba, revelacao de gaveta. */
  leve: 7,
  /** Passou do ponto de nao-volta; a acao vai disparar ao soltar. */
  firme: 16,
  /** Concluido — dois pulsos, o padrao universal de "pronto". */
  concluido: [10, 45, 14],
} as const;

export function vibrar(padrao: number | readonly number[] = TATO.leve): void {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  try {
    navigator.vibrate(padrao as number | number[]);
  } catch {
    // Alguns navegadores lancam quando a aba nao teve interacao ainda. Falhar
    // aqui nunca pode derrubar o gesto que estava acontecendo.
  }
}
