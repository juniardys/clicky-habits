import { createAuthClient } from "better-auth/react";
import { API_URL } from "./config";

export const authClient = createAuthClient({
  // Empty in dev -> same origin (Vite proxy handles /api/auth).
  // Prod -> https://api.clickyhabits.com (via VITE_API_URL).
  baseURL: API_URL || window.location.origin,
});

export const { useSession, signIn, signUp, signOut } = authClient;
