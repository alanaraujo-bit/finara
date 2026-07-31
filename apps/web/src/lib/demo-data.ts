/**
 * DADOS DE DEMONSTRACAO — provisorio.
 *
 * O banco de producao esta' vazio e a autenticacao ainda nao existe, entao a
 * tela precisa de algo pra mostrar. Tudo aqui e' inventado e esta' concentrado
 * neste arquivo de proposito: quando as queries reais entrarem, some este
 * modulo e nenhum componente muda de formato.
 *
 * Valores em centavos, como manda a convencao do app.
 */

export const demoResumo = {
  saldoTotal: 1284730,
  variacaoMes: 7.4,
  entradas: 962000,
  saidas: 618340,
  aReceber: 145000,
  dividasAbertas: 387500,
};

export type DemoCategoria = {
  nome: string;
  valor: number;
  cor: string;
};

export const demoCategorias: DemoCategoria[] = [
  { nome: "Moradia", valor: 210000, cor: "var(--info)" },
  { nome: "Alimentação", valor: 148900, cor: "var(--primary)" },
  { nome: "Transporte", valor: 92400, cor: "var(--accent)" },
  { nome: "Lazer", valor: 76200, cor: "var(--expense)" },
  { nome: "Saúde", valor: 54800, cor: "var(--income)" },
  { nome: "Outros", valor: 36040, cor: "var(--text-subtle)" },
];

export type DemoLancamento = {
  id: string;
  descricao: string;
  categoria: string;
  data: string;
  valor: number;
  tipo: "expense" | "income";
  origem: string;
};

export const demoLancamentos: DemoLancamento[] = [
  {
    id: "1",
    descricao: "Supermercado Pão de Açúcar",
    categoria: "Alimentação",
    data: "Hoje",
    valor: 28790,
    tipo: "expense",
    origem: "Nubank",
  },
  {
    id: "2",
    descricao: "Salário",
    categoria: "Renda",
    data: "Ontem",
    valor: 850000,
    tipo: "income",
    origem: "Itaú",
  },
  {
    id: "3",
    descricao: "Uber",
    categoria: "Transporte",
    data: "Ontem",
    valor: 3250,
    tipo: "expense",
    origem: "Nubank",
  },
  {
    id: "4",
    descricao: "Farmácia São Paulo",
    categoria: "Saúde",
    data: "28 jul",
    valor: 8940,
    tipo: "expense",
    origem: "Inter",
  },
  {
    id: "5",
    descricao: "Freela — landing page",
    categoria: "Renda extra",
    data: "27 jul",
    valor: 112000,
    tipo: "income",
    origem: "Itaú",
  },
];

export type DemoCompromisso = {
  id: string;
  nome: string;
  valor: number;
  vence: string;
  diasRestantes: number;
  tipo: "assinatura" | "fatura" | "divida";
};

export const demoCompromissos: DemoCompromisso[] = [
  { id: "a", nome: "Fatura Nubank", valor: 187430, vence: "5 ago", diasRestantes: 6, tipo: "fatura" },
  { id: "b", nome: "Netflix", valor: 5990, vence: "8 ago", diasRestantes: 9, tipo: "assinatura" },
  { id: "c", nome: "Financiamento carro", valor: 98700, vence: "10 ago", diasRestantes: 11, tipo: "divida" },
  { id: "d", nome: "Spotify", valor: 2190, vence: "12 ago", diasRestantes: 13, tipo: "assinatura" },
];
