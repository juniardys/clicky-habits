import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useI18n, type Lang } from "../lib/i18n";
import { playPop, playScratch } from "../lib/sound";
import Jar3D from "../components/Jar3D";
import Calendar3D from "../components/Calendar3D";

const spring = { type: "spring" as const, duration: 0.5, bounce: 0 };
const INITIAL_COINS = 137;
const CHART_HEIGHTS = [35, 55, 40, 70, 50, 85, 62, 45, 78, 92, 58, 74, 66, 88];

function demoDateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function initialCrossed(): Set<string> {
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return new Set(
    [1, 2, 3, 5, 6, 8, 9, 10].filter((d) => d <= daysInMonth).map((d) => demoDateKey(now.getFullYear(), now.getMonth(), d))
  );
}

type DemoMode = "jar" | "calendar";

export default function LandingPage() {
  const { lang, setLang, t } = useI18n();
  const now = new Date();
  const [demoMode, setDemoMode] = useState<DemoMode>("jar");
  const [crossed, setCrossed] = useState<Set<string>>(initialCrossed);
  const [coins, setCoins] = useState(INITIAL_COINS);
  const [justAdded, setJustAdded] = useState(false);

  const jarProgress = coins % 100;
  const jarsFull = Math.floor(coins / 100);

  function toggleDay(key: string) {
    setCrossed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
        playPop();
      } else {
        next.add(key);
        playScratch();
      }
      return next;
    });
  }

  function dropCoin() {
    setJustAdded(true);
    setCoins((c) => c + 1);
  }

  function resetDemo() {
    playPop();
    setCrossed(initialCrossed());
    setCoins(INITIAL_COINS);
    setJustAdded(false);
  }

  function tryMode(mode: DemoMode) {
    setDemoMode(mode);
    document.getElementById("demo")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  const faqs = [
    { q: t("landing.q1"), a: t("landing.a1") },
    { q: t("landing.q2"), a: t("landing.a2") },
    { q: t("landing.q3"), a: t("landing.a3") },
    { q: t("landing.q4"), a: t("landing.a4") },
    { q: t("landing.q5"), a: t("landing.a5") },
    { q: t("landing.q6"), a: t("landing.a6") },
  ];

  // Rendered twice: in the navbar (desktop) and in the footer (phones, where
  // the navbar keeps only the logo and the main CTA).
  const langToggle = (className: string) => (
    <div className={className} role="group" aria-label="Language">
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
  );

  return (
    <div className="landing">
      <header className="landing-nav">
        <div className="landing-nav-inner">
          <Link to="/" className="brand">
            Clicky <span>Habits</span>
          </Link>
          <nav className="landing-links" aria-label="Landing">
            <a href="#how">{t("landing.navHow")}</a>
            <a href="#modes">{t("landing.navModes")}</a>
            <a href="#stats">{t("landing.navStats")}</a>
            <a href="#faq">{t("landing.navFaq")}</a>
          </nav>
          <div className="landing-nav-actions">
            {langToggle("lang-toggle landing-nav-lang")}
            <Link to="/login" className="landing-signin">
              {t("landing.signIn")}
            </Link>
            <Link to="/login" className="btn btn-primary landing-nav-cta">
              {t("landing.heroPrimary")}
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="landing-hero">
          <motion.div
            className="landing-hero-copy"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={spring}
          >
            <span className="landing-pill">{t("landing.badge")}</span>
            <h1>
              {t("landing.heroTitleA")}
              <span className="peach">{t("landing.heroTitleB")}</span>
              {t("landing.heroTitleC")}
            </h1>
            <p className="landing-lede">{t("landing.heroLede")}</p>
            <div className="landing-cta-row">
              <Link to="/login" className="btn btn-primary landing-cta">
                {t("landing.heroPrimary")}
              </Link>
              <a href="#how" className="btn landing-cta landing-cta-soft">
                {t("landing.heroSecondary")}
              </a>
            </div>
            <p className="landing-micro">{t("landing.heroMicro")}</p>
            <div className="landing-proof">
              <span>🗓️🪙 {t("landing.proofModes")}</span>
              <span>🫙 {t("landing.proofJar")}</span>
              <span>📊 {t("landing.proofStats")}</span>
            </div>
          </motion.div>

          <motion.div
            className="landing-demo"
            id="demo"
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ ...spring, delay: 0.08 }}
          >
            <div className="landing-demo-head">
              <div>
                <span className="landing-eyebrow">{t("landing.demoEyebrow")}</span>
                <h2>{t("landing.demoTitle")}</h2>
              </div>
              <button type="button" className="btn-ghost landing-reset" onClick={resetDemo}>
                {t("landing.demoReset")}
              </button>
            </div>

            <div className="landing-demo-tabs" role="tablist" aria-label={t("landing.demoTitle")}>
              <button
                type="button"
                role="tab"
                aria-selected={demoMode === "jar"}
                className={`landing-demo-tab ${demoMode === "jar" ? "active" : ""}`}
                onClick={() => setDemoMode("jar")}
              >
                🪙 {t("landing.demoJarTitle")}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={demoMode === "calendar"}
                className={`landing-demo-tab ${demoMode === "calendar" ? "active" : ""}`}
                onClick={() => setDemoMode("calendar")}
              >
                🗓️ {t("landing.demoCalTitle")}
              </button>
            </div>

            <div className="landing-3d-stage">
              {demoMode === "jar" ? (
                <Jar3D coinsInJar={jarProgress} animateLast={justAdded} />
              ) : (
                <Calendar3D
                  year={now.getFullYear()}
                  month={now.getMonth()}
                  markedDates={crossed}
                  onToggle={toggleDay}
                />
              )}
            </div>

            {demoMode === "jar" ? (
              <div className="landing-demo-controls">
                <p>
                  {t("landing.demoJarHint")} {t("landing.demoDragJar")}
                </p>
                <button type="button" className="btn btn-primary landing-drop" onClick={dropCoin}>
                  {t("landing.demoDrop")}
                </button>
                <strong className="landing-demo-count">
                  {t("landing.demoCoins", { n: jarProgress })} · {t("landing.demoJarFull", { n: jarsFull })}
                </strong>
              </div>
            ) : (
              <div className="landing-demo-controls">
                <p>
                  {t("landing.demoCalHint")} {t("landing.demoDragCal")}
                </p>
                <strong className="landing-demo-count">
                  {t("landing.demoCrossed", { n: crossed.size })}
                </strong>
              </div>
            )}
          </motion.div>
        </section>

        <section className="landing-section">
          <span className="landing-eyebrow">{t("landing.problemEyebrow")}</span>
          <h2>{t("landing.problemTitle")}</h2>
          <p className="landing-section-lede">{t("landing.problemBody")}</p>
          <div className="landing-cards landing-cards-3">
            <article className="landing-card">
              <div className="landing-card-emoji">✓</div>
              <h3>{t("landing.p1Title")}</h3>
              <p>{t("landing.p1Body")}</p>
            </article>
            <article className="landing-card mint">
              <div className="landing-card-emoji">👀</div>
              <h3>{t("landing.p2Title")}</h3>
              <p>{t("landing.p2Body")}</p>
            </article>
            <article className="landing-card lav">
              <div className="landing-card-emoji">🧩</div>
              <h3>{t("landing.p3Title")}</h3>
              <p>{t("landing.p3Body")}</p>
            </article>
          </div>
        </section>

        <section className="landing-section" id="how">
          <span className="landing-eyebrow">{t("landing.howEyebrow")}</span>
          <h2>{t("landing.howTitle")}</h2>
          <div className="landing-cards landing-cards-3">
            <article className="landing-card">
              <span className="landing-step">1</span>
              <h3>{t("landing.s1Title")}</h3>
              <p>{t("landing.s1Body")}</p>
            </article>
            <article className="landing-card mint">
              <span className="landing-step">2</span>
              <h3>{t("landing.s2Title")}</h3>
              <p>{t("landing.s2Body")}</p>
            </article>
            <article className="landing-card lav">
              <span className="landing-step">3</span>
              <h3>{t("landing.s3Title")}</h3>
              <p>{t("landing.s3Body")}</p>
            </article>
          </div>
        </section>

        <section className="landing-section" id="modes">
          <span className="landing-eyebrow">{t("landing.modesEyebrow")}</span>
          <h2>{t("landing.modesTitle")}</h2>
          <p className="landing-section-lede">{t("landing.modesLead")}</p>
          <div className="landing-cards landing-cards-2">
            <article className="landing-card landing-mode">
              <h3>{t("home.typeCalendar")}</h3>
              <span className="landing-mode-rule">{t("landing.calRule")}</span>
              <p>{t("landing.calBody")}</p>
              <strong>{t("landing.calBest")}</strong>
              <span className="landing-examples-line">{t("landing.calExamples")}</span>
              <button type="button" className="btn landing-try" onClick={() => tryMode("calendar")}>
                {t("landing.tryMode")}
              </button>
            </article>
            <article className="landing-card mint landing-mode">
              <h3>{t("home.typeJar")}</h3>
              <span className="landing-mode-rule">{t("landing.jarRule")}</span>
              <p>{t("landing.jarBody")}</p>
              <strong>{t("landing.jarBest")}</strong>
              <span className="landing-examples-line">{t("landing.jarExamples")}</span>
              <button type="button" className="btn landing-try" onClick={() => tryMode("jar")}>
                {t("landing.tryMode")}
              </button>
            </article>
          </div>
          <p className="landing-note">{t("landing.modesNote")}</p>
        </section>

        <section className="landing-section" id="stats">
          <span className="landing-eyebrow">{t("landing.statsEyebrow")}</span>
          <h2>{t("landing.statsTitle")}</h2>
          <p className="landing-section-lede">{t("landing.statsBody")}</p>
          <div className="landing-stats-grid">
            <div className="stat-tile"><div className="value">12</div><div className="label">{t("landing.statsL1")}</div></div>
            <div className="stat-tile"><div className="value">83%</div><div className="label">{t("landing.statsL2")}</div></div>
            <div className="stat-tile"><div className="value">247</div><div className="label">{t("landing.statsL3")}</div></div>
            <div className="stat-tile"><div className="value">19</div><div className="label">{t("landing.statsL4")}</div></div>
          </div>
          <div className="landing-chart-card">
            <h3>{t("landing.chartTitle")}</h3>
            <div className="landing-chart" aria-hidden="true">
              {CHART_HEIGHTS.map((height, i) => (
                <span key={i} style={{ height: `${height}%` }} />
              ))}
            </div>
            <Link to="/login" className="landing-text-link">{t("landing.statsCta")} →</Link>
          </div>
        </section>

        <section className="landing-section">
          <span className="landing-eyebrow">{t("landing.examplesEyebrow")}</span>
          <h2>{t("landing.examplesTitle")}</h2>
          <div className="landing-chips">
            {[t("landing.ex1"), t("landing.ex2"), t("landing.ex3"), t("landing.ex4"), t("landing.ex5"), t("landing.ex6")].map((example) => (
              <span key={example} className="landing-chip">{example}</span>
            ))}
          </div>
        </section>

        <section className="landing-section" id="faq">
          <span className="landing-eyebrow">{t("landing.faqEyebrow")}</span>
          <h2>{t("landing.faqTitle")}</h2>
          <div className="landing-faq">
            {faqs.map((faq) => (
              <details key={faq.q} className="landing-faq-item">
                <summary>{faq.q}</summary>
                <p>{faq.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="landing-final">
          <h2>{t("landing.finalTitle")}</h2>
          <p>{t("landing.finalBody")}</p>
          <Link to="/login" className="btn btn-primary landing-cta">
            {t("landing.finalButton")}
          </Link>
          <span>{t("landing.heroMicro")}</span>
        </section>
      </main>

      <footer className="landing-footer">
        <span className="brand">Clicky <span>Habits</span></span>
        <p>{t("landing.footer")}</p>
        {langToggle("lang-toggle landing-footer-lang")}
        <Link to="/login">{t("landing.signIn")}</Link>
      </footer>
    </div>
  );
}
