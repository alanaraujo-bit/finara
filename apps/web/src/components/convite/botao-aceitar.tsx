"use client";

import { SpinnerGapIcon } from "@phosphor-icons/react";
import { useActionState } from "react";
import { aceitar, type EstadoAceite } from "@/app/convite/[token]/actions";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/input";

export function BotaoAceitar({ token }: { token: string }) {
  const [estado, acao, pendente] = useActionState<EstadoAceite, FormData>(aceitar, {});

  return (
    <form action={acao}>
      <input type="hidden" name="token" value={token} />
      <Button type="submit" size="lg" className="w-full" disabled={pendente}>
        {pendente ? (
          <>
            <SpinnerGapIcon size={17} className="animate-spin" />
            Entrando no espaço...
          </>
        ) : (
          "Aceitar convite"
        )}
      </Button>
      <FieldError>{estado.erro}</FieldError>
    </form>
  );
}
