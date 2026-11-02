import { prisma } from "./db";
import { computeStats, resolveToday, type HabitStats } from "./stats";

export type TrackerType = "CALENDAR" | "JAR";

export interface HabitSummary {
  id: string;
  name: string;
  type: TrackerType;
  createdAt: Date;
  totalCount: number;
  totalDays: number;
  doneToday: boolean;
}

export interface HabitDetail {
  id: string;
  name: string;
  type: TrackerType;
  createdAt: Date;
  entries: { date: string; count: number }[];
  totalCount: number;
}

export interface HabitStatsResult extends HabitStats {
  id: string;
  name: string;
  type: TrackerType;
}

export interface DashboardData {
  totalHabits: number;
  totalCoins: number;
  totalDaysMarked: number;
  activeDays30: number;
  completionRate30: number;
  bestStreak: { value: number; name: string };
  last30Days: { date: string; count: number }[];
  habits: HabitStatsResult[];
}

function toDate(dateKey: string): Date {
  return new Date(dateKey + "T00:00:00Z");
}

async function findOwnedHabit(userId: string, id: string) {
  return prisma.habit.findFirst({ where: { id, userId } });
}

// `today` on the read methods is the user's local date (YYYY-MM-DD); entries
// are stored under local dates, so "today" must match them. Defaults to UTC.
export interface HabitService {
  listHabits(userId: string, today?: string): Promise<HabitSummary[]>;
  createHabit(
    userId: string,
    name: string,
    type: TrackerType
  ): Promise<{ id: string; userId: string; name: string; type: TrackerType; createdAt: Date }>;
  deleteHabit(userId: string, id: string): Promise<boolean>;
  getHabit(userId: string, id: string): Promise<HabitDetail | null>;
  toggleDay(
    userId: string,
    id: string,
    date: string
  ): Promise<{ marked: boolean; date: string } | null>;
  ensureMarked(
    userId: string,
    id: string,
    date: string
  ): Promise<{ created: boolean; date: string } | null>;
  addCoins(
    userId: string,
    id: string,
    date: string,
    count: number
  ): Promise<{ date: string; countToday: number; totalCount: number } | null>;
  removeMark(userId: string, id: string, date: string): Promise<boolean>;
  decrementCoins(
    userId: string,
    id: string,
    date: string,
    count: number
  ): Promise<{ removed: number; countToday: number }>;
  removeLastCoin(
    userId: string,
    id: string
  ): Promise<{ date: string | null; removed: number; countToday: number; totalCount: number } | null>;
  getDashboard(userId: string, today?: string): Promise<DashboardData>;
  getHabitStats(userId: string, id: string, today?: string): Promise<HabitStatsResult | null>;
}

async function listHabits(userId: string, todayKey?: string): Promise<HabitSummary[]> {
  const habits = await prisma.habit.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    include: { entries: { select: { date: true, count: true } } },
  });
  const today = resolveToday(todayKey).toISOString().slice(0, 10);
  return habits.map((h) => ({
    id: h.id,
    name: h.name,
    type: h.type,
    createdAt: h.createdAt,
    totalCount: h.entries.reduce((s, e) => s + e.count, 0),
    totalDays: h.entries.length,
    doneToday: h.entries.some((e) => e.date.toISOString().slice(0, 10) === today),
  }));
}

async function createHabit(userId: string, name: string, type: TrackerType) {
  const habit = await prisma.habit.create({ data: { userId, name, type } });
  return {
    id: habit.id,
    userId: habit.userId,
    name: habit.name,
    type: habit.type,
    createdAt: habit.createdAt,
  };
}

async function deleteHabit(userId: string, id: string): Promise<boolean> {
  const habit = await findOwnedHabit(userId, id);
  if (!habit) return false;
  await prisma.habit.delete({ where: { id: habit.id } });
  return true;
}

async function getHabit(userId: string, id: string): Promise<HabitDetail | null> {
  const habit = await prisma.habit.findFirst({
    where: { id, userId },
    include: { entries: { orderBy: { date: "asc" } } },
  });
  if (!habit) return null;
  return {
    id: habit.id,
    name: habit.name,
    type: habit.type,
    createdAt: habit.createdAt,
    entries: habit.entries.map((e) => ({
      date: e.date.toISOString().slice(0, 10),
      count: e.count,
    })),
    totalCount: habit.entries.reduce((s, e) => s + e.count, 0),
  };
}

async function toggleDay(userId: string, id: string, dateKey: string) {
  const habit = await findOwnedHabit(userId, id);
  if (!habit) return null;
  const date = toDate(dateKey);
  const existing = await prisma.entry.findUnique({
    where: { habitId_date: { habitId: habit.id, date } },
  });
  if (existing) {
    await prisma.entry.delete({ where: { id: existing.id } });
    return { marked: false, date: dateKey };
  }
  await prisma.entry.create({ data: { habitId: habit.id, date } });
  return { marked: true, date: dateKey };
}

async function ensureMarked(userId: string, id: string, dateKey: string) {
  const habit = await findOwnedHabit(userId, id);
  if (!habit) return null;
  const date = toDate(dateKey);
  const existing = await prisma.entry.findUnique({
    where: { habitId_date: { habitId: habit.id, date } },
  });
  if (existing) return { created: false, date: dateKey };
  await prisma.entry.create({ data: { habitId: habit.id, date } });
  return { created: true, date: dateKey };
}

async function addCoins(userId: string, id: string, dateKey: string, count: number) {
  const habit = await findOwnedHabit(userId, id);
  if (!habit) return null;
  const date = toDate(dateKey);
  const entry = await prisma.entry.upsert({
    where: { habitId_date: { habitId: habit.id, date } },
    create: { habitId: habit.id, date, count },
    update: { count: { increment: count } },
  });
  const agg = await prisma.entry.aggregate({
    where: { habitId: habit.id },
    _sum: { count: true },
  });
  return { date: dateKey, countToday: entry.count, totalCount: agg._sum.count ?? 0 };
}

async function removeMark(userId: string, id: string, dateKey: string): Promise<boolean> {
  const habit = await findOwnedHabit(userId, id);
  if (!habit) return false;
  const date = toDate(dateKey);
  const existing = await prisma.entry.findUnique({
    where: { habitId_date: { habitId: habit.id, date } },
  });
  if (!existing) return false;
  await prisma.entry.delete({ where: { id: existing.id } });
  return true;
}

async function decrementCoins(userId: string, id: string, dateKey: string, count: number) {
  const habit = await findOwnedHabit(userId, id);
  if (!habit) return { removed: 0, countToday: 0 };
  const date = toDate(dateKey);
  const existing = await prisma.entry.findUnique({
    where: { habitId_date: { habitId: habit.id, date } },
  });
  if (!existing) return { removed: 0, countToday: 0 };
  const removed = Math.min(existing.count, count);
  const countToday = existing.count - removed;
  if (countToday <= 0) {
    await prisma.entry.delete({ where: { id: existing.id } });
  } else {
    await prisma.entry.update({ where: { id: existing.id }, data: { count: countToday } });
  }
  return { removed, countToday };
}

/** Newest entry date (YYYY-MM-DD) that still holds at least one coin. */
export function latestCoinDate(entries: { date: string; count: number }[]): string | null {
  let latest: string | null = null;
  for (const e of entries) {
    if (e.count > 0 && (latest === null || e.date > latest)) latest = e.date;
  }
  return latest;
}

async function removeLastCoin(userId: string, id: string) {
  const habit = await getHabit(userId, id);
  if (!habit || habit.type !== "JAR") return null;
  const date = latestCoinDate(habit.entries);
  if (!date) return { date: null, removed: 0, countToday: 0, totalCount: 0 };
  const { removed, countToday } = await decrementCoins(userId, id, date, 1);
  return { date, removed, countToday, totalCount: habit.totalCount - removed };
}

async function getDashboard(userId: string, todayKey?: string): Promise<DashboardData> {
  const habits = await prisma.habit.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    include: { entries: true },
  });

  const perHabit: HabitStatsResult[] = habits.map((h) => ({
    id: h.id,
    name: h.name,
    type: h.type,
    ...computeStats(h.entries, todayKey),
  }));

  const combined = new Map<string, number>();
  for (const h of habits) {
    for (const e of h.entries) {
      const key = e.date.toISOString().slice(0, 10);
      combined.set(key, (combined.get(key) ?? 0) + e.count);
    }
  }
  const todayUtc = resolveToday(todayKey).getTime();
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

  return {
    totalHabits: habits.length,
    totalCoins,
    totalDaysMarked,
    activeDays30,
    completionRate30: Math.round((activeDays30 / 30) * 100),
    bestStreak: best,
    last30Days,
    habits: perHabit,
  };
}

async function getHabitStats(
  userId: string,
  id: string,
  todayKey?: string
): Promise<HabitStatsResult | null> {
  const habit = await prisma.habit.findFirst({
    where: { id, userId },
    include: { entries: true },
  });
  if (!habit) return null;
  return { id: habit.id, name: habit.name, type: habit.type, ...computeStats(habit.entries, todayKey) };
}

export const habitService: HabitService = {
  listHabits,
  createHabit,
  deleteHabit,
  getHabit,
  toggleDay,
  ensureMarked,
  addCoins,
  removeMark,
  decrementCoins,
  removeLastCoin,
  getDashboard,
  getHabitStats,
};
