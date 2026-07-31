import { ShieldCheckIcon, SparkleIcon, UsersThreeIcon } from "@phosphor-icons/react/dist/ssr";
import type { ReactNode } from "react";
import { Logo, Wordmark } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";

const DESTAQUES = [
  {
    icone: UsersThreeIcon,
    titulo: "Feito para dois",
    texto: "O que é seu, o que é meu e o que é nosso — no mesmo lugar, sem lançar duas vezes.",
  },
  {
    icone: SparkleIcon,
    titulo: "Manual ou automático",
    texto: "Funciona 100% na mão. O Open Finance entra depois, só para acelerar.",
  },
  {
    icone: ShieldCheckIcon,
    titulo: "Nada de saldo velho",
    texto: "Offline o app avisa em vez de mostrar um número desatualizado.",
  },
];

/**
 * So' a moldura visual. O redirecionamento de quem ja' esta' logado fica nas
 * paginas, nao aqui: layout do App Router nao recebe `searchParams`, entao
 * daqui nao daria pra respeitar o `?proximo=` de um convite.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_1.1fr]">
      {/* ---------- painel da marca (some no celular) ---------- */}
      <aside className="relative hidden overflow-hidden bg-surface-2 p-10 lg:flex lg:flex-col lg:justify-between">
        <div
          aria-hidden
          className="pointer-events-none absolute -left-24 -top-24 size-96 rounded-full opacity-20 blur-3xl"
          style={{ background: "var(--primary)" }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-32 -right-20 size-96 rounded-full opacity-[0.14] blur-3xl"
          style={{ background: "var(--accent)" }}
        />

        <div className="relative flex items-center gap-2.5">
          <Logo size={32} />
          <Wordmark className="text-lg" />
        </div>

        <div className="relative">
          <h2 className="max-w-sm text-[26px] font-semibold leading-tight tracking-tight text-text">
            Seu dinheiro, inteiro e sob controle.
          </h2>

          <ul className="mt-8 space-y-5">
            {DESTAQUES.map((d) => (
              <li key={d.titulo} className="flex gap-3.5">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-surface text-primary shadow-xs">
                  <d.icone size={18} weight="duotone" />
                </span>
                <div className="max-w-xs">
                  <p className="text-[13.5px] font-medium text-text">{d.titulo}</p>
                  <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted">{d.texto}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-[11.5px] text-subtle">
          Contas · Cartões · Assinaturas · Dívidas · A receber
        </p>
      </aside>

      {/* ---------- formulário ---------- */}
      <main className="relative flex flex-col">
        <div className="flex items-center justify-between p-5 lg:justify-end">
          <div className="flex items-center gap-2 lg:hidden">
            <Logo size={26} />
            <Wordmark className="text-base" />
          </div>
          <ThemeToggle />
        </div>

        <div className="flex flex-1 items-center justify-center px-5 pb-16">
          <div className="w-full max-w-[380px] animate-[fade-up_0.45s_var(--ease-out-quint)_both]">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
