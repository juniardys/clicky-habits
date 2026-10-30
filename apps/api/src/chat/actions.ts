import type { HabitService } from "../habits-service";

export const PENDING_TTL_MS = 600_000;

export function isPendingExpired(p: { expiresAt: Date }, now: Date): boolean {
  return now.getTime() > p.expiresAt.getTime();
}

export interface UndoAction {
  userId: string;
  kind: string;
  payload: Record<string, unknown>;
}

function str(payload: Record<string, unknown>, key: string): string | undefined {
  const v = payload[key];
  return typeof v === "string" && v.trim() ? v : undefined;
}

export async function applyUndo(
  action: UndoAction,
  svc: HabitService
): Promise<{ changed: boolean; summary: string; removed?: number }> {
  const { userId, kind, payload } = action;
  const habitId = str(payload, "habitId");
  if (!habitId) return { changed: false, summary: "Aksi tidak valid untuk di-undo." };

  if (kind === "create") {
    const changed = await svc.deleteHabit(userId, habitId);
    return {
      changed,
      summary: changed ? "Habit yang dibuat dibatalkan (dihapus)." : "Habit itu sudah tidak ada.",
    };
  }
  if (kind === "mark") {
    const date = str(payload, "date");
    if (!date) return { changed: false, summary: "Aksi tidak valid untuk di-undo." };
    const changed = await svc.removeMark(userId, habitId, date);
    return {
      changed,
      summary: changed ? `Coretan ${date} dibuka kembali.` : `Coretan ${date} sudah tidak ada.`,
    };
  }
  if (kind === "coins") {
    const date = str(payload, "date");
    const count = typeof payload.count === "number" ? payload.count : 0;
    if (!date || count < 1) return { changed: false, summary: "Aksi tidak valid untuk di-undo." };
    const { removed } = await svc.decrementCoins(userId, habitId, date, count);
    return {
      changed: removed > 0,
      removed,
      summary:
        removed > 0
          ? `${removed} koin dikeluarkan kembali.`
          : "Tidak ada koin tersisa untuk dikeluarkan.",
    };
  }
  return { changed: false, summary: "Jenis aksi tidak dikenal." };
}
