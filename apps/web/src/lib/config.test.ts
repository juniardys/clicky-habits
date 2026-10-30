import { describe, expect, test } from "bun:test";
import { parseGoogleClientId } from "./config";

describe("parseGoogleClientId", () => {
  test("trims whitespace from VITE_GOOGLE_CLIENT_ID", () => {
    expect(parseGoogleClientId("  cid.apps.googleusercontent.com  ")).toBe(
      "cid.apps.googleusercontent.com"
    );
  });

  test("missing or blank value disables One Tap (empty string)", () => {
    expect(parseGoogleClientId(undefined)).toBe("");
    expect(parseGoogleClientId("")).toBe("");
    expect(parseGoogleClientId("   ")).toBe("");
  });
});
