import { randomUUID } from "node:crypto";

/** Identificador de registro. UUID v4 — nao vaza contagem nem ordem de criacao. */
export function newId(): string {
  return randomUUID();
}

/** Token opaco para convite de parceiro. 32 bytes em base64url. */
export function newToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString("base64url");
}

// Bloco Unicode "Combining Diacritical Marks": o que o NFD separa da letra
// ("ã" vira "a" + acento). Comparado por codigo em vez de regex literal —
// caractere combinante no codigo-fonte e' invisivel no editor e se perde
// em reencode de arquivo.
const ACENTO_INICIO = 0x0300;
const ACENTO_FIM = 0x036f;

function semAcento(texto: string): string {
  let saida = "";
  for (const char of texto.normalize("NFD")) {
    const codigo = char.codePointAt(0) ?? 0;
    if (codigo < ACENTO_INICIO || codigo > ACENTO_FIM) saida += char;
  }
  return saida;
}

/**
 * Slug legivel a partir do nome do workspace, com sufixo aleatorio.
 * O sufixo evita colisao entre dois "Casa da Bia" sem precisar de retry.
 */
export function slugify(nome: string): string {
  const base = semAcento(nome)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);

  const sufixo = Math.random().toString(36).slice(2, 8);
  return `${base || "espaco"}-${sufixo}`;
}
