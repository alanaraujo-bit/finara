import {
  and,
  categories,
  creditCards,
  db,
  eq,
  financialAccounts,
  sql,
  transactions,
  workspaceInvites,
  workspaceMembers,
  workspaces,
} from "@finara/db";
import { CORES_MEMBRO } from "./workspace";
import { newId, newToken } from "./id";

const VALIDADE_DIAS = 7;

export type ResultadoConvite =
  | { ok: true; workspaceId: string }
  | { ok: false; motivo: string };

/**
 * Cria (ou renova) o convite do parceiro. No modo casal o espaco comporta
 * duas pessoas, entao recusamos antes de gerar link inutil.
 */
export async function criarConvite(params: {
  workspaceId: string;
  convidadoPorId: string;
  email: string;
}): Promise<{ ok: true; token: string } | { ok: false; motivo: string }> {
  const { workspaceId, convidadoPorId, email } = params;

  const membros = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(workspaceMembers)
    .where(eq(workspaceMembers.workspaceId, workspaceId));

  if ((membros[0]?.n ?? 0) >= 2) {
    return { ok: false, motivo: "Este espaço já tem duas pessoas." };
  }

  const token = newToken();
  const expiraEm = new Date(Date.now() + VALIDADE_DIAS * 24 * 60 * 60 * 1000);

  // Convite pendente anterior perde a validade: dois links vivos para o mesmo
  // espaco e' porta aberta pra confusao (e pra alguem entrar por engano).
  await db
    .update(workspaceInvites)
    .set({ status: "revoked" })
    .where(
      and(eq(workspaceInvites.workspaceId, workspaceId), eq(workspaceInvites.status, "pending")),
    );

  await db.insert(workspaceInvites).values({
    id: newId(),
    workspaceId,
    email: email.trim().toLowerCase(),
    token,
    invitedById: convidadoPorId,
    expiresAt: expiraEm,
  });

  return { ok: true, token };
}

/** Convite valido e pendente, com o nome do espaco — para exibir antes de aceitar. */
export async function lerConvite(token: string) {
  const [convite] = await db
    .select({
      id: workspaceInvites.id,
      workspaceId: workspaceInvites.workspaceId,
      email: workspaceInvites.email,
      status: workspaceInvites.status,
      expiresAt: workspaceInvites.expiresAt,
      workspaceNome: workspaces.name,
    })
    .from(workspaceInvites)
    .innerJoin(workspaces, eq(workspaces.id, workspaceInvites.workspaceId))
    .where(eq(workspaceInvites.token, token))
    .limit(1);

  if (!convite) return null;
  if (convite.status !== "pending") return { ...convite, valido: false as const };
  if (convite.expiresAt < new Date()) return { ...convite, valido: false as const };

  return { ...convite, valido: true as const };
}

/**
 * Um espaco e' "intocado" se nunca recebeu dado do usuario: sem lancamento,
 * sem conta e sem cartao. So' as categorias semeadas no cadastro.
 */
async function espacoIntocado(workspaceId: string): Promise<boolean> {
  const [contagem] = await db
    .select({
      lancamentos: sql<number>`(select count(*) from ${transactions} where ${transactions.workspaceId} = ${workspaceId})::int`,
      contas: sql<number>`(select count(*) from ${financialAccounts} where ${financialAccounts.workspaceId} = ${workspaceId})::int`,
      cartoes: sql<number>`(select count(*) from ${creditCards} where ${creditCards.workspaceId} = ${workspaceId})::int`,
      categoriasProprias: sql<number>`(select count(*) from ${categories} where ${categories.workspaceId} = ${workspaceId} and ${categories.isSystem} = false)::int`,
    })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId));

  if (!contagem) return false;

  return (
    contagem.lancamentos === 0 &&
    contagem.contas === 0 &&
    contagem.cartoes === 0 &&
    contagem.categoriasProprias === 0
  );
}

/**
 * Aceita o convite e junta o usuario ao espaco de quem convidou.
 *
 * Todo usuario novo ganha um espaco proprio no cadastro (ver
 * `criarWorkspaceInicial`). Quem chega por convite entao teria dois. Se o
 * espaco proprio ainda estiver intocado, ele e' descartado aqui. Se ja' tiver
 * dado dentro, recusamos em vez de apagar trabalho de alguem — juntar dois
 * historicos e' decisao do usuario, nao efeito colateral de clicar num link.
 */
export async function aceitarConvite(params: {
  token: string;
  userId: string;
  nomeUsuario: string;
}): Promise<ResultadoConvite> {
  const { token, userId, nomeUsuario } = params;

  const convite = await lerConvite(token);
  if (!convite) return { ok: false, motivo: "Convite não encontrado." };
  if (!convite.valido) return { ok: false, motivo: "Este convite expirou ou já foi usado." };

  const [jaMembro] = await db
    .select({ id: workspaceMembers.id })
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, convite.workspaceId),
        eq(workspaceMembers.userId, userId),
      ),
    );

  if (jaMembro) return { ok: true, workspaceId: convite.workspaceId };

  // Espacos que a pessoa ja' tem (normalmente o criado no cadastro).
  const proprios = await db
    .select({ workspaceId: workspaceMembers.workspaceId, role: workspaceMembers.role })
    .from(workspaceMembers)
    .where(eq(workspaceMembers.userId, userId));

  const descartaveis: string[] = [];
  for (const p of proprios) {
    if (p.role !== "owner") continue;
    if (await espacoIntocado(p.workspaceId)) {
      descartaveis.push(p.workspaceId);
    } else {
      return {
        ok: false,
        motivo:
          "Você já tem um espaço com lançamentos. Aceitar o convite abandonaria esses dados — fale com quem te convidou antes.",
      };
    }
  }

  await db.transaction(async (tx) => {
    await tx.insert(workspaceMembers).values({
      id: newId(),
      workspaceId: convite.workspaceId,
      userId,
      role: "partner",
      displayName: nomeUsuario.trim().split(/\s+/)[0] ?? null,
      color: CORES_MEMBRO[1],
    });

    await tx
      .update(workspaceInvites)
      .set({ status: "accepted", acceptedAt: new Date() })
      .where(eq(workspaceInvites.id, convite.id));

    for (const id of descartaveis) {
      // Cascade leva junto membros e categorias semeadas.
      await tx.delete(workspaces).where(eq(workspaces.id, id));
    }
  });

  return { ok: true, workspaceId: convite.workspaceId };
}
