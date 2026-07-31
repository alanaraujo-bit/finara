import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/auth-form";
import { redirecionarSeLogado } from "@/lib/redirecionar-se-logado";

export const metadata: Metadata = {
  title: "Criar conta",
};

export default async function CriarContaPage({
  searchParams,
}: {
  searchParams: Promise<{ proximo?: string }>;
}) {
  const { proximo } = await searchParams;
  await redirecionarSeLogado(proximo);
  return <AuthForm modo="criar" proximo={proximo} />;
}
