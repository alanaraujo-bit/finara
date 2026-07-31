/**
 * Vocabulario visual das categorias: os icones e as cores que o usuario pode
 * escolher.
 *
 * Aqui ficam so' os NOMES, sem importar componente nenhum — o modulo precisa
 * ser legivel tanto pela server action (que valida o que veio do formulario)
 * quanto pelo componente de cliente (que resolve o nome para o icone). Um
 * arquivo com `import` do Phosphor nao poderia ser lido pelo servidor.
 *
 * O nome guardado no banco e' o do icone no Phosphor sem o sufixo `Icon`
 * ("House", "ForkKnife"), que e' o formato que `criarWorkspaceInicial` ja'
 * grava nas 16 categorias padrao.
 */

export const ICONES_CATEGORIA = [
  // casa e contas
  "House",
  "Buildings",
  "Lightning",
  "Drop",
  "WifiHigh",
  "Phone",
  // comida
  "ForkKnife",
  "Coffee",
  "ShoppingCart",
  "Basket",
  // transporte
  "Car",
  "Bus",
  "GasPump",
  "Airplane",
  // saude e cuidado
  "Heartbeat",
  "Pill",
  "Barbell",
  "Scissors",
  // estudo e lazer
  "GraduationCap",
  "Book",
  "FilmSlate",
  "GameController",
  "MusicNotes",
  // pessoas e compras
  "ShoppingBag",
  "TShirt",
  "PawPrint",
  "Baby",
  "Users",
  "Gift",
  // dinheiro
  "Money",
  "PiggyBank",
  "HandCoins",
  "ChartLineUp",
  "Briefcase",
  "Bank",
  "CreditCard",
  "Receipt",
  "Repeat",
  "Wrench",
  "Sparkle",
  "Tag",
  "DotsThreeCircle",
] as const;

export type IconeCategoria = (typeof ICONES_CATEGORIA)[number];

/**
 * Paleta fechada, em vez de seletor de cor livre. Duas razoes: cor escolhida
 * a esmo estraga a harmonia do grafico de gastos, e tom muito claro some no
 * tema escuro. Estes 18 foram conferidos nos dois temas.
 */
export const CORES_CATEGORIA = [
  "#ef4444",
  "#f43f5e",
  "#ec4899",
  "#a855f7",
  "#8b5cf6",
  "#6366f1",
  "#3b82f6",
  "#0ea5e9",
  "#06b6d4",
  "#14b8a6",
  "#10b981",
  "#22c55e",
  "#84cc16",
  "#eab308",
  "#f59e0b",
  "#f97316",
  "#78716c",
  "#64748b",
] as const;

export const ICONE_PADRAO: IconeCategoria = "Tag";
export const COR_PADRAO = "#6366f1";

export function ehIconeValido(valor: string): valor is IconeCategoria {
  return (ICONES_CATEGORIA as readonly string[]).includes(valor);
}

export function ehCorValida(valor: string): boolean {
  return (CORES_CATEGORIA as readonly string[]).includes(valor);
}
