"use client";

import {
  DotsThreeOutlineIcon,
  PlusIcon,
  SidebarSimpleIcon,
  SignOutIcon,
} from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Logo, Wordmark } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { signOut } from "@/lib/auth-client";
import { mobileNavItems, navigation } from "@/lib/navigation";
import { cn } from "@/lib/utils";

export type UsuarioShell = { nome: string; email: string };
export type WorkspaceShell = { nome: string; apelido: string | null };

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

/** Iniciais para o avatar: "Alan Vitor" -> "AV", "Alan" -> "AL". */
function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  if (partes.length === 1) return partes[0]!.slice(0, 2).toUpperCase();
  return (partes[0]![0]! + partes[partes.length - 1]![0]!).toUpperCase();
}

/** Grava a preferencia num cookie — legivel no servidor, sem flash no load. */
function salvarPreferenciaSidebar(recolhida: boolean) {
  document.cookie = `sidebar-recolhida=${recolhida ? "1" : "0"}; path=/; max-age=31536000; samesite=lax`;
}

function BotaoSair() {
  const router = useRouter();
  const [saindo, setSaindo] = useState(false);

  return (
    <button
      type="button"
      aria-label="Sair da conta"
      disabled={saindo}
      onClick={async () => {
        setSaindo(true);
        await signOut();
        // refresh() garante que o layout do servidor reavalie a sessao;
        // sem ele o usuario continuaria vendo a tela ate' recarregar na mao.
        router.push("/entrar");
        router.refresh();
      }}
      className="grid size-9 place-items-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-expense disabled:opacity-50"
    >
      <SignOutIcon size={18} weight="duotone" />
    </button>
  );
}

/**
 * Sidebar do desktop. Some abaixo de lg, onde entra a barra inferior.
 *
 * Recolhe deslizando pra fora (`translate-x`) em vez de encolher a largura:
 * o conteudo de dentro (rotulos, nomes) nao precisa reajustar no meio do
 * movimento, so' desliza inteiro pra fora da vista.
 */
function Sidebar({
  usuario,
  workspace,
  recolhida,
  aoAlternar,
}: {
  usuario: UsuarioShell;
  workspace: WorkspaceShell;
  recolhida: boolean;
  aoAlternar: () => void;
}) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-30 hidden w-[248px] flex-col border-r border-border bg-surface lg:flex",
        "transition-transform duration-300 ease-[var(--ease-out-quint)]",
        recolhida && "-translate-x-full",
      )}
    >
      <div className="flex h-16 items-center gap-2.5 px-5">
        <Logo size={30} />
        <Wordmark />
        <button
          type="button"
          onClick={aoAlternar}
          aria-label="Esconder barra lateral"
          className="ml-auto grid size-8 shrink-0 place-items-center rounded-lg text-subtle transition-colors hover:bg-surface-2 hover:text-text"
        >
          <SidebarSimpleIcon size={17} weight="bold" />
        </button>
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
        <div className="flex items-center justify-between gap-1 rounded-xl px-2 py-1.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="grid size-8 shrink-0 place-items-center rounded-full bg-primary-soft text-[11px] font-semibold text-primary-soft-fg">
              {iniciais(usuario.nome)}
            </div>
            <div className="min-w-0">
              <p className="truncate text-[13px] font-medium text-text">
                {workspace.apelido ?? usuario.nome}
              </p>
              <p className="truncate text-[11px] text-subtle">{workspace.nome}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center">
            <ThemeToggle />
            <BotaoSair />
          </div>
        </div>
      </div>
    </aside>
  );
}

/**
 * Reaparece a barra lateral quando ela esta' escondida. Fixo no canto
 * superior esquerdo — o mesmo lugar de sempre, do jeito que o Finder e o
 * Mail da Apple fazem.
 */
function BotaoMostrarSidebar({ aoClicar }: { aoClicar: () => void }) {
  return (
    <button
      type="button"
      onClick={aoClicar}
      aria-label="Mostrar barra lateral"
      className={cn(
        "fixed left-3 top-3 z-30 hidden size-9 items-center justify-center rounded-lg",
        "border border-border bg-surface text-subtle shadow-xs",
        "transition-colors duration-200 hover:bg-surface-2 hover:text-text lg:flex",
      )}
    >
      <SidebarSimpleIcon size={17} weight="bold" />
    </button>
  );
}

/**
 * Cabecalho fixo do celular. Vira invisivel no desktop.
 *
 * Superficie solida, sem desfoque. Um blur de vidro convincente pede varias
 * camadas de luz e sombra — o que uma unica `backdrop-filter` nao entrega, e
 * o resultado lia como imitacao. Uma barra solida com fio (`border-b`) e' o
 * que apps como Instagram e Threads usam, e e' honesto sobre o que e'.
 */
function MobileHeader() {
  return (
    <header className="pt-safe sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-surface px-4 lg:hidden">
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
    <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface lg:hidden">
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
          item={{ href: "/mais", label: "Mais", icon: DotsThreeOutlineIcon }}
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

export function AppShell({
  children,
  usuario,
  workspace,
  sidebarRecolhidaInicial,
}: {
  children: ReactNode;
  usuario: UsuarioShell;
  workspace: WorkspaceShell;
  sidebarRecolhidaInicial: boolean;
}) {
  const [recolhida, setRecolhida] = useState(sidebarRecolhidaInicial);

  function alternar() {
    setRecolhida((atual) => {
      const novo = !atual;
      salvarPreferenciaSidebar(novo);
      return novo;
    });
  }

  return (
    <div className="min-h-dvh">
      <Sidebar usuario={usuario} workspace={workspace} recolhida={recolhida} aoAlternar={alternar} />
      {recolhida && <BotaoMostrarSidebar aoClicar={alternar} />}
      <MobileHeader />
      {/* pb-24 no celular reserva o espaco da barra inferior. O padding
          esquerdo acompanha a sidebar sumindo, pra area util crescer junto. */}
      <main
        className={cn(
          "pb-24 transition-[padding-left] duration-300 ease-[var(--ease-out-quint)] lg:pb-0",
          recolhida ? "lg:pl-0" : "lg:pl-[248px]",
        )}
      >
        {children}
      </main>
      <MobileNav />
    </div>
  );
}
