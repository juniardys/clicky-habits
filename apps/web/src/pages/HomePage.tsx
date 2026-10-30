import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { api, type HabitSummary, type TrackerType } from "../lib/api";
import { onHabitsChanged } from "../lib/chat";
import { useI18n } from "../lib/i18n";
import { playPop } from "../lib/sound";
import Navbar from "../components/Navbar";

const spring = { type: "spring" as const, duration: 0.45, bounce: 0 };

export default function HomePage() {
  const { t } = useI18n();
  const [habits, setHabits] = useState<HabitSummary[] | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<TrackerType>("CALENDAR");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    setHabits(await api.listHabits());
  }

  useEffect(() => {
    refresh().catch(() => setHabits([]));
  }, []);

  useEffect(() => onHabitsChanged(() => void refresh().catch(() => {})), []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.createHabit(name, type);
      playPop();
      setName("");
      setShowAdd(false);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("home.createFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string, habitName: string) {
    if (!confirm(t("home.deleteConfirm", { name: habitName }))) return;
    await api.deleteHabit(id);
    await refresh();
  }

  return (
    <div className="container">
      <Navbar />

      <div className="page-head">
        <h1>{t("home.myHabits")}</h1>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
          {t("home.addHabit")}
        </button>
      </div>

      {habits === null ? (
        <div className="center-screen" style={{ minHeight: "30vh" }}>
          <div className="spinner" />
        </div>
      ) : habits.length === 0 ? (
        <motion.div
          className="empty-state"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={spring}
        >
          <div className="big">🗓️🪙</div>
          <p>{t("home.empty")}</p>
        </motion.div>
      ) : (
        <div className="habit-grid">
          {habits.map((h, i) => {
            const jarProgress = (h.totalCount % 100) / 100;
            return (
              <motion.div
                className="habit-card"
                key={h.id}
                initial={{ opacity: 0, y: 18, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ ...spring, delay: i * 0.06 }}
              >
                <span className="type-badge">
                  {h.type === "CALENDAR" ? t("home.typeCalendar") : t("home.typeJar")}
                </span>
                <h3>{h.name}</h3>
                <span className="meta">
                  {h.type === "CALENDAR"
                    ? t("home.daysCrossed", { n: h.totalDays })
                    : t("home.coinsMeta", {
                        n: h.totalCount,
                        jars: Math.floor(h.totalCount / 100),
                      })}
                </span>
                {h.type === "JAR" && (
                  <div
                    className="progress-track"
                    title={t("home.activeJar", { pct: Math.round(jarProgress * 100) })}
                  >
                    <div
                      className="progress-fill"
                      style={{ width: `${Math.max(jarProgress * 100, h.totalCount > 0 ? 3 : 0)}%` }}
                    />
                  </div>
                )}
                {h.doneToday && <span className="done-dot">{t("home.doneToday")}</span>}
                <div className="actions">
                  <Link to={`/habits/${h.id}`}>
                    <button className="btn btn-primary">{t("common.tracking")}</button>
                  </Link>
                  <Link to={`/habits/${h.id}/stats`}>
                    <button className="btn">{t("common.stats")}</button>
                  </Link>
                  <button className="btn-ghost" onClick={() => handleDelete(h.id, h.name)}>
                    {t("common.delete")}
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      <AnimatePresence>
        {showAdd && (
          <motion.div
            className="modal-backdrop"
            onClick={() => setShowAdd(false)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            <motion.form
              className="modal"
              onClick={(e) => e.stopPropagation()}
              onSubmit={handleCreate}
              initial={{ opacity: 0, scale: 0.94, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 8 }}
              transition={spring}
            >
              <h2>{t("home.newHabit")}</h2>
              <input
                autoFocus
                placeholder={t("home.namePlaceholder")}
                value={name}
                required
                onChange={(e) => setName(e.target.value)}
              />
              <div className="type-picker">
                <div
                  className={`type-option ${type === "CALENDAR" ? "selected" : ""}`}
                  onClick={() => setType("CALENDAR")}
                >
                  <span className="icon">🗓️</span>
                  {t("home.calendarOption")}
                  <small>{t("home.calendarDesc")}</small>
                </div>
                <div
                  className={`type-option ${type === "JAR" ? "selected" : ""}`}
                  onClick={() => setType("JAR")}
                >
                  <span className="icon">🪙</span>
                  {t("home.jarOption")}
                  <small>{t("home.jarDesc")}</small>
                </div>
              </div>
              {error && <p className="error-text">{error}</p>}
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button type="button" className="btn-ghost" onClick={() => setShowAdd(false)}>
                  {t("common.cancel")}
                </button>
                <button type="submit" className="btn btn-primary" disabled={busy}>
                  {t("common.save")}
                </button>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
