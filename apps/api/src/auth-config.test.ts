import { describe, expect, test } from "bun:test";
import { buildAuthPlugins, buildSocialProviders } from "./auth-config";

describe("buildSocialProviders", () => {
  test("google provider always prompts to select an account", () => {
    expect(buildSocialProviders("cid", "secret")).toEqual({
      google: { clientId: "cid", clientSecret: "secret", prompt: "select_account" },
    });
  });

  test("no providers when google credentials are missing", () => {
    expect(buildSocialProviders("", "secret")).toEqual({});
    expect(buildSocialProviders("cid", "")).toEqual({});
    expect(buildSocialProviders(undefined, undefined)).toEqual({});
  });
});

describe("buildAuthPlugins", () => {
  test("registers the one-tap plugin when a google client id exists", () => {
    const plugins = buildAuthPlugins("cid");
    expect(plugins).toHaveLength(1);
    expect(plugins[0].id).toBe("one-tap");
  });

  test("no plugins when google is not configured", () => {
    expect(buildAuthPlugins("")).toEqual([]);
    expect(buildAuthPlugins(undefined)).toEqual([]);
  });
});
