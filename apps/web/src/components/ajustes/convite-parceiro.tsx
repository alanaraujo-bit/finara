"use client";

import { CheckIcon, CopyIcon, PaperPlaneTiltIcon, SpinnerGapIcon } from "@phosphor-icons/react";
import { useActionState, useState } from "react";
import { gerarConvite, type EstadoConvite } from "@/app/(app)/ajustes/actions";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label } from "@/components/ui/input";

export function ConviteParceiro({ podeConvidar }: { podeConvidar: boolean }) {
  const [estado, acao, pendente] = useActionState<EstadoConvite, FormData>(gerarConvite, {});
  const [copiado, setCopiado] = useState(false);

  if (!podeConvidar) {
    return (
      <p className="text-[13px] text-muted">
        Este espaço já tem duas pessoas — o limite do modo casal.
      </p>
    );
  }

  return (
    <div>
      <form action={acao} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <Label htmlFor="email-convite">E-mail de quem você quer convidar</Label>
          <Input
            id="email-convite"
            name="email"
            type="email"
            inputMode="email"
            placeholder="parceiro@exemplo.com"
            disabled={pendente}
            required
          />
        </div>
        <Button type="submit" size="lg" disabled={pendente} className="shrink-0">
          {pendente ? (
            <>
              <SpinnerGapIcon size={16} className="animate-spin" />
              Gerando...
            </>
          ) : (
            <>
              <PaperPlaneTiltIcon size={16} weight="duotone" />
              Gerar convite
            </>
          )}
        </Button>
      </form>

      <FieldError>{estado.erro}</FieldError>

      {estado.link && (
        <div className="mt-4 animate-[fade-up_0.35s_var(--ease-out-quint)_both] rounded-xl border border-border bg-surface-2 p-3.5">
          <p className="text-[12.5px] text-muted">
            Link criado — vale por 7 dias. Ainda não há envio de e-mail configurado, então copie e
            mande você mesmo.
          </p>
          <div className="mt-2.5 flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-lg bg-surface px-3 py-2 font-mono text-[12px] text-text">
              {estado.link}
            </code>
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={async () => {
                await navigator.clipboard.writeText(estado.link!);
                setCopiado(true);
                setTimeout(() => setCopiado(false), 2000);
              }}
              className="shrink-0"
            >
              {copiado ? (
                <>
                  <CheckIcon size={15} weight="bold" className="text-income" />
                  Copiado
                </>
              ) : (
                <>
                  <CopyIcon size={15} />
                  Copiar
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
