import { describe, expect, test } from "bun:test";
import type {
  DashboardData,
  HabitDetail,
  HabitService,
  HabitStatsResult,
  HabitSummary,
  TrackerType,
} from "../habits-service";
import { describeToolCall, executeTool, type ToolContext } from "./tools";

interface FakeHabit {
  id: string;
  userId: string;
  name: string;
  type: TrackerType;
  entries: Map<string, number>;
}

export function makeFakeService(seed: FakeHabit[]): HabitService & { habits: FakeHabit[] } {
  const habits = seed;
  const owned = (userId: string, id: string) => habits.find((h) => h.id === id && h.userId === userId);
  const detail = (h: FakeHabit): HabitDetail => ({
    id: h.id,
    name: h.name,
    type: h.type,
    createdAt: new Date(),
    entries: [...h.entries.entries()].map(([date, count]) => ({ date, count })),
    totalCount: [...h.entries.values()].reduce((s, c) => s + c, 0),
  });
  const svc: HabitService & { habits: FakeHabit[] } = {
    habits,
    async listHabits(userId) {
      return habits
        .filter((h) => h.userId === userId)
        .map((h): HabitSummary => ({
          id: h.id,
          name: h.name,
          type: h.type,
          createdAt: new Date(),
          totalCount: [...h.entries.values()].reduce((s, c) => s + c, 0),
          totalDays: h.entries.size,
          doneToday: h.entries.has("2026-10-30"),
        }));
    },
    async createHabit(userId, name, type) {
      const h: FakeHabit = { id: `h${habits.length + 1}`, userId, name, type, entries: new Map() };
      habits.push(h);
      return { id: h.id, userId, name, type, createdAt: new Date() };
    },
    async deleteHabit(userId, id) {
      const i = habits.findIndex((h) => h.id === id && h.userId === userId);
      if (i < 0) return false;
      habits.splice(i, 1);
      return true;
    },
    async getHabit(userId, id) {
      const h = owned(userId, id);
      return h ? detail(h) : null;
    },
    async toggleDay() {
      return null;
    },
    async ensureMarked(userId, id, date) {
      const h = owned(userId, id);
      if (!h) return null;
      const created = !h.entries.has(date);
      if (created) h.entries.set(date, 1);
      return { created, date };
    },
    async addCoins(userId, id, date, count) {
      const h = owned(userId, id);
      if (!h) return null;
      const next = (h.entries.get(date) ?? 0) + count;
      h.entries.set(date, next);
      return {
        date,
        countToday: next,
        totalCount: [...h.entries.values()].reduce((s, c) => s + c, 0),
      };
    },
    async removeMark(userId, id, date) {
      const h = owned(userId, id);
      if (!h) return false;
      return h.entries.delete(date);
    },
    async decrementCoins(userId, id, date, count) {
      const h = owned(userId, id);
      if (!h) return { removed: 0, countToday: 0 };
      const cur = h.entries.get(date) ?? 0;
      const removed = Math.min(cur, count);
      const left = cur - removed;
      if (left <= 0) h.entries.delete(date);
      else h.entries.set(date, left);
      return { removed, countToday: left };
    },
    async getDashboard(userId): Promise<DashboardData> {
      const mine = habits.filter((h) => h.userId === userId);
      return {
        totalHabits: mine.length,
        totalCoins: 0,
        totalDaysMarked: 0,
        activeDays30: 0,
        completionRate30: 0,
        bestStreak: { value: 0, name: "" },
        last30Days: [],
        habits: [],
      };
    },
    async getHabitStats(userId, id): Promise<HabitStatsResult | null> {
      const h = owned(userId, id);
      if (!h) return null;
      return {
        id: h.id,
        name: h.name,
        type: h.type,
        totalCount: [...h.entries.values()].reduce((s, c) => s + c, 0),
        totalDays: h.entries.size,
        currentStreak: 0,
        bestStreak: 0,
        last30Days: [],
        thisMonthDays: 0,
        completionRate30: 0,
      };
    },
  };
  return svc;
}

const ctx: ToolContext = { userId: "u1", threadId: "t1", today: "2026-10-30", lang: "id" };

function seed() {
  return makeFakeService([
    { id: "cal1", userId: "u1", name: "Baca", type: "CALENDAR", entries: new Map() },
    { id: "jar1", userId: "u1", name: "Push-up", type: "JAR", entries: new Map([["2026-10-30", 2]]) },
    { id: "other", userId: "u2", name: "Milik orang", type: "JAR", entries: new Map() },
  ]);
}

describe("executeTool validation", () => {
  test("unknown tool returns ok:false and mutates nothing", async () => {
    const svc = seed();
    const out = await executeTool({ callId: "c", name: "nuke", arguments: {} }, ctx, svc);
    expect(out.ok).toBe(false);
    expect(svc.habits.length).toBe(3);
  });

  test("malformed arguments return ok:false", async () => {
    const svc = seed();
    const out = await executeTool(
      { callId: "c", name: "add_coins", arguments: { __malformed: "{oops" } },
      ctx,
      svc
    );
    expect(out.ok).toBe(false);
  });

  test("cross-user habit id is not found", async () => {
    const svc = seed();
    const out = await executeTool(
      { callId: "c", name: "add_coins", arguments: { habitId: "other", count: 1 } },
      ctx,
      svc
    );
    expect(out.ok).toBe(false);
    expect(svc.habits.find((h) => h.id === "other")!.entries.size).toBe(0);
  });

  test("add_coins on a CALENDAR habit fails; mark_day on a JAR habit fails", async () => {
    const svc = seed();
    const a = await executeTool(
      { callId: "c", name: "add_coins", arguments: { habitId: "cal1" } },
      ctx,
      svc
    );
    const b = await executeTool(
      { callId: "c", name: "mark_day", arguments: { habitId: "jar1" } },
      ctx,
      svc
    );
    expect(a.ok).toBe(false);
    expect(b.ok).toBe(false);
  });

  test("invalid date and out-of-range coin count fail", async () => {
    const svc = seed();
    const a = await executeTool(
      { callId: "c", name: "mark_day", arguments: { habitId: "cal1", date: "30-10-2026" } },
      ctx,
      svc
    );
    const b = await executeTool(
      { callId: "c", name: "add_coins", arguments: { habitId: "jar1", count: 99 } },
      ctx,
      svc
    );
    expect(a.ok).toBe(false);
    expect(b.ok).toBe(false);
  });
});

describe("executeTool writes and undo payloads", () => {
  test("mark_day is idempotent; second call produces no undo", async () => {
    const svc = seed();
    const first = await executeTool(
      { callId: "c", name: "mark_day", arguments: { habitId: "cal1" } },
      ctx,
      svc
    );
    const second = await executeTool(
      { callId: "c", name: "mark_day", arguments: { habitId: "cal1" } },
      ctx,
      svc
    );
    expect(first.ok).toBe(true);
    expect(first.undo).toEqual({ kind: "mark", payload: { habitId: "cal1", date: "2026-10-30" } });
    expect(second.ok).toBe(true);
    expect(second.undo).toBeUndefined();
    expect(svc.habits.find((h) => h.id === "cal1")!.entries.get("2026-10-30")).toBe(1);
  });

  test("add_coins defaults to 1 and carries undo payload", async () => {
    const svc = seed();
    const out = await executeTool(
      { callId: "c", name: "add_coins", arguments: { habitId: "jar1", count: 3 } },
      ctx,
      svc
    );
    expect(out.ok).toBe(true);
    expect(out.undo).toEqual({
      kind: "coins",
      payload: { habitId: "jar1", date: "2026-10-30", count: 3 },
    });
    expect(svc.habits.find((h) => h.id === "jar1")!.entries.get("2026-10-30")).toBe(5);
  });

  test("create_habit carries create undo payload", async () => {
    const svc = seed();
    const out = await executeTool(
      { callId: "c", name: "create_habit", arguments: { name: "Meditasi", type: "CALENDAR" } },
      ctx,
      svc
    );
    expect(out.ok).toBe(true);
    expect(out.undo?.kind).toBe("create");
    expect(String(out.undo?.payload.habitId)).toBeTruthy();
  });

  test("delete_habit returns pendingDelete and does not delete", async () => {
    const svc = seed();
    const out = await executeTool(
      { callId: "c", name: "delete_habit", arguments: { habitId: "jar1" } },
      ctx,
      svc
    );
    expect(out.pendingDelete).toEqual({ habitId: "jar1", name: "Push-up" });
    expect(svc.habits.some((h) => h.id === "jar1")).toBe(true);
  });
});

describe("describeToolCall", () => {
  test("label resolves the habit name", async () => {
    const svc = seed();
    const label = await describeToolCall(
      { callId: "c", name: "add_coins", arguments: { habitId: "jar1", count: 2 } },
      ctx,
      svc
    );
    expect(label).toContain("Push-up");
    expect(label).toContain("2");
  });
});
