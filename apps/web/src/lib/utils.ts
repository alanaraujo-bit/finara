import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Junta classes e resolve conflito do Tailwind (o ultimo vence). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
