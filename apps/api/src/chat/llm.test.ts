import { describe, expect, test } from "bun:test";
import { createLlmClient, LlmError, type LlmToolDef } from "./llm";

const tools: LlmToolDef[] = [
  {
    name: "add_coins",
    description: "Add coins",
    parameters: {
      type: "object",
      properties: { habitId: { type: "string" }, count: { type: "number" } },
      required: ["habitId"],
    },
  },
];

function sseResponse(body: string): Response {
  return new Response(body, {
    status: 200,
    headers: { "content-type": "text/event-stream" },
  });
}

function stubFetch(handler: (url: string, init: RequestInit) => Response | Promise<Response>) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fn = async (url: unknown, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return handler(String(url), init ?? {});
  };
  return { fn: fn as unknown as typeof fetch, calls };
}

const config = { baseUrl: "https://llm.example/v1", apiKey: "k", model: "m" };

describe("responses mode", () => {
  test("streams text deltas to onText and returns full text", async () => {
    const body = [
      `data: {"type":"response.output_text.delta","delta":"Halo "}`,
      `data: {"type":"response.output_text.delta","delta":"dunia"}`,
      `data: {"type":"response.completed","response":{"output":[]}}`,
    ].join("\n\n");
    const { fn } = stubFetch(() => sseResponse(body));
    const client = createLlmClient({ ...config, mode: "responses" }, fn);
    const seen: string[] = [];
    const result = await client.runTurn(
      { instructions: "be nice", messages: [{ role: "user", content: "hi" }], tools },
      (t) => seen.push(t)
    );
    expect(seen).toEqual(["Halo ", "dunia"]);
    expect(result.text).toBe("Halo dunia");
    expect(result.toolCalls).toEqual([]);
  });

  test("assembles a function call whose arguments arrive in fragments", async () => {
    const body = [
      `data: {"type":"response.output_item.added","item":{"type":"function_call","id":"fc_1","call_id":"call_1","name":"add_coins","arguments":""}}`,
      `data: {"type":"response.function_call_arguments.delta","item_id":"fc_1","delta":"{\\"habitId\\":\\"h1\\","}`,
      `data: {"type":"response.function_call_arguments.delta","item_id":"fc_1","delta":"\\"count\\":3}"}`,
      `data: {"type":"response.function_call_arguments.done","item_id":"fc_1","arguments":"{\\"habitId\\":\\"h1\\",\\"count\\":3}"}`,
      `data: {"type":"response.completed","response":{"output":[{"type":"function_call","call_id":"call_1","name":"add_coins","arguments":"{\\"habitId\\":\\"h1\\",\\"count\\":3}"}]}}`,
    ].join("\n\n");
    const { fn } = stubFetch(() => sseResponse(body));
    const client = createLlmClient({ ...config, mode: "responses" }, fn);
    const result = await client.runTurn(
      { instructions: "", messages: [{ role: "user", content: "coin" }], tools },
      () => {}
    );
    expect(result.toolCalls).toEqual([
      { callId: "call_1", name: "add_coins", arguments: { habitId: "h1", count: 3 } },
    ]);
  });

  test("falls back to non-streaming JSON when streaming is rejected", async () => {
    const { fn, calls } = stubFetch((_url, init) => {
      const parsed = JSON.parse(String(init.body));
      if (parsed.stream) return new Response("no streaming", { status: 400 });
      return Response.json({
        output: [
          { type: "message", content: [{ type: "output_text", text: "siap" }] },
          {
            type: "function_call",
            call_id: "call_9",
            name: "add_coins",
            arguments: '{"habitId":"h2","count":1}',
          },
        ],
      });
    });
    const client = createLlmClient({ ...config, mode: "responses" }, fn);
    const result = await client.runTurn(
      { instructions: "", messages: [{ role: "user", content: "x" }], tools },
      () => {}
    );
    expect(calls.length).toBe(2);
    expect(result.text).toBe("siap");
    expect(result.toolCalls[0].callId).toBe("call_9");
  });
});

describe("chat mode", () => {
  test("assembles tool_calls fragments across chunks", async () => {
    const chunk = (delta: unknown, finish: unknown = null) =>
      `data: ${JSON.stringify({ choices: [{ delta, finish_reason: finish }] })}`;
    const body = [
      chunk({ content: "ok " }),
      chunk({ tool_calls: [{ index: 0, id: "c1", function: { name: "add_coins", arguments: '{"hab' } }] }),
      chunk({ tool_calls: [{ index: 0, function: { arguments: 'itId":"h7"}' } }] }),
      chunk({}, "tool_calls"),
      "data: [DONE]",
    ].join("\n\n");
    const { fn } = stubFetch(() => sseResponse(body));
    const client = createLlmClient({ ...config, mode: "chat" }, fn);
    const texts: string[] = [];
    const result = await client.runTurn(
      { instructions: "sys", messages: [{ role: "user", content: "x" }], tools },
      (t) => texts.push(t)
    );
    expect(result.text).toBe("ok ");
    expect(result.toolCalls).toEqual([
      { callId: "c1", name: "add_coins", arguments: { habitId: "h7" } },
    ]);
  });

  test("falls back to non-streaming JSON when streaming is rejected", async () => {
    const { fn } = stubFetch((_url, init) => {
      const parsed = JSON.parse(String(init.body));
      if (parsed.stream) return new Response("nope", { status: 400 });
      return Response.json({
        choices: [
          {
            message: {
              content: "halo",
              tool_calls: [
                { id: "c2", type: "function", function: { name: "add_coins", arguments: '{"habitId":"h3"}' } },
              ],
            },
          },
        ],
      });
    });
    const client = createLlmClient({ ...config, mode: "chat" }, fn);
    const result = await client.runTurn(
      { instructions: "", messages: [], tools },
      () => {}
    );
    expect(result.text).toBe("halo");
    expect(result.toolCalls[0]).toEqual({
      callId: "c2",
      name: "add_coins",
      arguments: { habitId: "h3" },
    });
  });

  test("non-2xx after fallback throws generic LlmError without upstream body", async () => {
    const { fn } = stubFetch(() => new Response("secret upstream detail", { status: 500 }));
    const client = createLlmClient({ ...config, mode: "chat" }, fn);
    const run = client.runTurn({ instructions: "", messages: [], tools }, () => {});
    await expect(run).rejects.toBeInstanceOf(LlmError);
    await expect(
      client.runTurn({ instructions: "", messages: [], tools }, () => {})
    ).rejects.toThrow(/failed/i);
    try {
      await client.runTurn({ instructions: "", messages: [], tools }, () => {});
      throw new Error("should have thrown");
    } catch (err) {
      expect(String(err)).not.toContain("secret upstream detail");
    }
  });

  test("an already-aborted caller signal stops the request immediately", async () => {
    const { fn } = stubFetch((_url, init) => {
      return new Promise<Response>((_resolve, reject) => {
        const signal = init.signal as AbortSignal;
        if (signal.aborted) reject(new DOMException("aborted", "AbortError"));
        signal.addEventListener("abort", () =>
          reject(new DOMException("aborted", "AbortError"))
        );
      }) as unknown as Response;
    });
    const client = createLlmClient({ ...config, mode: "responses", timeoutMs: 30_000 }, fn);
    const controller = new AbortController();
    controller.abort();
    const run = client.runTurn(
      { instructions: "", messages: [], tools, signal: controller.signal },
      () => {}
    );
    const outcome = await Promise.race([
      run.then(
        () => "resolved",
        () => "rejected"
      ),
      new Promise<string>((r) => setTimeout(() => r("hung"), 1000)),
    ]);
    expect(outcome).toBe("rejected");
  });

  test("malformed tool arguments surface as __malformed marker, not a crash", async () => {
    const body = `data: ${JSON.stringify({
      choices: [
        {
          delta: { tool_calls: [{ index: 0, id: "c9", function: { name: "add_coins", arguments: "{oops" } }] },
          finish_reason: "tool_calls",
        },
      ],
    })}\n\ndata: [DONE]`;
    const { fn } = stubFetch(() => sseResponse(body));
    const client = createLlmClient({ ...config, mode: "chat" }, fn);
    const result = await client.runTurn(
      { instructions: "", messages: [], tools },
      () => {}
    );
    expect(result.toolCalls[0].name).toBe("add_coins");
    expect(result.toolCalls[0].arguments).toEqual({ __malformed: "{oops" });
  });
});
