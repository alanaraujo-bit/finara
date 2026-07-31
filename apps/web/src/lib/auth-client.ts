"use client";

import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  // Vazio = mesma origem. Em producao a Vercel serve app e API no mesmo
  // dominio, entao nao ha' o que configurar.
  baseURL: process.env.NEXT_PUBLIC_APP_URL,
});

export const { signIn, signUp, signOut, useSession } = authClient;
