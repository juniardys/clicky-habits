import { describe, expect, test } from "bun:test";
import { parseSse, toMessageViews, type StoredMessage } from "./chat";

describe("parseSse", () => {
  test("event split mid-JSON across chunks completes on the second chunk", () => {
    const wire = `event: tool_start\ndata: {"type":"tool_start","callId":"c1","tool":"add_coins","label":"Masukkan 1 koin"}\n\n`;
    const first = parseSse("", wire.slice(0, 30));
    expect(first.events).toEqual([]);
    const second = parseSse(first.rest, wire.slice(30));
    expect(second.events.length).toBe(1);
    expect(second.events[0].type).toBe("tool_start");
    expect(second.rest).toBe("");
  });

  test("multiple events in one chunk all parse", () => {
    const wire =
      `event: text_delta\ndata: {"type":"text_delta","text":"Halo"}\n\n` +
      `event: done\ndata: {"type":"done","messageId":"m1"}\n\n`;
    const { events, rest } = parseSse("", wire);
    expect(events.map((e) => e.type)).toEqual(["text_delta", "done"]);
    expect(rest).toBe("");
  });

  test("unknown event names are skipped", () => {
    const wire =
      `event: mystery\ndata: {"type":"mystery","x":1}\n\n` +
      `event: text_delta\ndata: {"type":"text_delta","text":"hi"}\n\n`;
    const { events } = parseSse("", wire);
    expect(events.length).toBe(1);
    expect(events[0].type).toBe("text_delta");
  });
});

function row(partial: Partial<StoredMessage> & { role: string }): StoredMessage {
  return {
    id: Math.random().toString(36).slice(2),
    content: "",
    toolName: null,
    toolMeta: null,
    createdAt: "2026-10-30T00:00:00.000Z",
    ...partial,
  };
}

describe("toMessageViews", () => {
  test("groups tool rows under their assistant turn and drops hidden rows", () => {
    const views = toMessageViews([
      row({ role: "user", content: "statistikku gimana?" }),
      row({
        role: "assistant",
        content: "",
        toolMeta: { toolCalls: [{ callId: "c1", name: "get_dashboard", arguments: {} }] },
      }),
      row({
        role: "tool",
        toolName: "get_dashboard",
        content: '{"ok":true}',
        toolMeta: { callId: "c1", label: "Lihat statistik kamu", ok: true, summary: "3 habit" },
      }),
      row({ role: "assistant", content: "Streak kamu 5 hari!" }),
      row({ role: "user", content: "", toolMeta: { hidden: true, kind: "confirm_result", text: "x" } }),
    ]);
    expect(views.length).toBe(2);
    expect(views[0].role).toBe("user");
    expect(views[1].content).toBe("Streak kamu 5 hari!");
    expect(views[1].toolCards.length).toBe(1);
    expect(views[1].toolCards[0].status).toBe("ok");
  });

  test("blocks keep narration before tools and answer after tools split", () => {
    const views = toMessageViews([
      row({ role: "user", content: "statistikku gimana?" }),
      row({
        role: "assistant",
        content: "Siap, aku intip dulu datamu ya!",
        toolMeta: {
          toolCalls: [
            { callId: "c1", name: "get_dashboard", arguments: {} },
            { callId: "c2", name: "list_habits", arguments: {} },
          ],
        },
      }),
      row({
        role: "tool",
        toolName: "get_dashboard",
        content: '{"ok":true}',
        toolMeta: { callId: "c1", label: "Lihat statistik kamu", ok: true, summary: "1 habit" },
      }),
      row({
        role: "tool",
        toolName: "list_habits",
        content: '{"ok":true}',
        toolMeta: { callId: "c2", label: "Lihat daftar habit kamu", ok: true, summary: "1 habit ditemukan." },
      }),
      row({ role: "assistant", content: "Kamu punya 1 habit!" }),
    ]);
    const view = views[1];
    // concatenated content kept for retry detection / back-compat
    expect(view.content).toBe("Siap, aku intip dulu datamu ya!Kamu punya 1 habit!");
    expect(view.blocks).toEqual([
      { type: "text", text: "Siap, aku intip dulu datamu ya!" },
      { type: "tools", callIds: ["c1", "c2"] },
      { type: "text", text: "Kamu punya 1 habit!" },
    ]);
  });

  test("reconstructs an undone card from the actions list", () => {
    const views = toMessageViews(
      [
        row({ role: "user", content: "catat push-up" }),
        row({
          role: "assistant",
          toolMeta: { toolCalls: [{ callId: "c1", name: "add_coins", arguments: {} }] },
        }),
        row({
          role: "tool",
          toolName: "add_coins",
          content: "{}",
          toolMeta: { callId: "c1", label: "Masukkan 1 koin", ok: true, summary: "+1", undoActionId: "a1" },
        }),
        row({ role: "assistant", content: "Clink!" }),
      ],
      [{ id: "a1", undone: true }]
    );
    expect(views[1].toolCards[0].status).toBe("undone");
    expect(views[1].toolCards[0].undoActionId).toBe("a1");
  });

  test("failed tool card shows error status; interrupted assistant is flagged", () => {
    const views = toMessageViews([
      row({ role: "user", content: "halo" }),
      row({
        role: "assistant",
        toolMeta: { toolCalls: [{ callId: "c1", name: "add_coins", arguments: {} }] },
      }),
      row({
        role: "tool",
        toolName: "add_coins",
        content: "{}",
        toolMeta: { callId: "c1", label: "Masukkan koin", ok: false, summary: "Habit tidak ditemukan." },
      }),
      row({ role: "assistant", content: "", toolMeta: { interrupted: true } }),
    ]);
    expect(views[1].toolCards[0].status).toBe("error");
    expect(views[1].interrupted).toBe(true);
  });

  test("interrupted attempt and its retry answer stay separate views; retry is not offered twice", () => {
    const views = toMessageViews([
      row({ role: "user", content: "halo" }),
      row({ role: "assistant", content: "Sebentar ya", toolMeta: { interrupted: true } }),
      row({ role: "assistant", content: "Jawaban lengkap." }),
    ]);
    const assistants = views.filter((v) => v.role === "assistant");
    expect(assistants.length).toBe(2);
    expect(assistants[0].interrupted).toBe(true);
    expect(assistants[0].retryMessageId).toBeUndefined();
    expect(assistants[1].content).toBe("Jawaban lengkap.");
  });

  test("interrupted attempt without a retry keeps its retry target", () => {
    const views = toMessageViews([
      row({ role: "user", content: "halo" }),
      row({ role: "assistant", content: "", toolMeta: { interrupted: true } }),
    ]);
    const assistant = views.find((v) => v.role === "assistant");
    expect(assistant?.retryMessageId).toBe(views[0].id);
  });

  test("confirmation card resolves to approved when a hidden confirm result follows", () => {
    const views = toMessageViews([
      row({ role: "user", content: "hapus push-up" }),
      row({
        role: "assistant",
        toolMeta: { toolCalls: [{ callId: "c1", name: "delete_habit", arguments: {} }] },
      }),
      row({
        role: "tool",
        toolName: "delete_habit",
        content: '{"ok":true,"data":{"name":"Push-up"}}',
        toolMeta: { callId: "c1", label: "Hapus habit", ok: true, summary: "Menunggu konfirmasi", pendingActionId: "p1" },
      }),
      row({ role: "assistant", content: "Yakin?" }),
      row({
        role: "user",
        content: "",
        toolMeta: { hidden: true, kind: "confirm_result", text: "[system note] The user confirmed the deletion." },
      }),
      row({ role: "assistant", content: "Sudah dihapus." }),
    ]);
    expect(views[1].confirm?.pendingActionId).toBe("p1");
    expect(views[1].confirm?.state).toBe("approved");
    expect(views[1].confirm?.detail).toBe("Push-up");
  });
});
