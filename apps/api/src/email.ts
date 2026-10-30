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

// Colors mirror apps/web/src/styles.css. Email clients drop <style> blocks
// and CSS variables, so everything is inline and laid out with tables.
const C = {
  skyTop: "#ffe8d6",
  skyBot: "#d6e9ff",
  peach: "#ff9a76",
  peachDeep: "#f06d4f",
  char: "#46364a",
  charDim: "#8a7a90",
};
const HEADING_FONT = "'Baloo 2', 'Nunito', 'Trebuchet MS', Arial, sans-serif";
const BODY_FONT = "'Nunito', 'Segoe UI', Helvetica, Arial, sans-serif";

type LinkEmail = { subject: string; heading: string; intro: string; action: string };

function brandedHtml({ subject, heading, intro, action }: LinkEmail, url: string): string {
  const safeUrl = escapeHtml(url);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>${escapeHtml(subject)}</title>
<link href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@800&family=Nunito:wght@400;700&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background:${C.skyBot};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(intro)}</div>
<!-- The gradient only spans the content, so the body (and the bgcolor
     fallback for Outlook) uses the gradient's end color. The viewer's
     extra height then continues the gradient without a visible seam. -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.skyBot}" style="background:${C.skyBot};background-image:linear-gradient(180deg,${C.skyTop},${C.skyBot});">
<tr><td align="center" style="padding:40px 16px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;">
    <tr><td align="center" style="padding:0 0 24px;font-family:${HEADING_FONT};font-size:28px;font-weight:800;letter-spacing:-0.5px;color:${C.char};">
      Clicky <span style="color:${C.peachDeep};">Habits</span>
    </td></tr>
    <tr><td style="background:#ffffff;border:2.5px solid ${C.char};border-radius:24px;box-shadow:0 6px 0 ${C.char};padding:36px 32px;">
      <h1 style="margin:0 0 12px;font-family:${HEADING_FONT};font-size:26px;line-height:1.2;font-weight:800;color:${C.char};">${escapeHtml(heading)}</h1>
      <p style="margin:0 0 28px;font-family:${BODY_FONT};font-size:16px;line-height:1.6;color:${C.char};">${escapeHtml(intro)}</p>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
        <td style="background:${C.peach};border:2.5px solid ${C.char};border-radius:999px;box-shadow:0 4px 0 ${C.char};">
          <a href="${safeUrl}" style="display:inline-block;padding:12px 28px;font-family:${HEADING_FONT};font-size:16px;font-weight:700;color:${C.char};text-decoration:none;">${escapeHtml(action)}</a>
        </td>
      </tr></table>
      <p style="margin:28px 0 0;font-family:${BODY_FONT};font-size:13px;line-height:1.5;color:${C.charDim};">Button not working? Open this link:<br><a href="${safeUrl}" style="color:${C.peachDeep};word-break:break-all;">${safeUrl}</a></p>
    </td></tr>
    <tr><td align="center" style="padding:24px 8px 0;font-family:${BODY_FONT};font-size:12px;line-height:1.5;color:${C.charDim};">
      If you did not request this, you can ignore this email.
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`;
}

function linkEmail(to: string, content: LinkEmail, url: string): EmailMessage {
  return {
    to,
    subject: content.subject,
    text: `${content.intro}\n\n${content.action}: ${url}\n\nIf you did not request this, you can ignore this email.`,
    html: brandedHtml(content, url),
  };
}

export function verificationEmail(to: string, url: string): EmailMessage {
  return linkEmail(
    to,
    {
      subject: "Verify your Clicky Habits email",
      heading: "Confirm your email",
      intro: "Welcome to Clicky Habits! Please confirm this is your email address.",
      action: "Verify email",
    },
    url
  );
}

export function changeEmailEmail(to: string, url: string): EmailMessage {
  return linkEmail(
    to,
    {
      subject: "Confirm your new Clicky Habits email",
      heading: "Confirm your new email",
      intro: "You asked to use this address for your Clicky Habits account.",
      action: "Confirm new email",
    },
    url
  );
}
