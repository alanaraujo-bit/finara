"use client";

import { XIcon } from "@phosphor-icons/react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type PointerEvent,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

/**
 * Como o CONTEUDO da folha pede para ela se fechar.
 *
 * Existe porque quem conclui uma acao esta' dentro da folha (o formulario que
 * salvou, a opcao que foi escolhida) e ate' agora avisava o componente de FORA
 * — que desmontava a caixa na hora. A folha sumia num quadro, sem chance de
 * sair animada, exatamente como se tivesse dado erro.
 *
 * Pedindo por aqui, a saida e' a mesma do X e do arrasto: um caminho so' para
 * fechar, aconteca o que acontecer.
 *
 * Devolve `null` fora de uma folha — `FormLancamento` tambem vive numa pagina
 * inteira (`/lancamentos/novo`), e la' concluir e' navegar, nao fechar.
 */
const FecharFolha = createContext<(() => void) | null>(null);

export function useFecharFolha() {
  return useContext(FecharFolha);
}

/**
 * Quanto esperar pela saida se o `transitionend` nao vier.
 *
 * Ele vem em todo caminho normal, inclusive com `prefers-reduced-motion` (que
 * encurta a duracao para 0.01ms, mas ainda dispara o evento). A rede de
 * seguranca e' para o caso patologico — a aba perde a visibilidade no meio da
 * saida e o navegador suspende as transicoes. Sem ela, o estado do pai ficaria
 * presto em "aberto" para sempre e a folha nao reabriria.
 */
const SAIDA_MAX_MS = 600;

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
  const painelRef = useRef<HTMLDivElement>(null);
  const tituloId = useId();
  const descricaoId = useId();

  // Deslocamento do arrasto, em pixels. Null = nao esta' arrastando.
  const [arrasto, setArrasto] = useState<number | null>(null);
  const inicioY = useRef(0);

  /**
   * PEDIR PARA FECHAR NAO E' FECHAR.
   *
   * Todo caminho de saida — o X, o toque no fundo, o arrasto, o `Esc`, o
   * formulario que salvou — passa por aqui, e aqui so' se pede ao `<dialog>`
   * que se feche. Quem avisa o componente de fora e' o `close` la' embaixo,
   * DEPOIS que a folha terminou de descer.
   *
   * A inversao e' o conserto do corte seco. Antes, cada um desses caminhos
   * chamava `aoFechar` direto; o pai zerava o estado, o React desmontava o
   * `<dialog>` no mesmo commit, e a animacao de saida — que o CSS declara com
   * `display`/`overlay` em `allow-discrete` justamente para isso — nunca tinha
   * um elemento em que rodar. Medido: um quadro com a folha inteira, o
   * seguinte sem nada.
   */
  const pedirFechamento = useCallback(() => {
    const dialog = ref.current;
    // Sem dialog aberto nao ha' o que animar; avisa direto para nao travar
    // quem esta' esperando o fechamento.
    if (!dialog?.open) {
      aoFechar();
      return;
    }
    dialog.close();
  }, [aoFechar]);

  /**
   * TRAVA DE ROLAGEM COM A POSICAO PRESERVADA
   *
   * O `<dialog>` bloqueia interacao com o fundo, mas nao a rolagem dele — sem
   * trava, rolar dentro da folha no fim da lista arrasta a pagina atras.
   *
   * A trava obvia (`overflow: hidden` no <html>) resolve a rolagem e cria um
   * problema pior: o elemento que rolava deixa de rolar, e o navegador DESCARTA
   * a posicao. Abrir a folha no meio do extrato jogava a pagina para o topo, e
   * fechar devolvia a pessoa a um lugar onde ela nao estava. Num app nativo, o
   * que esta' atras da folha nao se mexe um pixel.
   *
   * Fixar o <body> deslocado pelo tanto que ja' estava rolado congela a pagina
   * exatamente onde ela esta', e a posicao volta na limpeza.
   *
   * **Este efeito precisa vir ANTES do que chama `showModal`.** Efeitos rodam
   * na ordem em que aparecem no arquivo, e `showModal()` move o foco para
   * dentro da caixa — o que rola o documento para o topo antes de qualquer
   * medicao. Com a ordem invertida, `window.scrollY` ja' lia zero e a trava
   * "preservava" a posicao errada. Foi assim que o bug aconteceu.
   */
  useEffect(() => {
    if (!aberto) return;

    const y = window.scrollY;
    const estilo = document.body.style;
    const anterior = {
      position: estilo.position,
      top: estilo.top,
      left: estilo.left,
      right: estilo.right,
      width: estilo.width,
    };

    estilo.position = "fixed";
    estilo.top = `-${y}px`;
    estilo.left = "0";
    estilo.right = "0";
    estilo.width = "100%";

    return () => {
      Object.assign(estilo, anterior);

      /**
       * Leitura descartada de proposito: forca o navegador a recalcular o
       * layout AGORA.
       *
       * Com o <body> fixo, a pagina inteira mede a altura da janela — nao ha'
       * para onde rolar. Devolver o estilo nao refaz essa conta na hora: ate' o
       * proximo ciclo de layout o documento ainda "tem" 660px de altura, e um
       * pedido de rolar ate' 400 e' limitado a zero. O efeito era a folha
       * fechar e a lista aparecer no topo — exatamente o que a trava veio
       * evitar. Uma leitura de `offsetHeight` obriga o recalculo antes da
       * proxima linha.
       */
      void document.body.offsetHeight;

      // Instantaneo: uma rolagem animada de volta seria exatamente o movimento
      // que esta trava existe para eliminar.
      window.scrollTo({ top: y, left: 0, behavior: "instant" });
    };
  }, [aberto]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;

    // `showModal` e' o que ativa top layer, foco preso e `::backdrop`;
    // `open={true}` no JSX abriria a caixa sem nada disso. Roda DEPOIS da
    // trava de rolagem de proposito — ver o comentario dela.
    if (aberto && !dialog.open) {
      dialog.showModal();

      /**
       * O foco vai para a FOLHA, nao para o primeiro campo.
       *
       * Sem isto o navegador escolhe sozinho, e a escolha dele e' o primeiro
       * elemento focavel — quase sempre um `<input>`. No celular isso levanta
       * o teclado no mesmo instante em que a folha entra: a viewport encolhe
       * (`interactiveWidget: resizes-content`), a folha se redimensiona no meio
       * da animacao de entrada, e o conjunto da' a impressao de uma caixa que
       * se mexe sozinha. Nenhum app nativo abre uma tela de edicao ja' com o
       * teclado em cima; o teclado vem quando se toca no campo.
       *
       * `preventScroll` porque focar rola o alvo para a vista, e era isso que
       * jogava a pagina de tras para o topo.
       *
       * No DESKTOP a conta e' outra: nao ha' teclado que suba, e comecar a
       * digitar sem precisar clicar no campo e' o comportamento esperado de
       * qualquer caixa de dialogo. Por isso o autofoco volta la', e so' la' —
       * ainda com `preventScroll`, que a pagina de tras nao tem por que andar
       * em nenhuma das duas situacoes.
       */
      const alvo =
        window.matchMedia("(pointer: fine)").matches &&
        painelRef.current?.querySelector<HTMLElement>(
          "input:not([type=hidden]):not([readonly]), textarea, select",
        );

      (alvo || painelRef.current)?.focus({ preventScroll: true });
    }
    if (!aberto && dialog.open) dialog.close();
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
    // Zerar o arrasto ANTES de pedir o fechamento tira o `transition: none`
    // inline que o gesto instalava. Sem isso a folha ficaria congelada na
    // altura em que o dedo a largou e sumiria dali — o `transition: none` que
    // serve ao arrasto (onde a folha tem que colar no dedo) venceria a
    // animacao de saida.
    setArrasto(null);
    // 96px e' o ponto em que o gesto ja' foi claramente intencional.
    if (percorreu > 96) pedirFechamento();
  }

  /**
   * O `<dialog>` terminou de fechar — agora e' esperar a folha descer.
   *
   * `close()` tira o `[open]` e a partir dai' o CSS anima a saida. Avisar o
   * componente de fora neste instante seria o mesmo corte seco de antes, so'
   * que por outro caminho: ele desmontaria a caixa no meio do movimento.
   */
  function aoDialogFechar() {
    const painel = painelRef.current;
    if (!painel) {
      aoFechar();
      return;
    }

    let encerrado = false;

    const encerrar = () => {
      if (encerrado) return;
      encerrado = true;
      painel.removeEventListener("transitionend", aoTerminar);
      clearTimeout(rede);
      aoFechar();
    };

    const aoTerminar = (evento: TransitionEvent) => {
      // So' o `transform` do proprio painel. `transitionend` sobe por
      // bubbling: sem este filtro, qualquer campo la' dentro terminando a
      // transicao de foco encerraria a saida no meio.
      if (evento.target === painel && evento.propertyName === "transform") encerrar();
    };

    painel.addEventListener("transitionend", aoTerminar);
    const rede = setTimeout(encerrar, SAIDA_MAX_MS);
  }

  return (
    <dialog
      ref={ref}
      className={cn("fmodal", className)}
      aria-labelledby={tituloId}
      aria-describedby={descricao ? descricaoId : undefined}
      // Dispara no Esc e no close() — e' o ponto unico que devolve o estado
      // para quem abriu, sem depender de cada caminho de fechamento.
      onClose={aoDialogFechar}
      onClick={(evento) => {
        // Clique no fundo (o proprio dialog), nao no painel.
        if (evento.target === ref.current) pedirFechamento();
      }}
    >
      <div
        ref={painelRef}
        // -1: alcancavel por foco programatico, fora da ordem do Tab. Ainda e'
        // o primeiro Tab a partir daqui que leva ao primeiro campo.
        tabIndex={-1}
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
            onClick={pedirFechamento}
            aria-label="Fechar"
            className={cn(
              "-mr-1.5 grid size-9 shrink-0 place-items-center rounded-xl text-subtle",
              "pressionavel hover:bg-surface-2 hover:text-text",
            )}
          >
            <XIcon size={17} weight="bold" />
          </button>
        </header>

        <div className="fmodal-corpo">
          <FecharFolha value={pedirFechamento}>{children}</FecharFolha>
        </div>
      </div>
    </dialog>
  );
}
