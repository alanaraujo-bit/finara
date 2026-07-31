import { CaretRightIcon } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { navigation } from "@/lib/navigation";
import { exigirSessao } from "@/lib/session";

export const metadata: Metadata = {
  title: "Mais",
};

/**
 * Tela "Mais" do celular.
 *
 * Na barra inferior cabem quatro alvos de toque com folga — o resto da
 * navegacao precisa de um lugar, e este e' ele. No desktop a sidebar ja'
 * mostra tudo, entao esta rota so' aparece pelo caminho do celular.
 */
export default async function MaisPage() {
  const { usuario, workspace } = await exigirSessao();

  // O que ja' esta' na barra inferior nao se repete aqui.
  const grupos = navigation
    .map((grupo) => ({ ...grupo, items: grupo.items.filter((item) => !item.mobile) }))
    .filter((grupo) => grupo.items.length > 0);

  return (
    <div className="mx-auto w-full max-w-[880px] px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
      <header className="animate-[fade-up_0.4s_var(--ease-out-quint)_both]">
        <h1 className="text-2xl font-semibold tracking-tight text-text">Mais</h1>
        <p className="mt-1 text-[13.5px] text-muted">
          {usuario.name} · {workspace.nome}
        </p>
      </header>

      {grupos.map((grupo, indice) => (
        <section
          key={grupo.label}
          className="mt-7 animate-[fade-up_0.45s_var(--ease-out-quint)_both]"
          style={{ animationDelay: `${60 + indice * 60}ms` }}
        >
          <h2 className="mb-2.5 px-1 text-[12px] font-semibold uppercase tracking-wide text-subtle">
            {grupo.label}
          </h2>

          <Card className="divide-y divide-border">
            {grupo.items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3.5 px-4 py-3.5 transition-colors first:rounded-t-2xl last:rounded-b-2xl hover:bg-surface-2/60 active:bg-surface-2"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-surface-2 text-muted">
                  <item.icon size={18} weight="duotone" />
                </span>
                <span className="flex-1 text-[14px] font-medium text-text">{item.label}</span>
                <CaretRightIcon size={15} weight="bold" className="shrink-0 text-subtle" />
              </Link>
            ))}
          </Card>
        </section>
      ))}
    </div>
  );
}
