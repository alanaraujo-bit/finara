"use client";

import { EyeIcon, EyeSlashIcon } from "@phosphor-icons/react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Carregando } from "@/components/ui/carregando";
import { FieldError, Input, Label } from "@/components/ui/input";
import { signIn, signUp } from "@/lib/auth-client";

type Modo = "entrar" | "criar";

/**
 * O better-auth responde em ingles. Traduzir aqui, e nao espalhar o texto cru
 * do erro na tela, e' o que impede o usuario de receber "Invalid email or
 * password" no meio de um app em portugues.
 */
function traduzirErro(codigo: string | undefined, mensagem: string | undefined): string {
  switch (codigo) {
    case "INVALID_EMAIL_OR_PASSWORD":
      return "E-mail ou senha incorretos.";
    case "USER_ALREADY_EXISTS":
      return "Já existe uma conta com esse e-mail. Tente entrar.";
    case "PASSWORD_TOO_SHORT":
      return "A senha precisa de pelo menos 8 caracteres.";
    case "INVALID_EMAIL":
      return "Esse e-mail não parece válido.";
    default:
      return mensagem || "Não consegui completar a operação. Tente de novo.";
  }
}

/**
 * So' aceita caminho interno. Sem isso, `?proximo=https://site-falso` faria o
 * app jogar o usuario recem-logado num dominio de terceiro (open redirect).
 * A checagem de "//" barra o truque de URL protocolo-relativa.
 */
function destinoSeguro(proximo: string | undefined): string {
  if (!proximo) return "/";
  if (!proximo.startsWith("/")) return "/";
  if (proximo.startsWith("//")) return "/";
  return proximo;
}

export function AuthForm({ modo, proximo }: { modo: Modo; proximo?: string }) {
  const criando = modo === "criar";
  const destino = destinoSeguro(proximo);

  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [verSenha, setVerSenha] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function aoEnviar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);

    if (criando && nome.trim().length < 2) {
      setErro("Diga como podemos te chamar.");
      return;
    }
    if (senha.length < 8) {
      setErro("A senha precisa de pelo menos 8 caracteres.");
      return;
    }

    setEnviando(true);

    const resultado = criando
      ? await signUp.email({ name: nome.trim(), email: email.trim(), password: senha })
      : await signIn.email({ email: email.trim(), password: senha });

    if (resultado.error) {
      setErro(traduzirErro(resultado.error.code, resultado.error.message));
      setEnviando(false);
      return;
    }

    /**
     * Navegacao de documento inteiro, e nao `router.push`.
     *
     * O cookie de sessao acabou de mudar, entao TODO o HTML vindo do servidor
     * esta' velho — inclusive o layout de (app), que le a sessao para montar
     * a barra lateral. O par `refresh()` + `push()` que ficava aqui tentava
     * resolver isso pelo lado do cliente e criava uma corrida: o refresh
     * invalidava o cache do roteador no mesmo quadro em que o push comecava,
     * e a navegacao ficava presa no fallback de `loading.tsx` para sempre —
     * a pessoa logava e olhava a tela de espera sem fim.
     *
     * Recarregar a pagina inteira e' o comportamento correto para troca de
     * sessao, e uma vez so' no login nao pesa.
     */
    window.location.assign(destino);
  }

  return (
    <div>
      <h1 className="text-[22px] font-semibold tracking-tight text-text">
        {criando ? "Criar sua conta" : "Entrar no Finara"}
      </h1>
      <p className="mt-1.5 text-[13.5px] text-muted">
        {criando
          ? "Seu espaço financeiro fica pronto em segundos."
          : "Que bom te ver de volta."}
      </p>

      <form onSubmit={aoEnviar} className="mt-7 space-y-4" noValidate>
        {criando && (
          <div>
            <Label htmlFor="nome">Como te chamamos?</Label>
            <Input
              id="nome"
              name="name"
              autoComplete="name"
              placeholder="Alan"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              disabled={enviando}
              required
            />
          </div>
        )}

        <div>
          <Label htmlFor="email">E-mail</Label>
          <Input
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="voce@exemplo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={enviando}
            required
          />
        </div>

        <div>
          <Label htmlFor="senha">Senha</Label>
          <div className="relative">
            <Input
              id="senha"
              name="password"
              type={verSenha ? "text" : "password"}
              autoComplete={criando ? "new-password" : "current-password"}
              placeholder={criando ? "Pelo menos 8 caracteres" : "••••••••"}
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              disabled={enviando}
              className="pr-11"
              required
            />
            <button
              type="button"
              aria-label={verSenha ? "Ocultar senha" : "Mostrar senha"}
              onClick={() => setVerSenha((v) => !v)}
              className="absolute right-1 top-1 grid size-9 place-items-center rounded-lg text-subtle transition-colors hover:text-text"
            >
              {verSenha ? <EyeSlashIcon size={17} /> : <EyeIcon size={17} />}
            </button>
          </div>
        </div>

        <FieldError>{erro}</FieldError>

        <Button type="submit" size="lg" className="w-full" disabled={enviando}>
          {enviando ? (
            <>
              <Carregando size={17} rotulo={null} />
              {criando ? "Criando..." : "Entrando..."}
            </>
          ) : criando ? (
            "Criar conta"
          ) : (
            "Entrar"
          )}
        </Button>
      </form>

      <p className="mt-6 text-center text-[13px] text-muted">
        {criando ? "Já tem conta? " : "Ainda não tem conta? "}
        <Link
          href={{
            pathname: criando ? "/entrar" : "/criar-conta",
            // Preserva o destino ao trocar de tela, senao quem veio de um
            // convite perde o link ao clicar em "já tenho conta".
            query: proximo ? { proximo } : undefined,
          }}
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          {criando ? "Entrar" : "Criar agora"}
        </Link>
      </p>
    </div>
  );
}
