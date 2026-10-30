import nodemailer from "nodemailer";

export type EmailMessage = { to: string; subject: string; text: string; html: string };

export type MailTransport = {
  sendMail(msg: EmailMessage & { from: string }): Promise<unknown>;
};

type Env = Record<string, string | undefined>;

const DEFAULT_FROM = "Clicky Habits <no-reply@localhost>";

function buildTransport(env: Env): MailTransport {
  const port = Number(env.SMTP_PORT) || 587;
  const secure = (env.SMTP_SECURE ?? "").toLowerCase() === "true";
  return nodemailer.createTransport({
    host: env.SMTP_HOST,
    port,
    secure,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS ?? "" } : undefined,
  });
}

// Returns a sender that never throws. With SMTP_HOST empty (local dev) the
// message is printed to the console so links can be opened by hand.
export function createEmailSender(
  env: Env,
  opts: { transport?: MailTransport; log?: (...args: unknown[]) => void } = {}
): (msg: EmailMessage) => Promise<void> {
  const log = opts.log ?? console.log;
  const from = env.EMAIL_FROM || DEFAULT_FROM;
  let transport = opts.transport;

  return async (msg) => {
    if (!env.SMTP_HOST) {
      log(`[email] SMTP_HOST not set, not sending. To: ${msg.to} | ${msg.subject}\n${msg.text}`);
      return;
    }
    try {
      transport ??= buildTransport(env);
      await transport.sendMail({ from, ...msg });
    } catch (err) {
      log(`[email] failed to send "${msg.subject}" to ${msg.to}:`, err);
    }
  };
}

let defaultSender: ((msg: EmailMessage) => Promise<void>) | undefined;

export function sendEmail(msg: EmailMessage): Promise<void> {
  defaultSender ??= createEmailSender(process.env);
  return defaultSender(msg);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function linkEmail(to: string, subject: string, intro: string, action: string, url: string): EmailMessage {
  const safeUrl = escapeHtml(url);
  return {
    to,
    subject,
    text: `${intro}\n\n${action}: ${url}\n\nIf you did not request this, you can ignore this email.`,
    html: `<p>${escapeHtml(intro)}</p><p><a href="${safeUrl}">${escapeHtml(action)}</a></p><p style="color:#888;font-size:12px">Or open this link: ${safeUrl}</p><p style="color:#888;font-size:12px">If you did not request this, you can ignore this email.</p>`,
  };
}

export function verificationEmail(to: string, url: string): EmailMessage {
  return linkEmail(
    to,
    "Verify your Clicky Habits email",
    "Welcome to Clicky Habits! Please confirm this is your email address.",
    "Verify email",
    url
  );
}

export function changeEmailEmail(to: string, url: string): EmailMessage {
  return linkEmail(
    to,
    "Confirm your new Clicky Habits email",
    "You asked to use this address for your Clicky Habits account.",
    "Confirm new email",
    url
  );
}
