import { UsersThreeIcon, WarningCircleIcon } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { Logo, Wordmark } from "@/components/logo";
import { BotaoAceitar } from "@/components/convite/botao-aceitar";
import { buttonVariants } from "@/components/ui/button";
import { lerConvite } from "@/lib/convites";
import { obterSessao } from "@/lib/session";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Convite",
};

export default async function ConvitePage({ params }: { params: Promise<{ token: string }> }) {
  // No Next 16 `params` e' Promise — acesso sincrono foi removido.
  const { token } = await params;

  const convite = await lerConvite(token);
  const sessao = await obterSessao();

  const invalido = !convite || !convite.valido;

  return (
    <div className="grid min-h-dvh place-items-center px-5 py-12">
      <div className="w-full max-w-[400px] animate-[fade-up_0.45s_var(--ease-out-quint)_both] text-center">
        <div className="flex items-center justify-center gap-2.5">
          <Logo size={30} />
          <Wordmark className="text-lg" />
        </div>

        {invalido ? (
          <>
            <span className="mx-auto mt-9 grid size-14 place-items-center rounded-2xl bg-surface-2 text-subtle">
              <WarningCircleIcon size={26} weight="duotone" />
            </span>
            <h1 className="mt-5 text-lg font-semibold tracking-tight text-text">
              Convite indisponível
            </h1>
            <p className="mt-2 text-[13.5px] leading-relaxed text-muted">
              Este link expirou, já foi usado ou não existe. Peça um novo para quem te convidou.
            </p>
            <Link href="/" className={cn(buttonVariants({ variant: "outline", size: "md" }), "mt-6")}>
              Ir para o início
            </Link>
          </>
        ) : (
          <>
            <span className="mx-auto mt-9 grid size-14 place-items-center rounded-2xl bg-primary-soft text-primary-soft-fg">
              <UsersThreeIcon size={26} weight="duotone" />
            </span>
            <h1 className="mt-5 text-lg font-semibold tracking-tight text-text">
              Você foi convidado para
              <br />
              <span className="text-primary">{convite.workspaceNome}</span>
            </h1>
            <p className="mt-2.5 text-[13.5px] leading-relaxed text-muted">
              Vocês dois passam a ver o mesmo espaço financeiro, cada um com seu login. Todo
              lançamento pode ser marcado como individual ou conjunto.
            </p>

            {sessao ? (
              <div className="mt-7">
                <BotaoAceitar token={token} />
                <p className="mt-3 text-[12px] text-subtle">
                  Entrando como {sessao.user.email}
                </p>
              </div>
            ) : (
              <div className="mt-7 space-y-2.5">
                <Link
                  href={`/criar-conta?proximo=${encodeURIComponent(`/convite/${token}`)}`}
                  className={cn(buttonVariants({ size: "lg" }), "w-full")}
                >
                  Criar conta e aceitar
                </Link>
                <Link
                  href={`/entrar?proximo=${encodeURIComponent(`/convite/${token}`)}`}
                  className={cn(buttonVariants({ variant: "outline", size: "lg" }), "w-full")}
                >
                  Já tenho conta
                </Link>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
