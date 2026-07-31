"use client";

import { XIcon } from "@phosphor-icons/react";
import { useEffect, useId, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Modal do Finara, sobre o `<dialog>` nativo.
 *
 * O elemento nativo entrega de graca — e melhor do que qualquer reimplementacao
 * — quatro coisas que um formulario de dinheiro nao pode errar: foco presa
 * dentro da caixa, `Esc` fechando, fundo inerte ao teclado e leitor de tela, e
 * renderizacao na *top layer*, acima de tudo, sem depender de z-index nem
 * sofrer com `overflow` de ancestral.
 *
 * No desktop ele e' uma caixa centrada. No celular vira folha subindo de baixo,
 * que e' onde o polegar alcanca — e arrastando pra baixo ela fecha, como
 * qualquer app nativo.
 */
export function Modal({
  aberto,
  aoFechar,
  titulo,
  descricao,
  children,
  className,
}: {
  aberto: boolean;
  aoFechar: () => void;
  titulo: string;
  descricao?: string;
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const tituloId = useId();
  const descricaoId = useId();

  // Deslocamento do arrasto, em pixels. Null = nao esta' arrastando.
  const [arrasto, setArrasto] = useState<number | null>(null);
  const inicioY = useRef(0);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;

    // `showModal` e' o que ativa top layer, foco preso e `::backdrop`;
    // `open={true}` no JSX abriria a caixa sem nada disso.
    if (aberto && !dialog.open) dialog.showModal();
    if (!aberto && dialog.open) dialog.close();
  }, [aberto]);

  useEffect(() => {
    if (!aberto) return;

    // O `<dialog>` bloqueia interacao com o fundo, mas nao a rolagem dele:
    // sem isto, rolar dentro do modal no fim da lista arrasta a pagina atras.
    const anterior = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = anterior;
    };
  }, [aberto]);

  function aoArrastarInicio(evento: PointerEvent<HTMLDivElement>) {
    // Mouse continua com clique-fora e Esc; arrastar e' gesto de dedo.
    if (evento.pointerType === "mouse") return;
    inicioY.current = evento.clientY;
    setArrasto(0);
    evento.currentTarget.setPointerCapture(evento.pointerId);
  }

  function aoArrastar(evento: PointerEvent<HTMLDivElement>) {
    if (arrasto === null) return;
    // Só para baixo: puxar pra cima nao estica a folha.
    setArrasto(Math.max(0, evento.clientY - inicioY.current));
  }

  function aoArrastarFim() {
    if (arrasto === null) return;
    const percorreu = arrasto;
    setArrasto(null);
    // 96px e' o ponto em que o gesto ja' foi claramente intencional.
    if (percorreu > 96) aoFechar();
  }

  return (
    <dialog
      ref={ref}
      className={cn("fmodal", className)}
      aria-labelledby={tituloId}
      aria-describedby={descricao ? descricaoId : undefined}
      // Dispara no Esc e no close() — e' o ponto unico que devolve o estado
      // para quem abriu, sem depender de cada caminho de fechamento.
      onClose={aoFechar}
      onClick={(evento) => {
        // Clique no fundo (o proprio dialog), nao no painel.
        if (evento.target === ref.current) aoFechar();
      }}
    >
      <div
        className="fmodal-painel"
        style={
          arrasto === null
            ? undefined
            : { transform: `translateY(${arrasto}px)`, transition: "none" }
        }
      >
        <div
          className="fmodal-arrasto"
          onPointerDown={aoArrastarInicio}
          onPointerMove={aoArrastar}
          onPointerUp={aoArrastarFim}
          onPointerCancel={aoArrastarFim}
        >
          <span className="fmodal-alca" aria-hidden />
        </div>

        <header className="fmodal-cabecalho">
          <div className="min-w-0">
            <h2 id={tituloId} className="text-[15px] font-semibold tracking-tight text-text">
              {titulo}
            </h2>
            {descricao && (
              <p id={descricaoId} className="mt-0.5 text-[12.5px] text-muted">
                {descricao}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={aoFechar}
            aria-label="Fechar"
            className="-mr-1.5 grid size-9 shrink-0 place-items-center rounded-xl text-subtle transition-colors hover:bg-surface-2 hover:text-text"
          >
            <XIcon size={17} weight="bold" />
          </button>
        </header>

        <div className="fmodal-corpo">{children}</div>
      </div>
    </dialog>
  );
}
