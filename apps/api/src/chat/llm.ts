export interface ToolCall {
  callId: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface LlmToolDef {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface LlmMessage {
  role: "user" | "assistant" | "tool";
  content: string;
  toolCallId?: string;
  toolCalls?: ToolCall[];
}

export interface LlmTurnInput {
  instructions: string;
  messages: LlmMessage[];
  tools: LlmToolDef[];
}

export interface LlmClient {
  runTurn(
    input: LlmTurnInput,
    onText: (text: string) => void
  ): Promise<{ text: string; toolCalls: ToolCall[] }>;
}

export class LlmError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LlmError";
  }
}

export interface LlmConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  mode: "responses" | "chat";
  timeoutMs?: number;
}

function parseArguments(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return { __malformed: raw };
  } catch {
    return { __malformed: raw };
  }
}

/** Yields parsed JSON payloads of an SSE body (lines starting with `data:`). */
async function* ssePayloads(body: ReadableStream<Uint8Array>): AsyncGenerator<unknown> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 1);
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (!data || data === "[DONE]") continue;
      try {
        yield JSON.parse(data) as unknown;
      } catch {
        // ignore keep-alive / non-JSON lines
      }
    }
  }
}

type FetchFn = typeof fetch;

abstract class BaseClient implements LlmClient {
  protected constructor(
    protected config: LlmConfig,
    protected fetchFn: FetchFn
  ) {}

  protected async request(body: Record<string, unknown>): Promise<Response> {
    const timeout = this.config.timeoutMs ?? 30_000;
    const url = this.endpoint();
    const doFetch = (payload: Record<string, unknown>) =>
      this.fetchFn(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(timeout),
      });

    let res: Response;
    try {
      res = await doFetch({ ...body, stream: true });
    } catch {
      throw new LlmError("LLM provider request failed");
    }
    if (res.ok) return res;

    // Streaming rejected: one non-streaming retry.
    try {
      const retry = await doFetch({ ...body, stream: false });
      if (!retry.ok) throw new LlmError(`LLM provider request failed (status ${retry.status})`);
      return retry;
    } catch (err) {
      if (err instanceof LlmError) throw err;
      throw new LlmError("LLM provider request failed");
    }
  }

  protected abstract endpoint(): string;
  abstract runTurn(
    input: LlmTurnInput,
    onText: (text: string) => void
  ): Promise<{ text: string; toolCalls: ToolCall[] }>;
}

// ---------------- Responses API ----------------

interface RespFunctionCallState {
  callId: string;
  name: string;
  args: string;
}

class ResponsesClient extends BaseClient {
  constructor(config: LlmConfig, fetchFn: FetchFn) {
    super(config, fetchFn);
  }

  protected endpoint(): string {
    return `${this.config.baseUrl.replace(/\/$/, "")}/responses`;
  }

  private buildBody(input: LlmTurnInput): Record<string, unknown> {
    const items: Record<string, unknown>[] = [];
    for (const m of input.messages) {
      if (m.role === "tool") {
        items.push({
          type: "function_call_output",
          call_id: m.toolCallId ?? "",
          output: m.content,
        });
      } else if (m.role === "assistant" && m.toolCalls?.length) {
        for (const call of m.toolCalls) {
          items.push({
            type: "function_call",
            call_id: call.callId,
            name: call.name,
            arguments: JSON.stringify(call.arguments),
          });
        }
        if (m.content) items.push({ role: "assistant", content: m.content });
      } else {
        items.push({ role: m.role, content: m.content });
      }
    }
    return {
      model: this.config.model,
      instructions: input.instructions || undefined,
      input: items,
      tools: input.tools.map((t) => ({
        type: "function",
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      })),
    };
  }

  async runTurn(input: LlmTurnInput, onText: (text: string) => void) {
    const res = await this.request(this.buildBody(input));
    const contentType = res.headers.get("content-type") ?? "";

    if (!contentType.includes("text/event-stream") || !res.body) {
      const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
      if (!json) throw new LlmError("LLM provider returned an invalid response");
      return this.fromJson(json, onText);
    }

    let text = "";
    const calls = new Map<string, RespFunctionCallState>();
    let completedOutput: unknown[] | null = null;

    for await (const payload of ssePayloads(res.body)) {
      const ev = payload as Record<string, unknown>;
      const type = String(ev.type ?? "");
      if (type === "response.output_text.delta" && typeof ev.delta === "string") {
        text += ev.delta;
        onText(ev.delta);
      } else if (type === "response.output_item.added") {
        const item = ev.item as Record<string, unknown> | undefined;
        if (item?.type === "function_call") {
          const key = String(item.id ?? item.call_id ?? "");
          calls.set(key, {
            callId: String(item.call_id ?? item.id ?? ""),
            name: String(item.name ?? ""),
            args: typeof item.arguments === "string" ? item.arguments : "",
          });
        }
      } else if (type === "response.function_call_arguments.delta") {
        const state = calls.get(String(ev.item_id ?? ""));
        if (state && typeof ev.delta === "string") state.args += ev.delta;
      } else if (type === "response.function_call_arguments.done") {
        const state = calls.get(String(ev.item_id ?? ""));
        if (state && typeof ev.arguments === "string") state.args = ev.arguments;
      } else if (type === "response.output_item.done") {
        const item = ev.item as Record<string, unknown> | undefined;
        if (item?.type === "function_call") {
          const key = String(item.id ?? item.call_id ?? "");
          const prev = calls.get(key);
          calls.set(key, {
            callId: String(item.call_id ?? prev?.callId ?? ""),
            name: String(item.name ?? prev?.name ?? ""),
            args: typeof item.arguments === "string" ? item.arguments : (prev?.args ?? ""),
          });
        }
      } else if (type === "response.completed") {
        const response = ev.response as Record<string, unknown> | undefined;
        if (Array.isArray(response?.output)) completedOutput = response.output;
      }
    }

    if (completedOutput) {
      const fromCompleted = this.callsFromOutput(completedOutput);
      if (fromCompleted.length > 0) {
        return { text, toolCalls: fromCompleted };
      }
    }
    return {
      text,
      toolCalls: [...calls.values()]
        .filter((c) => c.name)
        .map((c) => ({ callId: c.callId, name: c.name, arguments: parseArguments(c.args || "{}") })),
    };
  }

  private callsFromOutput(output: unknown[]): ToolCall[] {
    const result: ToolCall[] = [];
    for (const item of output) {
      const it = item as Record<string, unknown>;
      if (it.type === "function_call") {
        result.push({
          callId: String(it.call_id ?? it.id ?? ""),
          name: String(it.name ?? ""),
          arguments: parseArguments(typeof it.arguments === "string" ? it.arguments : "{}"),
        });
      }
    }
    return result;
  }

  private fromJson(json: Record<string, unknown>, onText: (t: string) => void) {
    let text = typeof json.output_text === "string" ? json.output_text : "";
    const output = Array.isArray(json.output) ? json.output : [];
    if (!text) {
      for (const item of output) {
        const it = item as Record<string, unknown>;
        if (it.type === "message" && Array.isArray(it.content)) {
          for (const part of it.content) {
            const p = part as Record<string, unknown>;
            if ((p.type === "output_text" || p.type === "text") && typeof p.text === "string") {
              text += p.text;
            }
          }
        }
      }
    }
    if (text) onText(text);
    return { text, toolCalls: this.callsFromOutput(output) };
  }
}

// ---------------- Chat Completions ----------------

interface ChatCallState {
  callId: string;
  name: string;
  args: string;
}

class ChatClient extends BaseClient {
  constructor(config: LlmConfig, fetchFn: FetchFn) {
    super(config, fetchFn);
  }

  protected endpoint(): string {
    return `${this.config.baseUrl.replace(/\/$/, "")}/chat/completions`;
  }

  private buildBody(input: LlmTurnInput): Record<string, unknown> {
    const messages: Record<string, unknown>[] = [];
    if (input.instructions) messages.push({ role: "system", content: input.instructions });
    for (const m of input.messages) {
      if (m.role === "tool") {
        messages.push({ role: "tool", tool_call_id: m.toolCallId ?? "", content: m.content });
      } else if (m.role === "assistant" && m.toolCalls?.length) {
        messages.push({
          role: "assistant",
          content: m.content || null,
          tool_calls: m.toolCalls.map((c) => ({
            id: c.callId,
            type: "function",
            function: { name: c.name, arguments: JSON.stringify(c.arguments) },
          })),
        });
      } else {
        messages.push({ role: m.role, content: m.content });
      }
    }
    return {
      model: this.config.model,
      messages,
      tools: input.tools.map((t) => ({
        type: "function",
        function: { name: t.name, description: t.description, parameters: t.parameters },
      })),
    };
  }

  async runTurn(input: LlmTurnInput, onText: (text: string) => void) {
    const res = await this.request(this.buildBody(input));
    const contentType = res.headers.get("content-type") ?? "";

    if (!contentType.includes("text/event-stream") || !res.body) {
      const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
      if (!json) throw new LlmError("LLM provider returned an invalid response");
      return this.fromJson(json, onText);
    }

    let text = "";
    const calls = new Map<number, ChatCallState>();
    for await (const payload of ssePayloads(res.body)) {
      const chunk = payload as { choices?: { delta?: Record<string, unknown> }[] };
      const delta = chunk.choices?.[0]?.delta;
      if (!delta) continue;
      if (typeof delta.content === "string" && delta.content) {
        text += delta.content;
        onText(delta.content);
      }
      const fragments = delta.tool_calls as
        | { index?: number; id?: string; function?: { name?: string; arguments?: string } }[]
        | undefined;
      if (Array.isArray(fragments)) {
        for (const frag of fragments) {
          const index = frag.index ?? 0;
          const state = calls.get(index) ?? { callId: "", name: "", args: "" };
          if (frag.id) state.callId = frag.id;
          if (frag.function?.name) state.name = frag.function.name;
          if (typeof frag.function?.arguments === "string") state.args += frag.function.arguments;
          calls.set(index, state);
        }
      }
    }
    return {
      text,
      toolCalls: [...calls.values()]
        .filter((c) => c.name)
        .map((c) => ({ callId: c.callId, name: c.name, arguments: parseArguments(c.args || "{}") })),
    };
  }

  private fromJson(json: Record<string, unknown>, onText: (t: string) => void) {
    const choices = json.choices as { message?: Record<string, unknown> }[] | undefined;
    const message = choices?.[0]?.message ?? {};
    const text = typeof message.content === "string" ? message.content : "";
    if (text) onText(text);
    const rawCalls = (message.tool_calls as Record<string, unknown>[] | undefined) ?? [];
    const toolCalls: ToolCall[] = rawCalls.map((c) => {
      const fn = (c.function as Record<string, unknown> | undefined) ?? {};
      return {
        callId: String(c.id ?? ""),
        name: String(fn.name ?? ""),
        arguments: parseArguments(typeof fn.arguments === "string" ? fn.arguments : "{}"),
      };
    });
    return { text, toolCalls: toolCalls.filter((c) => c.name) };
  }
}

export function createLlmClient(config: LlmConfig, fetchFn: FetchFn = fetch): LlmClient {
  return config.mode === "chat"
    ? new ChatClient(config, fetchFn)
    : new ResponsesClient(config, fetchFn);
}

export function llmClientFromEnv(): LlmClient | null {
  const baseUrl = process.env.LLM_BASE_URL?.trim();
  const apiKey = process.env.LLM_API_KEY?.trim();
  const model = process.env.LLM_MODEL?.trim();
  if (!baseUrl || !apiKey || !model) return null;
  const mode = process.env.LLM_API_MODE?.trim().toLowerCase() === "chat" ? "chat" : "responses";
  const timeoutMs = Number(process.env.LLM_TIMEOUT_MS ?? "") || undefined;
  return createLlmClient({ baseUrl, apiKey, model, mode, timeoutMs });
}

export function isLlmConfigured(): boolean {
  return Boolean(
    process.env.LLM_BASE_URL?.trim() && process.env.LLM_API_KEY?.trim() && process.env.LLM_MODEL?.trim()
  );
}
