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
  listHabits: () => request<HabitSummary[]>("/habits"),
  createHabit: (name: string, type: TrackerType) =>
    request<HabitSummary>("/habits", {
      method: "POST",
      body: JSON.stringify({ name, type }),
    }),
  deleteHabit: (id: string) =>
    request<{ ok: boolean }>(`/habits/${id}`, { method: "DELETE" }),
  getHabit: (id: string) => request<HabitDetail>(`/habits/${id}`),
  toggleDay: (id: string, date: string) =>
    request<{ marked: boolean; date: string }>(`/habits/${id}/toggle`, {
      method: "POST",
      body: JSON.stringify({ date }),
    }),
  addCoin: (id: string) =>
    request<{ date: string; countToday: number; totalCount: number }>(
      `/habits/${id}/coin`,
      { method: "POST", body: JSON.stringify({ date: todayKey() }) }
    ),
  removeCoin: (id: string) =>
    request<{ date: string | null; removed: number; countToday: number; totalCount: number }>(
      `/habits/${id}/coin/remove`,
      { method: "POST", body: JSON.stringify({}) }
    ),
  getStats: (id: string) => request<HabitStats>(`/habits/${id}/stats`),
  getDashboard: () => request<DashboardData>("/habits-dashboard"),
  getAccount: () => request<{ hasPassword: boolean }>("/me/account"),
  // Only for accounts without a password (Google sign-up). Errors are thrown
  // as their code: password_too_short, password_too_long, already_has_password.
  setPassword: (newPassword: string) =>
    request<{ ok: true }>("/me/password", {
      method: "POST",
      body: JSON.stringify({ newPassword }),
    }),
};

export function todayKey(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
