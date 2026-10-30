import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "./db";

// Public base URL of the auth/API endpoints.
// - Local dev:        http://localhost:5173 (Vite proxies /api to this server)
// - Single domain:    https://clickyhabits.com
// - API on subdomain: https://api.clickyhabits.com
const baseURL = process.env.BETTER_AUTH_URL ?? "http://localhost:5173";

// Local dev origins are always allowed. In production, BETTER_AUTH_URL (and
// any comma-separated extras in TRUSTED_ORIGINS) are added so the deployed
// domain can sign in. With the API on a subdomain, TRUSTED_ORIGINS must list
// the web origin (e.g. https://clickyhabits.com).
export function buildTrustedOrigins(): string[] {
  const origins = new Set(["http://localhost:5173", "http://localhost:3001"]);

  const envBaseURL = process.env.BETTER_AUTH_URL;
  if (envBaseURL) {
    try {
      origins.add(new URL(envBaseURL).origin);
    } catch {
      // ignore malformed value
    }
  }

  for (const extra of (process.env.TRUSTED_ORIGINS ?? "").split(",")) {
    const trimmed = extra.trim();
    if (trimmed) origins.add(trimmed);
  }

  return [...origins];
}

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  baseURL,
  secret: process.env.BETTER_AUTH_SECRET,
  // Email/password is enabled so the app can be used locally before
  // Google SSO credentials are configured.
  emailAndPassword: {
    enabled: true,
  },
  socialProviders:
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? {
          google: {
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          },
        }
      : {},
  trustedOrigins: buildTrustedOrigins(),
});

export type Auth = typeof auth;
