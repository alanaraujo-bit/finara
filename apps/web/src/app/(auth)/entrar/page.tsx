import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/auth-form";
import { redirecionarSeLogado } from "@/lib/redirecionar-se-logado";

export const metadata: Metadata = {
  title: "Entrar",
};

export default async function EntrarPage({
  searchParams,
}: {
  searchParams: Promise<{ proximo?: string }>;
}) {
  // No Next 16 `searchParams` e' Promise — acesso sincrono foi removido.
  const { proximo } = await searchParams;
  await redirecionarSeLogado(proximo);
  return <AuthForm modo="entrar" proximo={proximo} />;
}
