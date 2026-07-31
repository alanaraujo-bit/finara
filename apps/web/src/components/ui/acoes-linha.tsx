"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Carregando } from "@/components/ui/carregando";
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

export function AcoesLinha({ acoes, className }: { acoes: Acao[]; className?: string }) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [confirmando, setConfirmando] = useState<Acao | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  function disparar(acao: Acao) {
    if (acao.aoClicar) {
      acao.aoClicar();
      return;
    }
    setErro(null);
    setConfirmando(null);
    iniciar(async () => {
      const r = await acao.executar!();
      if (r?.erro) setErro(r.erro);
      else router.refresh();
    });
  }

  if (erro) {
    return (
      <div className={cn("flex max-w-[300px] items-start gap-2", className)}>
        <p role="alert" className="text-right text-[11.5px] leading-snug text-expense">
          {erro}
        </p>
        <Button variant="ghost" size="sm" onClick={() => setErro(null)}>
          Ok
        </Button>
      </div>
    );
  }

  if (confirmando) {
    return (
      <div className={cn("flex shrink-0 items-center gap-1.5", className)}>
        <span className="text-[11.5px] text-muted">{confirmando.confirmar}</span>
        <Button
          variant={confirmando.perigo ? "danger" : "primary"}
          size="sm"
          disabled={pendente}
          onClick={() => disparar(confirmando)}
        >
          Sim
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setConfirmando(null)}>
          Não
        </Button>
      </div>
    );
  }

  if (pendente) {
    return (
      <span className={cn("grid size-8 shrink-0 place-items-center text-subtle", className)}>
        <Carregando size={15} rotulo={null} />
      </span>
    );
  }

  return (
    <div
      className={cn(
        "flex shrink-0 items-center gap-0.5 transition-opacity duration-200",
        // No celular não existe hover: os botões ficam sempre visíveis.
        "sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100",
        className,
      )}
    >
      {acoes.map((acao) => (
        <BotaoIcone
          key={acao.rotulo}
          rotulo={acao.rotulo}
          perigo={acao.perigo}
          onClick={() => (acao.confirmar ? setConfirmando(acao) : disparar(acao))}
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
