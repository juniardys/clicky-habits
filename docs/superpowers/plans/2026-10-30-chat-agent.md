# Mochi Chat Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** In-app AI chat (“Mochi”) that answers habit statistics questions and performs habit actions through server-side tools, with live visible tool-calling, persisted history, undoable writes, delete confirmation, and a lightweight 3D clay mascot.

**Architecture:** Bun + Hono API gains a `src/chat/` module: a normalized OpenAI-compatible LLM adapter (Responses + Chat Completions), tool executors over an extracted shared habit service, and an agent loop streamed to the web via SSE. PostgreSQL (Prisma) stores threads, messages (including tool cards), undoable actions, and pending deletes. The React web app adds a lazily loaded chat panel; three.js loads only when the panel first opens.

**Tech Stack:** Bun (built-in `fetch`, `bun test`), Hono (`hono/streaming` SSE), Prisma/PostgreSQL, React 18, three/@react-three/fiber (already installed), framer-motion (already installed). No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-30-chat-agent-design.md`

## Global Constraints

- Env names are generic, never provider-specific: `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL`, `LLM_API_MODE` (`responses` | `chat`). The value of `LLM_BASE_URL` may be `https://api.meta.ai/v1`; that string appears only in local `.env` and as an example value in docs.
- The LLM API key never reaches the browser; all provider calls happen in `apps/api`.
- Every tool execution is scoped by the session `userId`; tool arguments never contain a user id.
- Caps: message ≤ 2,000 chars, ≤ 6 tool steps per turn, `add_coins` count 1–20 per call, history sent to the LLM = last 20 messages, pending delete expires after 10 minutes, one active chat stream per user.
- `mark_day` is idempotent (never a toggle). Write tools execute immediately and produce an undoable action; `delete_habit` never executes without the confirmation card. Delete is permanent and has no undo.
- Existing REST endpoints keep their current paths, response shapes, and behavior.
- Chat UI text goes through the existing EN/ID i18n system.
- Mobile performance: three.js chunk loads only on first panel open; Mochi canvas ~84px, `dpr={1}`, no shadows; FAB is SVG only; `prefers-reduced-motion` or missing WebGL falls back to the static SVG face.
- Tests never call a real LLM (fixtures, stub fetch, fake clients only).

## Review Focus

1. Provider sends a tool call with malformed JSON arguments, an unknown tool name, or wrong argument types → no write happens, the LLM receives a tool error, the turn survives (Task 3 tests).
2. A failed or interrupted turn is retried → the persisted user message is reused, never duplicated, and a partial reply is stored as interrupted (Task 4 tests).
3. Undo is clicked after the user manually changed the same data (entry removed, coins changed, habit deleted) → undo reverses only what still applies, never goes negative, never resurrects a habit, and reports honestly (Task 3 tests).
4. A delete confirmation is approved twice, after a new message, or after expiry → exactly one deletion ever happens; later confirms return 409 and the card shows expired (Task 4 tests).
5. The assistant states a statistic → it must come from a tool result; the system prompt's no-invented-numbers and list-first rules are pinned by a prompt snapshot test (Task 4 tests). Runtime hallucination beyond tool grounding cannot be unit-proven and is checked in the final manual conversation.

---

### Task 1: Prisma chat models, env, shared habit service

**Files:**
- Modify: `apps/api/prisma/schema.prisma` (add `ChatThread`, `ChatMessage`, `ChatAction`, `ChatPendingAction` exactly as in the spec, plus reverse relations on `User` and `ChatThread`)
- Create: `apps/api/prisma/migrations/<timestamp>_chat_agent/migration.sql` (via `prisma migrate dev --name chat_agent`)
- Create: `apps/api/src/habits-service.ts`
- Modify: `apps/api/src/index.ts` (REST handlers delegate to the service; responses byte-identical)
- Modify: `.env.example` (LLM block), `.env` locally (empty `LLM_*` keys are fine at this stage)

**Interfaces:**
- Produces: `habitService` and `HabitService` interface with:
  - `listHabits(userId): Promise<HabitSummary[]>` (same shape as `GET /api/habits`)
  - `createHabit(userId, name, type): Promise<Habit>`; `deleteHabit(userId, id): Promise<boolean>`
  - `getHabit(userId, id): Promise<HabitDetail | null>`; `toggleDay(userId, id, date): Promise<{ marked, date } | null>`
  - `ensureMarked(userId, id, date): Promise<{ created: boolean, date } | null>` (idempotent mark)
  - `addCoins(userId, id, date, count): Promise<{ date, countToday, totalCount } | null>`
  - `removeMark(userId, id, date): Promise<boolean>`; `decrementCoins(userId, id, date, count): Promise<{ removed, countToday }>`
  - `getDashboard(userId)`, `getHabitStats(userId, id)` (payloads identical to current routes, reusing `computeStats` from `src/stats.ts`)
  - Server-side types `HabitSummary`, `HabitDetail`, `TrackerType` exported from this file.

- [ ] **Step 1:** Add the four models to `schema.prisma`, run `bun run --filter @clicky/api db:generate`, then create the migration with `bunx dotenv -e ../../.env -- bunx prisma migrate dev --name chat_agent` from `apps/api` (if the local database is unreachable, generate the client, hand-write `migration.sql` to match the schema, and note that `migrate deploy` must run before the chat routes work).
- [ ] **Step 2:** Extract habit logic from `index.ts` into `habits-service.ts` (move, don't rewrite; keep `parseDate` semantics and all error cases). `index.ts` keeps auth guards and becomes thin delegation.
- [ ] **Step 3:** Add the `LLM_*` block to `.env.example` with empty key/model and `LLM_API_MODE="responses"`.
- [ ] **Step 4:** Verify no REST regression: start the API, `GET /api/health`, sign in, and exercise list/create/toggle/coin/dashboard/stats against the local DB; compare payloads with the pre-change shapes from the spec-era code (`git stash` comparison is acceptable). Run `bunx tsc --noEmit` in `apps/api`.
- [ ] **Step 5:** Commit `feat(api): extract habit service, add chat schema`.

### Task 2: LLM adapter (Responses + Chat Completions)

**Files:**
- Create: `apps/api/src/chat/llm.ts`
- Test: `apps/api/src/chat/llm.test.ts`

**Interfaces:**
- Produces:
  - `ToolCall { callId: string; name: string; arguments: Record<string, unknown> }`
  - `LlmToolDef { name; description; parameters: object }` (JSON Schema object)
  - `LlmMessage { role: "user" | "assistant" | "tool"; content: string; toolCallId?: string; toolCalls?: ToolCall[] }`
  - `LlmClient { runTurn(input: { instructions: string; messages: LlmMessage[]; tools: LlmToolDef[] }, onText: (text: string) => void): Promise<{ text: string; toolCalls: ToolCall[] }> }`
  - `createLlmClient(config: { baseUrl; apiKey; model; mode: "responses" | "chat" }, fetchFn?: typeof fetch): LlmClient`
  - `llmClientFromEnv(): LlmClient | null` (null when any required env is empty)

- [ ] **Step 1: Write failing tests** in `llm.test.ts` using a stub `fetchFn`, covering: (a) Responses streamed text deltas are forwarded to `onText` and concatenated; (b) Responses streamed function-call items produce one complete `ToolCall` with parsed arguments even when argument JSON arrives in fragments; (c) Chat Completions streamed `delta.tool_calls` fragments (split name/arguments across chunks) assemble into one `ToolCall`; (d) a streaming request rejected with HTTP 400 falls back once to a non-streaming request and parses the JSON body in both modes; (e) a non-2xx fallback response throws a generic `LlmError` whose message contains no upstream body.
- [ ] **Step 2:** Run `bun test apps/api/src/chat/llm.test.ts` — expect FAIL (module missing).
- [ ] **Step 3:** Implement `llm.ts`: one internal SSE line parser over `response.body`; per-mode request builders and event interpreters; history conversion per mode (Responses: `function_call` / `function_call_output` input items; Chat: `assistant.tool_calls` + `role:"tool"` messages); per-call timeout via `AbortSignal.timeout(30_000)` (overridable by `LLM_TIMEOUT_MS` in `llmClientFromEnv`).
- [ ] **Step 4:** Run the test file — expect PASS. Run `bunx tsc --noEmit` in `apps/api`.
- [ ] **Step 5:** Commit `feat(api): OpenAI-compatible LLM adapter with responses and chat modes`.

### Task 3: Tools, labels, undo, pending-delete rules

**Files:**
- Create: `apps/api/src/chat/tools.ts`
- Create: `apps/api/src/chat/actions.ts`
- Test: `apps/api/src/chat/tools.test.ts`, `apps/api/src/chat/actions.test.ts`

**Interfaces:**
- Consumes: `HabitService` (Task 1), `LlmToolDef`/`ToolCall` (Task 2).
- Produces:
  - `toolDefs: LlmToolDef[]` for `list_habits`, `get_dashboard`, `get_habit_stats`, `create_habit`, `mark_day`, `add_coins`, `delete_habit` (arguments exactly as the spec table).
  - `ToolContext { userId; threadId; today; lang: "en" | "id" }`
  - `ToolOutcome { ok; summary: string; data?: unknown; undo?: { kind: "create" | "mark" | "coins"; payload: object }; pendingDelete?: { habitId; name } }`
  - `describeToolCall(call: ToolCall, ctx, svc?): Promise<string>` — human label from validated args, resolving habit names via the service (e.g. `Masukkan 1 koin ke Push-up`, `Buat habit "Baca"`); falls back to a generic label when the habit cannot be found.
  - `executeTool(call: ToolCall, ctx, svc = habitService): Promise<ToolOutcome>` — validates name/args/types/dates, enforces tracker-type match, returns outcomes; **never throws** for bad input (returns `ok:false` outcomes the agent feeds back to the LLM). `delete_habit` returns `pendingDelete` and does not delete.
  - `applyUndo(action: { kind; payload }, svc): Promise<{ changed: boolean; summary: string }>` in `actions.ts`.
  - `isPendingExpired(p: { expiresAt: Date }, now: Date): boolean` and `PENDING_TTL_MS = 600_000` in `actions.ts`.

- [ ] **Step 1: Write failing tests** with an in-memory fake `HabitService`: unknown tool and malformed args → `ok:false`, no service mutation; `add_coins` on a CALENDAR habit and `mark_day` on a JAR habit → `ok:false`; `mark_day` twice → second outcome has no `undo`; `delete_habit` → `pendingDelete` set and fake's delete not called; `describeToolCall` uses the habit name; cross-user habit id (fake returns null) → `ok:false`. In `actions.test.ts`: coin undo after the entry was manually reduced floors at 0 with `removed` reported; mark undo when the entry is already gone → `changed:false`; create undo when the habit is already deleted → `changed:false`.
- [ ] **Step 2:** Run both test files — expect FAIL.
- [ ] **Step 3:** Implement `tools.ts` and `actions.ts`. Summaries are short factual strings built from service results (counts, streaks), localized by `ctx.lang`. Coin decrement math: `removed = min(currentCount, addedCount)`.
- [ ] **Step 4:** Run both test files — expect PASS; `bunx tsc --noEmit` in `apps/api`.
- [ ] **Step 5:** Commit `feat(api): chat tools with undo and delete-confirmation rules`.

### Task 4: Agent loop, chat store, SSE routes

**Files:**
- Create: `apps/api/src/chat/store.ts` (Prisma-backed `ChatStore`)
- Create: `apps/api/src/chat/agent.ts`
- Create: `apps/api/src/chat/routes.ts`
- Modify: `apps/api/src/index.ts` (mount chat routes)
- Test: `apps/api/src/chat/agent.test.ts`

**Interfaces:**
- Consumes: `LlmClient` (Task 2), `executeTool`/`describeToolCall`/`applyUndo` (Task 3), `habitService` (Task 1).
- Produces:
  - `ChatStore` interface: `getOrCreateLatestThread(userId)`, `createThread(userId)`, `addMessage(threadId, { role, content, toolName?, toolMeta? }): Promise<{ id }>`, `listMessages(threadId, limit)`, `saveAction(userId, threadId, undo)`, `getAction(userId, id)`, `markActionUndone(id)`, `createPending(userId, threadId, toolName, args)`, `getPending(userId, id)`, `consumePending(id)`, `discardPendingForThread(threadId)`, `threadOwnedBy(threadId, userId)`.
  - `ChatStreamEvent` union matching the spec (`thread`, `text_delta`, `tool_start`, `tool_result`, `confirm_required`, `done`, `error`).
  - `buildInstructions({ today, lang }): string` — Mochi persona + all spec agent rules.
  - `buildLlmHistory(messages): LlmMessage[]` — maps stored rows (user / assistant incl. tool-call rows with `toolMeta.toolCalls` / tool rows with `toolMeta.callId` / hidden confirm-result user rows) to adapter messages, last 20.
  - `runChatTurn(deps: { llm; svc; store }, opts: { userId; threadId; today; lang; emit; signal? }): Promise<void>` — assumes the triggering message (user message, retry target, or hidden confirm-result row) is already persisted; the loop: rebuild history, call LLM, persist assistant/tool rows, emit events, execute tools (persisting `ChatAction` on undo outcomes, `ChatPendingAction` + `confirm_required` on delete), feed results back, stop at 6 tool steps with a closing text.
  - `registerChatRoutes(app, deps?)` mounting `POST /api/chat` (incl. `retryMessageId`), `GET /api/chat/thread`, `POST /api/chat/threads`, `POST /api/chat/confirm`, `POST /api/chat/actions/:id/undo` behind session auth; SSE via `streamSSE` from `hono/streaming`; in-memory `Set<userId>` single-stream guard (409 on concurrent); new message discards outstanding pending actions for the thread; message length > 2,000 → 400; unconfigured LLM → 503 `{ error: "assistant_not_configured" }`.

- [ ] **Step 1: Write failing agent tests** with an in-memory `ChatStore`, in-memory fake `HabitService`, and a scripted fake `LlmClient`: (a) stats question → `list_habits`/`get_dashboard` tool events emitted in order `tool_start → tool_result → text_delta → done`, messages persisted; (b) create flow → outcome carries an action id in `tool_result`; (c) delete flow → `confirm_required` emitted, fake delete never called, pending row exists; (d) an LLM that always requests tools stops after 6 steps and still emits `done`; (e) malformed tool call from the LLM → tool error fed back, turn completes; (f) `buildInstructions` snapshot asserts the no-invented-numbers, list-first, and ask-on-ambiguous rules are present (Review Focus 5).
- [ ] **Step 2:** Run `bun test apps/api/src/chat/agent.test.ts` — expect FAIL.
- [ ] **Step 3:** Implement `store.ts`, `agent.ts`, `routes.ts`; wire into `index.ts`. Retry semantics: `retryMessageId` must reference a persisted user message in a thread owned by the user whose following assistant turn is missing/interrupted, otherwise 409. Confirm flow: approve consumes the pending row exactly once (second approve → 409), executes via `habitService.deleteHabit`, appends a hidden user row (`toolMeta: { hidden: true, kind: "confirm_result" }`) describing the result, then runs `runChatTurn` so Mochi replies; decline consumes without executing. Undo route: ownership-check, `applyUndo`, `markActionUndone` only when `changed` (already-undone → 200 report, no-op). Client abort (`signal`) stops the loop and persists the partial assistant text with `toolMeta: { interrupted: true }`.
- [ ] **Step 4:** Run all `apps/api` tests — expect PASS; `bunx tsc --noEmit` in `apps/api`. With the local DB up and `LLM_*` still empty, smoke-test: `POST /api/chat` while signed in returns 503 in the documented shape.
- [ ] **Step 5:** Commit `feat(api): chat agent loop with SSE routes`.

### Task 5: Web chat client (SSE parser, types, habits-changed bus)

**Files:**
- Create: `apps/web/src/lib/chat.ts`
- Test: `apps/web/src/lib/chat.test.ts`

**Interfaces:**
- Produces:
  - `ChatStreamEvent` (mirrors the server union), `ToolCardData { callId; tool; label; status: "running" | "ok" | "error" | "undone"; summary?; undoActionId? }`, `ChatMessageView { id; role; content; toolCards: ToolCardData[]; confirm?: { pendingActionId; label; detail; state: "pending" | "approved" | "declined" | "expired" | "cancelled" } }`.
  - `parseSse(buffer: string, chunk: string): { events: ChatStreamEvent[]; rest: string }` — pure, tolerant of events split across chunks and of unknown event names (ignored).
  - `streamChatMessage(body, onEvent, signal?): Promise<void>` — POSTs `/api/chat` with credentials, reads the stream through `parseSse`; throws on non-2xx with the server's error code.
  - `chatApi.getThread()`, `chatApi.newThread()`, `chatApi.confirm(pendingActionId, approve, onEvent, signal?)` (streams the continuation through the same parser), `chatApi.undo(actionId)`.
  - `notifyHabitsChanged()` and `onHabitsChanged(cb): () => void` over a `clicky:habits-changed` window event.
  - `toMessageViews(rows): ChatMessageView[]` — converts `GET /api/chat/thread` rows (incl. tool rows, hidden-row filtering, interrupted flag) into renderable messages. That endpoint returns `{ threadId: string | null, messages: StoredMessage[] }` where `StoredMessage { id; role; content; toolName: string | null; toolMeta: Record<string, unknown> | null; createdAt }` mirrors the `ChatMessage` table.

- [ ] **Step 1: Write failing tests**: SSE event split mid-JSON across two chunks yields exactly one event when completed; multiple events in one chunk all parse; unknown event names are skipped; `toMessageViews` groups tool rows under their assistant turn, drops hidden rows, and reconstructs an undone card from `toolMeta`.
- [ ] **Step 2:** Run `bun test apps/web/src/lib/chat.test.ts` — expect FAIL.
- [ ] **Step 3:** Implement `chat.ts` (no React imports — pure TS + fetch).
- [ ] **Step 4:** Run the test — expect PASS; `bunx tsc --noEmit` in `apps/web` (add a `typecheck` script if none exists).
- [ ] **Step 5:** Commit `feat(web): chat SSE client and message view models`.

### Task 6: Chat panel UI, i18n, page refresh wiring

**Files:**
- Create: `apps/web/src/components/chat/MochiFace.tsx` (static SVG face, props `{ size?: number }`; also defines and exports `MochiStatus = "idle" | "thinking" | "tool" | "speaking" | "celebrate" | "error"`, which Task 7's `Mochi3D` imports as a type from here to avoid a cycle)
- Create: `apps/web/src/components/chat/ChatPanel.tsx` (FAB + panel/sheet + messages + tool cards + confirm card + composer; Mochi avatar area renders a placeholder slot filled by Task 7's lazy component, falling back to `MochiFace`)
- Modify: `apps/web/src/App.tsx` (render `<ChatWidget />` for signed-in users only)
- Modify: `apps/web/src/lib/i18n.tsx` (all `chat.*` keys, EN + ID: FAB label, statuses, quick prompts, tool fallbacks, confirm copy incl. “permanent, cannot be undone”, undo/undone, errors, not-configured, retry)
- Modify: `apps/web/src/styles.css` (FAB, panel, mobile sheet, bubbles, tool cards, chips, composer — existing clay border/shadow language, ≥44px targets, safe-area padding)
- Modify: `apps/web/src/pages/HomePage.tsx`, `HabitPage.tsx`, `DashboardPage.tsx` (subscribe `onHabitsChanged` → refetch)

**Interfaces:**
- Consumes: everything from Task 5; produces `MochiStatus` (in `MochiFace.tsx`) and imports the lazy avatar default export from Task 7's `Mochi3D.tsx`.
- Internal state: messages as `ChatMessageView[]`, `status: MochiStatus`, `streaming: boolean`, derived strictly from stream events (`tool_start` → `tool`, first `text_delta` → `speaking`, write success → brief `celebrate`, `error` → `error`, `done` → `idle`).

- [ ] **Step 1:** Implement `MochiFace` (peach blob, sprout, eyes, mouth, cheeks as inline SVG, no assets).
- [ ] **Step 2:** Implement `ChatPanel.tsx`: open state lives in the widget; on first open fetch `chatApi.getThread()`; send flow appends the user message optimistically, streams events into the current assistant turn (tool cards by `callId`), disables send while streaming, provides Stop (aborts; partial text remains, marked interrupted with a Retry action that resends via `retryMessageId`); Undo buttons call `chatApi.undo` then flip the card and `notifyHabitsChanged()`; confirm buttons call `chatApi.confirm` streaming the continuation into a new assistant turn, and mark the card approved/declined; any `tool_result` with `ok` for a write tool also fires `notifyHabitsChanged()`; quick-prompt chips (empty thread + above composer) send their text; not-configured (503 `assistant_not_configured`) renders the friendly state; dialog semantics (`role="dialog"`, labelled, Esc closes, focus in on open / back to FAB on close, status line as a polite `aria-live` region).
- [ ] **Step 3:** Add i18n keys and styles, including `@media (max-width: 640px)` full-screen sheet and FAB offset so it never covers habit-page canvas controls.
- [ ] **Step 4:** Wire `App.tsx` and the three pages' refetch subscriptions.
- [ ] **Step 5:** Verify: `bun run build:web` passes; manual pass signed-in — panel opens, thread loads, chips visible, pages behind refresh after a (stubbed or real) write. Commit `feat(web): Mochi chat panel with live tool cards`.

### Task 7: Mochi 3D (lazy, mobile-light), docs, full verification

**Files:**
- Create: `apps/web/src/components/chat/Mochi3D.tsx`
- Modify: `apps/web/src/components/chat/ChatPanel.tsx` (mount the lazy avatar with fallback)
- Modify: `README.md` (LLM setup section: both modes, example base URL, “no key → chat shows not-configured”)
- Modify: `.env.example` only if Task 1's block needs the final wording.

**Interfaces:**
- Produces: default-exported `Mochi3D({ status }: { status: MochiStatus })` (importing the `MochiStatus` type from `MochiFace.tsx`) — primitives-only clay blob (~84px canvas, `dpr={1}`, no shadows, two lights, procedural `useFrame` animation per status: idle breathing squash, thinking tilt + sprout wiggle, tool hop on status entry, speaking mouth oscillation, celebrate hop + spin, error slow shake; frameloop paused while `document.hidden`).

- [ ] **Step 1:** Implement `Mochi3D.tsx`; in `ChatPanel`, load it via `React.lazy(() => import("./Mochi3D"))` only after first open, wrap in `Suspense` with `MochiFace` fallback; if `matchMedia("(prefers-reduced-motion: reduce)")` matches or WebGL context creation fails, never mount the canvas — keep `MochiFace`.
- [ ] **Step 2:** Update README's setup with the `LLM_*` block and both `LLM_API_MODE` values.
- [ ] **Step 3: Full verification** — `bun test apps/api apps/web/src/lib` (all PASS), `bunx tsc --noEmit` in both apps, `bun run build:web`; confirm the three.js chunk is a separate lazy chunk and is not requested before the panel opens (dev-server network tab); mobile viewport (≤640px) pass: sheet layout, FAB placement, composer usable; WebGL disabled → SVG fallback, chat still works; with real `LLM_*` filled locally, run one conversation per example (stats question, create habit, add coin/mark day, undo, delete with decline then approve) and confirm the underlying pages update on panel close.
- [ ] **Step 4:** Commit `feat(web): lazy Mochi 3D avatar and chat docs`.

## Notes for the executor

- The repo has no test runner configured; `bun test` is the runner everywhere, discovering `*.test.ts` next to sources. Add `"test": "bun test"` scripts to both app `package.json` files in the first task that adds tests for that app.
- Types are duplicated deliberately across the API/web boundary (existing pattern: `apps/web/src/lib/api.ts` mirrors API payloads); keep `ChatStreamEvent` in sync manually between `apps/api/src/chat/agent.ts` and `apps/web/src/lib/chat.ts`.
- If the local PostgreSQL is down during Task 1, do not block: generate the client, hand-write the migration, and run the DB-dependent smoke checks in Task 7's verification once the DB is available.
