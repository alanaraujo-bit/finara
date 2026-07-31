"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { MARCA_D, MARCA_PESO, MARCA_VIEWBOX } from "@/lib/marca";
import { TATO, vibrar } from "@/lib/tato";

/**
 * PUXAR PARA ATUALIZAR
 *
 * O `overscroll-behavior: none` que tira o quique da rolagem tira junto o
 * puxar-para-atualizar nativo do Chrome — e num app de dinheiro esse gesto não
 * é enfeite: é como se confere se o saldo já contou o Pix que acabou de cair.
 * Então ele volta, mas nosso: com a marca do Finara em vez da setinha do
 * navegador, e recarregando pelo `router.refresh()`, que refaz os componentes
 * de servidor mantendo o estado do cliente. Um reload de verdade reiniciaria o
 * app inteiro — folha aberta, rolagem, tudo.
 *
 * Três cuidados separam isto de um gesto que atrapalha:
 *
 * 1. **Só do topo.** Se a página já rolou um pixel, o gesto não existe — quem
 *    está no meio de uma lista quer voltar para cima, não atualizar.
 *
 * 2. **Só quando o eixo é claramente vertical.** As linhas desta mesma tela
 *    abrem gaveta na horizontal; disputar o mesmo movimento faria os dois
 *    gestos falharem.
 *
 * 3. **Resistência crescente.** O indicador anda menos que o dedo, e cada vez
 *    menos conforme se aproxima do limite. É o que dá "peso" ao gesto e avisa
 *    sozinho onde ele termina.
 */

/** Quanto o indicador precisa descer para disparar. */
const LIMIAR = 72;
/** Teto do quanto ele desce, por mais que se puxe. */
const TETO = 104;

export function PuxarParaAtualizar() {
  const router = useRouter();
  const [puxado, setPuxado] = useState(0);
  const [atualizando, setAtualizando] = useState(false);
  /** `true` enquanto o dedo está na tela: desliga a transição de volta. */
  const [arrastando, setArrastando] = useState(false);

  const inicio = useRef<{ x: number; y: number } | null>(null);
  const ativo = useRef(false);
  const avisou = useRef(false);
  /** Espelho do deslocamento para o handler de soltar, que não re-renderiza. */
  const distancia = useRef(0);
  /** Evita disparar duas atualizações antes da primeira responder. */
  const ocupado = useRef(false);

  useEffect(() => {
    // Só onde existe toque. No desktop, recarregar já está a um atalho de
    // distância e nenhum gesto melhora isso.
    if (!window.matchMedia("(pointer: coarse)").matches) return;

    function aoComecar(evento: TouchEvent) {
      if (ocupado.current || evento.touches.length !== 1) return;
      if (window.scrollY > 0) return;

      const t = evento.touches[0]!;
      inicio.current = { x: t.clientX, y: t.clientY };
      ativo.current = false;
      avisou.current = false;
    }

    function aoMover(evento: TouchEvent) {
      if (!inicio.current || ocupado.current) return;

      const t = evento.touches[0]!;
      const dy = t.clientY - inicio.current.y;
      const dx = t.clientX - inicio.current.x;

      if (!ativo.current) {
        // Subindo, ou indo mais para o lado que para baixo: não é este gesto.
        if (dy <= 0 || Math.abs(dx) > Math.abs(dy)) {
          inicio.current = null;
          return;
        }
        if (dy < 10) return;
        ativo.current = true;
        setArrastando(true);
      }

      // Rolar não pode acontecer junto, senão a página escorrega por baixo do
      // indicador. É por isto que o listener é `passive: false`.
      if (evento.cancelable) evento.preventDefault();

      // Resistência: o fator cai conforme o dedo desce, então os últimos
      // pixels custam muito mais que os primeiros.
      const d = Math.min(TETO, dy * 0.5 * (1 - Math.min(dy, 400) / 900));
      distancia.current = d;
      setPuxado(d);

      if (d >= LIMIAR && !avisou.current) {
        avisou.current = true;
        vibrar(TATO.firme);
      } else if (d < LIMIAR && avisou.current) {
        avisou.current = false;
      }
    }

    function aoSoltar() {
      if (!ativo.current) {
        inicio.current = null;
        return;
      }

      const disparou = distancia.current >= LIMIAR;
      inicio.current = null;
      ativo.current = false;
      setArrastando(false);

      if (!disparou) {
        distancia.current = 0;
        setPuxado(0);
        return;
      }

      // Segura o indicador no limiar enquanto o servidor responde. Sumir antes
      // da resposta chegar daria a impressão de que nada aconteceu.
      ocupado.current = true;
      distancia.current = LIMIAR;
      setPuxado(LIMIAR);
      setAtualizando(true);
      router.refresh();
    }

    window.addEventListener("touchstart", aoComecar, { passive: true });
    window.addEventListener("touchmove", aoMover, { passive: false });
    window.addEventListener("touchend", aoSoltar, { passive: true });
    window.addEventListener("touchcancel", aoSoltar, { passive: true });

    return () => {
      window.removeEventListener("touchstart", aoComecar);
      window.removeEventListener("touchmove", aoMover);
      window.removeEventListener("touchend", aoSoltar);
      window.removeEventListener("touchcancel", aoSoltar);
    };
  }, [router]);

  /**
   * `router.refresh()` não devolve promessa que dê para aguardar. O tempo fixo
   * abaixo não é "esperar o servidor" — é o mínimo que o indicador precisa
   * ficar na tela para o olho registrar que algo aconteceu. Abaixo de meio
   * segundo a animação lê como falha, não como sucesso; e a árvore nova chega
   * por baixo dele de qualquer jeito, quando chegar.
   */
  useEffect(() => {
    if (!atualizando) return;

    const t = setTimeout(() => {
      setAtualizando(false);
      distancia.current = 0;
      setPuxado(0);
      ocupado.current = false;
      vibrar(TATO.leve);
    }, 700);

    return () => clearTimeout(t);
  }, [atualizando]);

  const progresso = Math.min(puxado / LIMIAR, 1);

  return (
    <div
      aria-hidden={puxado === 0}
      role={atualizando ? "status" : undefined}
      aria-label={atualizando ? "Atualizando" : undefined}
      className="pointer-events-none fixed inset-x-0 top-0 z-40 flex justify-center pointer-fine:hidden"
      style={{
        transform: `translate3d(0, ${puxado}px, 0)`,
        // Enquanto o dedo manda, o indicador segue de imediato. Ao soltar, ele
        // volta animado — é o quique que o navegador dava de graça.
        transition: arrastando ? "none" : "transform 0.32s var(--ease-out-quint)",
      }}
    >
      <div
        className="mt-2 grid size-10 place-items-center rounded-full border border-border bg-surface shadow-md"
        style={{
          opacity: Math.min(progresso * 1.4, 1),
          transform: `scale(${0.7 + progresso * 0.3})`,
        }}
      >
        <svg
          width={19}
          height={19}
          viewBox={MARCA_VIEWBOX}
          fill="none"
          className="text-primary"
          // Antes de disparar, o traço se desenha acompanhando o dedo: o gesto
          // vira o próprio medidor de progresso. Depois de solto, gira — o
          // vocabulário universal de "processando".
          style={atualizando ? { animation: "girar 0.9s linear infinite" } : undefined}
        >
          <path
            d={MARCA_D}
            pathLength={100}
            stroke="currentColor"
            strokeWidth={MARCA_PESO}
            strokeLinecap="round"
            opacity={0.2}
          />
          <path
            d={MARCA_D}
            pathLength={100}
            stroke="currentColor"
            strokeWidth={MARCA_PESO}
            strokeLinecap="round"
            strokeDasharray={100}
            strokeDashoffset={atualizando ? 30 : 100 - progresso * 100}
          />
        </svg>
      </div>
    </div>
  );
}
