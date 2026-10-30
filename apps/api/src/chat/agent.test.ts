import { describe, expect, test } from "bun:test";
import { buildInstructions, runChatTurn, type ChatStreamEvent } from "./agent";
import type { LlmClient, LlmTurnInput, ToolCall } from "./llm";
import type { ChatStore, StoredAction, StoredMessage, StoredPending } from "./store";
import { makeFakeService } from "./tools.test";

class MemoryStore implements ChatStore {
  threads: { id: string; userId: string }[] = [];
  messages: StoredMessage[] = [];
  actions: StoredAction[] = [];
  pendings: StoredPending[] = [];
  private seq = 0;
  private next(prefix: string) {
    return `${prefix}_${++this.seq}`;
  }
  async getLatestThread(userId: string) {
    return this.threads.filter((t) => t.userId === userId).at(-1) ?? null;
  }
  async createThread(userId: string) {
    const t = { id: this.next("thread"), userId };
    this.threads.push(t);
    return t;
  }
  async getThread(userId: string, threadId: string) {
    return this.threads.find((t) => t.id === threadId && t.userId === userId) ?? null;
  }
  async addMessage(threadId: string, input: Parameters<ChatStore["addMessage"]>[1]) {
    const msg: StoredMessage = {
      id: this.next("msg"),
      threadId,
      createdAt: new Date(),
      ...input,
      toolName: input.toolName ?? null,
      toolMeta: input.toolMeta ?? null,
    };
    this.messages.push(msg);
    return msg;
  }
  async listMessages(threadId: string) {
    return this.messages.filter((m) => m.threadId === threadId);
  }
  async saveAction(userId: string, threadId: string, undo: { kind: string; payload: Record<string, unknown> }) {
    const action: StoredAction = {
      id: this.next("act"),
      userId,
      threadId,
      kind: undo.kind,
      payload: undo.payload,
      undoneAt: null,
    };
    this.actions.push(action);
    return action;
  }
  async getAction(userId: string, id: string) {
    return this.actions.find((a) => a.id === id && a.userId === userId) ?? null;
  }
  async markActionUndone(id: string) {
    const a = this.actions.find((x) => x.id === id);
    if (a) a.undoneAt = new Date();
  }
  async listActions(userId: string, threadId: string) {
    return this.actions.filter((a) => a.userId === userId && a.threadId === threadId);
  }
  async createPending(userId: string, threadId: string, toolName: string, args: Record<string, unknown>) {
    const p: StoredPending = {
      id: this.next("pen"),
      userId,
      threadId,
      toolName,
      args,
      expiresAt: new Date(Date.now() + 600_000),
    };
    this.pendings.push(p);
    return p;
  }
  async getPending(userId: string, id: string) {
    return this.pendings.find((p) => p.id === id && p.userId === userId) ?? null;
  }
  async consumePending(id: string) {
    const i = this.pendings.findIndex((p) => p.id === id);
    if (i < 0) return false;
    this.pendings.splice(i, 1);
    return true;
  }
  async discardPendingForThread(threadId: string) {
    this.pendings = this.pendings.filter((p) => p.threadId !== threadId);
  }
}

function scriptedLlm(script: { text?: string; toolCalls?: ToolCall[] }[]): LlmClient & { inputs: LlmTurnInput[] } {
  const inputs: LlmTurnInput[] = [];
  let i = 0;
  return {
    inputs,
    async runTurn(input, onText) {
      inputs.push(input);
      const step = script[Math.min(i++, script.length - 1)] ?? { text: "" };
      if (step.text) onText(step.text);
      return { text: step.text ?? "", toolCalls: step.toolCalls ?? [] };
    },
  };
}

async function setup(script: { text?: string; toolCalls?: ToolCall[] }[]) {
  const store = new MemoryStore();
  const svc = makeFakeService([
    { id: "jar1", userId: "u1", name: "Push-up", type: "JAR", entries: new Map([["2026-10-30", 2]]) },
  ]);
  const thread = await store.createThread("u1");
  await store.addMessage(thread.id, { role: "user", content: "halo" });
  const events: ChatStreamEvent[] = [];
  const llm = scriptedLlm(script);
  return { store, svc, thread, events, llm };
}

describe("runChatTurn", () => {
  test("stats question: tool events in order, then text, then done; messages persisted", async () => {
    const { store, svc, thread, events, llm } = await setup([
      { toolCalls: [{ callId: "c1", name: "get_dashboard", arguments: {} }] },
      { text: "Streak kamu bagus!" },
    ]);
    await runChatTurn(
      { llm, svc, store },
      { userId: "u1", threadId: thread.id, today: "2026-10-30", lang: "id", emit: (e) => {
        events.push(e);
      } }
    );
    const types = events.map((e) => e.type);
    expect(types).toEqual(["tool_start", "tool_result", "text_delta", "done"]);
    const toolMsg = store.messages.find((m) => m.role === "tool");
    expect(toolMsg?.toolName).toBe("get_dashboard");
    const final = store.messages.at(-1);
    expect(final?.role).toBe("assistant");
    expect(final?.content).toBe("Streak kamu bagus!");
  });

  test("create flow: tool_result carries an undo action id", async () => {
    const { store, svc, thread, events, llm } = await setup([
      { toolCalls: [{ callId: "c1", name: "create_habit", arguments: { name: "Meditasi", type: "CALENDAR" } }] },
      { text: "Sudah kubuat!" },
    ]);
    await runChatTurn(
      { llm, svc, store },
      { userId: "u1", threadId: thread.id, today: "2026-10-30", lang: "id", emit: (e) => {
        events.push(e);
      } }
    );
    const result = events.find((e) => e.type === "tool_result");
    expect(result?.type === "tool_result" && result.undoActionId).toBeTruthy();
    expect(store.actions.length).toBe(1);
    expect(store.actions[0].kind).toBe("create");
  });

  test("delete flow: confirm_required emitted, habit not deleted, pending stored", async () => {
    const { store, svc, thread, events, llm } = await setup([
      { toolCalls: [{ callId: "c1", name: "delete_habit", arguments: { habitId: "jar1" } }] },
      { text: "Yakin mau hapus Push-up? Ini permanen ya." },
    ]);
    await runChatTurn(
      { llm, svc, store },
      { userId: "u1", threadId: thread.id, today: "2026-10-30", lang: "id", emit: (e) => {
        events.push(e);
      } }
    );
    expect(events.some((e) => e.type === "confirm_required")).toBe(true);
    expect(svc.habits.some((h) => h.id === "jar1")).toBe(true);
    expect(store.pendings.length).toBe(1);
  });

  test("LLM that always requests tools stops at the step cap and still emits done", async () => {
    const loop: { toolCalls: ToolCall[] } = {
      toolCalls: [{ callId: "cx", name: "list_habits", arguments: {} }],
    };
    const { store, svc, thread, events, llm } = await setup(
      Array.from({ length: 12 }, () => loop)
    );
    await runChatTurn(
      { llm, svc, store },
      { userId: "u1", threadId: thread.id, today: "2026-10-30", lang: "id", emit: (e) => {
        events.push(e);
      } }
    );
    expect(events.at(-1)?.type).toBe("done");
    expect(llm.inputs.length).toBeLessThanOrEqual(7);
  });

  test("malformed tool call becomes a tool error fed back, turn completes", async () => {
    const { store, svc, thread, events, llm } = await setup([
      { toolCalls: [{ callId: "c1", name: "add_coins", arguments: { __malformed: "{oops" } }] },
      { text: "Maaf, tadi gagal." },
    ]);
    await runChatTurn(
      { llm, svc, store },
      { userId: "u1", threadId: thread.id, today: "2026-10-30", lang: "id", emit: (e) => {
        events.push(e);
      } }
    );
    const result = events.find((e) => e.type === "tool_result");
    expect(result?.type === "tool_result" && result.ok).toBe(false);
    expect(events.at(-1)?.type).toBe("done");
    // second LLM call must have received the tool error in history
    const secondInput = llm.inputs[1];
    expect(secondInput.messages.some((m) => m.role === "tool" && m.content.includes("false"))).toBe(true);
  });
});

describe("buildInstructions", () => {
  test("contains grounding and ambiguity rules", () => {
    const text = buildInstructions({ today: "2026-10-30", lang: "id" });
    expect(text).toMatch(/never invent/i);
    expect(text).toContain("list_habits");
    expect(text).toMatch(/ambiguous/i);
    expect(text).toContain("2026-10-30");
  });
});
