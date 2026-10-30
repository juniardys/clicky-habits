import { describe, expect, test } from "bun:test";
import { Hono } from "hono";
import { registerMeRoutes, type MeDeps } from "./me-routes";

function makeApp(hasPassword: boolean) {
  const setCalls: string[] = [];
  const deps: MeDeps = {
    hasPassword: async () => hasPassword,
    setPassword: async (pw) => {
      setCalls.push(pw);
    },
  };
  const app = new Hono<{ Variables: { userId: string } }>();
  app.use("/me/*", async (c, next) => {
    c.set("userId", "u1");
    await next();
  });
  registerMeRoutes(app, deps);
  return { app, setCalls };
}

function post(app: Hono<{ Variables: { userId: string } }>, body: unknown) {
  return app.request("/me/password", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("GET /me/account", () => {
  test("returns whether the user has a password", async () => {
    const { app } = makeApp(false);
    const res = await app.request("/me/account");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ hasPassword: false });
  });
});

describe("POST /me/password", () => {
  test("rejects short password without calling setPassword", async () => {
    const { app, setCalls } = makeApp(false);
    const res = await post(app, { newPassword: "short" });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "password_too_short" });
    expect(setCalls).toEqual([]);
  });

  test("sets password for users without one", async () => {
    const { app, setCalls } = makeApp(false);
    const res = await post(app, { newPassword: "longenough1" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(setCalls).toEqual(["longenough1"]);
  });

  test("refuses when the user already has a password", async () => {
    const { app, setCalls } = makeApp(true);
    const res = await post(app, { newPassword: "longenough1" });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "already_has_password" });
    expect(setCalls).toEqual([]);
  });

  test("invalid JSON body is treated as missing password", async () => {
    const { app } = makeApp(false);
    const res = await app.request("/me/password", { method: "POST", body: "nope" });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "password_too_short" });
  });
});
