import { CaretDownIcon } from "@phosphor-icons/react/dist/ssr";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/**
 * Select nativo, de proposito. No celular ele abre o seletor do sistema —
 * mais rapido e acessivel que qualquer dropdown customizado, e sem custo de
 * JavaScript. A seta e' nossa; a do navegador some via `appearance-none`.
 */
export function Select({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <div className="relative">
      <select
        className={cn(
          "h-11 w-full appearance-none rounded-xl border border-border bg-surface pl-3.5 pr-10",
          "text-[15px] text-text",
          "transition-[border-color,box-shadow] duration-200",
          "hover:border-border-strong",
          "focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/12",
          "disabled:cursor-not-allowed disabled:opacity-60",
          // Fonte < 16px faz o iOS dar zoom ao focar.
          "[font-size:max(15px,1rem)]",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <CaretDownIcon
        size={15}
        weight="bold"
        aria-hidden
        className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-subtle"
      />
    </div>
  );
}

/** Grupo de opcoes mutuamente exclusivas, estilo abas. Melhor que select
 *  quando ha' so' duas ou tres escolhas e elas orientam o resto do formulario. */
export function SegmentedField({
  name,
  opcoes,
  valor,
  aoMudar,
  disabled,
}: {
  name: string;
  opcoes: { valor: string; rotulo: string; tom?: "income" | "expense" }[];
  valor: string;
  aoMudar: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div
      role="radiogroup"
      className="grid grid-flow-col gap-1 rounded-xl border border-border bg-surface-2 p-1"
    >
      {opcoes.map((o) => {
        const ativo = o.valor === valor;
        return (
          <button
            key={o.valor}
            type="button"
            role="radio"
            aria-checked={ativo}
            disabled={disabled}
            onClick={() => aoMudar(o.valor)}
            className={cn(
              "h-9 rounded-lg text-[13.5px] font-medium transition-all duration-200",
              ativo
                ? o.tom === "income"
                  ? "bg-income-soft text-income shadow-xs"
                  : o.tom === "expense"
                    ? "bg-expense-soft text-expense shadow-xs"
                    : "bg-surface text-text shadow-xs"
                : "text-muted hover:text-text",
            )}
          >
            {o.rotulo}
          </button>
        );
      })}
      <input type="hidden" name={name} value={valor} />
    </div>
  );
}
