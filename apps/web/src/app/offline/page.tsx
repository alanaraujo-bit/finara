import { CloudSlashIcon } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import { Logo } from "@/components/logo";

export const metadata: Metadata = {
  title: "Sem conexão",
};

export default function OfflinePage() {
  return (
    <div className="grid min-h-[70dvh] place-items-center px-6">
      <div className="flex max-w-sm flex-col items-center text-center">
        <Logo size={40} />

        <span className="mt-8 grid size-14 place-items-center rounded-2xl bg-surface-2 text-subtle">
          <CloudSlashIcon size={26} weight="duotone" />
        </span>

        <h1 className="mt-5 text-lg font-semibold tracking-tight text-text">Você está offline</h1>

        <p className="mt-2 text-[13.5px] leading-relaxed text-muted">
          O Finara não mostra saldo guardado em cache — um número desatualizado seria pior que
          nenhum. Assim que a conexão voltar, seus dados aparecem atualizados.
        </p>
      </div>
    </div>
  );
}
