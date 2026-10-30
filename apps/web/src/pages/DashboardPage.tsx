import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api, type DashboardData } from "../lib/api";
import { onHabitsChanged } from "../lib/chat";
import { useI18n } from "../lib/i18n";
import Navbar from "../components/Navbar";
import { isSparse } from "../lib/chart";

const spring = { type: "spring" as const, duration: 0.45, bounce: 0 };

export default function DashboardPage() {
  const { t } = useI18n();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getDashboard()
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  useEffect(
    () =>
      onHabitsChanged(() => {
        api.getDashboard().then(setData).catch(() => {});
      }),
    []
  );

  if (error) {
    return (
      <div className="container">
        <Navbar />
        <p className="error-text">{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="container">
        <Navbar />
        <div className="center-screen" style={{ minHeight: "40vh" }}>
          <div className="spinner" />
        </div>
      </div>
    );
  }

  const chartData = data.last30Days.map((d) => ({
    ...d,
    label: d.date.slice(8, 10),
  }));

  return (
    <div className="container">
      <Navbar />

      <div className="page-head">
        <div>
          <h1>{t("dash.title")}</h1>
          <div className="sub">{t("dash.subtitle")}</div>
        </div>
      </div>

      {data.totalHabits === 0 ? (
        <motion.div
          className="empty-state"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={spring}
        >
          <div className="big">📊</div>
          <p>{t("dash.empty")}</p>
        </motion.div>
      ) : (
        <>
          <div className="stat-tiles">
            <div className="stat-tile">
              <div className="value">{data.totalHabits}</div>
              <div className="label">{t("dash.totalHabits")}</div>
            </div>
            <div className="stat-tile">
              <div className="value">{data.totalCoins}</div>
              <div className="label">{t("dash.totalCoins")}</div>
            </div>
            <div className="stat-tile">
              <div className="value">{data.totalDaysMarked}</div>
              <div className="label">{t("dash.totalDaysMarked")}</div>
            </div>
            <div className="stat-tile">
              <div className="value">{data.activeDays30}</div>
              <div className="label">{t("dash.activeDays30")}</div>
            </div>
            <div className="stat-tile">
              <div className="value">{data.bestStreak.value}</div>
              <div className="label">{t("dash.bestStreak")}</div>
              {data.bestStreak.name && (
                <div className="label-sub">{data.bestStreak.name}</div>
              )}
            </div>
            <div className="stat-tile">
              <div className="value">{data.completionRate30}%</div>
              <div className="label">{t("dash.consistency30")}</div>
            </div>
          </div>

          <div className="chart-card">
            <h3>{t("dash.chartTitle")}</h3>
            {isSparse(chartData) && <p className="chart-sparse">{t("chart.sparse")}</p>}
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
                  labelFormatter={(_, payload) => payload?.[0]?.payload?.date ?? ""}
                  formatter={(value: number) => [value, t("dash.unitActivity")]}
                />
                <Bar dataKey="count" fill="#ff9a76" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="chart-card">
            <h3>{t("dash.perHabit")}</h3>
            <div className="table-wrap">
              <table className="clay-table">
                <thead>
                  <tr>
                    <th>{t("dash.colHabit")}</th>
                    <th className="col-type">{t("dash.colType")}</th>
                    <th>{t("dash.colTotal")}</th>
                    <th>{t("dash.colStreak")}</th>
                    <th>{t("dash.colBest")}</th>
                    <th>{t("dash.colConsistency")}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.habits.map((h) => (
                    <tr key={h.id}>
                      <td className="col-name">
                        <span className="type-icon-inline" aria-hidden="true">
                          {h.type === "CALENDAR" ? "🗓️" : "🪙"}
                        </span>
                        <Link to={`/habits/${h.id}/stats`} className="table-link">
                          {h.name}
                        </Link>
                      </td>
                      <td className="col-type">{h.type === "CALENDAR" ? "🗓️" : "🪙"}</td>
                      <td>{h.type === "JAR" ? h.totalCount : h.totalDays}</td>
                      <td>{h.currentStreak}</td>
                      <td>{h.bestStreak}</td>
                      <td>{h.completionRate30}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
