import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "./db";

// Public base URL of the auth/API endpoints.
// - Local dev:  http://localhost:5173 (Vite proxies /api to this server)
// - Production: https://api.clickyhabits.com
const baseURL = process.env.BETTER_AUTH_URL ?? "http://localhost:5173";

// Local dev origins are always allowed. In production, BETTER_AUTH_URL (and
// any comma-separated extras in TRUSTED_ORIGINS) are added so the deployed
// domain can sign in. The API lives on its own subdomain, so TRUSTED_ORIGINS
// must list the web origin (e.g. https://clickyhabits.com).
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

// A split-origin deployment (web on example.com, API on api.example.com) must
// list the web origin in TRUSTED_ORIGINS. Without it, credentialed CORS is not
// mounted and better-auth rejects the web origin's callbackURL with a 403,
// which only shows up at sign-in. Fail loudly at boot instead.
export function missingTrustedOrigin(baseURL: string): string | null {
  const extras = (process.env.TRUSTED_ORIGINS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (extras.length > 0) return null;

  let baseOrigin: string;
  try {
    baseOrigin = new URL(baseURL).origin;
  } catch {
    return null;
  }

  return `TRUSTED_ORIGINS is empty but the API is deployed at ${baseOrigin}. Set it to the web app origin (e.g. https://example.com) or split-origin sign-in will fail with 403 Invalid callbackURL.`;
}

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  baseURL,
  // Auth endpoints live at the API root (/auth/*), not under a /api prefix.
  // Must match the client's basePath and the Google redirect URI.
  basePath: "/auth",
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
