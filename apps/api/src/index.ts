import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { auth } from "./auth";
import { prisma } from "./db";
import { computeStats } from "./stats";

type Env = {
  Variables: {
    userId: string;
  };
};

const app = new Hono<Env>();
app.use(logger());

// CORS: needed when the web app runs on a different origin, e.g.
// https://clickyhabits.com calling https://api.clickyhabits.com.
// Dev leaves CORS_ORIGINS empty -> same-origin via the Vite proxy, no CORS.
const corsOrigins = (process.env.CORS_ORIGINS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
if (corsOrigins.length > 0) {
  app.use(
    "/api/*",
    cors({
      origin: corsOrigins,
      credentials: true,
      allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowHeaders: ["Content-Type", "Authorization"],
    })
  );
}

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
  const habits = await prisma.habit.findMany({
    where: { userId: c.get("userId") },
    orderBy: { createdAt: "asc" },
    include: { entries: { select: { date: true, count: true } } },
  });
  return c.json(
    habits.map((h) => {
      const totalCount = h.entries.reduce((s, e) => s + e.count, 0);
      const todayKey = new Date().toISOString().slice(0, 10);
      const doneToday = h.entries.some(
        (e) => e.date.toISOString().slice(0, 10) === todayKey
      );
      return {
        id: h.id,
        name: h.name,
        type: h.type,
        createdAt: h.createdAt,
        totalCount,
        totalDays: h.entries.length,
        doneToday,
      };
    })
  );
});

app.post("/api/habits", async (c) => {
  const body = await c.req.json<{ name?: string; type?: string }>();
  const name = body.name?.trim();
  if (!name) return c.json({ error: "Habit name is required" }, 400);
  if (body.type !== "CALENDAR" && body.type !== "JAR") {
    return c.json({ error: "Invalid tracker type" }, 400);
  }
  const habit = await prisma.habit.create({
    data: { userId: c.get("userId"), name, type: body.type },
  });
  return c.json(habit, 201);
});

app.delete("/api/habits/:id", async (c) => {
  const habit = await prisma.habit.findFirst({
    where: { id: c.req.param("id"), userId: c.get("userId") },
  });
  if (!habit) return c.json({ error: "Not found" }, 404);
  await prisma.habit.delete({ where: { id: habit.id } });
  return c.json({ ok: true });
});

app.get("/api/habits/:id", async (c) => {
  const habit = await prisma.habit.findFirst({
    where: { id: c.req.param("id"), userId: c.get("userId") },
    include: { entries: { orderBy: { date: "asc" } } },
  });
  if (!habit) return c.json({ error: "Not found" }, 404);
  return c.json({
    id: habit.id,
    name: habit.name,
    type: habit.type,
    createdAt: habit.createdAt,
    entries: habit.entries.map((e) => ({
      date: e.date.toISOString().slice(0, 10),
      count: e.count,
    })),
    totalCount: habit.entries.reduce((s, e) => s + e.count, 0),
  });
});

function parseDate(value: string | undefined): Date | null {
  const key = value ?? new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return null;
  const d = new Date(key + "T00:00:00Z");
  return Number.isNaN(d.getTime()) ? null : d;
}

// Calendar tracker: toggle a day on/off.
app.post("/api/habits/:id/toggle", async (c) => {
  const habit = await prisma.habit.findFirst({
    where: { id: c.req.param("id"), userId: c.get("userId") },
  });
  if (!habit) return c.json({ error: "Not found" }, 404);
  const body = await c.req.json<{ date?: string }>().catch(() => ({}) as { date?: string });
  const date = parseDate(body.date);
  if (!date) return c.json({ error: "Invalid date" }, 400);

  const existing = await prisma.entry.findUnique({
    where: { habitId_date: { habitId: habit.id, date } },
  });
  if (existing) {
    await prisma.entry.delete({ where: { id: existing.id } });
    return c.json({ marked: false, date: date.toISOString().slice(0, 10) });
  }
  await prisma.entry.create({ data: { habitId: habit.id, date } });
  return c.json({ marked: true, date: date.toISOString().slice(0, 10) });
});

// Jar tracker: add one coin (today by default).
app.post("/api/habits/:id/coin", async (c) => {
  const habit = await prisma.habit.findFirst({
    where: { id: c.req.param("id"), userId: c.get("userId") },
  });
  if (!habit) return c.json({ error: "Not found" }, 404);
  const body = await c.req.json<{ date?: string }>().catch(() => ({}) as { date?: string });
  const date = parseDate(body.date);
  if (!date) return c.json({ error: "Invalid date" }, 400);

  const entry = await prisma.entry.upsert({
    where: { habitId_date: { habitId: habit.id, date } },
    create: { habitId: habit.id, date },
    update: { count: { increment: 1 } },
  });
  const agg = await prisma.entry.aggregate({
    where: { habitId: habit.id },
    _sum: { count: true },
  });
  return c.json({
    date: entry.date.toISOString().slice(0, 10),
    countToday: entry.count,
    totalCount: agg._sum.count ?? 0,
  });
});

// Aggregated dashboard across all habits of the user.
app.get("/api/habits-dashboard", async (c) => {
  const habits = await prisma.habit.findMany({
    where: { userId: c.get("userId") },
    orderBy: { createdAt: "asc" },
    include: { entries: true },
  });

  const perHabit = habits.map((h) => ({
    id: h.id,
    name: h.name,
    type: h.type,
    ...computeStats(h.entries),
  }));

  // Combined daily activity: count of entry-units per day across all habits.
  const combined = new Map<string, number>();
  for (const h of habits) {
    for (const e of h.entries) {
      const key = e.date.toISOString().slice(0, 10);
      combined.set(key, (combined.get(key) ?? 0) + e.count);
    }
  }
  const now = new Date();
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const last30Days: { date: string; count: number }[] = [];
  let activeDays30 = 0;
  for (let i = 29; i >= 0; i--) {
    const key = new Date(todayUtc - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const count = combined.get(key) ?? 0;
    if (count > 0) activeDays30++;
    last30Days.push({ date: key, count });
  }

  const totalCoins = perHabit
    .filter((h) => h.type === "JAR")
    .reduce((s, h) => s + h.totalCount, 0);
  const totalDaysMarked = perHabit
    .filter((h) => h.type === "CALENDAR")
    .reduce((s, h) => s + h.totalDays, 0);
  const best = perHabit.reduce(
    (acc, h) => (h.bestStreak > acc.value ? { value: h.bestStreak, name: h.name } : acc),
    { value: 0, name: "" }
  );

  return c.json({
    totalHabits: habits.length,
    totalCoins,
    totalDaysMarked,
    activeDays30,
    completionRate30: Math.round((activeDays30 / 30) * 100),
    bestStreak: best,
    last30Days,
    habits: perHabit,
  });
});

app.get("/api/habits/:id/stats", async (c) => {
  const habit = await prisma.habit.findFirst({
    where: { id: c.req.param("id"), userId: c.get("userId") },
    include: { entries: true },
  });
  if (!habit) return c.json({ error: "Not found" }, 404);
  return c.json({
    id: habit.id,
    name: habit.name,
    type: habit.type,
    ...computeStats(habit.entries),
  });
});

const port = Number(process.env.PORT ?? 3001);
console.log(`API listening on port ${port}`);

export default {
  port,
  fetch: app.fetch,
};
