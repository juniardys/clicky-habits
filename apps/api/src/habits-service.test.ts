import { describe, expect, test } from "bun:test";
import { latestCoinDate } from "./habits-service";

describe("latestCoinDate", () => {
  test("picks the newest date that still has coins, ignoring empty entries", () => {
    expect(
      latestCoinDate([
        { date: "2026-10-28", count: 3 },
        { date: "2026-10-30", count: 0 },
        { date: "2026-10-29", count: 2 },
      ])
    ).toBe("2026-10-29");
  });

  test("returns null when no entry has coins", () => {
    expect(latestCoinDate([])).toBeNull();
    expect(latestCoinDate([{ date: "2026-10-30", count: 0 }])).toBeNull();
  });
});
