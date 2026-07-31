"use client";

import { PlusIcon } from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Logo, Wordmark } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { mobileNavItems, navigation } from "@/lib/navigation";
import { cn } from "@/lib/utils";

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

/** Sidebar do desktop. Some abaixo de lg, onde entra a barra inferior. */
function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] flex-col border-r border-border bg-surface lg:flex">
      <div className="flex h-16 items-center gap-2.5 px-5">
        <Logo size={30} />
        <Wordmark />
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-2">
        {navigation.map((group) => (
          <div key={group.label}>
            <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.09em] text-subtle">
              {group.label}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = isActive(pathname, item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        "group relative flex items-center gap-3 rounded-xl px-3 py-2 text-[13.5px] font-medium",
                        "transition-colors duration-200 ease-[var(--ease-out-quint)]",
                        active
                          ? "bg-primary-soft text-primary-soft-fg"
                          : "text-muted hover:bg-surface-2 hover:text-text",
                      )}
                    >
                      {/* Marcador do item ativo — cresce a partir do centro. */}
                      <span
                        className={cn(
                          "absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-primary",
                          "origin-center transition-transform duration-300 ease-[var(--ease-spring)]",
                          active ? "scale-y-100" : "scale-y-0",
                        )}
                      />
                      <item.icon size={19} weight={active ? "duotone" : "regular"} />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-border p-3">
        <div className="flex items-center justify-between gap-2 rounded-xl px-2 py-1.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="grid size-8 shrink-0 place-items-center rounded-full bg-primary-soft text-[11px] font-semibold text-primary-soft-fg">
              AL
            </div>
            <div className="min-w-0">
              <p className="truncate text-[13px] font-medium text-text">Alan</p>
              <p className="truncate text-[11px] text-subtle">Espaço pessoal</p>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </div>
    </aside>
  );
}

/** Cabecalho fixo do celular. Vira invisivel no desktop. */
function MobileHeader() {
  return (
    <header className="glass pt-safe sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border px-4 lg:hidden">
      <div className="flex items-center gap-2">
        <Logo size={26} />
        <Wordmark className="text-base" />
      </div>
      <ThemeToggle />
    </header>
  );
}

/**
 * Barra inferior do celular, com o botao de novo lancamento no centro.
 * Alvos de toque com 44px+ e area segura respeitada — no iPhone a barra
 * do sistema comeria o ultimo item sem o `pb-safe`.
 */
function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="glass pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-border lg:hidden">
      <ul className="flex items-stretch justify-around px-1 pt-1">
        {mobileNavItems.slice(0, 2).map((item) => (
          <MobileNavItem key={item.href} item={item} active={isActive(pathname, item.href)} />
        ))}

        <li className="flex items-center px-1">
          <Link
            href="/lancamentos/novo"
            aria-label="Novo lançamento"
            className={cn(
              "grid size-12 -translate-y-3 place-items-center rounded-2xl bg-primary text-primary-fg",
              "shadow-[var(--shadow-glow)] transition-transform duration-200 ease-[var(--ease-spring)]",
              "active:scale-90",
            )}
          >
            <PlusIcon size={22} weight="bold" />
          </Link>
        </li>

        {mobileNavItems.slice(2).map((item) => (
          <MobileNavItem key={item.href} item={item} active={isActive(pathname, item.href)} />
        ))}
        <MobileNavItem
          item={{ href: "/mais", label: "Mais", icon: navigation[2]!.items[2]!.icon }}
          active={isActive(pathname, "/mais")}
        />
      </ul>
    </nav>
  );
}

function MobileNavItem({
  item,
  active,
}: {
  item: { href: string; label: string; icon: React.ComponentType<{ size?: number; weight?: "regular" | "duotone" | "bold" }> };
  active: boolean;
}) {
  return (
    <li className="flex-1">
      <Link
        href={item.href}
        className={cn(
          "flex min-h-[52px] flex-col items-center justify-center gap-1 rounded-xl px-1 py-1.5",
          "transition-colors duration-200",
          active ? "text-primary" : "text-subtle",
        )}
      >
        <item.icon size={21} weight={active ? "duotone" : "regular"} />
        <span className="text-[10px] font-medium leading-none">{item.label}</span>
      </Link>
    </li>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh">
      <Sidebar />
      <MobileHeader />
      {/* pb-24 no celular reserva o espaco da barra inferior. */}
      <main className="pb-24 lg:pb-0 lg:pl-[248px]">{children}</main>
      <MobileNav />
    </div>
  );
}
