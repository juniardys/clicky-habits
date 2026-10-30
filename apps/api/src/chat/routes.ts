import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { auth } from "../auth";
import { habitService, type HabitService } from "../habits-service";
import { applyUndo, isPendingExpired } from "./actions";
import { runChatTurn, turnCompleted, type ChatStreamEvent } from "./agent";
import { createStreamGuard } from "./guard";
import { isLlmConfigured, llmClientFromEnv, type LlmClient } from "./llm";
import { prismaChatStore, type ChatStore } from "./store";

type ChatEnv = {
  Variables: {
    userId: string;
  };
};

export interface ChatRouteDeps {
  llm?: LlmClient | null;
  svc?: HabitService;
  store?: ChatStore;
}

const streamGuard = createStreamGuard();

function validToday(value: unknown): string {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const d = new Date(value + "T00:00:00Z");
    if (!Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value) return value;
  }
  return new Date().toISOString().slice(0, 10);
}

function langOf(value: unknown): "en" | "id" {
  return value === "id" ? "id" : "en";
}

export function createChatRoutes(deps: ChatRouteDeps = {}) {
  const store = deps.store ?? prismaChatStore;
  const svc = deps.svc ?? habitService;
  const resolveLlm = (): LlmClient | null =>
    deps.llm !== undefined ? deps.llm : llmClientFromEnv();

  const app = new Hono<ChatEnv>();

  app.use("/api/chat/*", async (c, next) => {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    if (!session) return c.json({ error: "Unauthorized" }, 401);
    c.set("userId", session.user.id);
    await next();
  });
  app.use("/api/chat", async (c, next) => {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    if (!session) return c.json({ error: "Unauthorized" }, 401);
    c.set("userId", session.user.id);
    await next();
  });

  app.get("/api/chat/thread", async (c) => {
    const userId = c.get("userId");
    const thread = await store.getLatestThread(userId);
    if (!thread) return c.json({ threadId: null, messages: [], actions: [] });
    const [messages, actions] = await Promise.all([
      store.listMessages(thread.id, 100),
      store.listActions(userId, thread.id),
    ]);
    return c.json({
      threadId: thread.id,
      messages,
      actions: actions.map((a) => ({ id: a.id, undone: a.undoneAt !== null })),
    });
  });

  app.post("/api/chat/threads", async (c) => {
    const userId = c.get("userId");
    // Starting a new thread invalidates confirmations left open on the old one.
    const latest = await store.getLatestThread(userId);
    if (latest) await store.discardPendingForThread(latest.id);
    const thread = await store.createThread(userId);
    return c.json({ threadId: thread.id }, 201);
  });

  app.post("/api/chat", async (c) => {
    const userId = c.get("userId");
    const llm = resolveLlm();
    if (!llm) return c.json({ error: "assistant_not_configured" }, 503);
    // Acquire synchronously before the first await so concurrent requests
    // for this user cannot both pass the single-stream check.
    if (!streamGuard.acquire(userId)) {
      return c.json({ error: "chat_busy" }, 409);
    }
    const fail = (payload: { error: string }, status: 400 | 404 | 409) => {
      streamGuard.release(userId);
      return c.json(payload, status);
    };

    const body = await c.req
      .json<{
        threadId?: string;
        message?: string;
        retryMessageId?: string;
        today?: string;
        lang?: string;
      }>()
      .catch(() => ({}) as { threadId?: string; message?: string; retryMessageId?: string; today?: string; lang?: string });

    const today = validToday(body.today);
    const lang = langOf(body.lang);

    let threadId: string;
    if (body.threadId) {
      const owned = await store.getThread(userId, body.threadId);
      if (!owned) return fail({ error: "Thread not found" }, 404);
      threadId = owned.id;
    } else {
      const latest = await store.getLatestThread(userId);
      threadId = latest ? latest.id : (await store.createThread(userId)).id;
    }

    if (body.retryMessageId) {
      const messages = await store.listMessages(threadId, 100);
      const idx = messages.findIndex((m) => m.id === body.retryMessageId && m.role === "user");
      if (idx < 0) return fail({ error: "Message not found" }, 404);
      if (turnCompleted(messages.slice(idx + 1))) {
        return fail({ error: "Turn already completed" }, 409);
      }
    } else {
      const message = body.message?.trim() ?? "";
      if (!message) return fail({ error: "Message is required" }, 400);
      if (message.length > 2000) return fail({ error: "Message too long" }, 400);
      // A new message cancels any outstanding destructive confirmation.
      await store.discardPendingForThread(threadId);
      await store.addMessage(threadId, { role: "user", content: message });
    }

    const abort = new AbortController();
    return streamSSE(c, async (stream) => {
      stream.onAbort(() => abort.abort());
      const emit = async (e: ChatStreamEvent) => {
        await stream.writeSSE({ event: e.type, data: JSON.stringify(e) });
      };
      try {
        await emit({ type: "thread", threadId });
        await runChatTurn(
          { llm, svc, store },
          { userId, threadId, today, lang, emit, signal: abort.signal }
        );
      } finally {
        streamGuard.release(userId);
      }
    });
  });

  app.post("/api/chat/confirm", async (c) => {
    const userId = c.get("userId");
    const llm = resolveLlm();
    if (!llm) return c.json({ error: "assistant_not_configured" }, 503);
    if (!streamGuard.acquire(userId)) {
      return c.json({ error: "chat_busy" }, 409);
    }
    const fail = (payload: { error: string }, status: 400 | 409) => {
      streamGuard.release(userId);
      return c.json(payload, status);
    };

    const body = await c.req
      .json<{ pendingActionId?: string; approve?: boolean; today?: string; lang?: string }>()
      .catch(() => ({}) as { pendingActionId?: string; approve?: boolean; today?: string; lang?: string });
    if (!body.pendingActionId) return fail({ error: "pendingActionId is required" }, 400);

    const pending = await store.getPending(userId, body.pendingActionId);
    if (!pending) return fail({ error: "pending_expired" }, 409);
    if (isPendingExpired(pending, new Date())) {
      await store.consumePending(pending.id);
      return fail({ error: "pending_expired" }, 409);
    }

    const consumed = await store.consumePending(pending.id);
    if (!consumed) return fail({ error: "pending_expired" }, 409);

    const habitId = typeof pending.args.habitId === "string" ? pending.args.habitId : "";
    const name = typeof pending.args.name === "string" ? pending.args.name : habitId;
    let resultText: string;
    if (body.approve === true) {
      const deleted = habitId ? await svc.deleteHabit(userId, habitId) : false;
      resultText = deleted
        ? `[system note] The user confirmed the deletion on the confirmation card. Habit "${name}" (id ${habitId}) has been permanently deleted. Confirm this to the user briefly.`
        : `[system note] The user confirmed the deletion, but habit "${name}" (id ${habitId}) no longer existed, so nothing was deleted. Tell the user briefly.`;
    } else {
      resultText = `[system note] The user declined the deletion of habit "${name}" on the confirmation card. Nothing was deleted. Acknowledge briefly.`;
    }
    await store.addMessage(pending.threadId, {
      role: "user",
      content: "",
      toolMeta: { hidden: true, kind: "confirm_result", text: resultText },
    });

    const abort = new AbortController();
    const today = validToday(body.today);
    const lang = langOf(body.lang);
    return streamSSE(c, async (stream) => {
      stream.onAbort(() => abort.abort());
      const emit = async (e: ChatStreamEvent) => {
        await stream.writeSSE({ event: e.type, data: JSON.stringify(e) });
      };
      try {
        await emit({ type: "thread", threadId: pending.threadId });
        await runChatTurn(
          { llm, svc, store },
          { userId, threadId: pending.threadId, today, lang, emit, signal: abort.signal }
        );
      } finally {
        streamGuard.release(userId);
      }
    });
  });

  app.post("/api/chat/actions/:id/undo", async (c) => {
    const userId = c.get("userId");
    const action = await store.getAction(userId, c.req.param("id"));
    if (!action) return c.json({ error: "Not found" }, 404);
    if (action.undoneAt) {
      return c.json({ changed: false, summary: "Aksi ini sudah di-undo.", undone: true });
    }
    // Claim atomically before reversing: a concurrent undo loses here and
    // reports already-undone instead of reversing twice.
    const claimed = await store.claimAction(userId, action.id);
    if (!claimed) {
      return c.json({ changed: false, summary: "Aksi ini sudah di-undo.", undone: true });
    }
    try {
      const result = await applyUndo(
        { userId, kind: action.kind, payload: action.payload },
        svc
      );
      return c.json({ changed: result.changed, summary: result.summary, undone: true });
    } catch (err) {
      await store.releaseAction(action.id);
      throw err;
    }
  });

  return app;
}

export { isLlmConfigured };
