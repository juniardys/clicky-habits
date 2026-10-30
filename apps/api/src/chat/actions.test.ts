import { describe, expect, test } from "bun:test";
import { applyUndo, isPendingExpired, PENDING_TTL_MS } from "./actions";
import { makeFakeService } from "./tools.test";

describe("applyUndo", () => {
  test("coin undo floors at zero after manual reduction and reports removed", async () => {
    const svc = makeFakeService([
      { id: "jar1", userId: "u1", name: "Push-up", type: "JAR", entries: new Map([["2026-10-30", 1]]) },
    ]);
    const result = await applyUndo(
      { userId: "u1", kind: "coins", payload: { habitId: "jar1", date: "2026-10-30", count: 5 } },
      svc
    );
    expect(result.changed).toBe(true);
    expect(result.removed).toBe(1);
    expect(svc.habits[0].entries.has("2026-10-30")).toBe(false);
  });

  test("coin undo with nothing left reports changed:false", async () => {
    const svc = makeFakeService([
      { id: "jar1", userId: "u1", name: "Push-up", type: "JAR", entries: new Map() },
    ]);
    const result = await applyUndo(
      { userId: "u1", kind: "coins", payload: { habitId: "jar1", date: "2026-10-30", count: 2 } },
      svc
    );
    expect(result.changed).toBe(false);
    expect(result.removed).toBe(0);
  });

  test("mark undo when entry already gone reports changed:false", async () => {
    const svc = makeFakeService([
      { id: "cal1", userId: "u1", name: "Baca", type: "CALENDAR", entries: new Map() },
    ]);
    const result = await applyUndo(
      { userId: "u1", kind: "mark", payload: { habitId: "cal1", date: "2026-10-30" } },
      svc
    );
    expect(result.changed).toBe(false);
  });

  test("mark undo removes the entry the action created", async () => {
    const svc = makeFakeService([
      { id: "cal1", userId: "u1", name: "Baca", type: "CALENDAR", entries: new Map([["2026-10-30", 1]]) },
    ]);
    const result = await applyUndo(
      { userId: "u1", kind: "mark", payload: { habitId: "cal1", date: "2026-10-30" } },
      svc
    );
    expect(result.changed).toBe(true);
    expect(svc.habits[0].entries.size).toBe(0);
  });

  test("create undo when habit already deleted reports changed:false", async () => {
    const svc = makeFakeService([]);
    const result = await applyUndo(
      { userId: "u1", kind: "create", payload: { habitId: "gone" } },
      svc
    );
    expect(result.changed).toBe(false);
  });

  test("create undo deletes the created habit", async () => {
    const svc = makeFakeService([
      { id: "new1", userId: "u1", name: "Baru", type: "CALENDAR", entries: new Map() },
    ]);
    const result = await applyUndo(
      { userId: "u1", kind: "create", payload: { habitId: "new1" } },
      svc
    );
    expect(result.changed).toBe(true);
    expect(svc.habits.length).toBe(0);
  });
});

describe("isPendingExpired", () => {
  test("expiry is PENDING_TTL_MS based comparison", () => {
    const created = new Date("2026-10-30T00:00:00Z");
    const expiresAt = new Date(created.getTime() + PENDING_TTL_MS);
    expect(isPendingExpired({ expiresAt }, new Date(created.getTime() + 1000))).toBe(false);
    expect(isPendingExpired({ expiresAt }, new Date(expiresAt.getTime() + 1))).toBe(true);
  });
});
