import { API_URL } from "./config";

export type TrackerType = "CALENDAR" | "JAR";

export interface HabitSummary {
  id: string;
  name: string;
  type: TrackerType;
  createdAt: string;
  totalCount: number;
  totalDays: number;
  doneToday: boolean;
}

export interface HabitDetail {
  id: string;
  name: string;
  type: TrackerType;
  createdAt: string;
  entries: { date: string; count: number }[];
  totalCount: number;
}

export interface HabitStats {
  id: string;
  name: string;
  type: TrackerType;
  totalCount: number;
  totalDays: number;
  currentStreak: number;
  bestStreak: number;
  last30Days: { date: string; count: number }[];
  thisMonthDays: number;
  completionRate30: number;
}

export interface DashboardData {
  totalHabits: number;
  totalCoins: number;
  totalDaysMarked: number;
  activeDays30: number;
  completionRate30: number;
  bestStreak: { value: number; name: string };
  last30Days: { date: string; count: number }[];
  habits: (HabitStats & { id: string; name: string; type: TrackerType })[];
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    credentials: "include",
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  listHabits: () => request<HabitSummary[]>("/api/habits"),
  createHabit: (name: string, type: TrackerType) =>
    request<HabitSummary>("/api/habits", {
      method: "POST",
      body: JSON.stringify({ name, type }),
    }),
  deleteHabit: (id: string) =>
    request<{ ok: boolean }>(`/api/habits/${id}`, { method: "DELETE" }),
  getHabit: (id: string) => request<HabitDetail>(`/api/habits/${id}`),
  toggleDay: (id: string, date: string) =>
    request<{ marked: boolean; date: string }>(`/api/habits/${id}/toggle`, {
      method: "POST",
      body: JSON.stringify({ date }),
    }),
  addCoin: (id: string) =>
    request<{ date: string; countToday: number; totalCount: number }>(
      `/api/habits/${id}/coin`,
      { method: "POST", body: JSON.stringify({ date: todayKey() }) }
    ),
  getStats: (id: string) => request<HabitStats>(`/api/habits/${id}/stats`),
  getDashboard: () => request<DashboardData>("/api/habits-dashboard"),
};

export function todayKey(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
