import { describe, expect, test } from "bun:test";
import { validatePassword } from "./password";

describe("validatePassword", () => {
  test("rejects 3 characters", () => {
    expect(validatePassword("a".repeat(3))).toBe("password_too_short");
  });

  test("accepts 4 and 128 characters", () => {
    expect(validatePassword("a".repeat(4))).toBeNull();
    expect(validatePassword("a".repeat(128))).toBeNull();
  });

  test("rejects 129 characters", () => {
    expect(validatePassword("a".repeat(129))).toBe("password_too_long");
  });

  test("treats non-strings as too short", () => {
    expect(validatePassword(undefined)).toBe("password_too_short");
    expect(validatePassword(12345678)).toBe("password_too_short");
  });
});
