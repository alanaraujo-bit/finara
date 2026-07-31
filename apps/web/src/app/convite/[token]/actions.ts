"use server";

import { redirect } from "next/navigation";
import { aceitarConvite } from "@/lib/convites";
import { obterSessao } from "@/lib/session";

export type EstadoAceite = { erro?: string };

export async function aceitar(
  _anterior: EstadoAceite,
  formData: FormData,
): Promise<EstadoAceite> {
  const token = String(formData.get("token") ?? "");
  const sessao = await obterSessao();

  if (!sessao) {
    redirect(`/entrar?proximo=${encodeURIComponent(`/convite/${token}`)}`);
  }

  const resultado = await aceitarConvite({
    token,
    userId: sessao.user.id,
    nomeUsuario: sessao.user.name,
  });

  if (!resultado.ok) {
    return { erro: resultado.motivo };
  }

  redirect("/");
}
