import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";

/**
 * Todas as rotas do better-auth (login, cadastro, sessao, logout) passam
 * por aqui. O service worker ignora /api/* de proposito — sessao e dado
 * financeiro nunca podem ser servidos do cache.
 */
export const { GET, POST } = toNextJsHandler(auth);
