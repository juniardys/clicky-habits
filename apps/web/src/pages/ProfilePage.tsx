import { useEffect, useRef, useState } from "react";
import Navbar from "../components/Navbar";
import { api } from "../lib/api";
import { authClient, useSession } from "../lib/auth";
import { useI18n, type TranslationKey } from "../lib/i18n";
import { validateNewPassword } from "../lib/password";
import { playPop } from "../lib/sound";
import { useOnceParam } from "../lib/useOnceParam";

type Status = { busy: boolean; error: string | null; success: string | null };
const idle: Status = { busy: false, error: null, success: null };

type Session = NonNullable<ReturnType<typeof useSession>["data"]>;

// Error codes from /me/password and validateNewPassword map to profile.<code>.
const KNOWN_CODES = new Set([
  "password_too_short",
  "password_too_long",
  "password_mismatch",
  "already_has_password",
]);

function useT() {
  const { t } = useI18n();
  const codeMessage = (code: string) =>
    KNOWN_CODES.has(code) ? t(`profile.${code}` as TranslationKey) : t("profile.saveFailed");
  return { t, codeMessage };
}

function StatusLine({ status }: { status: Status }) {
  if (status.error) return <p className="error-text">{status.error}</p>;
  if (status.success) return <p className="success-text">{status.success}</p>;
  return null;
}

function NameCard({ session, refetch }: { session: Session; refetch: () => Promise<unknown> }) {
  const { t } = useT();
  const [name, setName] = useState(session.user.name);
  const [status, setStatus] = useState<Status>(idle);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus({ ...idle, busy: true });
    const { error } = await authClient.updateUser({ name: name.trim() });
    if (error) {
      setStatus({ ...idle, error: error.message ?? t("profile.saveFailed") });
      return;
    }
    await refetch();
    playPop();
    setStatus({ ...idle, success: t("profile.nameSaved") });
  }

  return (
    <form className="profile-card" onSubmit={submit}>
      <h2>{t("profile.nameSection")}</h2>
      <label>
        <span>{t("profile.name")}</span>
        <input
          required
          maxLength={100}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <StatusLine status={status} />
      <button
        type="submit"
        className="btn btn-primary"
        disabled={status.busy || !name.trim() || name.trim() === session.user.name}
      >
        {t("common.save")}
      </button>
    </form>
  );
}

function EmailCard({ session, refetch }: { session: Session; refetch: () => Promise<unknown> }) {
  const { t } = useT();
  const changeLink = useOnceParam("emailChanged");
  const justChanged = changeLink === "ok";
  const [newEmail, setNewEmail] = useState("");
  const [status, setStatus] = useState<Status>(idle);
  const verified = session.user.emailVerified;

  // Pull the new email into the session once after the confirm link lands
  // here. Guarded because refetch is not guaranteed to be referentially stable.
  const refetchedAfterChange = useRef(false);
  useEffect(() => {
    if (!justChanged || refetchedAfterChange.current) return;
    refetchedAfterChange.current = true;
    void refetch();
  }, [justChanged, refetch]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus({ ...idle, busy: true });
    const { error } = await authClient.changeEmail({
      newEmail: newEmail.trim(),
      // Absolute: the confirmation link is served by the API origin.
      callbackURL: `${window.location.origin}/profile?emailChanged=1`,
    });
    if (error) {
      setStatus({ ...idle, error: error.message ?? t("profile.saveFailed") });
      return;
    }
    if (verified) {
      setNewEmail("");
      playPop();
      setStatus({ ...idle, success: t("profile.emailChangeSent") });
      return;
    }
    // Unverified accounts switch right away; the new address gets a
    // verification link and the banner keeps showing until it is clicked.
    // better-auth answers 200 without changing anything when the address
    // belongs to another account, so confirm the switch from the session.
    const { data: fresh, error: sessionError } = await authClient.getSession({
      query: { disableCookieCache: true },
    });
    if (sessionError || !fresh) {
      setStatus({ ...idle, error: t("profile.saveFailed") });
      return;
    }
    if (fresh.user.email !== newEmail.trim().toLowerCase()) {
      setStatus({ ...idle, error: t("profile.emailInUse") });
      return;
    }
    await refetch();
    setNewEmail("");
    playPop();
    setStatus({ ...idle, success: t("profile.emailChangedUnverified") });
  }

  return (
    <form className="profile-card" onSubmit={submit}>
      <h2>{t("profile.emailSection")}</h2>
      {justChanged && <p className="success-text">{t("profile.emailChanged")}</p>}
      {changeLink === "error" && <p className="error-text">{t("profile.emailLinkInvalid")}</p>}
      <div className="profile-current">
        <span className="profile-label">{t("profile.currentEmail")}</span>
        <span className="profile-email">{session.user.email}</span>
        <span className={`badge ${verified ? "badge-ok" : "badge-warn"}`}>
          {verified ? t("profile.verified") : t("profile.unverified")}
        </span>
      </div>
      <label>
        <span>{t("profile.newEmail")}</span>
        <input
          type="email"
          required
          autoComplete="email"
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
        />
      </label>
      <StatusLine status={status} />
      <button type="submit" className="btn btn-primary" disabled={status.busy || !newEmail.trim()}>
        {t("profile.changeEmail")}
      </button>
    </form>
  );
}

function PasswordCard() {
  const { t, codeMessage } = useT();
  const [hasPassword, setHasPassword] = useState<boolean | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState<Status>(idle);

  useEffect(() => {
    api
      .getAccount()
      .then((a) => setHasPassword(a.hasPassword))
      .catch(() => setLoadError(true));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const invalid = validateNewPassword(next, confirm);
    if (invalid) {
      setStatus({ ...idle, error: codeMessage(invalid) });
      return;
    }
    setStatus({ ...idle, busy: true });

    if (hasPassword) {
      const { error } = await authClient.changePassword({
        currentPassword: current,
        newPassword: next,
        revokeOtherSessions: true,
      });
      if (error) {
        setStatus({ ...idle, error: error.message ?? t("profile.saveFailed") });
        return;
      }
      setStatus({ ...idle, success: t("profile.passwordSaved") });
    } else {
      try {
        await api.setPassword(next);
      } catch (err) {
        setStatus({ ...idle, error: codeMessage(err instanceof Error ? err.message : "") });
        return;
      }
      setHasPassword(true);
      setStatus({ ...idle, success: t("profile.passwordSet") });
    }
    playPop();
    setCurrent("");
    setNext("");
    setConfirm("");
  }

  if (loadError) {
    return (
      <section className="profile-card">
        <h2>{t("profile.passwordSection")}</h2>
        <p className="error-text">{t("profile.saveFailed")}</p>
      </section>
    );
  }

  if (hasPassword === null) {
    return (
      <section className="profile-card">
        <h2>{t("profile.passwordSection")}</h2>
        <div className="spinner" />
      </section>
    );
  }

  return (
    <form className="profile-card" onSubmit={submit}>
      <h2>{t("profile.passwordSection")}</h2>
      {!hasPassword && <p className="profile-note">{t("profile.setPasswordNote")}</p>}
      {hasPassword && (
        <label>
          <span>{t("profile.currentPassword")}</span>
          <input
            type="password"
            required
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
          />
        </label>
      )}
      <label>
        <span>{t("profile.newPassword")}</span>
        <input
          type="password"
          required
          autoComplete="new-password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
        />
      </label>
      <label>
        <span>{t("profile.confirmPassword")}</span>
        <input
          type="password"
          required
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </label>
      <StatusLine status={status} />
      <button type="submit" className="btn btn-primary" disabled={status.busy}>
        {hasPassword ? t("profile.changePassword") : t("profile.setPassword")}
      </button>
    </form>
  );
}

export default function ProfilePage() {
  const { t } = useI18n();
  const { data: session, refetch } = useSession();

  return (
    <div className="container">
      <Navbar />
      <div className="page-head">
        <h1>{t("profile.title")}</h1>
      </div>
      {session && (
        <div className="profile-stack">
          <NameCard session={session} refetch={refetch} />
          <EmailCard session={session} refetch={refetch} />
          <PasswordCard />
        </div>
      )}
    </div>
  );
}
