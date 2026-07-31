/**
 * O widget do Pluggy devolve o erro como codigo cru — "INVALID_CREDENTIALS",
 * "TRIAL_CLIENT_ITEM_CREATE_NOT_ALLOWED". Jogar isso na tela nao ajuda
 * ninguem: o usuario nao sabe se errou a senha, se o banco caiu ou se o
 * problema e' da nossa conta no Pluggy.
 *
 * Traduzir e' so' metade — a outra metade e' nao esconder o codigo quando ele
 * for desconhecido, senao um erro novo vira "falhou" e ninguem consegue
 * investigar depois.
 */

const MENSAGENS: Record<string, string> = {
  // Conta Pluggy em trial/demo: os conectores de banco real sao bloqueados na
  // criacao do item. So' os de sandbox funcionam ate' a aplicacao sair do trial.
  TRIAL_CLIENT_ITEM_CREATE_NOT_ALLOWED:
    "A conta do Pluggy ainda está em modo de teste, e nesse modo ela não conecta banco real. Dá para exercitar o fluxo inteiro escolhendo um banco de sandbox na lista.",

  INVALID_CREDENTIALS: "O banco não aceitou esses dados de acesso. Confira e tente de novo.",
  INVALID_CREDENTIALS_MFA: "O código de verificação não foi aceito pelo banco.",
  ALREADY_LOGGED_IN: "O banco acusou outra sessão aberta. Saia do app do banco e tente de novo.",
  ACCOUNT_LOCKED: "O banco bloqueou o acesso. Resolva direto com ele antes de tentar aqui.",
  ACCOUNT_NEEDS_ACTION: "O banco está pedindo alguma ação sua no app dele antes de liberar o acesso.",
  SITE_NOT_AVAILABLE: "O sistema do banco está fora do ar agora. Tente mais tarde.",
  CONNECTION_ERROR: "Não consegui falar com o banco. Tente de novo em alguns minutos.",
  USER_AUTHORIZATION_PENDING: "A autorização não foi concluída no app do banco.",
  USER_INPUT_TIMEOUT: "O tempo para confirmar no banco acabou. Comece de novo.",
};

/** Codigo tem cara de CONSTANTE_ASSIM; o resto ja' e' frase legivel. */
const PARECE_CODIGO = /^[A-Z][A-Z0-9_]*$/;

export function traduzirErroPluggy(mensagem?: string | null): string {
  const bruto = (mensagem ?? "").trim();

  if (!bruto) return "A conexão com o banco falhou.";

  const conhecido = MENSAGENS[bruto];
  if (conhecido) return conhecido;

  // Codigo que ainda nao mapeamos: mostra a frase generica sem perder a pista.
  return PARECE_CODIGO.test(bruto) ? `A conexão com o banco falhou (${bruto}).` : bruto;
}
