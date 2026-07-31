# Finara

Sistema financeiro pessoal — contas, cartões, faturas, assinaturas, dívidas,
recebíveis e calendário de gastos. Uma base de código servindo desktop no
navegador e mobile como PWA instalável.

## Arquitetura

| Camada | Onde roda | O quê |
| --- | --- | --- |
| `apps/web` | Vercel | Next.js 16 (App Router), UI e Server Actions |
| `packages/db` | — | Schema Drizzle e cliente Postgres, compartilhado |
| Postgres | Railway | Banco de produção |
| Redis | Railway | Cache e filas do worker |
| `apps/worker` | Railway | *(a criar)* jobs, webhooks de Open Finance e cron |

## Ambiente de desenvolvimento

Nada de infraestrutura roda na máquina local — sem Docker, sem Postgres local.
O único processo local é o servidor de desenvolvimento, que conecta na infra de
produção do Railway pelas URLs públicas.

```bash
pnpm install
cp .env.example apps/web/.env.local   # e preencher com os valores do Railway
pnpm dev                              # http://localhost:3000
```

Credenciais reais saem do Railway:

```bash
railway variables --service Postgres
```

## Banco

Migrations são versionadas (`generate` + `migrate`), nunca `push` — o banco
alvo é o de produção.

```bash
pnpm db:generate   # gera o SQL a partir do schema
pnpm --filter @finara/db migrate
pnpm db:studio     # inspeção visual
```

## Convenções que não se negociam

- **Dinheiro é inteiro em centavos** (`bigint`). Nenhum valor monetário
  transita como float. Formatação só na borda da UI, via `lib/money.ts`.
- **Datas de fato** (`date`) são `YYYY-MM-DD` sem fuso. Um gasto do dia 31
  aparece no dia 31 no calendário, em qualquer timezone.
- **Todo registro financeiro pertence a um workspace.** `ownerId` nulo
  significa conjunto (do casal); preenchido, individual. `visibility` decide
  se o parceiro enxerga.
- **Saldo nunca vem do cache.** O service worker serve navegação com rede
  primeiro; `/api/*` jamais é cacheado.

## Design

Tokens em OKLCH (`globals.css`), com pares claro/escuro em distâncias
perceptuais equivalentes — é o que faz os dois temas terem o mesmo peso
visual. Ícones: Phosphor. Fonte: Geist.
