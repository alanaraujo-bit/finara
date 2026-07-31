"use client";

import { MoonStarsIcon, SunIcon } from "@phosphor-icons/react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";

/** Nunca notifica: o valor so' precisa diferir entre servidor e cliente. */
const semInscricao = () => () => {};

/**
 * Alterna claro/escuro. O `montado` evita o descompasso de hidratacao: no
 * servidor nao da' pra saber o tema salvo, entao renderizamos um placeholder
 * do mesmo tamanho ate' montar — sem pulo de layout.
 *
 * `useSyncExternalStore` em vez de `useState` + efeito: e' a forma que o React
 * oferece para um valor que difere entre servidor e cliente, e nao gera o
 * render em cascata que um setState dentro de efeito provoca.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const montado = useSyncExternalStore(
    semInscricao,
    () => true,
    () => false,
  );

  const isDark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      // O rotulo tambem depende do tema, entao precisa do mesmo guard do icone:
      // no servidor `resolvedTheme` e' undefined e o texto divergiria na hidratacao.
      aria-label={!montado ? "Alternar tema" : isDark ? "Ativar tema claro" : "Ativar tema escuro"}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={cn(
        "relative grid size-9 place-items-center rounded-lg text-muted",
        "transition-[color,background-color,transform] duration-200 active:scale-[0.92]",
        "hover:bg-surface-2 hover:text-text",
        className,
      )}
    >
      {montado ? (
        <span key={resolvedTheme} className="animate-[fade-in_0.2s_ease-out]">
          {isDark ? (
            <MoonStarsIcon size={18} weight="duotone" />
          ) : (
            <SunIcon size={18} weight="duotone" />
          )}
        </span>
      ) : (
        <span className="size-[18px]" />
      )}
    </button>
  );
}
