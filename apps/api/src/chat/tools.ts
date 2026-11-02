import { habitService, type HabitService, type TrackerType } from "../habits-service";
import type { LlmToolDef, ToolCall } from "./llm";

export interface ToolContext {
  userId: string;
  threadId: string;
  today: string;
  lang: "en" | "id";
}

export interface ToolOutcome {
  ok: boolean;
  summary: string;
  data?: unknown;
  undo?: { kind: "create" | "mark" | "coins"; payload: Record<string, unknown> };
  pendingDelete?: { habitId: string; name: string };
}

const pick = (lang: "en" | "id", id: string, en: string) => (lang === "id" ? id : en);

export const toolDefs: LlmToolDef[] = [
  {
    name: "list_habits",
    description: "List the current user's habits with id, name, tracker type, done-today flag and totals. Call this before acting on a habit named by the user when its id is not already known.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_dashboard",
    description: "Get aggregate statistics across all of the user's habits: totals, current/best streaks, 30-day consistency and activity.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_habit_stats",
    description: "Get statistics for one habit: totals, current and best streak, this-month active days, 30-day consistency.",
    parameters: {
      type: "object",
      properties: { habitId: { type: "string", description: "Habit id from list_habits" } },
      required: ["habitId"],
      additionalProperties: false,
    },
  },
  {
    name: "create_habit",
    description: "Create a new habit. type CALENDAR means once-a-day cross-off; JAR means repeatable coin counting. Only call when the tracker type is clear from the user, otherwise ask first.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string" },
        type: { type: "string", enum: ["CALENDAR", "JAR"] },
      },
      required: ["name", "type"],
      additionalProperties: false,
    },
  },
  {
    name: "mark_day",
    description: "Mark one day as done for a CALENDAR habit (idempotent; never unmarks). Defaults to today when date is omitted.",
    parameters: {
      type: "object",
      properties: {
        habitId: { type: "string" },
        date: { type: "string", description: "YYYY-MM-DD" },
      },
      required: ["habitId"],
      additionalProperties: false,
    },
  },
  {
    name: "add_coins",
    description: "Add coins to a JAR habit for one day (default 1, max 20 per call). Defaults to today when date is omitted.",
    parameters: {
      type: "object",
      properties: {
        habitId: { type: "string" },
        count: { type: "number" },
        date: { type: "string", description: "YYYY-MM-DD" },
      },
      required: ["habitId"],
      additionalProperties: false,
    },
  },
  {
    name: "delete_habit",
    description: "Request deletion of a habit. This does NOT delete immediately: the user gets a confirmation card and must approve. Tell the user deletion is permanent.",
    parameters: {
      type: "object",
      properties: { habitId: { type: "string" } },
      required: ["habitId"],
      additionalProperties: false,
    },
  },
];

function strArg(args: Record<string, unknown>, key: string): string | undefined {
  const v = args[key];
  if (typeof v !== "string") return undefined;
  const trimmed = v.trim();
  return trimmed ? trimmed : undefined;
}

/** Present-but-invalid dates are an error; only an absent date defaults to today. */
function dateArg(args: Record<string, unknown>, today: string): string | null {
  const raw = args.date;
  if (raw === undefined) return today;
  if (typeof raw !== "string") return null;
  const key = raw.trim();
  return validDateKey(key) ? key : null;
}

function validDateKey(key: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return false;
  const d = new Date(key + "T00:00:00Z");
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === key;
}

function fail(summary: string): ToolOutcome {
  return { ok: false, summary };
}

export async function describeToolCall(
  call: ToolCall,
  ctx: ToolContext,
  svc: HabitService = habitService
): Promise<string> {
  const lang = ctx.lang;
  const args = call.arguments ?? {};
  const habitId = strArg(args, "habitId");
  let habitName: string | undefined;
  if (habitId) {
    const habit = await svc.getHabit(ctx.userId, habitId).catch(() => null);
    habitName = habit?.name;
  }
  const named = habitName ? `"${habitName}"` : pick(lang, "habit ini", "this habit");
  switch (call.name) {
    case "list_habits":
      return pick(lang, "Lihat daftar habit kamu", "View your habit list");
    case "get_dashboard":
      return pick(lang, "Lihat statistik kamu", "View your statistics");
    case "get_habit_stats":
      return pick(lang, `Lihat statistik ${named}`, `View stats for ${named}`);
    case "create_habit":
      return pick(lang, `Buat habit "${strArg(args, "name") ?? ""}"`, `Create habit "${strArg(args, "name") ?? ""}"`);
    case "mark_day": {
      const date = strArg(args, "date") ?? ctx.today;
      const when = date === ctx.today ? pick(lang, "hari ini", "today") : date;
      return pick(lang, `Coret ${when} untuk ${named}`, `Mark ${when} for ${named}`);
    }
    case "add_coins": {
      const count = typeof args.count === "number" ? args.count : 1;
      return pick(lang, `Masukkan ${count} koin ke ${named}`, `Add ${count} coin(s) to ${named}`);
    }
    case "delete_habit":
      return pick(lang, `Hapus habit ${named}`, `Delete habit ${named}`);
    default:
      return call.name;
  }
}

export async function executeTool(
  call: ToolCall,
  ctx: ToolContext,
  svc: HabitService = habitService
): Promise<ToolOutcome> {
  const lang = ctx.lang;
  const args = call.arguments ?? {};
  if ("__malformed" in args) {
    return fail(pick(lang, "Argumen tool tidak valid.", "Invalid tool arguments."));
  }
  try {
    switch (call.name) {
      case "list_habits": {
        const habits = await svc.listHabits(ctx.userId, ctx.today);
        return {
          ok: true,
          summary: pick(lang, `${habits.length} habit ditemukan.`, `${habits.length} habits found.`),
          data: habits.map((h) => ({
            id: h.id,
            name: h.name,
            type: h.type,
            doneToday: h.doneToday,
            totalCount: h.totalCount,
            totalDays: h.totalDays,
          })),
        };
      }
      case "get_dashboard": {
        const dash = await svc.getDashboard(ctx.userId, ctx.today);
        return {
          ok: true,
          summary: pick(
            lang,
            `${dash.totalHabits} habit · streak terbaik ${dash.bestStreak.value} hari · konsistensi 30 hari ${dash.completionRate30}%`,
            `${dash.totalHabits} habits · best streak ${dash.bestStreak.value} days · 30-day consistency ${dash.completionRate30}%`
          ),
          data: dash,
        };
      }
      case "get_habit_stats": {
        const habitId = strArg(args, "habitId");
        if (!habitId) return fail(pick(lang, "habitId wajib diisi.", "habitId is required."));
        const stats = await svc.getHabitStats(ctx.userId, habitId, ctx.today);
        if (!stats) return fail(pick(lang, "Habit tidak ditemukan.", "Habit not found."));
        return {
          ok: true,
          summary: pick(
            lang,
            `Streak ${stats.currentStreak} hari · terbaik ${stats.bestStreak} hari · total ${stats.totalCount}`,
            `Current streak ${stats.currentStreak} days · best ${stats.bestStreak} days · total ${stats.totalCount}`
          ),
          data: stats,
        };
      }
      case "create_habit": {
        const name = strArg(args, "name");
        const type = args.type;
        if (!name) return fail(pick(lang, "Nama habit wajib diisi.", "Habit name is required."));
        if (type !== "CALENDAR" && type !== "JAR") {
          return fail(pick(lang, "Tipe tracker tidak valid.", "Invalid tracker type."));
        }
        const habit = await svc.createHabit(ctx.userId, name, type as TrackerType);
        return {
          ok: true,
          summary: pick(
            lang,
            `Habit "${habit.name}" dibuat (${type === "CALENDAR" ? "Kalender" : "Toples"}).`,
            `Habit "${habit.name}" created (${type === "CALENDAR" ? "Calendar" : "Jar"}).`
          ),
          data: { id: habit.id, name: habit.name, type: habit.type },
          undo: { kind: "create", payload: { habitId: habit.id } },
        };
      }
      case "mark_day": {
        const habitId = strArg(args, "habitId");
        if (!habitId) return fail(pick(lang, "habitId wajib diisi.", "habitId is required."));
        const date = dateArg(args, ctx.today);
        if (!date) return fail(pick(lang, "Tanggal tidak valid.", "Invalid date."));
        const habit = await svc.getHabit(ctx.userId, habitId);
        if (!habit) return fail(pick(lang, "Habit tidak ditemukan.", "Habit not found."));
        if (habit.type !== "CALENDAR") {
          return fail(
            pick(
              lang,
              `"${habit.name}" adalah habit Toples — pakai tambah koin, bukan coret hari.`,
              `"${habit.name}" is a Jar habit — add coins instead of marking a day.`
            )
          );
        }
        const result = await svc.ensureMarked(ctx.userId, habitId, date);
        if (!result) return fail(pick(lang, "Habit tidak ditemukan.", "Habit not found."));
        return {
          ok: true,
          summary: result.created
            ? pick(lang, `${date} untuk "${habit.name}" dicoret.`, `${date} marked for "${habit.name}".`)
            : pick(
                lang,
                `${date} untuk "${habit.name}" memang sudah dicoret.`,
                `${date} was already marked for "${habit.name}".`
              ),
          data: { habitId, name: habit.name, date, created: result.created },
          undo: result.created
            ? { kind: "mark", payload: { habitId, date } }
            : undefined,
        };
      }
      case "add_coins": {
        const habitId = strArg(args, "habitId");
        if (!habitId) return fail(pick(lang, "habitId wajib diisi.", "habitId is required."));
        const date = dateArg(args, ctx.today);
        if (!date) return fail(pick(lang, "Tanggal tidak valid.", "Invalid date."));
        const rawCount = args.count ?? 1;
        if (typeof rawCount !== "number" || !Number.isInteger(rawCount) || rawCount < 1 || rawCount > 20) {
          return fail(pick(lang, "Jumlah koin harus 1–20.", "Coin count must be 1–20."));
        }
        const habit = await svc.getHabit(ctx.userId, habitId);
        if (!habit) return fail(pick(lang, "Habit tidak ditemukan.", "Habit not found."));
        if (habit.type !== "JAR") {
          return fail(
            pick(
              lang,
              `"${habit.name}" adalah habit Kalender — pakai coret hari, bukan tambah koin.`,
              `"${habit.name}" is a Calendar habit — mark a day instead of adding coins.`
            )
          );
        }
        const result = await svc.addCoins(ctx.userId, habitId, date, rawCount);
        if (!result) return fail(pick(lang, "Habit tidak ditemukan.", "Habit not found."));
        return {
          ok: true,
          summary: pick(
            lang,
            `+${rawCount} koin ke "${habit.name}" · hari ini ${result.countToday} · total ${result.totalCount}`,
            `+${rawCount} coin(s) to "${habit.name}" · today ${result.countToday} · total ${result.totalCount}`
          ),
          data: { habitId, name: habit.name, added: rawCount, ...result },
          undo: { kind: "coins", payload: { habitId, date, count: rawCount } },
        };
      }
      case "delete_habit": {
        const habitId = strArg(args, "habitId");
        if (!habitId) return fail(pick(lang, "habitId wajib diisi.", "habitId is required."));
        const habit = await svc.getHabit(ctx.userId, habitId);
        if (!habit) return fail(pick(lang, "Habit tidak ditemukan.", "Habit not found."));
        return {
          ok: true,
          summary: pick(
            lang,
            `Menunggu konfirmasi hapus "${habit.name}".`,
            `Waiting for confirmation to delete "${habit.name}".`
          ),
          data: { status: "pending_confirmation", habitId, name: habit.name },
          pendingDelete: { habitId, name: habit.name },
        };
      }
      default:
        return fail(pick(lang, `Tool tidak dikenal: ${call.name}`, `Unknown tool: ${call.name}`));
    }
  } catch {
    return fail(pick(lang, "Terjadi kesalahan saat menjalankan aksi.", "Something went wrong running that action."));
  }
}
