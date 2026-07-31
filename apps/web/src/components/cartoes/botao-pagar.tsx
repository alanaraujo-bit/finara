"use client";

import { CheckCircleIcon } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { pagarFatura } from "@/app/(app)/cartoes/actions";
import { Button } from "@/components/ui/button";
import { Carregando } from "@/components/ui/carregando";
import { Modal } from "@/components/ui/modal";
import { TATO, vibrar } from "@/lib/tato";

/**
 * Pagar a fatura debita a conta de verdade, e desfazer isso depois custa uma
 * viagem inteira pela interface. Por isso continua sendo um BOTÃO explícito, e
 * não um gesto: gesto é para o que se repete e perdoa engano — este é o
 * contrário dos dois.
 *
 * O que mudou foi a confirmação. Era uma fileira de textinho e dois botões que
 * nascia dentro do bloco da fatura e reorganizava o cartão inteiro ao abrir —
 * no celular o valor chegava a sair da tela justamente no momento de conferir
 * o valor. Agora a pergunta é uma folha, com o número grande e a frase inteira
 * do que vai acontecer.
 */
export function BotaoPagar({ faturaId, valor }: { faturaId: string; valor: string }) {
  const router = useRouter();
  const [confirmando, setConfirmando] = useState(false);
  const [pendente, iniciar] = useTransition();

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setConfirmando(true)}>
        Marcar como paga
      </Button>

      {confirmando && (
        <Modal
          aberto
          aoFechar={() => setConfirmando(false)}
          titulo="Pagar a fatura"
          descricao="O valor sai do saldo da conta de pagamento do cartão e a fatura é fechada."
        >
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-surface-2/60 p-4 text-center">
              <p className="text-[12px] font-medium uppercase tracking-wide text-subtle">
                Vai debitar
              </p>
              <p className="tabular mt-1 text-[30px] font-semibold leading-none text-text">
                {valor}
              </p>
            </div>

            <Button
              size="lg"
              className="w-full gap-2"
              disabled={pendente}
              onClick={() =>
                iniciar(async () => {
                  await pagarFatura(faturaId);
                  vibrar(TATO.concluido);
                  setConfirmando(false);
                  router.refresh();
                })
              }
            >
              {pendente ? (
                <>
                  <Carregando size={17} rotulo={null} />
                  Pagando...
                </>
              ) : (
                <>
                  <CheckCircleIcon size={16} weight="bold" />
                  Confirmar pagamento
                </>
              )}
            </Button>

            <p className="text-center text-[12px] text-subtle">
              Dá para desfazer depois, pelo botão que aparece na fatura paga.
            </p>
          </div>
        </Modal>
      )}
    </>
  );
}
