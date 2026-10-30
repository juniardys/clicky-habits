import { createAuthClient } from "better-auth/react";
import { API_URL } from "./config";

export const authClient = createAuthClient({
  // Dev -> Vite proxies /auth to the API on :3001.
  // Prod -> https://api.clickyhabits.com (via VITE_API_URL).
  baseURL: API_URL || window.location.origin,
  // Must match better-auth's basePath on the API and the Google redirect URI.
  basePath: "/auth",
});

export const { useSession, signIn, signUp, signOut } = authClient;
