import { Link, NavLink } from "react-router-dom";
import { signOut, useSession } from "../lib/auth";
import { useI18n, type Lang } from "../lib/i18n";
import VerifyEmailBanner from "./VerifyEmailBanner";

const navClass = ({ isActive }: { isActive: boolean }) => `nav-link ${isActive ? "active" : ""}`;

// Up to two initials from the display name, e.g. "Junia Putri" -> "JP".
function initialsOf(label: string): string {
  const words = label.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  const letters = words.length === 1 ? [...words[0]].slice(0, 1) : [[...words[0]][0], [...words[1]][0]];
  return letters.join("").toUpperCase();
}

export default function Navbar() {
  const { data: session } = useSession();
  const { lang, setLang, t } = useI18n();
  const userLabel = session?.user.name || session?.user.email || "";

  const langButton = (code: Lang, label: string) => (
    <button
      type="button"
      className={`lang-option ${lang === code ? "active" : ""}`}
      onClick={() => setLang(code)}
      aria-pressed={lang === code}
    >
      {label}
    </button>
  );

  return (
    <>
      <div className="topbar">
        <Link to="/app" className="brand">
          Clicky <span>Habits</span>
        </Link>
        <nav className="nav-links">
          <NavLink to="/app" end className={navClass}>
            {t("nav.home")}
          </NavLink>
          <NavLink to="/dashboard" className={navClass}>
            {t("nav.dashboard")}
          </NavLink>
          <NavLink to="/profile" className={navClass}>
            {t("nav.profile")}
          </NavLink>
        </nav>
        <div className="topbar-right">
          <div className="lang-toggle" role="group" aria-label="Language">
            {langButton("en", "EN")}
            {langButton("id", "ID")}
          </div>
          <Link to="/profile" className="topbar-user" title={t("nav.profile")}>
            <span className="topbar-avatar" aria-hidden="true">
              {initialsOf(session?.user.name || session?.user.email?.split("@")[0] || "")}
            </span>
            <span className="topbar-user-name">{userLabel}</span>
          </Link>
          <button className="btn-ghost" onClick={() => signOut()}>
            {t("nav.logout")}
          </button>
        </div>
      </div>
      <VerifyEmailBanner />
    </>
  );
}
