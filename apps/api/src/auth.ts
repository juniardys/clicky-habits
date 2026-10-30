import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "./db";

// Public base URL of the auth/API endpoints.
// - Dev: leave the default; the Vite dev server proxies /api to this server.
// - Prod (subdomain setup): https://api.clickyhabits.com
const baseURL = process.env.BETTER_AUTH_URL ?? "http://localhost:5173";

// Origins allowed to call the auth endpoints (better-auth CSRF check).
// - Dev: the localhost defaults below are enough.
// - Prod: set BETTER_AUTH_TRUSTED_ORIGINS="https://clickyhabits.com"
const trustedOrigins = [
  "http://localhost:5173",
  "http://localhost:3001",
  ...(process.env.BETTER_AUTH_TRUSTED_ORIGINS?.split(",") ?? []).map((s) =>
    s.trim()
  ),
].filter(Boolean);

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
  trustedOrigins,
});

export type Auth = typeof auth;
