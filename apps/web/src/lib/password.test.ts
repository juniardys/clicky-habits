import { describe, expect, test } from "bun:test";
import { validateNewPassword } from "./password";

describe("validateNewPassword", () => {
  test("rejects short passwords before checking the confirmation", () => {
    expect(validateNewPassword("short", "short")).toBe("password_too_short");
    expect(validateNewPassword("short", "other")).toBe("password_too_short");
  });

  test("rejects a confirmation that does not match", () => {
    expect(validateNewPassword("longenough", "different1")).toBe("password_mismatch");
  });

  test("accepts matching passwords of valid length", () => {
    expect(validateNewPassword("longenough", "longenough")).toBeNull();
  });

  test("rejects passwords over 128 characters", () => {
    const long = "a".repeat(129);
    expect(validateNewPassword(long, long)).toBe("password_too_long");
  });
});
