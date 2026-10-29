import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api, type HabitStats } from "../lib/api";

export default function StatsPage() {
  const { id } = useParams<{ id: string }>();
  const [stats, setStats] = useState<HabitStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    api
      .getStats(id)
      .then(setStats)
      .catch((e) => setError(e.message));
  }, [id]);

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

  if (!stats) {
    return (
      <div className="center-screen">
        <div className="spinner" />
      </div>
    );
  }

  const isJar = stats.type === "JAR";
  const chartData = stats.last30Days.map((d) => ({
    ...d,
    label: d.date.slice(8, 10),
  }));

  return (
    <div className="container">
      <div className="page-head">
        <div>
          <h1>Statistik — {stats.name}</h1>
          <div className="sub">
            {isJar ? "🪙 Koin dalam Toples" : "🗓️ Coret Kalender"}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link to={`/habits/${id}`}>
            <button className="btn">Tracking</button>
          </Link>
          <Link to="/">
            <button className="btn-ghost">← Beranda</button>
          </Link>
        </div>
      </div>

      <div className="stat-tiles">
        <div className="stat-tile">
          <div className="value">{stats.currentStreak}</div>
          <div className="label">Streak saat ini (hari)</div>
        </div>
        <div className="stat-tile">
          <div className="value">{stats.bestStreak}</div>
          <div className="label">Streak terbaik (hari)</div>
        </div>
        <div className="stat-tile">
          <div className="value">{isJar ? stats.totalCount : stats.totalDays}</div>
          <div className="label">{isJar ? "Total koin" : "Total hari tercoret"}</div>
        </div>
        {isJar && (
          <div className="stat-tile">
            <div className="value">{Math.floor(stats.totalCount / 100)}</div>
            <div className="label">Toples penuh</div>
          </div>
        )}
        <div className="stat-tile">
          <div className="value">{stats.completionRate30}%</div>
          <div className="label">Konsistensi 30 hari terakhir</div>
        </div>
        <div className="stat-tile">
          <div className="value">{stats.thisMonthDays}</div>
          <div className="label">Hari aktif bulan ini</div>
        </div>
      </div>

      <div className="chart-card">
        <h3>{isJar ? "Koin per hari — 30 hari terakhir" : "Aktivitas — 30 hari terakhir"}</h3>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={chartData}>
            <CartesianGrid stroke="#e4d8cc" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" stroke="#8a7a90" fontSize={12} tickLine={false} />
            <YAxis stroke="#8a7a90" fontSize={12} tickLine={false} allowDecimals={false} />
            <Tooltip
              contentStyle={{
                background: "#fff8ef",
                border: "2px solid #46364a",
                borderRadius: 14,
                color: "#46364a",
                fontWeight: 700,
              }}
              labelFormatter={(_, payload) =>
                payload?.[0]?.payload?.date ?? ""
              }
              formatter={(value: number) => [value, isJar ? "koin" : "selesai"]}
            />
            <Bar dataKey="count" fill="#ff9a76" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
