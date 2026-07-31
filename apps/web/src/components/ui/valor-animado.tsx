"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { formatMoney } from "@/lib/money";

/** Quanto dura a contagem. Curta: e' confirmacao, nao espetaculo. */
const DURACAO_MS = 420;

/**
 * Efeito de LAYOUT, e nao o comum — a diferenca aparece na tela.
 *
 * `useEffect` roda DEPOIS da pintura. O navegador chegava a desenhar um quadro
 * com o numero final e so' entao a contagem comecava, do valor velho: media na
 * ferramenta um salto para "R$ 794,39" e, 30ms depois, um recomeco em
 * "R$ 96,16". Ou seja, a resposta aparecia inteira antes da animacao que
 * deveria leva-la ate' la' — o oposto do que se quer.
 *
 * O de layout roda ANTES da pintura, entao o primeiro quadro que existe ja' e'
 * o comeco da contagem.
 *
 * No servidor ele nao pode ser chamado (o React avisa, e nao ha' layout para
 * medir). Como o corpo so' faz algo quando o valor MUDA — o que nunca acontece
 * na primeira renderizacao — cair no `useEffect` la' e' inofensivo.
 */
const useEfeitoDeLayout = typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * VALOR QUE CONTA ATE' O NOVO NUMERO
 *
 * Serve a um momento so': o saldo mudou porque VOCE acabou de mudar alguma
 * coisa. Sem isto, salvar uma edicao troca "R$ 5.000,00" por "R$ 4.750,00"
 * entre dois quadros, e o olho nao tem como saber se aquele numero mexeu —
 * quem quer conferir precisa ter decorado o anterior. A contagem e' o que
 * liga a acao ao efeito dela.
 *
 * **So' anima quando o valor MUDA, nunca ao aparecer.** Contar a partir do
 * zero toda vez que a tela carrega e' o truque de painel de vendas: chama
 * atencao para um numero que ninguem pediu para ver mexer, e some com a
 * unica informacao que a animacao deveria carregar — a de que algo mudou.
 * Na primeira renderizacao o numero simplesmente esta' la'.
 *
 * **A contagem escreve direto no DOM, sem estado do React.** Sao ~25 quadros
 * de texto novo; passar cada um por `setState` renderizaria a arvore inteira
 * 25 vezes por numero na tela. Aqui o React renderiza o valor final uma vez
 * — que e' o valor certo se qualquer coisa interromper — e a animacao so'
 * sobrescreve o texto pelo caminho.
 */
export function ValorAnimado({
  valor,
  className,
}: {
  valor: number;
  className?: string;
}) {
  const no = useRef<HTMLSpanElement>(null);
  const anterior = useRef(valor);

  useEfeitoDeLayout(() => {
    const de = anterior.current;
    anterior.current = valor;

    if (de === valor || !no.current) return;

    // Quem pediu menos movimento no sistema nao quer numero correndo na tela.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const alvo = no.current;
    const inicio = performance.now();
    let quadro = 0;

    const passo = (agora: number) => {
      const progresso = Math.min((agora - inicio) / DURACAO_MS, 1);
      // Mesma familia de curva do resto do app: rapido no comeco, assenta
      // devagar. Nos ultimos quadros os centavos ja' quase pararam, que e' o
      // que faz a contagem terminar em vez de simplesmente cortar.
      const suave = 1 - (1 - progresso) ** 4;
      alvo.textContent = formatMoney(Math.round(de + (valor - de) * suave));

      if (progresso < 1) quadro = requestAnimationFrame(passo);
    };

    quadro = requestAnimationFrame(passo);

    return () => {
      cancelAnimationFrame(quadro);
      // Interrompido no meio (o valor mudou de novo, a tela saiu): o texto
      // volta a ser o que o React renderizou, que e' sempre o valor correto.
      alvo.textContent = formatMoney(valor);
    };
  }, [valor]);

  // `tabular` nao esta' aqui de proposito: quem usa escolhe, e todos os
  // pontos de uso ja' o declaram. Sem ele a largura dos digitos muda a cada
  // quadro e o numero inteiro treme durante a contagem.
  return (
    <span ref={no} className={className}>
      {formatMoney(valor)}
    </span>
  );
}
