import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { auth, buildTrustedOrigins, missingTrustedOrigin } from "./auth";
import { habitService } from "./habits-service";
import { createChatRoutes } from "./chat/routes";
import { prisma } from "./db";
import { registerMeRoutes, SetPasswordError } from "./me-routes";

type Env = {
  Variables: {
    userId: string;
  };
};

const app = new Hono<Env>();
// Request log, minus /health so frequent health checks don't flood the logs.
const requestLogger = logger();
app.use(async (c, next) => {
  if (c.req.path === "/health") return next();
  return requestLogger(c, next);
});

// Fail fast on a split-origin deploy that forgot TRUSTED_ORIGINS. Checked
// against BETTER_AUTH_URL so local dev (localhost) stays silent.
const trustedOriginWarning = missingTrustedOrigin(
  process.env.BETTER_AUTH_URL ?? "http://localhost:5173"
);
if (trustedOriginWarning) {
  console.error(`[config] ${trustedOriginWarning}`);
  if (process.env.NODE_ENV === "production") process.exit(1);
}

// CORS: the web app always runs on a different origin than the API
// (https://clickyhabits.com calling https://api.clickyhabits.com).
// Enabled only when TRUSTED_ORIGINS is set, which every deployment needs.
if (process.env.TRUSTED_ORIGINS?.trim()) {
  app.use(
    "*",
    cors({
      origin: buildTrustedOrigins(),
      credentials: true,
      allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowHeaders: ["Content-Type", "Authorization"],
    })
  );
}

// better-auth handles everything under /auth/* (basePath in auth.ts).
app.on(["GET", "POST"], "/auth/*", (c) => auth.handler(c.req.raw));

app.get("/health", (c) => c.json({ ok: true }));

// ---------- auth guard ----------
app.use("/habits/*", async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) return c.json({ error: "Unauthorized" }, 401);
  c.set("userId", session.user.id);
  await next();
});
app.use("/habits-dashboard", async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) return c.json({ error: "Unauthorized" }, 401);
  c.set("userId", session.user.id);
  await next();
});
app.use("/habits", async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) return c.json({ error: "Unauthorized" }, 401);
  c.set("userId", session.user.id);
  await next();
});
app.use("/me/*", async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) return c.json({ error: "Unauthorized" }, 401);
  c.set("userId", session.user.id);
  await next();
});

// ---------- account (/me) ----------
registerMeRoutes(app, {
  hasPassword: async (userId) =>
    (await prisma.account.count({
      where: { userId, providerId: "credential", password: { not: null } },
    })) > 0,
  setPassword: async (newPassword, headers) => {
    try {
      await auth.api.setPassword({ body: { newPassword }, headers });
    } catch (err) {
      // better-auth APIError carries its code on body.code.
      const code = (err as { body?: { code?: string } })?.body?.code;
      if (code === "PASSWORD_ALREADY_SET") throw new SetPasswordError("already_has_password");
      if (code === "PASSWORD_TOO_SHORT") throw new SetPasswordError("password_too_short");
      if (code === "PASSWORD_TOO_LONG") throw new SetPasswordError("password_too_long");
      throw err;
    }
  },
});

// ---------- habits ----------
app.get("/habits", async (c) => {
  return c.json(await habitService.listHabits(c.get("userId")));
});

app.post("/habits", async (c) => {
  const body = await c.req.json<{ name?: string; type?: string }>();
  const name = body.name?.trim();
  if (!name) return c.json({ error: "Habit name is required" }, 400);
  if (body.type !== "CALENDAR" && body.type !== "JAR") {
    return c.json({ error: "Invalid tracker type" }, 400);
  }
  const habit = await habitService.createHabit(c.get("userId"), name, body.type);
  return c.json(habit, 201);
});

app.delete("/habits/:id", async (c) => {
  const deleted = await habitService.deleteHabit(c.get("userId"), c.req.param("id"));
  if (!deleted) return c.json({ error: "Not found" }, 404);
  return c.json({ ok: true });
});

app.get("/habits/:id", async (c) => {
  const habit = await habitService.getHabit(c.get("userId"), c.req.param("id"));
  if (!habit) return c.json({ error: "Not found" }, 404);
  return c.json(habit);
});

function parseDate(value: string | undefined): string | null {
  const key = value ?? new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return null;
  const d = new Date(key + "T00:00:00Z");
  return Number.isNaN(d.getTime()) ? null : key;
}

// Calendar tracker: toggle a day on/off.
app.post("/habits/:id/toggle", async (c) => {
  const body = await c.req.json<{ date?: string }>().catch(() => ({}) as { date?: string });
  const date = parseDate(body.date);
  if (!date) return c.json({ error: "Invalid date" }, 400);
  const result = await habitService.toggleDay(c.get("userId"), c.req.param("id"), date);
  if (!result) return c.json({ error: "Not found" }, 404);
  return c.json(result);
});

// Jar tracker: add one coin (today by default).
app.post("/habits/:id/coin", async (c) => {
  const body = await c.req.json<{ date?: string }>().catch(() => ({}) as { date?: string });
  const date = parseDate(body.date);
  if (!date) return c.json({ error: "Invalid date" }, 400);
  const result = await habitService.addCoins(c.get("userId"), c.req.param("id"), date, 1);
  if (!result) return c.json({ error: "Not found" }, 404);
  return c.json(result);
});

// Jar tracker: take one coin back out of the newest entry that has coins.
app.post("/habits/:id/coin/remove", async (c) => {
  const habit = await habitService.getHabit(c.get("userId"), c.req.param("id"));
  if (!habit) return c.json({ error: "Not found" }, 404);
  if (habit.type !== "JAR") return c.json({ error: "Not a jar habit" }, 400);
  const result = await habitService.removeLastCoin(c.get("userId"), c.req.param("id"));
  if (!result) return c.json({ error: "Not found" }, 404);
  return c.json(result);
});

// Aggregated dashboard across all habits of the user.
app.get("/habits-dashboard", async (c) => {
  return c.json(await habitService.getDashboard(c.get("userId")));
});

app.get("/habits/:id/stats", async (c) => {
  const stats = await habitService.getHabitStats(c.get("userId"), c.req.param("id"));
  if (!stats) return c.json({ error: "Not found" }, 404);
  return c.json(stats);
});

// ---------- chat agent ----------
app.route("/", createChatRoutes());

const port = Number(process.env.PORT ?? 3001);
console.log(`API listening on port ${port}`);

export default {
  port,
  fetch: app.fetch,
};
