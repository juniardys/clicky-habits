import type { Hono } from "hono";
import { validatePassword, type PasswordError } from "./password";

export type SetPasswordCode = PasswordError | "already_has_password";

// Thrown by MeDeps.setPassword for failures the client can explain, e.g.
// a second tab setting the password after both passed the hasPassword check.
export class SetPasswordError extends Error {
  constructor(readonly code: SetPasswordCode) {
    super(code);
  }
}

export type MeDeps = {
  hasPassword(userId: string): Promise<boolean>;
  setPassword(newPassword: string, headers: Headers): Promise<void>;
};

// Account routes for the signed-in user. Session auth (setting `userId`) is
// applied by the caller on /me/*.
export function registerMeRoutes(app: Hono<{ Variables: { userId: string } }>, deps: MeDeps): void {
  app.get("/me/account", async (c) => {
    return c.json({ hasPassword: await deps.hasPassword(c.get("userId")) });
  });

  // Lets users who signed up with Google add a password so they can also
  // sign in with email + password. Users who already have one change it via
  // better-auth's /auth/change-password (needs the current password).
  app.post("/me/password", async (c) => {
    const body = await c.req.json<{ newPassword?: unknown }>().catch(() => ({ newPassword: undefined }));
    const error = validatePassword(body.newPassword);
    if (error) return c.json({ error }, 400);
    if (await deps.hasPassword(c.get("userId"))) {
      return c.json({ error: "already_has_password" }, 400);
    }
    try {
      await deps.setPassword(body.newPassword as string, c.req.raw.headers);
    } catch (err) {
      if (err instanceof SetPasswordError) return c.json({ error: err.code }, 400);
      throw err;
    }
    return c.json({ ok: true });
  });
}
