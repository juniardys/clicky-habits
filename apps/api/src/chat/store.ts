import { prisma } from "../db";
import { PENDING_TTL_MS } from "./actions";

export interface StoredMessage {
  id: string;
  threadId: string;
  role: string;
  content: string;
  toolName: string | null;
  toolMeta: Record<string, unknown> | null;
  createdAt: Date;
}

export interface StoredAction {
  id: string;
  userId: string;
  threadId: string;
  kind: string;
  payload: Record<string, unknown>;
  undoneAt: Date | null;
}

export interface StoredPending {
  id: string;
  userId: string;
  threadId: string;
  toolName: string;
  args: Record<string, unknown>;
  expiresAt: Date;
}

export interface ChatStore {
  getLatestThread(userId: string): Promise<{ id: string } | null>;
  createThread(userId: string): Promise<{ id: string }>;
  getThread(userId: string, threadId: string): Promise<{ id: string } | null>;
  addMessage(
    threadId: string,
    input: {
      role: string;
      content: string;
      toolName?: string | null;
      toolMeta?: Record<string, unknown> | null;
    }
  ): Promise<StoredMessage>;
  listMessages(threadId: string, limit?: number): Promise<StoredMessage[]>;
  saveAction(
    userId: string,
    threadId: string,
    undo: { kind: string; payload: Record<string, unknown> }
  ): Promise<StoredAction>;
  getAction(userId: string, id: string): Promise<StoredAction | null>;
  markActionUndone(id: string): Promise<void>;
  listActions(userId: string, threadId: string): Promise<StoredAction[]>;
  createPending(
    userId: string,
    threadId: string,
    toolName: string,
    args: Record<string, unknown>
  ): Promise<StoredPending>;
  getPending(userId: string, id: string): Promise<StoredPending | null>;
  consumePending(id: string): Promise<boolean>;
  discardPendingForThread(threadId: string): Promise<void>;
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

export const prismaChatStore: ChatStore = {
  async getLatestThread(userId) {
    const t = await prisma.chatThread.findFirst({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      select: { id: true },
    });
    return t;
  },
  async createThread(userId) {
    const t = await prisma.chatThread.create({ data: { userId }, select: { id: true } });
    return t;
  },
  async getThread(userId, threadId) {
    const t = await prisma.chatThread.findFirst({
      where: { id: threadId, userId },
      select: { id: true },
    });
    return t;
  },
  async addMessage(threadId, input) {
    const m = await prisma.chatMessage.create({
      data: {
        threadId,
        role: input.role,
        content: input.content,
        toolName: input.toolName ?? null,
        toolMeta: (input.toolMeta ?? undefined) as never,
      },
    });
    await prisma.chatThread.update({ where: { id: threadId }, data: { updatedAt: new Date() } });
    return { ...m, toolMeta: asRecord(m.toolMeta) };
  },
  async listMessages(threadId, limit = 100) {
    const rows = await prisma.chatMessage.findMany({
      where: { threadId },
      orderBy: { createdAt: "asc" },
      take: limit,
    });
    return rows.map((m) => ({ ...m, toolMeta: asRecord(m.toolMeta) }));
  },
  async saveAction(userId, threadId, undo) {
    const a = await prisma.chatAction.create({
      data: { userId, threadId, kind: undo.kind, payload: undo.payload as never },
    });
    return { ...a, payload: asRecord(a.payload) ?? {} };
  },
  async getAction(userId, id) {
    const a = await prisma.chatAction.findFirst({ where: { id, userId } });
    if (!a) return null;
    return { ...a, payload: asRecord(a.payload) ?? {} };
  },
  async markActionUndone(id) {
    await prisma.chatAction.update({ where: { id }, data: { undoneAt: new Date() } });
  },
  async listActions(userId, threadId) {
    const rows = await prisma.chatAction.findMany({ where: { userId, threadId } });
    return rows.map((a) => ({ ...a, payload: asRecord(a.payload) ?? {} }));
  },
  async createPending(userId, threadId, toolName, args) {
    const p = await prisma.chatPendingAction.create({
      data: {
        userId,
        threadId,
        toolName,
        args: args as never,
        expiresAt: new Date(Date.now() + PENDING_TTL_MS),
      },
    });
    return { ...p, args: asRecord(p.args) ?? {} };
  },
  async getPending(userId, id) {
    const p = await prisma.chatPendingAction.findFirst({ where: { id, userId } });
    if (!p) return null;
    return { ...p, args: asRecord(p.args) ?? {} };
  },
  async consumePending(id) {
    const res = await prisma.chatPendingAction.deleteMany({ where: { id } });
    return res.count > 0;
  },
  async discardPendingForThread(threadId) {
    await prisma.chatPendingAction.deleteMany({ where: { threadId } });
  },
};
