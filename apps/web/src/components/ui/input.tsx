import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "h-11 w-full rounded-xl border border-border bg-surface px-3.5 text-[15px] text-text",
        "placeholder:text-subtle",
        "transition-[border-color,box-shadow] duration-200",
        "hover:border-border-strong",
        "focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/12",
        "disabled:cursor-not-allowed disabled:opacity-60",
        // O iOS dá zoom automático em input com fonte < 16px; 15px + este
        // ajuste evita o pulo de tela ao focar no celular.
        "[font-size:max(15px,1rem)] sm:text-[15px]",
        className,
      )}
      {...props}
    />
  );
}

export function Label({ className, ...props }: ComponentProps<"label">) {
  return (
    <label
      className={cn("mb-1.5 block text-[13px] font-medium text-text", className)}
      {...props}
    />
  );
}

export function FieldError({ children }: { children?: string | null }) {
  if (!children) return null;
  return (
    <p role="alert" className="mt-1.5 text-[12.5px] text-expense">
      {children}
    </p>
  );
}
