export interface EntryLike {
  date: Date;
  count: number;
}

export interface HabitStats {
  totalCount: number;
  totalDays: number;
  currentStreak: number;
  bestStreak: number;
  last30Days: { date: string; count: number }[];
  thisMonthDays: number;
  completionRate30: number; // share of the last 30 days with at least one entry
}

const DAY_MS = 24 * 60 * 60 * 1000;

function toKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function utcToday(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export function computeStats(entries: EntryLike[]): HabitStats {
  const byDay = new Map<string, number>();
  for (const e of entries) {
    const key = toKey(e.date);
    byDay.set(key, (byDay.get(key) ?? 0) + e.count);
  }

  const totalCount = entries.reduce((s, e) => s + e.count, 0);
  const totalDays = byDay.size;

  // Streaks over days that have at least one entry.
  const sortedKeys = [...byDay.keys()].sort();
  let bestStreak = 0;
  let run = 0;
  let prev: Date | null = null;
  for (const key of sortedKeys) {
    const d = new Date(key + "T00:00:00Z");
    run = prev !== null && d.getTime() - prev.getTime() === DAY_MS ? run + 1 : 1;
    bestStreak = Math.max(bestStreak, run);
    prev = d;
  }

  // Current streak: consecutive days ending today or yesterday.
  const today = utcToday();
  let currentStreak = 0;
  let cursor = today;
  if (!byDay.has(toKey(cursor))) {
    cursor = new Date(cursor.getTime() - DAY_MS);
  }
  while (byDay.has(toKey(cursor))) {
    currentStreak++;
    cursor = new Date(cursor.getTime() - DAY_MS);
  }

  const last30Days: { date: string; count: number }[] = [];
  let daysDone30 = 0;
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today.getTime() - i * DAY_MS);
    const key = toKey(d);
    const count = byDay.get(key) ?? 0;
    if (count > 0) daysDone30++;
    last30Days.push({ date: key, count });
  }

  const monthPrefix = toKey(today).slice(0, 7);
  let thisMonthDays = 0;
  for (const key of byDay.keys()) {
    if (key.startsWith(monthPrefix)) thisMonthDays++;
  }

  return {
    totalCount,
    totalDays,
    currentStreak,
    bestStreak,
    last30Days,
    thisMonthDays,
    completionRate30: Math.round((daysDone30 / 30) * 100),
  };
}
