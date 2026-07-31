import {
  categories,
  db,
  eq,
  workspaceMembers,
  workspaces,
} from "@finara/db";
import { newId, slugify } from "./id";

/**
 * Categorias criadas junto com o workspace. Ter algo pronto no primeiro acesso
 * e' o que evita a tela vazia que faz o usuario desistir do app financeiro
 * antes de lancar a primeira despesa.
 *
 * Sao `isSystem`, entao a UI impede exclusao (mas permite renomear e arquivar).
 */
const CATEGORIAS_PADRAO = [
  // --- despesas ---
  { nome: "Moradia", tipo: "expense", icone: "House", cor: "#3b82f6" },
  { nome: "Alimentação", tipo: "expense", icone: "ForkKnife", cor: "#14b8a6" },
  { nome: "Transporte", tipo: "expense", icone: "Car", cor: "#f59e0b" },
  { nome: "Saúde", tipo: "expense", icone: "Heartbeat", cor: "#10b981" },
  { nome: "Educação", tipo: "expense", icone: "GraduationCap", cor: "#8b5cf6" },
  { nome: "Lazer", tipo: "expense", icone: "FilmSlate", cor: "#f43f5e" },
  { nome: "Compras", tipo: "expense", icone: "ShoppingBag", cor: "#ec4899" },
  { nome: "Assinaturas", tipo: "expense", icone: "Repeat", cor: "#0ea5e9" },
  { nome: "Contas e serviços", tipo: "expense", icone: "Receipt", cor: "#64748b" },
  { nome: "Impostos e taxas", tipo: "expense", icone: "Bank", cor: "#78716c" },
  { nome: "Outros", tipo: "expense", icone: "DotsThreeCircle", cor: "#94a3b8" },
  // --- receitas ---
  { nome: "Salário", tipo: "income", icone: "Money", cor: "#10b981" },
  { nome: "Renda extra", tipo: "income", icone: "Briefcase", cor: "#14b8a6" },
  { nome: "Investimentos", tipo: "income", icone: "ChartLineUp", cor: "#22c55e" },
  { nome: "Presentes", tipo: "income", icone: "Gift", cor: "#f59e0b" },
  { nome: "Outros", tipo: "income", icone: "DotsThreeCircle", cor: "#94a3b8" },
] as const;

/** Cores atribuidas aos dois membros do casal, na ordem de entrada. */
export const CORES_MEMBRO = ["#14b8a6", "#8b5cf6"] as const;

/**
 * Cria o espaco financeiro de um usuario recem-cadastrado: o workspace, a
 * associacao dele como dono e as categorias iniciais.
 *
 * Tudo numa transacao — um workspace sem dono, ou com dono e sem categoria,
 * deixaria a conta num estado que a UI nao sabe representar.
 */
export async function criarWorkspaceInicial(params: {
  userId: string;
  nomeUsuario: string;
}): Promise<{ workspaceId: string }> {
  const { userId, nomeUsuario } = params;

  const primeiroNome = nomeUsuario.trim().split(/\s+/)[0] ?? "Meu";
  const nomeWorkspace = `Finanças de ${primeiroNome}`;
  const workspaceId = newId();

  await db.transaction(async (tx) => {
    await tx.insert(workspaces).values({
      id: workspaceId,
      name: nomeWorkspace,
      slug: slugify(nomeWorkspace),
      ownerId: userId,
    });

    await tx.insert(workspaceMembers).values({
      id: newId(),
      workspaceId,
      userId,
      role: "owner",
      displayName: primeiroNome,
      color: CORES_MEMBRO[0],
    });

    await tx.insert(categories).values(
      CATEGORIAS_PADRAO.map((c, i) => ({
        id: newId(),
        workspaceId,
        name: c.nome,
        kind: c.tipo,
        icon: c.icone,
        color: c.cor,
        isSystem: true,
        sortOrder: i,
      })),
    );
  });

  return { workspaceId };
}

/**
 * Workspace ativo do usuario. Hoje uma pessoa participa de um espaco so'; se
 * um dia participar de varios, este e' o unico ponto que precisa aprender a
 * escolher qual.
 */
export async function obterWorkspaceDoUsuario(userId: string) {
  const [membro] = await db
    .select({
      workspaceId: workspaceMembers.workspaceId,
      role: workspaceMembers.role,
      displayName: workspaceMembers.displayName,
      color: workspaceMembers.color,
      nome: workspaces.name,
      slug: workspaces.slug,
      currency: workspaces.currency,
    })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
    .where(eq(workspaceMembers.userId, userId))
    .limit(1);

  return membro ?? null;
}

/** Os membros do espaco — no modo casal, no maximo dois. */
export async function listarMembros(workspaceId: string) {
  return db
    .select({
      userId: workspaceMembers.userId,
      role: workspaceMembers.role,
      displayName: workspaceMembers.displayName,
      color: workspaceMembers.color,
      joinedAt: workspaceMembers.joinedAt,
    })
    .from(workspaceMembers)
    .where(eq(workspaceMembers.workspaceId, workspaceId));
}
