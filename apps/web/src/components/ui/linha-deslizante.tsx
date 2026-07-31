"use client";

import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { AcoesLinha, useAcoes, type Acao } from "@/components/ui/acoes-linha";
import { Carregando } from "@/components/ui/carregando";
import { TATO, vibrar } from "@/lib/tato";
import { cn } from "@/lib/utils";

/**
 * LINHA QUE RESPONDE AO ARRASTO
 *
 * A alternativa ao botão. Num app de celular, editar e excluir em cada linha
 * ocupam o lugar do conteúdo, somem no meio dele e ainda convidam ao toque
 * errado — o alvo de excluir fica a 8px do de editar. Aqui arrastar a linha
 * para a esquerda revela as ações, e arrastar para a direita dispara a ação
 * positiva da tela (receber, pagar). O conteúdo volta a ser só conteúdo.
 *
 * Quatro coisas fazem o gesto parecer nativo, e não "um site com drag":
 *
 * 1. **O eixo é decidido no primeiro movimento.** Enquanto não dá pra saber se
 *    o dedo quer rolar a página ou abrir a gaveta, não capturamos nada. Passou
 *    de 8px na horizontal antes da vertical, é nosso; o contrário, é do
 *    navegador e desistimos na hora. Sem isso a lista fica "grudenta" na
 *    rolagem — o defeito que denuncia gesto mal feito.
 *
 * 2. **Elástico nos limites.** Puxar além da gaveta não trava seco: continua
 *    andando com resistência, do jeito que toda superfície do iOS anda. É o
 *    que comunica "acaba aqui" sem parecer travamento.
 *
 * 3. **Arrasto longo executa direto.** Passando bem além da gaveta, a primeira
 *    ação cresce e toma a faixa inteira — soltar ali dispara sem precisar
 *    mirar em botão nenhum. É o gesto do Mail do iPhone. A primeira ação é
 *    sempre a não-destrutiva (editar), justamente porque essa é a que pode ser
 *    disparada por engano.
 *
 * 4. **Pulso no dedo nos dois limiares.** Um ao cruzar o encaixe, outro ao
 *    cruzar o disparo, nas duas direções. É o que dispensa olhar para saber
 *    onde o gesto está.
 *
 * A máquina de estados (confirmar, pendente, erro) é a mesma do desktop, vinda
 * de `useAcoes`. Aqui muda só a forma, e as duas nunca coexistem: esta some em
 * `pointer: fine`, os ícones de hover somem em `pointer: coarse`.
 */

/** Largura de cada ação revelada. 76px passa folgado dos 44pt de alvo mínimo. */
const LARGURA_BOTAO = 76;
/** Em confirmação a gaveta vira uma faixa larga, com a pergunta e as saídas. */
const LARGURA_CONFIRMA = 210;
/** Fração da gaveta a partir da qual soltar encaixa aberto em vez de fechar. */
const LIMIAR_ENCAIXE = 0.42;
/** Quanto além da gaveta o arrasto precisa ir para executar direto ao soltar. */
const FOLGA_DISPARO = 84;
/** Quanto do movimento sobrevive além do limite. 0.3 dá o peso do iOS. */
const ELASTICO = 0.3;
/** Movimento mínimo para declarar o eixo do gesto. */
const ZONA_MORTA = 8;

/**
 * Só uma gaveta aberta por vez em toda a página — abrir a segunda fecha a
 * primeira. Vive no módulo, e não num contexto, porque listas diferentes da
 * mesma tela (a receber tem duas) precisam se enxergar sem um provider comum.
 * A identidade é um objeto de ref, estável entre renders; comparar a função
 * `fechar` não serviria, porque ela nasce nova a cada render.
 */
let gavetaAberta: { dono: object; fechar: () => void } | null = null;

type Lado = "acoes" | "principal";

export type AcaoPrincipal = Acao & { tom?: "income" | "primary" };

export function LinhaDeslizante({
  acoes,
  acaoPrincipal,
  children,
  className,
  as: Tag = "li",
  style,
}: {
  /** Reveladas arrastando para a esquerda. A primeira é a do arrasto longo. */
  acoes: Acao[];
  /** Revelada arrastando para a direita: a ação positiva da tela. */
  acaoPrincipal?: AcaoPrincipal;
  children: ReactNode;
  className?: string;
  as?: "li" | "div";
  style?: React.CSSProperties;
}) {
  const { pendente, confirmando, erro, tocar, disparar, limparErro, cancelarConfirmacao } =
    useAcoes();

  const [aberta, setAberta] = useState<Lado | null>(null);
  /** Pixels enquanto o dedo está na tela. `null` = parado; a posição vem do estado. */
  const [arrasto, setArrasto] = useState<number | null>(null);

  const raiz = useRef<HTMLElement>(null);
  const dono = useRef({});
  const inicio = useRef({ x: 0, y: 0 });
  /**
   * `false` = não é gesto nosso; `null` = dedo na tela, eixo ainda indefinido;
   * `true` = capturado.
   *
   * Começa em `false`, e não em `null`, por um motivo que só aparece no
   * desktop: `pointermove` do MOUSE chega sem nenhum `pointerdown` antes
   * (basta passar o ponteiro por cima). Com `null` inicial, esse primeiro
   * movimento entrava como "eixo indefinido", media a distância contra um
   * `inicio` que ainda era {0,0} — ou seja, centenas de pixels — e abria a
   * gaveta sozinho. Só voltar a `false` ao terminar, nunca a `null`.
   */
  const capturando = useRef<boolean | null>(false);
  /** Impede o pulso de repetir a cada pixel dentro da mesma faixa. */
  const ultimoPulso = useRef<"" | "encaixe" | "disparo">("");

  /** Modo em que a gaveta está: muda a largura e o que aparece dentro. */
  const modo = erro ? "erro" : pendente ? "pendente" : confirmando ? "confirma" : "acoes";

  const larguraEsquerda =
    modo === "erro" || modo === "confirma"
      ? LARGURA_CONFIRMA
      : modo === "pendente"
        ? LARGURA_BOTAO
        : acoes.length * LARGURA_BOTAO;
  const larguraDireita = acaoPrincipal ? LARGURA_BOTAO + 24 : 0;

  const deslocamento =
    arrasto !== null
      ? arrasto
      : aberta === "acoes"
        ? -larguraEsquerda
        : aberta === "principal"
          ? larguraDireita
          : 0;

  /** Passou do ponto em que soltar executa direto, sem mirar num botão. */
  const disparaEsquerda =
    modo === "acoes" && arrasto !== null && arrasto < -(larguraEsquerda + FOLGA_DISPARO);
  const disparaDireita =
    Boolean(acaoPrincipal) && arrasto !== null && arrasto > larguraDireita + FOLGA_DISPARO;

  function abrir(lado: Lado) {
    if (gavetaAberta && gavetaAberta.dono !== dono.current) gavetaAberta.fechar();
    gavetaAberta = { dono: dono.current, fechar: fecharTudo };
    setAberta(lado);
  }

  function fecharTudo() {
    if (gavetaAberta?.dono === dono.current) gavetaAberta = null;
    setAberta(null);
    cancelarConfirmacao();
    limparErro();
  }

  // Toque em qualquer outro lugar da página fecha — inclusive rolagem iniciada
  // fora da linha. Sem isto a gaveta fica aberta, esquecida atrás do conteúdo.
  useEffect(() => {
    if (!aberta) return;

    const aoTocarFora = (evento: Event) => {
      const alvo = evento.target as Node | null;
      if (alvo && raiz.current?.contains(alvo)) return;
      if (gavetaAberta?.dono === dono.current) gavetaAberta = null;
      setAberta(null);
    };

    document.addEventListener("pointerdown", aoTocarFora, { passive: true });
    return () => document.removeEventListener("pointerdown", aoTocarFora);
  }, [aberta]);

  // A linha pode sair da tela com a gaveta aberta (a lista se refaz depois de
  // uma exclusão). Sem soltar o registro, a próxima linha a abrir chamaria um
  // `fechar` de componente que não existe mais.
  useEffect(() => {
    const meu = dono.current;
    return () => {
      if (gavetaAberta?.dono === meu) gavetaAberta = null;
    };
  }, []);

  /* ---------------------------------------------------------------- gesto */

  function aoDescer(evento: PointerEvent<HTMLElement>) {
    // Mouse tem hover e clique — o desktop já é servido por `AcoesLinha`.
    if (evento.pointerType === "mouse" || pendente) {
      capturando.current = false;
      return;
    }
    inicio.current = { x: evento.clientX, y: evento.clientY };
    capturando.current = null;
    ultimoPulso.current = "";
  }

  function aoMover(evento: PointerEvent<HTMLElement>) {
    if (capturando.current === false || evento.pointerType === "mouse") return;

    const dx = evento.clientX - inicio.current.x;
    const dy = evento.clientY - inicio.current.y;

    // Ainda decidindo de quem é o gesto.
    if (capturando.current === null) {
      if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > ZONA_MORTA) {
        capturando.current = false; // rolagem vertical: é do navegador.
        return;
      }
      if (Math.abs(dx) < ZONA_MORTA) return;

      // Sem ação para o lado puxado não há gesto — deixa a página em paz.
      if (dx > 0 && !acaoPrincipal && !aberta) {
        capturando.current = false;
        return;
      }

      capturando.current = true;
      evento.currentTarget.setPointerCapture(evento.pointerId);
    }

    const base =
      aberta === "acoes" ? -larguraEsquerda : aberta === "principal" ? larguraDireita : 0;
    const bruto = base + dx;

    setArrasto(comElastico(bruto, larguraEsquerda, larguraDireita));
    pulsarNasFaixas(bruto);
  }

  /**
   * Um pulso ao cruzar o encaixe e outro ao cruzar o disparo, nas duas
   * direções — voltar atrás também é informação que o dedo precisa.
   */
  function pulsarNasFaixas(bruto: number) {
    const cruzouDisparo =
      bruto < -(larguraEsquerda + FOLGA_DISPARO) ||
      (Boolean(acaoPrincipal) && bruto > larguraDireita + FOLGA_DISPARO);
    const cruzouEncaixe =
      bruto < -larguraEsquerda * LIMIAR_ENCAIXE ||
      (Boolean(acaoPrincipal) && bruto > larguraDireita * LIMIAR_ENCAIXE);

    const faixa = cruzouDisparo ? "disparo" : cruzouEncaixe ? "encaixe" : "";
    if (faixa === ultimoPulso.current) return;

    if (faixa === "disparo") vibrar(TATO.firme);
    else if (faixa === "encaixe") vibrar(TATO.leve);
    ultimoPulso.current = faixa;
  }

  function aoSubir() {
    if (capturando.current !== true) {
      capturando.current = false;
      return;
    }
    capturando.current = false;

    const percorrido = arrasto ?? 0;
    setArrasto(null);

    // Arrasto longo: executa sem precisar acertar o botão. O limiar de soltura
    // é menor que o de aviso porque o elástico já comeu parte do movimento.
    if (modo === "acoes" && percorrido < -(larguraEsquerda + FOLGA_DISPARO * ELASTICO)) {
      const primeira = acoes[0];
      if (primeira) {
        fecharTudo();
        tocar(primeira);
        return;
      }
    }
    if (acaoPrincipal && percorrido > larguraDireita + FOLGA_DISPARO * ELASTICO) {
      fecharTudo();
      tocar(acaoPrincipal);
      return;
    }

    if (percorrido < -larguraEsquerda * LIMIAR_ENCAIXE) abrir("acoes");
    else if (acaoPrincipal && percorrido > larguraDireita * LIMIAR_ENCAIXE) abrir("principal");
    else fecharTudo();
  }

  /* --------------------------------------------------------------- render */

  /**
   * A gaveta é tão larga quanto a linha e mora colada do lado de fora
   * (`left: 100%`), então some sozinha com o `overflow-hidden` da raiz — não
   * precisa de fundo opaco no conteúdo, o que estragaria os cantos do cartão.
   * O fundo dela acompanha a primeira ação: no arrasto longo, quando essa ação
   * engorda até tomar tudo, a faixa toda já é da cor certa.
   */
  const fundoGaveta =
    modo === "acoes"
      ? acoes[0]?.perigo
        ? "bg-expense"
        : "bg-surface-3"
      : modo === "erro"
        ? "bg-expense-soft"
        : "bg-surface-2";

  return (
    <Tag
      ref={raiz as never}
      className={cn("group/linha relative isolate overflow-hidden", className)}
      style={style}
      data-gaveta={aberta ?? undefined}
    >
      {/* ---- desktop: o mesmo conjunto de ações, revelado no hover ----
          Flutua na borda direita em vez de ocupar uma coluna fixa. É o desenho
          do Gmail: a linha guarda o conteúdo dela até você apontar, e só então
          as ações tomam aquele canto. Assim uma lista de 200 lançamentos não
          reserva 80px de largura, em toda linha, para botões invisíveis 99% do
          tempo — e as telas não precisam abrir espaço no layout para caber
          ação nenhuma.

          O degradê à esquerda da pílula é o que impede isso de parecer
          defeito. Sem ele, a pílula cobria METADE do valor e sobrava um "−R"
          solto ao lado, que lê como texto quebrado. Com o degradê, o número
          dissolve na superfície da linha e a leitura é "as ações tomaram este
          canto" — que é o que de fato aconteceu.

          Todas as linhas do app têm `--surface` por trás, então uma cor só
          resolve as seis telas. */}
      <div
        className={cn(
          "absolute inset-y-0 right-0 z-30 hidden items-center pl-24 pr-3 pointer-fine:flex",
          // O trecho sólido precisa cobrir um valor inteiro ("−R$ 1.250,00"),
          // e só o resto é que dissolve. Com a faixa sólida curta demais,
          // sobrava a ponta esquerda do número aparecendo ao lado da pílula.
          "bg-gradient-to-l from-surface from-55% to-transparent",
          "opacity-0 transition-opacity duration-200 ease-[var(--ease-out-quint)]",
          "group-hover/linha:opacity-100 focus-within:opacity-100",
        )}
      >
        <div className="flex items-center gap-0.5 rounded-xl border border-border bg-surface p-0.5 shadow-sm">
          {/* Uma máquina de estados só: a confirmação de excluir precisa poder
              tomar a pílula inteira, e duas instâncias lado a lado deixariam
              metade do conjunto clicável durante a pergunta. */}
          <AcoesLinha
            acoes={acaoPrincipal ? [acaoPrincipal, ...acoes] : acoes}
            sempreVisivel
          />
        </div>
      </div>

      <div
        className="relative touch-pan-y"
        style={{
          transform: `translate3d(${deslocamento}px, 0, 0)`,
          transition: arrasto === null ? "transform 0.34s var(--ease-out-quint)" : "none",
        }}
        onPointerDown={aoDescer}
        onPointerMove={aoMover}
        onPointerUp={aoSubir}
        onPointerCancel={aoSubir}
      >
        {children}

        {/* ---- gaveta da esquerda: as ações ---- */}
        <div
          className={cn(
            "absolute inset-y-0 left-full flex w-full pointer-fine:hidden",
            fundoGaveta,
          )}
          aria-hidden={aberta !== "acoes"}
        >
          <div
            className="flex shrink-0 items-stretch overflow-hidden transition-[width] duration-200 ease-[var(--ease-out-quint)]"
            style={{ width: disparaEsquerda ? "100%" : larguraEsquerda }}
          >
            {modo === "erro" ? (
              <button
                type="button"
                onClick={fecharTudo}
                className="flex w-full flex-col items-start justify-center gap-1 px-4 text-left"
              >
                <span role="alert" className="text-[11.5px] leading-snug text-expense">
                  {erro}
                </span>
                <span className="text-[11px] font-semibold text-expense underline">Ok</span>
              </button>
            ) : modo === "pendente" ? (
              <span className="grid w-full place-items-center text-subtle">
                <Carregando size={18} rotulo={null} />
              </span>
            ) : modo === "confirma" ? (
              <div className="flex w-full items-center gap-2 px-3">
                <span className="flex-1 text-[12px] font-medium leading-tight text-text">
                  {confirmando!.confirmar}
                </span>
                <button
                  type="button"
                  onClick={() => disparar(confirmando!)}
                  className={cn(
                    "h-9 shrink-0 rounded-lg px-3 text-[12.5px] font-semibold text-white",
                    confirmando!.perigo ? "bg-expense" : "bg-primary",
                  )}
                >
                  Sim
                </button>
                <button
                  type="button"
                  onClick={fecharTudo}
                  className="h-9 shrink-0 rounded-lg border border-border-strong px-3 text-[12.5px] font-medium text-muted"
                >
                  Não
                </button>
              </div>
            ) : (
              acoes.map((acao, i) => (
                <button
                  key={acao.rotulo}
                  type="button"
                  aria-label={acao.rotulo}
                  onClick={() => tocar(acao)}
                  className={cn(
                    "flex min-w-0 flex-col items-center justify-center gap-1 px-1",
                    "text-[10.5px] font-medium leading-none active:brightness-90",
                    acao.perigo ? "bg-expense text-white" : "bg-surface-3 text-text",
                    i === 0 && disparaEsquerda ? "grow" : "grow-0",
                  )}
                  style={{ flexBasis: LARGURA_BOTAO }}
                >
                  <span className="[&_svg]:size-[17px]">{acao.icone}</span>
                  {primeiraPalavra(acao.rotulo)}
                </button>
              ))
            )}
          </div>
        </div>

        {/* ---- gaveta da direita: a ação positiva ---- */}
        {acaoPrincipal && (
          <div
            className={cn(
              "absolute inset-y-0 right-full flex w-full justify-end pointer-fine:hidden",
              acaoPrincipal.tom === "primary" ? "bg-primary" : "bg-income",
            )}
            aria-hidden={aberta !== "principal"}
          >
            <button
              type="button"
              aria-label={acaoPrincipal.rotulo}
              onClick={() => tocar(acaoPrincipal)}
              className={cn(
                "flex shrink-0 flex-col items-center justify-center gap-1 px-1 text-white",
                "text-[10.5px] font-medium leading-none transition-[width] duration-200",
                "ease-[var(--ease-out-quint)] active:brightness-90",
              )}
              style={{ width: disparaDireita ? "100%" : larguraDireita }}
            >
              <span className="[&_svg]:size-[17px]">{acaoPrincipal.icone}</span>
              {primeiraPalavra(acaoPrincipal.rotulo)}
            </button>
          </div>
        )}

        {/* Com a gaveta aberta, tocar no conteúdo fecha em vez de acionar o que
            estiver embaixo — do contrário o toque de "deixa pra lá" abriria a
            edição do registro sem querer. */}
        {aberta && (
          <button
            type="button"
            aria-label="Fechar ações"
            onClick={fecharTudo}
            className="absolute inset-0 z-20 cursor-default pointer-fine:hidden"
          />
        )}
      </div>
    </Tag>
  );
}

/**
 * Rótulo curto sob o ícone. Os rótulos completos ("Excluir lançamento") são
 * escritos para leitor de tela e não cabem em 76px — a primeira palavra é o
 * verbo, que é justamente o que precisa aparecer.
 */
function primeiraPalavra(rotulo: string): string {
  return rotulo.split(" ")[0] ?? rotulo;
}

/** Passou do limite? Continua andando, com resistência. */
function comElastico(bruto: number, limiteEsquerda: number, limiteDireita: number): number {
  if (bruto < -limiteEsquerda) return -limiteEsquerda + (bruto + limiteEsquerda) * ELASTICO;
  if (bruto > limiteDireita) return limiteDireita + (bruto - limiteDireita) * ELASTICO;
  return bruto;
}
