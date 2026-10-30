import { Hono } from "hono";
import { logger } from "hono/logger";
import { auth } from "./auth";
import { habitService } from "./habits-service";
import { createChatRoutes } from "./chat/routes";

type Env = {
  Variables: {
    userId: string;
  };
};

const app = new Hono<Env>();
app.use(logger());

// better-auth handles everything under /api/auth/*
app.on(["GET", "POST"], "/api/auth/*", (c) => auth.handler(c.req.raw));

app.get("/api/health", (c) => c.json({ ok: true }));

// ---------- auth guard ----------
app.use("/api/habits/*", async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) return c.json({ error: "Unauthorized" }, 401);
  c.set("userId", session.user.id);
  await next();
});
app.use("/api/habits-dashboard", async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) return c.json({ error: "Unauthorized" }, 401);
  c.set("userId", session.user.id);
  await next();
});
app.use("/api/habits", async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) return c.json({ error: "Unauthorized" }, 401);
  c.set("userId", session.user.id);
  await next();
});

// ---------- habits ----------
app.get("/api/habits", async (c) => {
  return c.json(await habitService.listHabits(c.get("userId")));
});

app.post("/api/habits", async (c) => {
  const body = await c.req.json<{ name?: string; type?: string }>();
  const name = body.name?.trim();
  if (!name) return c.json({ error: "Habit name is required" }, 400);
  if (body.type !== "CALENDAR" && body.type !== "JAR") {
    return c.json({ error: "Invalid tracker type" }, 400);
  }
  const habit = await habitService.createHabit(c.get("userId"), name, body.type);
  return c.json(habit, 201);
});

app.delete("/api/habits/:id", async (c) => {
  const deleted = await habitService.deleteHabit(c.get("userId"), c.req.param("id"));
  if (!deleted) return c.json({ error: "Not found" }, 404);
  return c.json({ ok: true });
});

app.get("/api/habits/:id", async (c) => {
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
app.post("/api/habits/:id/toggle", async (c) => {
  const body = await c.req.json<{ date?: string }>().catch(() => ({}) as { date?: string });
  const date = parseDate(body.date);
  if (!date) return c.json({ error: "Invalid date" }, 400);
  const result = await habitService.toggleDay(c.get("userId"), c.req.param("id"), date);
  if (!result) return c.json({ error: "Not found" }, 404);
  return c.json(result);
});

// Jar tracker: add one coin (today by default).
app.post("/api/habits/:id/coin", async (c) => {
  const body = await c.req.json<{ date?: string }>().catch(() => ({}) as { date?: string });
  const date = parseDate(body.date);
  if (!date) return c.json({ error: "Invalid date" }, 400);
  const result = await habitService.addCoins(c.get("userId"), c.req.param("id"), date, 1);
  if (!result) return c.json({ error: "Not found" }, 404);
  return c.json(result);
});

// Aggregated dashboard across all habits of the user.
app.get("/api/habits-dashboard", async (c) => {
  return c.json(await habitService.getDashboard(c.get("userId")));
});

app.get("/api/habits/:id/stats", async (c) => {
  const stats = await habitService.getHabitStats(c.get("userId"), c.req.param("id"));
  if (!stats) return c.json({ error: "Not found" }, 404);
  return c.json(stats);
});

// ---------- chat agent ----------
app.route("/", createChatRoutes());

const port = Number(process.env.PORT ?? 3001);
console.log(`API listening on http://localhost:${port}`);

export default {
  port,
  fetch: app.fetch,
};
