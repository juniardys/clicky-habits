import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { authClient, signIn, signUp } from "../lib/auth";
import { GOOGLE_CLIENT_ID } from "../lib/config";
import { useI18n, type Lang } from "../lib/i18n";

export default function LoginPage() {
  const { lang, setLang, t } = useI18n();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const oneTapPrompted = useRef(false);

  // Google One Tap: floating "Continue as ..." prompt (like Notion) for
  // visitors already signed in to Google in this browser. Best effort only:
  // dismissal, cooldown, or an unregistered origin must never surface as an
  // error here, the buttons below keep working either way. On success the
  // plugin redirects to callbackURL (absolute, same reason as handleGoogle).
  // Skipped on phones: the One Tap bottom sheet covers the sign-in button and
  // the sign-up toggle, and the regular Google button is one tap away anyway.
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || oneTapPrompted.current) return;
    if (window.matchMedia("(max-width: 640px)").matches) return;
    oneTapPrompted.current = true;
    authClient
      .oneTap({ callbackURL: `${window.location.origin}/app` })
      .catch(() => {});
  }, []);

  async function handleGoogle() {
    setError(null);
    // Absolute URL: the OAuth callback is handled by the API, which may live on
    // another origin (api.<domain>). A relative "/app" would redirect there.
    const { error } = await signIn.social({
      provider: "google",
      callbackURL: `${window.location.origin}/app`,
    });
    if (error) {
      setError(t("login.googleFailed"));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "register") {
        // callbackURL: where the verification link lands. Absolute because
        // the link is served by the API, which may live on another origin.
        const { error } = await signUp.email({
          email,
          password,
          name: name || email,
          callbackURL: `${window.location.origin}/app?verified=1`,
        });
        if (error) throw new Error(error.message ?? t("login.signUpFailed"));
      } else {
        const { error } = await signIn.email({ email, password });
        if (error) throw new Error(error.message ?? t("login.wrongCreds"));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("login.genericError"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="center-screen">
      <div className="login-card">
        <div className="lang-toggle login-lang" role="group" aria-label="Language">
          {(["en", "id"] as Lang[]).map((code) => (
            <button
              key={code}
              type="button"
              className={`lang-option ${lang === code ? "active" : ""}`}
              onClick={() => setLang(code)}
              aria-pressed={lang === code}
            >
              {code.toUpperCase()}
            </button>
          ))}
        </div>
        <h1>
          Clicky <span style={{ color: "var(--accent)" }}>Habits</span>
        </h1>
        <p className="sub">{t("login.tagline")}</p>

        <button className="btn btn-primary" onClick={handleGoogle}>
          {t("login.google")}
        </button>

        <div className="divider">{t("login.orEmail")}</div>

        <form
          onSubmit={handleSubmit}
          style={{ display: "flex", flexDirection: "column", gap: 12 }}
        >
          {mode === "register" && (
            <input
              placeholder={t("login.name")}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          )}
          <input
            type="email"
            placeholder="Email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            type="password"
            placeholder={t("login.password")}
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && <p className="error-text">{error}</p>}
          <button className="btn" type="submit" disabled={busy}>
            {mode === "login" ? t("login.signIn") : t("login.signUp")}
          </button>
        </form>

        <button
          className="btn-ghost"
          onClick={() => setMode(mode === "login" ? "register" : "login")}
        >
          {mode === "login" ? t("login.noAccount") : t("login.hasAccount")}
        </button>
        <Link to="/" className="landing-text-link login-back">
          {t("login.backHome")}
        </Link>
      </div>
    </div>
  );
}
