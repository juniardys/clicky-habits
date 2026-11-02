import { describe, expect, test } from "bun:test";
import { computeStats } from "./stats";

function days(...keys: string[]) {
  return keys.map((k) => ({ date: new Date(k + "T00:00:00Z"), count: 1 }));
}

describe("computeStats streaks", () => {
  test("one missed day does not break the streak", () => {
    const s = computeStats(days("2026-11-01", "2026-11-02", "2026-11-04", "2026-11-05"), "2026-11-05");
    expect(s.currentStreak).toBe(4);
    expect(s.bestStreak).toBe(4);
  });

  test("two missed days in a row end the streak", () => {
    const s = computeStats(days("2026-11-01", "2026-11-02", "2026-11-05"), "2026-11-05");
    expect(s.currentStreak).toBe(1);
    expect(s.bestStreak).toBe(2);
  });

  test("streak stays alive while today and yesterday are still open", () => {
    expect(computeStats(days("2026-11-02", "2026-11-03"), "2026-11-04").currentStreak).toBe(2);
    expect(computeStats(days("2026-11-02", "2026-11-03"), "2026-11-05").currentStreak).toBe(2);
    expect(computeStats(days("2026-11-02", "2026-11-03"), "2026-11-06").currentStreak).toBe(0);
  });

  test("uses the user's local today, not the server's UTC date", () => {
    // A mark on the user's local Nov 6 must count even if UTC is still Nov 5.
    const s = computeStats(days("2026-11-06"), "2026-11-06");
    expect(s.currentStreak).toBe(1);
    expect(s.last30Days.at(-1)).toEqual({ date: "2026-11-06", count: 1 });
    expect(s.thisMonthDays).toBe(1);
  });

  test("ignores days after today", () => {
    const s = computeStats(days("2026-11-05", "2026-11-07"), "2026-11-05");
    expect(s.currentStreak).toBe(1);
    expect(s.bestStreak).toBe(1);
  });

  test("falls back to UTC today for a missing or malformed key", () => {
    expect(computeStats([], "nope").currentStreak).toBe(0);
    expect(computeStats([]).last30Days).toHaveLength(30);
  });
});
