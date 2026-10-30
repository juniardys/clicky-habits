import { useEffect, useRef, useState } from "react";
import { authClient, useSession } from "../lib/auth";
import { useI18n } from "../lib/i18n";

const RESEND_COOLDOWN_MS = 60_000;

// Shown under the navbar while the signed-in user's email is unverified.
// Unverified users can still use the app; this just nags with a resend link.
export default function VerifyEmailBanner() {
  const { data: session } = useSession();
  const { t } = useI18n();
  const [status, setStatus] = useState<"idle" | "busy" | "sent" | "error">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  if (!session || session.user.emailVerified !== false) return null;
  const email = session.user.email;

  async function resend() {
    setStatus("busy");
    const { error } = await authClient.sendVerificationEmail({
      email,
      // Absolute: the link is opened on the API origin, which may differ.
      callbackURL: `${window.location.origin}/app?verified=1`,
    });
    if (error) {
      setStatus("error");
      return;
    }
    setStatus("sent");
    timer.current = setTimeout(() => setStatus("idle"), RESEND_COOLDOWN_MS);
  }

  return (
    <div className="verify-banner" role="status">
      <span>{t("verify.banner", { email })}</span>
      <div className="verify-banner-action">
        {status === "error" && <span className="error-text">{t("verify.failed")}</span>}
        <button
          type="button"
          className="btn"
          onClick={resend}
          disabled={status === "busy" || status === "sent"}
        >
          {status === "sent" ? t("verify.sent") : t("verify.resend")}
        </button>
      </div>
    </div>
  );
}
