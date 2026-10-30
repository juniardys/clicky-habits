import { describe, expect, test } from "bun:test";
import { createStreamGuard } from "./guard";

describe("createStreamGuard", () => {
  test("second acquire for the same user fails until release", () => {
    const guard = createStreamGuard();
    expect(guard.acquire("u1")).toBe(true);
    expect(guard.acquire("u1")).toBe(false);
    expect(guard.acquire("u2")).toBe(true);
    guard.release("u1");
    expect(guard.acquire("u1")).toBe(true);
  });
});
