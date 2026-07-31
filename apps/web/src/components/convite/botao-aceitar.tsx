"use client";

import { useActionState } from "react";
import { aceitar, type EstadoAceite } from "@/app/convite/[token]/actions";
import { Button } from "@/components/ui/button";
import { Carregando } from "@/components/ui/carregando";
import { FieldError } from "@/components/ui/input";

export function BotaoAceitar({ token }: { token: string }) {
  const [estado, acao, pendente] = useActionState<EstadoAceite, FormData>(aceitar, {});

  return (
    <form action={acao}>
      <input type="hidden" name="token" value={token} />
      <Button type="submit" size="lg" className="w-full" disabled={pendente}>
        {pendente ? (
          <>
            <Carregando size={17} rotulo={null} />
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
