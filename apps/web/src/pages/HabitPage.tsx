import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import confetti from "canvas-confetti";
import { api, todayKey, type HabitDetail } from "../lib/api";
import { playChime, playPop, playScratch } from "../lib/sound";
import Calendar3D from "../components/Calendar3D";
import Jar3D, { JAR_CAPACITY } from "../components/Jar3D";

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

  const markedDates = useMemo(
    () => new Set(habit?.entries.map((e) => e.date) ?? []),
    [habit]
  );

  if (error) {
    return (
      <div className="container">
        <p className="error-text">{error}</p>
        <Link to="/">
          <button className="btn">Kembali</button>
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
        // jar just became full — big celebration
        playChime();
        burstAt(coinButtonRef.current, true);
      } else if (res.totalCount % 10 === 0) {
        burstAt(coinButtonRef.current);
      }
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

  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleDateString("id-ID", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="container">
      <div className="page-head">
        <div>
          <h1>{habit.name}</h1>
          <div className="sub">
            {habit.type === "CALENDAR"
              ? "🗓️ Coret kalender — klik tanggal saat kebiasaanmu selesai"
              : `🪙 Total ${total} koin · ${Math.floor(total / JAR_CAPACITY)} toples penuh`}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link to={`/habits/${id}/stats`}>
            <button className="btn">Statistik</button>
          </Link>
          <Link to="/">
            <button className="btn-ghost">← Beranda</button>
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
                <button className="nav-arrow" onClick={prevMonth} aria-label="Bulan sebelumnya">
                  ←
                </button>
                <span className="month-label">{monthLabel}</span>
                <button className="nav-arrow" onClick={nextMonth} aria-label="Bulan berikutnya">
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
                    ? "✓ Hari ini tercoret — batalkan"
                    : "✗ Coret Hari Ini"}
                </button>
              </div>
            </div>
            <p className="hint">Klik tanggal mana pun untuk mencoret / membatalkan.</p>
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
                  aria-label="Toples sebelumnya"
                >
                  ←
                </button>
                <span className="jar-label">
                  Toples {shownJar + 1}/{jarCount} · {coinsInShownJar}/{JAR_CAPACITY} koin
                </span>
                <button
                  className="nav-arrow"
                  disabled={shownJar >= jarCount - 1}
                  onClick={() => {
                    setJustAdded(false);
                    setViewJar(shownJar + 1);
                  }}
                  aria-label="Toples berikutnya"
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
                  🪙 Masukkan Koin
                </button>
              </div>
            </div>
            <p className="hint">
              Tarik toples untuk memutar. Satu toples muat {JAR_CAPACITY} koin — penuh,
              otomatis lanjut ke toples berikutnya.
            </p>
          </>
        )}
      </motion.div>
    </div>
  );
}
