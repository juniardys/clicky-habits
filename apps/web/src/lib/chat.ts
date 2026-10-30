import { API_URL } from "./config";

export type ChatStreamEvent =
  | { type: "thread"; threadId: string }
  | { type: "text_delta"; text: string }
  | { type: "tool_start"; callId: string; tool: string; label: string }
  | { type: "tool_result"; callId: string; tool: string; ok: boolean; summary: string; undoActionId?: string }
  | { type: "confirm_required"; pendingActionId: string; tool: string; label: string; detail: string; expiresAt: string }
  | { type: "done"; messageId: string }
  | { type: "error"; message: string };

const KNOWN_EVENTS = new Set([
  "thread",
  "text_delta",
  "tool_start",
  "tool_result",
  "confirm_required",
  "done",
  "error",
]);

export interface StoredMessage {
  id: string;
  threadId?: string;
  role: string;
  content: string;
  toolName: string | null;
  toolMeta: Record<string, unknown> | null;
  createdAt: string;
}

export interface ToolCardData {
  callId: string;
  tool: string;
  label: string;
  status: "running" | "ok" | "error" | "undone";
  summary?: string;
  undoActionId?: string;
}

export interface ConfirmData {
  pendingActionId: string;
  label: string;
  detail: string;
  state: "pending" | "approved" | "declined" | "expired" | "cancelled";
}

/**
 * Chronological layout of an assistant turn: text written before tools,
 * the tool batch, then the answer that used the tool results.
 */
export type ChatBlock = { type: "text"; text: string } | { type: "tools"; callIds: string[] };

export interface ChatMessageView {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolCards: ToolCardData[];
  blocks?: ChatBlock[];
  confirm?: ConfirmData;
  interrupted?: boolean;
  error?: boolean;
  retryMessageId?: string;
}

export class ChatApiError extends Error {
  code: string;
  status: number;
  constructor(code: string, status: number) {
    super(code);
    this.code = code;
    this.status = status;
  }
}

export function parseSse(
  buffer: string,
  chunk: string
): { events: ChatStreamEvent[]; rest: string } {
  const combined = buffer + chunk;
  const blocks = combined.split("\n\n");
  const rest = blocks.pop() ?? "";
  const events: ChatStreamEvent[] = [];
  for (const block of blocks) {
    let data = "";
    for (const line of block.split("\n")) {
      if (line.startsWith("data:")) data += line.slice(5).trim();
    }
    if (!data) continue;
    try {
      const parsed = JSON.parse(data) as ChatStreamEvent;
      if (parsed && typeof parsed === "object" && KNOWN_EVENTS.has(parsed.type)) {
        events.push(parsed);
      }
    } catch {
      // partial or non-JSON payload; ignore
    }
  }
  return { events, rest };
}

async function streamPost(
  path: string,
  body: Record<string, unknown>,
  onEvent: (e: ChatStreamEvent) => void,
  signal?: AbortSignal
): Promise<void> {
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new ChatApiError(data.error ?? `HTTP ${res.status}`, res.status);
  }
  if (!res.body) return;
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    const parsed = parseSse(buffer, decoder.decode(value, { stream: true }));
    buffer = parsed.rest;
    for (const e of parsed.events) onEvent(e);
  }
  if (buffer.trim()) {
    const parsed = parseSse("", buffer + "\n\n");
    for (const e of parsed.events) onEvent(e);
  }
}

export interface ChatThreadResponse {
  threadId: string | null;
  messages: StoredMessage[];
  actions: { id: string; undone: boolean }[];
}

export const chatApi = {
  async getThread(): Promise<ChatThreadResponse> {
    const res = await fetch(`${API_URL}/chat/thread`, { credentials: "include" });
    if (!res.ok) throw new ChatApiError(`HTTP ${res.status}`, res.status);
    return res.json() as Promise<ChatThreadResponse>;
  },
  async newThread(): Promise<{ threadId: string }> {
    const res = await fetch(`${API_URL}/chat/threads`, {
      method: "POST",
      credentials: "include",
    });
    if (!res.ok) throw new ChatApiError(`HTTP ${res.status}`, res.status);
    return res.json() as Promise<{ threadId: string }>;
  },
  sendMessage: (
    body: { threadId?: string; message?: string; retryMessageId?: string; today: string; lang: string },
    onEvent: (e: ChatStreamEvent) => void,
    signal?: AbortSignal
  ) => streamPost("/chat", body, onEvent, signal),
  confirm: (
    body: { pendingActionId: string; approve: boolean; today: string; lang: string },
    onEvent: (e: ChatStreamEvent) => void,
    signal?: AbortSignal
  ) => streamPost("/chat/confirm", body, onEvent, signal),
  async undo(actionId: string): Promise<{ changed: boolean; summary: string; undone: boolean }> {
    const res = await fetch(`${API_URL}/chat/actions/${actionId}/undo`, {
      method: "POST",
      credentials: "include",
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      throw new ChatApiError(data.error ?? `HTTP ${res.status}`, res.status);
    }
    return res.json();
  },
};

const HABITS_CHANGED = "clicky:habits-changed";

export function notifyHabitsChanged(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(HABITS_CHANGED));
  }
}

export function onHabitsChanged(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = () => cb();
  window.addEventListener(HABITS_CHANGED, handler);
  return () => window.removeEventListener(HABITS_CHANGED, handler);
}

export function toMessageViews(
  rows: StoredMessage[],
  actions: { id: string; undone: boolean }[] = []
): ChatMessageView[] {
  const undone = new Set(actions.filter((a) => a.undone).map((a) => a.id));
  const views: ChatMessageView[] = [];
  let current: ChatMessageView | null = null;
  let lastUserId: string | undefined;
  let lastConfirmView: ChatMessageView | null = null;

  const ensureAssistant = (id: string): ChatMessageView => {
    if (!current) {
      current = { id, role: "assistant", content: "", toolCards: [] };
      views.push(current);
    }
    return current;
  };

  for (const row of rows) {
    const meta = row.toolMeta ?? {};
    if (meta.hidden === true) {
      if (lastConfirmView?.confirm && lastConfirmView.confirm.state === "pending") {
        const text = typeof meta.text === "string" ? meta.text : "";
        lastConfirmView.confirm = {
          ...lastConfirmView.confirm,
          state: /declined/i.test(text) ? "declined" : "approved",
        };
      }
      continue;
    }
    if (row.role === "user") {
      current = null;
      lastUserId = row.id;
      views.push({ id: row.id, role: "user", content: row.content, toolCards: [] });
      continue;
    }
    if (row.role === "assistant") {
      const view = ensureAssistant(row.id);
      if (row.content) {
        view.content += row.content;
        const blocks = (view.blocks ??= []);
        const last = blocks[blocks.length - 1];
        if (last?.type === "text") last.text += row.content;
        else blocks.push({ type: "text", text: row.content });
      }
      // A narration row carries its tool calls: anchor the tools block here.
      const rawCalls = meta.toolCalls;
      if (Array.isArray(rawCalls) && rawCalls.length > 0) {
        const blocks = (view.blocks ??= []);
        const last = blocks[blocks.length - 1];
        if (last?.type !== "tools") blocks.push({ type: "tools", callIds: [] });
      }
      if (meta.interrupted === true) view.interrupted = true;
      if (meta.error === true) view.error = true;
      if ((view.interrupted || view.error) && lastUserId) view.retryMessageId = lastUserId;
      // A failed/interrupted attempt closes the turn: a retry's answer is a
      // separate view, not a concatenation onto the failed text.
      if (view.interrupted || view.error) current = null;
      continue;
    }
    if (row.role === "tool") {
      const view = ensureAssistant(row.id);
      const callId = typeof meta.callId === "string" ? meta.callId : row.id;
      const blocks = (view.blocks ??= []);
      const lastBlock = blocks[blocks.length - 1];
      if (lastBlock?.type === "tools") {
        if (!lastBlock.callIds.includes(callId)) lastBlock.callIds.push(callId);
      } else {
        blocks.push({ type: "tools", callIds: [callId] });
      }
      const undoActionId = typeof meta.undoActionId === "string" ? meta.undoActionId : undefined;
      const ok = meta.ok === true;
      view.toolCards.push({
        callId,
        tool: row.toolName ?? "",
        label: typeof meta.label === "string" ? meta.label : (row.toolName ?? ""),
        status: !ok ? "error" : undoActionId && undone.has(undoActionId) ? "undone" : "ok",
        summary: typeof meta.summary === "string" ? meta.summary : undefined,
        undoActionId,
      });
      if (typeof meta.pendingActionId === "string") {
        let detail = "";
        try {
          const parsed = JSON.parse(row.content) as { data?: { name?: string } };
          detail = parsed?.data?.name ?? "";
        } catch {
          detail = "";
        }
        view.confirm = {
          pendingActionId: meta.pendingActionId,
          label: typeof meta.label === "string" ? meta.label : "",
          detail,
          state: "pending",
        };
        lastConfirmView = view;
      }
    }
  }

  // Once a later assistant answer exists in the same turn, the interrupted
  // attempt before it has already been retried - don't offer Retry again.
  let laterCompleted = false;
  for (let i = views.length - 1; i >= 0; i--) {
    const v = views[i];
    if (v.role === "user") {
      laterCompleted = false;
      continue;
    }
    if (laterCompleted && v.retryMessageId) delete v.retryMessageId;
    if (v.content.trim() && !v.interrupted && !v.error) laterCompleted = true;
  }
  return views;
}
