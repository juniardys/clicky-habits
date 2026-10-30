import { describe, expect, test } from "bun:test";
import { buildAuthPlugins, buildEmailOptions, buildSocialProviders } from "./auth-config";
import type { EmailMessage } from "./email";

// Unsigned JWT-shaped token: only the payload matters for template choice.
function token(payload: Record<string, unknown>): string {
  const b64 = (v: unknown) => Buffer.from(JSON.stringify(v)).toString("base64url");
  return `${b64({ alg: "HS256" })}.${b64(payload)}.sig`;
}

describe("buildEmailOptions", () => {
  function setup() {
    const sent: EmailMessage[] = [];
    const opts = buildEmailOptions((msg) => {
      sent.push(msg);
      return Promise.resolve();
    });
    return { sent, opts };
  }

  test("sends verification on sign-up and keeps login open for unverified users", () => {
    const { opts } = setup();
    expect(opts.emailAndPassword).toEqual({ enabled: true, requireEmailVerification: false });
    expect(opts.emailVerification.sendOnSignUp).toBe(true);
    expect(opts.emailVerification.autoSignInAfterVerification).toBe(true);
    expect(opts.user.changeEmail).toMatchObject({ enabled: true, updateEmailWithoutVerification: true });
  });

  test("sign-up token uses the verification template", async () => {
    const { sent, opts } = setup();
    const url = "https://api.test/auth/verify-email?token=x";
    await opts.emailVerification.sendVerificationEmail({
      user: { email: "new@x.com" },
      url,
      token: token({ email: "new@x.com" }),
    });
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe("new@x.com");
    expect(sent[0].subject).toBe("Verify your Clicky Habits email");
    expect(sent[0].text).toContain(url);
  });

  test("change-email token uses the confirm-new-email template", async () => {
    const { sent, opts } = setup();
    await opts.emailVerification.sendVerificationEmail({
      user: { email: "new@x.com" },
      url: "https://api.test/auth/verify-email?token=y",
      token: token({ email: "old@x.com", updateTo: "new@x.com", requestType: "change-email-verification" }),
    });
    expect(sent[0].to).toBe("new@x.com");
    expect(sent[0].subject).toBe("Confirm your new Clicky Habits email");
  });

  test("malformed token falls back to the verification template", async () => {
    const { sent, opts } = setup();
    await opts.emailVerification.sendVerificationEmail({
      user: { email: "a@x.com" },
      url: "u",
      token: "not-a-jwt",
    });
    expect(sent[0].subject).toBe("Verify your Clicky Habits email");
  });
});

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
