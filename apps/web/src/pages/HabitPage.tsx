import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import confetti from "canvas-confetti";
import { api, todayKey, type HabitDetail } from "../lib/api";
import { onHabitsChanged } from "../lib/chat";
import { useI18n } from "../lib/i18n";
import { playChime, playPop, playScratch } from "../lib/sound";
import Calendar3D from "../components/Calendar3D";
import Jar3D, { JAR_CAPACITY } from "../components/Jar3D";
import Navbar from "../components/Navbar";

function burstAt(el: HTMLElement | null, big = false) {
  const rect = el?.getBoundingClientRect();
  const origin = rect
    ? {
        x: (rect.left + rect.width / 2) / window.innerWidth,
        y: (rect.top + rect.height / 2) / window.innerHeight,
      }
    : { x: 0.5, y: 0.7 };
  confetti({
    particleCount: big ? 160 : 40,
    spread: big ? 100 : 60,
    startVelocity: big ? 45 : 28,
    origin,
    colors: ["#ff9a76", "#ffce4f", "#7fd8a6", "#b9a6f2", "#f06d4f"],
    disableForReducedMotion: true,
  });
}

export default function HabitPage() {
  const { t, locale } = useI18n();
  const { id } = useParams<{ id: string }>();
  const [habit, setHabit] = useState<HabitDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());

  const [viewJar, setViewJar] = useState<number | null>(null);
  const [justAdded, setJustAdded] = useState(false);
  const [busy, setBusy] = useState(false);
  const coinButtonRef = useRef<HTMLButtonElement>(null);
  const markButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!id) return;
    api
      .getHabit(id)
      .then(setHabit)
      .catch((e) => setError(e.message));
  }, [id]);

  useEffect(() => {
    if (!id) return;
    return onHabitsChanged(() => {
      api.getHabit(id).then(setHabit).catch(() => {});
    });
  }, [id]);

  const markedDates = useMemo(
    () => new Set(habit?.entries.map((e) => e.date) ?? []),
    [habit]
  );

  if (error) {
    return (
      <div className="container">
        <Navbar />
        <p className="error-text">{error}</p>
        <Link to="/app">
          <button className="btn">{t("common.back")}</button>
        </Link>
      </div>
    );
  }

  if (!habit || !id) {
    return (
      <div className="center-screen">
        <div className="spinner" />
      </div>
    );
  }

  const total = habit.totalCount;
  const jarCount = Math.max(1, Math.ceil(total / JAR_CAPACITY) || 1);
  const currentJar = total === 0 ? 0 : Math.floor((total - 1) / JAR_CAPACITY);
  const shownJar = viewJar ?? currentJar;
  const coinsInShownJar = Math.max(
    0,
    Math.min(JAR_CAPACITY, total - shownJar * JAR_CAPACITY)
  );

  async function handleToggle(dateKey: string) {
    if (!habit) return;
    const exists = habit.entries.some((e) => e.date === dateKey);
    if (exists) {
      playPop();
    } else {
      playScratch();
      if (dateKey === todayKey()) burstAt(markButtonRef.current);
    }
    // optimistic update
    setHabit({
      ...habit,
      entries: exists
        ? habit.entries.filter((e) => e.date !== dateKey)
        : [...habit.entries, { date: dateKey, count: 1 }],
    });
    try {
      await api.toggleDay(habit.id, dateKey);
    } catch {
      setHabit(await api.getHabit(habit.id));
    }
  }

  async function handleCoin() {
    if (!habit || busy) return;
    setBusy(true);
    try {
      const res = await api.addCoin(habit.id);
      setJustAdded(true);
      setViewJar(null); // jump to the active jar so the drop is visible
      const t = todayKey();
      const entries = habit.entries.some((e) => e.date === t)
        ? habit.entries.map((e) =>
            e.date === t ? { ...e, count: res.countToday } : e
          )
        : [...habit.entries, { date: t, count: res.countToday }];
      setHabit({ ...habit, entries, totalCount: res.totalCount });
      if (res.totalCount % JAR_CAPACITY === 0) {
        // jar just became full - big celebration
        playChime();
        burstAt(coinButtonRef.current, true);
      } else if (res.totalCount % 10 === 0) {
        burstAt(coinButtonRef.current);
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleRemoveCoin() {
    if (!habit || busy || total === 0) return;
    setBusy(true);
    try {
      const res = await api.removeCoin(habit.id);
      const date = res.date;
      if (res.removed > 0 && date) {
        playPop();
        setJustAdded(false);
        setViewJar(null); // jump to the active jar so the removal is visible
        const entries =
          res.countToday > 0
            ? habit.entries.map((e) => (e.date === date ? { ...e, count: res.countToday } : e))
            : habit.entries.filter((e) => e.date !== date);
        setHabit({ ...habit, entries, totalCount: res.totalCount });
      }
    } catch {
      setHabit(await api.getHabit(habit.id));
    } finally {
      setBusy(false);
    }
  }

  function prevMonth() {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else setViewMonth(viewMonth - 1);
  }

  function nextMonth() {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else setViewMonth(viewMonth + 1);
  }

  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleDateString(locale, {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="container">
      <Navbar />
      <div className="page-head">
        <div>
          <h1>{habit.name}</h1>
          <div className="sub">
            {habit.type === "CALENDAR"
              ? t("habit.calendarSub")
              : t("habit.jarSub", {
                  total,
                  jars: Math.floor(total / JAR_CAPACITY),
                })}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link to={`/habits/${id}/stats`}>
            <button className="btn">{t("common.stats")}</button>
          </Link>
          <Link to="/app">
            <button className="btn-ghost">{t("common.back")}</button>
          </Link>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", duration: 0.5, bounce: 0 }}
      >
        {habit.type === "CALENDAR" ? (
          <>
            <div className="canvas-wrap">
              <div className="canvas-top">
                <button className="nav-arrow" onClick={prevMonth} aria-label={t("habit.prevMonth")}>
                  ←
                </button>
                <span className="month-label">{monthLabel}</span>
                <button className="nav-arrow" onClick={nextMonth} aria-label={t("habit.nextMonth")}>
                  →
                </button>
              </div>
              <Calendar3D
                year={viewYear}
                month={viewMonth}
                markedDates={markedDates}
                onToggle={handleToggle}
              />
              <div className="canvas-overlay">
                <button
                  ref={markButtonRef}
                  className="btn btn-primary big-action"
                  onClick={() => handleToggle(todayKey())}
                >
                  {markedDates.has(todayKey())
                    ? t("habit.todayCrossed")
                    : t("habit.crossToday")}
                </button>
              </div>
            </div>
            <p className="hint">{t("habit.calendarHint")}</p>
          </>
        ) : (
          <>
            <div className="canvas-wrap">
              <div className="canvas-top">
                <button
                  className="nav-arrow"
                  disabled={shownJar === 0}
                  onClick={() => {
                    setJustAdded(false);
                    setViewJar(shownJar - 1);
                  }}
                  aria-label={t("habit.prevJar")}
                >
                  ←
                </button>
                <span className="jar-label">
                  {t("habit.jarLabel", {
                    cur: shownJar + 1,
                    total: jarCount,
                    coins: coinsInShownJar,
                    cap: JAR_CAPACITY,
                  })}
                </span>
                <button
                  className="nav-arrow"
                  disabled={shownJar >= jarCount - 1}
                  onClick={() => {
                    setJustAdded(false);
                    setViewJar(shownJar + 1);
                  }}
                  aria-label={t("habit.nextJar")}
                >
                  →
                </button>
              </div>
              <Jar3D
                key={shownJar}
                coinsInJar={coinsInShownJar}
                animateLast={justAdded && shownJar === currentJar}
              />
              <div className="canvas-overlay">
                <button
                  ref={coinButtonRef}
                  className="btn btn-primary big-action"
                  onClick={handleCoin}
                  disabled={busy}
                >
                  {t("habit.addCoin")}
                </button>
                <button
                  className="btn big-action"
                  onClick={handleRemoveCoin}
                  disabled={busy || total === 0}
                >
                  {t("habit.removeCoin")}
                </button>
              </div>
            </div>
            <p className="hint">{t("habit.jarHint", { cap: JAR_CAPACITY })}</p>
          </>
        )}
      </motion.div>
    </div>
  );
}
