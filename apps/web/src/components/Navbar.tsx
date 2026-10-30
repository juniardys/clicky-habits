import { Link, NavLink } from "react-router-dom";
import { signOut, useSession } from "../lib/auth";
import { useI18n, type Lang } from "../lib/i18n";

export default function Navbar() {
  const { data: session } = useSession();
  const { lang, setLang, t } = useI18n();

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
    <div className="topbar">
      <Link to="/app" className="brand">
        Clicky <span>Habits</span>
      </Link>
      <nav className="nav-links">
        <NavLink to="/app" end className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}>
          {t("nav.home")}
        </NavLink>
        <NavLink
          to="/dashboard"
          className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}
        >
          {t("nav.dashboard")}
        </NavLink>
      </nav>
      <div className="topbar-right">
        <div className="lang-toggle" role="group" aria-label="Language">
          {langButton("en", "EN")}
          {langButton("id", "ID")}
        </div>
        <span className="topbar-user">{session?.user.name || session?.user.email}</span>
        <button className="btn-ghost" onClick={() => signOut()}>
          {t("nav.logout")}
        </button>
      </div>
    </div>
  );
}
