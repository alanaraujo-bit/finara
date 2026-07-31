import type { ReactNode } from "react";

/**
 * Estado vazio. Num app financeiro ele aparece muito no comeco, entao precisa
 * explicar o proximo passo — nao apenas informar que nao ha' nada.
 */
export function EmptyState({
  icone,
  titulo,
  descricao,
  acao,
}: {
  icone: ReactNode;
  titulo: string;
  descricao: string;
  acao?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <span className="grid size-14 place-items-center rounded-2xl bg-surface-2 text-subtle">
        {icone}
      </span>
      <h3 className="mt-4 text-[15px] font-semibold text-text">{titulo}</h3>
      <p className="mt-1.5 max-w-xs text-[13px] leading-relaxed text-muted">{descricao}</p>
      {acao && <div className="mt-5">{acao}</div>}
    </div>
  );
}
