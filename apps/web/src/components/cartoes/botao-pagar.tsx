"use client";

import { CheckCircleIcon, SpinnerGapIcon } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { pagarFatura } from "@/app/(app)/cartoes/actions";
import { Button } from "@/components/ui/button";

/**
 * Marcar fatura como paga move dinheiro de verdade (debita a conta), entao
 * pede confirmacao. Desfazer isso hoje daria trabalho manual pro usuario.
 */
export function BotaoPagar({ faturaId, valor }: { faturaId: string; valor: string }) {
  const router = useRouter();
  const [confirmando, setConfirmando] = useState(false);
  const [pendente, iniciar] = useTransition();

  if (!confirmando) {
    return (
      <Button variant="outline" size="sm" onClick={() => setConfirmando(true)}>
        Marcar como paga
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[12px] text-muted">Debitar {valor}?</span>
      <Button
        size="sm"
        disabled={pendente}
        onClick={() =>
          iniciar(async () => {
            await pagarFatura(faturaId);
            setConfirmando(false);
            router.refresh();
          })
        }
      >
        {pendente ? (
          <SpinnerGapIcon size={14} className="animate-spin" />
        ) : (
          <CheckCircleIcon size={14} weight="bold" />
        )}
        Confirmar
      </Button>
      <Button variant="ghost" size="sm" disabled={pendente} onClick={() => setConfirmando(false)}>
        Cancelar
      </Button>
    </div>
  );
}
