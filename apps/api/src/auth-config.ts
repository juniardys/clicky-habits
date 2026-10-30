import { oneTap } from "better-auth/plugins";

// Google sign-in config, split out of auth.ts so it can be unit tested
// without instantiating Prisma / better-auth.

// prompt: "select_account" forces Google to show the account picker on
// every OAuth sign-in, even when the browser already has a Google session
// (otherwise the last used account is silently reused).
export function buildSocialProviders(clientId?: string, clientSecret?: string) {
  if (!clientId || !clientSecret) return {};
  return {
    google: {
      clientId,
      clientSecret,
      prompt: "select_account" as const,
    },
  };
}

// Google One Tap (the floating "Continue as ..." prompt) needs a server
// endpoint to verify the ID token Google returns. Only register it when
// Google is configured; the audience falls back to the provider's
// clientId, but pass it explicitly so it also works standalone.
export function buildAuthPlugins(clientId?: string) {
  if (!clientId) return [];
  return [oneTap({ clientId })];
}
