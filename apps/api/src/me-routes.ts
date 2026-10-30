import type { Hono } from "hono";
import { validatePassword } from "./password";

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
    await deps.setPassword(body.newPassword as string, c.req.raw.headers);
    return c.json({ ok: true });
  });
}
