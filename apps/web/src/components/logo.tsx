import { cn } from "@/lib/utils";

/**
 * Marca do Finara: um "F" implicito formado por uma barra vertical e duas
 * horizontais que sobem, sugerindo crescimento. Puro SVG, sem arquivo de
 * imagem — escala em qualquer tamanho e acompanha a cor do tema.
 */
export function Logo({ className, size = 28 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className={cn("shrink-0", className)}
    >
      <rect width="32" height="32" rx="9" className="fill-primary" />
      <path
        d="M11 22.5V10.5C11 9.67157 11.6716 9 12.5 9H21"
        stroke="var(--primary-fg)"
        strokeWidth="2.75"
        strokeLinecap="round"
      />
      <path
        d="M11.75 16H18.5"
        stroke="var(--primary-fg)"
        strokeWidth="2.75"
        strokeLinecap="round"
        opacity="0.72"
      />
      <circle cx="21.5" cy="21.5" r="2.25" fill="var(--primary-fg)" opacity="0.45" />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("text-[17px] font-semibold tracking-tight text-text", className)}>
      Finara
    </span>
  );
}
