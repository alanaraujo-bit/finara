"use client";

import { MoonStarsIcon, SunIcon } from "@phosphor-icons/react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Alterna claro/escuro. O `mounted` evita o descompasso de hidratacao:
 * no servidor nao da' pra saber o tema salvo, entao renderizamos um
 * placeholder do mesmo tamanho ate' montar — sem pulo de layout.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const isDark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      aria-label={isDark ? "Ativar tema claro" : "Ativar tema escuro"}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={cn(
        "relative grid size-9 place-items-center rounded-lg text-muted",
        "transition-colors duration-200 hover:bg-surface-2 hover:text-text",
        className,
      )}
    >
      {mounted ? (
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
