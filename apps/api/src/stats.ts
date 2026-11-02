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

// "Never miss twice": one empty day between done days keeps a streak alive,
// two empty days in a row end it. Streak length counts done days only.
const MAX_GAP_DAYS = 2;

function toKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Today's date as a UTC-midnight Date. `todayKey` is the user's local date (YYYY-MM-DD). */
export function resolveToday(todayKey?: string): Date {
  if (todayKey && /^\d{4}-\d{2}-\d{2}$/.test(todayKey)) {
    const d = new Date(todayKey + "T00:00:00Z");
    if (!Number.isNaN(d.getTime())) return d;
  }
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export function computeStats(entries: EntryLike[], todayKey?: string): HabitStats {
  const byDay = new Map<string, number>();
  for (const e of entries) {
    const key = toKey(e.date);
    byDay.set(key, (byDay.get(key) ?? 0) + e.count);
  }

  const totalCount = entries.reduce((s, e) => s + e.count, 0);
  const totalDays = byDay.size;

  // Streaks over days that have at least one entry. Days after today are
  // ignored so a future-dated mark cannot keep a streak alive.
  const today = resolveToday(todayKey);
  const sortedKeys = [...byDay.keys()].sort().filter((k) => k <= toKey(today));
  let bestStreak = 0;
  let run = 0;
  let prev: Date | null = null;
  for (const key of sortedKeys) {
    const d = new Date(key + "T00:00:00Z");
    run = prev !== null && d.getTime() - prev.getTime() <= MAX_GAP_DAYS * DAY_MS ? run + 1 : 1;
    bestStreak = Math.max(bestStreak, run);
    prev = d;
  }

  // Current streak: the run ending on the newest done day, still alive while
  // that day is no more than MAX_GAP_DAYS before today.
  const last = prev;
  const currentStreak =
    last !== null && today.getTime() - last.getTime() <= MAX_GAP_DAYS * DAY_MS ? run : 0;

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
