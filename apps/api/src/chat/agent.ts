import type { HabitService } from "../habits-service";
import { habitService } from "../habits-service";
import type { LlmClient, LlmMessage, ToolCall } from "./llm";
import type { ChatStore, StoredMessage } from "./store";
import { describeToolCall, executeTool, toolDefs, type ToolContext } from "./tools";

export type ChatStreamEvent =
  | { type: "thread"; threadId: string }
  | { type: "text_delta"; text: string }
  | { type: "tool_start"; callId: string; tool: string; label: string }
  | { type: "tool_result"; callId: string; tool: string; ok: boolean; summary: string; undoActionId?: string }
  | { type: "confirm_required"; pendingActionId: string; tool: string; label: string; detail: string; expiresAt: string }
  | { type: "done"; messageId: string }
  | { type: "error"; message: string };

export const MAX_TOOL_STEPS = 6;
const HISTORY_LIMIT = 20;

export function buildInstructions(opts: { today: string; lang: "en" | "id" }): string {
  return [
    "You are Mochi, a warm, playful, brief habit buddy inside the Clicky Habits app. You speak like a supportive friend, celebrate small wins, and never lecture.",
    `Today's date for the user is ${opts.today}. The user's app language is ${opts.lang === "id" ? "Indonesian" : "English"}; reply in the language the user writes in.`,
    "Grounding rules (must follow):",
    "- Never invent numbers. Any statistic, total, streak, or count you mention must come from a tool result in this conversation.",
    "- To act on a habit the user names, call list_habits first when you do not already know its exact habit id from this conversation.",
    "- If a named habit is ambiguous (multiple habits could match), ask the user which one, listing the candidate names. Never guess silently.",
    "- When creating a habit, only call create_habit when the tracker type is clear (CALENDAR = once a day cross-off, JAR = repeatable coin counting). If unclear, ask which type they want.",
    "- delete_habit never deletes immediately; it asks the user to confirm on a card. When you request it, tell the user deletion is permanent and cannot be undone.",
    "- After a successful write, briefly state exactly what was recorded. After a failed tool, explain plainly and offer the correction (for example, the right habit or the right action for its tracker type).",
    "- Keep answers short: a few sentences, no long lists unless the user asks for details.",
  ].join("\n");
}

export function buildLlmHistory(messages: StoredMessage[]): LlmMessage[] {
  const mapped: LlmMessage[] = [];
  for (const m of messages) {
    const meta = m.toolMeta ?? {};
    if (meta.hidden === true) {
      const text = typeof meta.text === "string" ? meta.text : m.content;
      if (text) mapped.push({ role: "user", content: text });
      continue;
    }
    if (m.role === "user") {
      if (m.content) mapped.push({ role: "user", content: m.content });
    } else if (m.role === "assistant") {
      const rawCalls = meta.toolCalls;
      if (Array.isArray(rawCalls) && rawCalls.length > 0) {
        mapped.push({
          role: "assistant",
          content: m.content,
          toolCalls: rawCalls as ToolCall[],
        });
      } else if (m.content) {
        mapped.push({ role: "assistant", content: m.content });
      }
    } else if (m.role === "tool") {
      mapped.push({
        role: "tool",
        content: m.content,
        toolCallId: typeof meta.callId === "string" ? meta.callId : "",
      });
    }
  }
  // Repair: an aborted/failed batch can persist an assistant tool-call row
  // whose tool results never arrived. Providers reject unpaired calls, so
  // keep only calls that have a following tool result, and drop tool
  // results whose call was pruned.
  const paired: LlmMessage[] = [];
  let lastKeptCallIds = new Set<string>();
  for (let i = 0; i < mapped.length; i++) {
    const m = mapped[i];
    if (m.role === "assistant" && m.toolCalls?.length) {
      const resultIds = new Set<string>();
      for (let j = i + 1; j < mapped.length && mapped[j].role === "tool"; j++) {
        if (mapped[j].toolCallId) resultIds.add(mapped[j].toolCallId as string);
      }
      const kept = m.toolCalls.filter((c) => resultIds.has(c.callId));
      lastKeptCallIds = new Set(kept.map((c) => c.callId));
      if (kept.length > 0) {
        paired.push({ ...m, toolCalls: kept });
      } else if (m.content) {
        paired.push({ role: "assistant", content: m.content });
      }
      continue;
    }
    if (m.role === "tool") {
      if (m.toolCallId && lastKeptCallIds.has(m.toolCallId)) paired.push(m);
      continue;
    }
    paired.push(m);
  }

  const sliced = paired.slice(-HISTORY_LIMIT);
  while (sliced.length > 0 && sliced[0].role === "tool") sliced.shift();
  return sliced;
}

export function turnCompleted(after: StoredMessage[]): boolean {
  return after.some((m) => m.role === "assistant" && m.toolMeta?.final === true);
}

export interface AgentDeps {
  llm: LlmClient;
  svc?: HabitService;
  store: ChatStore;
}

export interface AgentTurnOpts {
  userId: string;
  threadId: string;
  today: string;
  lang: "en" | "id";
  emit: (event: ChatStreamEvent) => void | Promise<void>;
  signal?: AbortSignal;
}

export async function runChatTurn(deps: AgentDeps, opts: AgentTurnOpts): Promise<void> {
  const svc = deps.svc ?? habitService;
  const { store } = deps;
  const ctx: ToolContext = {
    userId: opts.userId,
    threadId: opts.threadId,
    today: opts.today,
    lang: opts.lang,
  };
  const emit = async (e: ChatStreamEvent) => {
    try {
      await opts.emit(e);
    } catch {
      // client went away; persistence continues
    }
  };

  const stored = await store.listMessages(opts.threadId, 100);
  const history = buildLlmHistory(stored);
  const instructions = buildInstructions({ today: opts.today, lang: opts.lang });

  let streamedText = "";
  let forceNextText = false;
  try {
    for (let step = 0; step <= MAX_TOOL_STEPS; step++) {
      if (opts.signal?.aborted) throw new Error("aborted");
      const forceText = step === MAX_TOOL_STEPS || forceNextText;
      streamedText = "";
      const result = await deps.llm.runTurn(
        { instructions, messages: history, tools: forceText ? [] : toolDefs, signal: opts.signal },
        (text) => {
          streamedText += text;
          void emit({ type: "text_delta", text });
        }
      );
      const finalText = result.text || streamedText;

      if (result.toolCalls.length === 0 || forceText) {
        if (opts.signal?.aborted) throw new Error("aborted");
        const msg = await store.addMessage(opts.threadId, {
          role: "assistant",
          content: finalText,
          toolMeta: { final: true },
        });
        await emit({ type: "done", messageId: msg.id });
        return;
      }

      await store.addMessage(opts.threadId, {
        role: "assistant",
        content: finalText,
        toolMeta: { toolCalls: result.toolCalls },
      });
      history.push({ role: "assistant", content: finalText, toolCalls: result.toolCalls });

      let batchPending = false;
      for (const call of result.toolCalls) {
        if (opts.signal?.aborted) throw new Error("aborted");
        const label = await describeToolCall(call, ctx, svc);
        await emit({ type: "tool_start", callId: call.callId, tool: call.name, label });
        const outcome = await executeTool(call, ctx, svc);

        let undoActionId: string | undefined;
        if (outcome.undo) {
          const action = await store.saveAction(opts.userId, opts.threadId, outcome.undo);
          undoActionId = action.id;
        }
        let pendingActionId: string | undefined;
        if (outcome.pendingDelete) {
          batchPending = true;
          // One pending action per thread: a new request replaces the old.
          await store.discardPendingForThread(opts.threadId);
          const pending = await store.createPending(opts.userId, opts.threadId, call.name, {
            ...call.arguments,
            habitId: outcome.pendingDelete.habitId,
            name: outcome.pendingDelete.name,
          });
          pendingActionId = pending.id;
          await emit({
            type: "confirm_required",
            pendingActionId: pending.id,
            tool: call.name,
            label,
            detail: outcome.pendingDelete.name,
            expiresAt: pending.expiresAt.toISOString(),
          });
        }

        const toolContent = JSON.stringify({
          ok: outcome.ok,
          summary: outcome.summary,
          data: outcome.data ?? null,
          ...(outcome.pendingDelete ? { status: "pending_confirmation" } : {}),
        });
        await store.addMessage(opts.threadId, {
          role: "tool",
          content: toolContent,
          toolName: call.name,
          toolMeta: {
            callId: call.callId,
            label,
            ok: outcome.ok,
            summary: outcome.summary,
            ...(undoActionId ? { undoActionId } : {}),
            ...(pendingActionId ? { pendingActionId } : {}),
          },
        });
        await emit({
          type: "tool_result",
          callId: call.callId,
          tool: call.name,
          ok: outcome.ok,
          summary: outcome.summary,
          ...(undoActionId ? { undoActionId } : {}),
        });
        history.push({ role: "tool", content: toolContent, toolCallId: call.callId });
      }
      // A confirmation request ends tool use: the next call is text-only so
      // Mochi asks for confirmation instead of chaining more actions.
      if (batchPending) forceNextText = true;
    }
  } catch (err) {
    if (opts.signal?.aborted || (err instanceof Error && err.message === "aborted")) {
      await store.addMessage(opts.threadId, {
        role: "assistant",
        content: streamedText,
        toolMeta: { interrupted: true },
      });
      return;
    }
    console.error("chat turn failed:", err);
    const message =
      opts.lang === "id"
        ? "Maaf, Mochi lagi bermasalah. Coba lagi sebentar ya."
        : "Sorry, Mochi hit a problem. Please try again in a moment.";
    await store.addMessage(opts.threadId, {
      role: "assistant",
      content: streamedText,
      toolMeta: { error: true },
    });
    await emit({ type: "error", message });
  }
}
