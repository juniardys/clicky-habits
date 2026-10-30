import { createAuthClient } from "better-auth/react";
import { oneTapClient } from "better-auth/client/plugins";
import { API_URL, GOOGLE_CLIENT_ID } from "./config";

export const authClient = createAuthClient({
  // Dev -> Vite proxies /auth to the API on :3001.
  // Prod -> https://api.clickyhabits.com (via VITE_API_URL).
  baseURL: API_URL || window.location.origin,
  // Must match better-auth's basePath on the API and the Google redirect URI.
  basePath: "/auth",
  plugins: [
    // Google One Tap. Registered even when GOOGLE_CLIENT_ID is empty: the
    // plugin is inert until oneTap() is called, and LoginPage only calls it
    // when an ID is configured.
    oneTapClient({
      clientId: GOOGLE_CLIENT_ID,
      autoSelect: false,
      cancelOnTapOutside: true,
      context: "signin",
    }),
  ],
});

export const { useSession, signIn, signUp, signOut } = authClient;
