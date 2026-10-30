import { describe, expect, test } from "bun:test";
import { changeEmailEmail, createEmailSender, verificationEmail, type MailTransport } from "./email";

const msg = {
  to: "user@example.com",
  subject: "Hello",
  text: "Open https://example.com/verify?token=abc",
  html: "<p>Open</p>",
};

function fakeLog() {
  const calls: unknown[][] = [];
  return { calls, log: (...args: unknown[]) => calls.push(args) };
}

describe("createEmailSender", () => {
  test("logs instead of sending when SMTP_HOST is empty", async () => {
    const { calls, log } = fakeLog();
    const send = createEmailSender({}, { log });
    await send(msg);
    expect(calls.length).toBe(1);
    const joined = calls[0].map(String).join(" ");
    expect(joined).toContain("user@example.com");
    expect(joined).toContain("https://example.com/verify?token=abc");
  });

  test("sends through transport with EMAIL_FROM when SMTP_HOST is set", async () => {
    const sent: unknown[] = [];
    const transport: MailTransport = {
      sendMail: async (m) => {
        sent.push(m);
      },
    };
    const send = createEmailSender(
      { SMTP_HOST: "smtp.test", EMAIL_FROM: "A <a@x.com>" },
      { transport, log: () => {} }
    );
    await send(msg);
    expect(sent).toEqual([{ from: "A <a@x.com>", ...msg }]);
  });

  test("swallows transport errors", async () => {
    const { calls, log } = fakeLog();
    const transport: MailTransport = {
      sendMail: async () => {
        throw new Error("smtp down");
      },
    };
    const send = createEmailSender({ SMTP_HOST: "smtp.test" }, { transport, log });
    await expect(send(msg)).resolves.toBeUndefined();
    expect(calls.length).toBe(1);
    expect(String(calls[0][0]).startsWith("[email]")).toBe(true);
  });
});

describe("templates", () => {
  test("verificationEmail includes the url in text and html", () => {
    const url = "https://api.test/auth/verify-email?token=t1";
    const m = verificationEmail("a@b.com", url);
    expect(m.to).toBe("a@b.com");
    expect(m.subject).toBe("Verify your Clicky Habits email");
    expect(m.text).toContain(url);
    expect(m.html).toContain(url);
  });

  test("html uses the branded layout with heading and button", () => {
    const m = verificationEmail("a@b.com", "https://api.test/v?token=t1");
    expect(m.html).toStartWith("<!doctype html>");
    expect(m.html).toContain("Confirm your email");
    expect(m.html).toContain("Verify email");
    expect(m.html).toContain("#ff9a76");
  });

  test("changeEmailEmail has its own heading and action", () => {
    const m = changeEmailEmail("a@b.com", "https://api.test/c?token=t2");
    expect(m.subject).toBe("Confirm your new Clicky Habits email");
    expect(m.html).toContain("Confirm your new email");
    expect(m.html).toContain("Confirm new email");
    expect(m.html).toContain("https://api.test/c?token=t2");
  });

  test("escapes html in the url", () => {
    const m = verificationEmail("a@b.com", 'https://api.test/v?a=1&b="x"<y>');
    expect(m.html).toContain("https://api.test/v?a=1&amp;b=&quot;x&quot;&lt;y&gt;");
    expect(m.html).not.toContain('"x"<y>');
  });
});
