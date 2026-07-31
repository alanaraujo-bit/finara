"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { criarConvite } from "@/lib/convites";
import { exigirSessao } from "@/lib/session";

const esquemaConvite = z.object({
  email: z.email("Digite um e-mail válido."),
});

export type EstadoConvite = {
  erro?: string;
  link?: string;
};

/**
 * Gera o link de convite do parceiro.
 *
 * O link e' devolvido pra tela em vez de enviado por e-mail: ainda nao ha'
 * servico de envio configurado, e um convite que "sumiu no e-mail" seria pior
 * que um link que o usuario copia e manda no WhatsApp.
 */
export async function gerarConvite(
  _anterior: EstadoConvite,
  formData: FormData,
): Promise<EstadoConvite> {
  const { usuario, workspace } = await exigirSessao();

  const parsed = esquemaConvite.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { erro: parsed.error.issues[0]?.message ?? "E-mail inválido." };
  }

  const resultado = await criarConvite({
    workspaceId: workspace.workspaceId,
    convidadoPorId: usuario.id,
    email: parsed.data.email,
  });

  if (!resultado.ok) {
    return { erro: resultado.motivo };
  }

  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  revalidatePath("/ajustes");
  return { link: `${base}/convite/${resultado.token}` };
}
