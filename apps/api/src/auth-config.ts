import { oneTap } from "better-auth/plugins";
import { changeEmailEmail, verificationEmail, type EmailMessage } from "./email";

// better-auth sends both the sign-up verification and the "confirm your new
// email" link through sendVerificationEmail. The token payload tells them
// apart: change-email tokens carry `updateTo`.
function isChangeEmailToken(token: string): boolean {
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1] ?? "", "base64url").toString("utf8"));
    return typeof payload?.updateTo === "string";
  } catch {
    return false;
  }
}

// Email verification + change email config, split out so it can be unit
// tested with a fake sender.
// - Unverified users can still sign in (a banner nags them to verify).
// - Verified users changing email get a link at the new address; the email
//   switches only after it is clicked.
// - Unverified users changing email get it updated right away, plus a
//   verification link at the new address.
// Sending is never awaited (better-auth timing-attack guidance).
export function buildEmailOptions(send: (msg: EmailMessage) => Promise<void>) {
  return {
    emailAndPassword: { enabled: true, requireEmailVerification: false },
    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url, token }: { user: { email: string }; url: string; token: string }) => {
        const msg = isChangeEmailToken(token)
          ? changeEmailEmail(user.email, url)
          : verificationEmail(user.email, url);
        void send(msg);
      },
    },
    user: {
      changeEmail: { enabled: true, updateEmailWithoutVerification: true },
    },
  };
}

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
