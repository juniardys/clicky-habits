import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { api, type HabitSummary, type TrackerType } from "../lib/api";
import { signOut, useSession } from "../lib/auth";
import { playPop } from "../lib/sound";

const spring = { type: "spring" as const, duration: 0.45, bounce: 0 };

export default function HomePage() {
  const { data: session } = useSession();
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
      setError(err instanceof Error ? err.message : "Gagal membuat kebiasaan");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string, habitName: string) {
    if (!confirm(`Hapus kebiasaan "${habitName}" beserta semua datanya?`)) return;
    await api.deleteHabit(id);
    await refresh();
  }

  return (
    <div className="container">
      <div className="topbar">
        <div className="brand">
          Clicky <span>Habits</span>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ color: "var(--text-dim)", fontSize: 14 }}>
            {session?.user.name || session?.user.email}
          </span>
          <button className="btn-ghost" onClick={() => signOut()}>
            Keluar
          </button>
        </div>
      </div>

      <div className="page-head">
        <h1>Kebiasaanku</h1>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
          + Tambah Kebiasaan
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
          <p>
            Belum ada kebiasaan. Tambah satu, lalu pilih mau coret kalender atau
            masukkan koin ke toples.
          </p>
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
                  {h.type === "CALENDAR" ? "🗓️ Coret Kalender" : "🪙 Koin dalam Toples"}
                </span>
                <h3>{h.name}</h3>
                <span className="meta">
                  {h.type === "CALENDAR"
                    ? `${h.totalDays} hari tercoret`
                    : `${h.totalCount} koin · ${Math.floor(h.totalCount / 100)} toples penuh`}
                </span>
                {h.type === "JAR" && (
                  <div className="progress-track" title={`Toples aktif: ${Math.round(jarProgress * 100)}%`}>
                    <div
                      className="progress-fill"
                      style={{ width: `${Math.max(jarProgress * 100, h.totalCount > 0 ? 3 : 0)}%` }}
                    />
                  </div>
                )}
                {h.doneToday && <span className="done-dot">✓ Sudah hari ini</span>}
                <div className="actions">
                  <Link to={`/habits/${h.id}`}>
                    <button className="btn btn-primary">Tracking</button>
                  </Link>
                  <Link to={`/habits/${h.id}/stats`}>
                    <button className="btn">Statistik</button>
                  </Link>
                  <button className="btn-ghost" onClick={() => handleDelete(h.id, h.name)}>
                    Hapus
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
              <h2>Kebiasaan Baru</h2>
              <input
                autoFocus
                placeholder="Contoh: olahraga rutin, bikin konten…"
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
                  Coret Kalender
                  <small>1x per hari, coret tanggalnya</small>
                </div>
                <div
                  className={`type-option ${type === "JAR" ? "selected" : ""}`}
                  onClick={() => setType("JAR")}
                >
                  <span className="icon">🪙</span>
                  Koin dalam Toples
                  <small>Bisa berkali-kali, 100 koin per toples</small>
                </div>
              </div>
              {error && <p className="error-text">{error}</p>}
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button type="button" className="btn-ghost" onClick={() => setShowAdd(false)}>
                  Batal
                </button>
                <button type="submit" className="btn btn-primary" disabled={busy}>
                  Simpan
                </button>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
