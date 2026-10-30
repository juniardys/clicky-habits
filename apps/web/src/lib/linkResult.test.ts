import { describe, expect, test } from "bun:test";
import { linkResult } from "./linkResult";

describe("linkResult", () => {
  test("flag without error is ok", () => {
    expect(linkResult(new URLSearchParams("verified=1"), "verified")).toBe("ok");
  });

  test("better-auth error param turns the flag into an error", () => {
    expect(linkResult(new URLSearchParams("verified=1&error=TOKEN_EXPIRED"), "verified")).toBe("error");
  });

  test("no flag means nothing to show, even with an error param", () => {
    expect(linkResult(new URLSearchParams(""), "verified")).toBeNull();
    expect(linkResult(new URLSearchParams("error=X"), "verified")).toBeNull();
    expect(linkResult(new URLSearchParams("verified=0"), "verified")).toBeNull();
  });
});
