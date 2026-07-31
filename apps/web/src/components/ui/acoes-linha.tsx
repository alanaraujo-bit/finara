"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Carregando } from "@/components/ui/carregando";
import { TATO, vibrar } from "@/lib/tato";
import { cn } from "@/lib/utils";

/**
 * AÇÕES DE UMA LINHA DE LISTA — editar, arquivar, desfazer, excluir.
 *
 * Existe porque as seis telas de registro (lançamentos, contas, cartões,
 * assinaturas, dívidas, a receber) precisam exatamente do mesmo
 * comportamento, e seis cópias divergiriam na primeira correção: uma
 * mostraria o erro, outra engoliria; uma pediria confirmação, outra apagaria
 * direto.
 *
 * Três coisas que o padrão garante:
 *
 * 1. **O erro da action vira texto na linha.** As actions de dinheiro recusam
 *    operação com uma frase que explica o caminho ("desfaça o pagamento da
 *    fatura primeiro"). Se a UI engolisse isso, o botão pareceria quebrado.
 *
 * 2. **Excluir confirma no lugar, sem `confirm()` do navegador.** O diálogo
 *    nativo não segue o tema, trava a aba e no celular aparece colado no topo,
 *    longe do dedo.
 *
 * 3. **Botão que a action vai recusar não é oferecido.** Quem monta a lista
 *    calcula se dá pra excluir e simplesmente não passa a ação — prometer e
 *    depois recusar é pior que não oferecer.
 *
 * ---
 *
 * **No celular estes botões não aparecem.** Quem serve o toque é a gaveta de
 * `linha-deslizante.tsx`, aberta arrastando a linha para o lado. As duas usam
 * o mesmo `useAcoes` abaixo, então a máquina de estados — confirmar, pendente,
 * erro — é uma só; o que muda é só a forma. Uma some por CSS quando a outra
 * aparece (`pointer: coarse` / `pointer: fine`), então em cada aparelho existe
 * exatamente um caminho, inclusive para leitor de tela.
 */

export type Acao = {
  rotulo: string;
  icone: ReactNode;
  perigo?: boolean;
  /** Pergunta curta antes de executar. Ex: "Excluir?" */
  confirmar?: string;
} & (
  | { aoClicar: () => void; executar?: never }
  | { executar: () => Promise<{ erro?: string } | void>; aoClicar?: never }
);

/**
 * A máquina de estados que as duas formas compartilham.
 *
 * Fica aqui, e não em cada renderizador, porque o estado é o que tem regra de
 * dinheiro dentro: a confirmação que não pode ser pulada, o erro da action que
 * não pode ser engolido, o pendente que impede o toque duplo virar duas
 * exclusões. Desenho é o que difere entre celular e desktop — isto não.
 */
export function useAcoes() {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [confirmando, setConfirmando] = useState<Acao | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  /** Toque num botão: pede confirmação se a ação exigir, senão dispara. */
  function tocar(acao: Acao) {
    if (acao.confirmar) {
      vibrar(TATO.leve);
      setConfirmando(acao);
      return;
    }
    disparar(acao);
  }

  function disparar(acao: Acao) {
    if (acao.aoClicar) {
      acao.aoClicar();
      return;
    }
    setErro(null);
    setConfirmando(null);
    iniciar(async () => {
      const r = await acao.executar!();
      if (r?.erro) {
        setErro(r.erro);
      } else {
        vibrar(TATO.concluido);
        router.refresh();
      }
    });
  }

  return {
    pendente,
    confirmando,
    erro,
    tocar,
    disparar,
    limparErro: () => setErro(null),
    cancelarConfirmacao: () => setConfirmando(null),
  };
}

/**
 * Forma de desktop: ícones discretos que aparecem no hover da linha.
 *
 * `pointer-coarse:hidden` é o que impede a duplicata no celular — lá a gaveta
 * de arrasto é quem responde, e dois caminhos para a mesma ação confundiriam
 * tanto o dedo quanto o leitor de tela.
 */
export function AcoesLinha({
  acoes,
  className,
  sempreVisivel = false,
}: {
  acoes: Acao[];
  className?: string;
  /**
   * Dispensa o hover. Para quando quem controla a revelação é o container —
   * é o caso de `LinhaDeslizante`, que faz o grupo inteiro aparecer junto —
   * ou quando a ação é a única coisa na linha e esconder não faria sentido.
   */
  sempreVisivel?: boolean;
}) {
  const { pendente, confirmando, erro, tocar, disparar, limparErro, cancelarConfirmacao } =
    useAcoes();

  if (erro) {
    return (
      <div className={cn("flex max-w-[300px] items-start gap-2 pointer-coarse:hidden", className)}>
        <p role="alert" className="text-right text-[11.5px] leading-snug text-expense">
          {erro}
        </p>
        <Button variant="ghost" size="sm" onClick={limparErro}>
          Ok
        </Button>
      </div>
    );
  }

  if (confirmando) {
    return (
      <div className={cn("flex shrink-0 items-center gap-1.5 pointer-coarse:hidden", className)}>
        <span className="text-[11.5px] text-muted">{confirmando.confirmar}</span>
        <Button
          variant={confirmando.perigo ? "danger" : "primary"}
          size="sm"
          disabled={pendente}
          onClick={() => disparar(confirmando)}
        >
          Sim
        </Button>
        <Button variant="ghost" size="sm" onClick={cancelarConfirmacao}>
          Não
        </Button>
      </div>
    );
  }

  if (pendente) {
    return (
      <span
        className={cn(
          "grid size-8 shrink-0 place-items-center text-subtle pointer-coarse:hidden",
          className,
        )}
      >
        <Carregando size={15} rotulo={null} />
      </span>
    );
  }

  return (
    <div
      className={cn(
        "flex shrink-0 items-center gap-0.5 pointer-coarse:hidden",
        !sempreVisivel &&
          "opacity-0 transition-opacity duration-200 group-hover:opacity-100 focus-within:opacity-100",
        className,
      )}
    >
      {acoes.map((acao) => (
        <BotaoIcone
          key={acao.rotulo}
          rotulo={acao.rotulo}
          perigo={acao.perigo}
          onClick={() => tocar(acao)}
        >
          {acao.icone}
        </BotaoIcone>
      ))}
    </div>
  );
}

export function BotaoIcone({
  rotulo,
  onClick,
  perigo,
  children,
}: {
  rotulo: string;
  onClick: () => void;
  perigo?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={rotulo}
      aria-label={rotulo}
      onClick={onClick}
      className={cn(
        "grid size-8 place-items-center rounded-lg text-subtle transition-colors",
        perigo ? "hover:bg-surface-2 hover:text-expense" : "hover:bg-surface-2 hover:text-text",
      )}
    >
      {children}
    </button>
  );
}
