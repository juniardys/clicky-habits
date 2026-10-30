# Chat Agent “Mochi” — Design

Date: 2026-10-30
Status: Approved design, pending written-spec review

## Goal

Add an in-app AI chat assistant to Clicky Habits. Users can, in natural language:

- Ask about their habit statistics (“Streak-ku gimana minggu ini?”).
- Create habits (“Tambahin habit baca 10 halaman”).
- Record progress (“Aku barusan push-up, catat ya”, “Catat habit hari ini”).

Every AI action runs through server-side tools scoped to the signed-in user. Tool
calls are visible live in the chat as playful step cards. The assistant has a
small 3D clay mascot, Mochi, that reacts to what the agent is doing. The feature
must stay light on mobile phones.

## Decisions made during brainstorming

| Topic | Decision |
|---|---|
| LLM protocol | OpenAI-compatible adapter supporting both the Responses API and Chat Completions, selected by env. Target provider base URL: `https://api.meta.ai/v1`, used only as an env value — code and env names contain no provider name. |
| Tool scope | Read stats, create habits, record progress. Delete requires an inline confirmation card. |
| Chat history | Persisted in PostgreSQL per user. |
| Placement | Floating button on all signed-in pages opening a chat panel; full-screen sheet on small screens. |
| Mascot | “Mochi” — peach clay blob with a sprout (option B in the visual brainstorm). |
| Write actions | Execute immediately, show result card with an Undo button. Only delete asks first. |
| Agent architecture | Server-side agent loop streaming Server-Sent Events (SSE). API key never reaches the browser. |

## Architecture

### Server (`apps/api`)

New module `apps/api/src/chat/`:

- `llm.ts` — provider adapter (see LLM adapter below). Exposes one normalized
  interface: given instructions, history, and tool definitions, it streams
  `text_delta` fragments and yields complete tool calls.
- `tools.ts` — tool definitions (JSON Schema) and executors. Executors call the
  shared habit service; they never accept a `userId` argument — the user id
  comes from the authenticated session in the route.
- `agent.ts` — the agent loop: send history to the LLM, execute requested
  tools, feed results back, repeat until the LLM answers with text or the step
  limit is hit. Emits stream events as it goes.
- `routes.ts` — Hono routes, registered in `apps/api/src/index.ts` behind the
  same session guard pattern as `/api/habits`.

Shared habit logic currently embedded in REST handlers in
`apps/api/src/index.ts` (list/create/delete habits, calendar toggle, jar coin,
per-habit and dashboard statistics via `computeStats`) is extracted into
`apps/api/src/habits-service.ts`. REST routes and chat tools both call it, so
validation and statistics cannot diverge. Existing REST behavior and response
shapes do not change.

Routes:

| Route | Purpose |
|---|---|
| `POST /api/chat` | Body: `{ threadId?, message, today, lang }`. Creates or continues a thread, persists the user message, runs the agent loop, streams SSE events. Accepts `{ threadId, retryMessageId, today, lang }` instead of `message` to re-run a persisted user message whose turn failed or was interrupted, without storing a duplicate. |
| `GET /api/chat/thread` | Returns the user's latest thread with its messages (including tool cards), or an empty thread state. |
| `POST /api/chat/threads` | Starts a new empty thread (“Chat baru”). |
| `POST /api/chat/confirm` | Body: `{ pendingActionId, approve }`. Executes or discards a pending destructive action, then runs one agent continuation turn so Mochi can summarize the outcome. |
| `POST /api/chat/actions/:id/undo` | Reverses a recorded write action owned by the user. Returns the reversal result. |

SSE events from `POST /api/chat` and the confirm continuation:

- `thread` — `{ threadId }`, sent first.
- `text_delta` — `{ text }` assistant text fragment.
- `tool_start` — `{ callId, tool, label }` where `label` is a human sentence
  rendered server-side from validated arguments (e.g. “Masukkan 1 koin ke
  Push-up”), so the UI never has to interpret raw arguments.
- `tool_result` — `{ callId, ok, summary, undoActionId? }`.
- `confirm_required` — `{ pendingActionId, tool, label, detail, expiresAt }`.
- `done` — `{ messageId }` end of the assistant turn.
- `error` — `{ message }` friendly failure; the turn is closed.

Client disconnect aborts the agent loop; a partially streamed assistant
message is persisted marked as interrupted rather than dropped, so history
never shows a user message with no trace of the reply attempt.

### LLM adapter

Configuration (root `.env`, generic names only):

```bash
# LLM (OpenAI-compatible)
LLM_BASE_URL="https://api.meta.ai/v1"
LLM_API_KEY=""
LLM_MODEL=""
LLM_API_MODE="responses"   # "responses" | "chat"
```

- `responses` mode: `POST {LLM_BASE_URL}/responses` with `instructions`,
  `input`, and function tools; parse streamed events
  (`response.output_text.delta`, function-call item/argument events,
  `response.completed`), with a non-streaming JSON fallback when the provider
  rejects streaming.
- `chat` mode: `POST {LLM_BASE_URL}/chat/completions` with `messages` and
  `tools`; accumulate streamed `delta.tool_calls` fragments; same
  non-streaming fallback.
- Both modes normalize to: text fragments, then zero or more complete tool
  calls `{ callId, name, arguments }`.
- If any of `LLM_BASE_URL` / `LLM_API_KEY` / `LLM_MODEL` is empty, chat routes
  return `503 { error: "assistant_not_configured" }` and the web UI shows a
  friendly “Mochi belum dikonfigurasi” state. No key, header, or upstream error
  body is ever forwarded to the browser beyond a generic failure message.
- Per-call timeout (default 30s, `LLM_TIMEOUT_MS` optional override) and a
  hard cap of 6 tool steps per user message. Only the last 20 stored messages
  (plus tool results of the current turn) are sent as history.

### System prompt and agent rules

- Persona: Mochi, a warm, brief, playful habit buddy. Speaks the user's
  language (`lang` from the client, following the app's EN/ID setting, and
  matching the language of the user's message if they switch).
- Today's date is injected per request from the client's local date
  (`today`), consistent with the web app's existing `todayKey()` behavior.
- Never invent numbers: any statistic, total, or streak mentioned must come
  from a tool result in this turn or a previous tool result in history.
- To act on a named habit, first call `list_habits` if the habit id is not
  already known from history. If the name is still ambiguous, ask the user to
  choose — never guess silently.
- If a habit's tracker type is unclear at creation time, ask (Calendar = once
  a day, Jar = repeatable count) instead of assuming.
- After a write tool succeeds, briefly celebrate and state exactly what was
  recorded. After a failure, explain plainly and offer the correction.

### Tools

| Tool | Arguments | Behavior |
|---|---|---|
| `list_habits` | — | User's habits: `id, name, type, doneToday, totalCount, totalDays`. |
| `get_dashboard` | — | Same aggregate payload as `GET /api/habits-dashboard`. |
| `get_habit_stats` | `habitId` | Same payload as `GET /api/habits/:id/stats`. |
| `create_habit` | `name`, `type` (`CALENDAR`\|`JAR`) | Creates the habit. Recorded as an undoable action. |
| `mark_day` | `habitId`, `date?` (default: client today) | Calendar habits only. Idempotently ensures the day is marked — it is **not** a toggle, so a repeated instruction cannot accidentally unmark. Records an undoable action only when it actually created the entry. |
| `add_coins` | `habitId`, `count?` (default 1, max 20 per call), `date?` | Jar habits only. Adds coins to that day's entry. Undoable. |
| `delete_habit` | `habitId` | Destructive. Does **not** execute: creates a `ChatPendingAction`, emits `confirm_required`, and the assistant turn ends asking for confirmation. |

Tool validation mirrors the REST API: habit must belong to the user, tracker
type must match the action, dates must be `YYYY-MM-DD`. Validation failures
are returned to the LLM as tool errors (not HTTP errors) so Mochi can react.

Wrong-type or not-found cases therefore read naturally, e.g. `add_coins` on a
Calendar habit returns an error the LLM can relay: that habit is a calendar;
offer to mark the day instead.

### Undo

Every successful write tool creates a `ChatAction` with the exact inverse:

- `create_habit` → delete the created habit.
- `mark_day` → delete the entry for that date **only if this action created
  it** (an idempotent no-op mark produces no undo button).
- `add_coins` → decrement that date's entry by the added count, flooring at 0
  and deleting the entry when it reaches 0.

Undo is executed by `POST /api/chat/actions/:id/undo`, ownership-checked,
idempotent (second undo is a no-op reporting already-undone), and marks
`undoneAt`. The tool card in the UI flips to an “undone” state. Delete (after
confirmation) is permanent and has no undo; the confirmation card says so.

### Delete confirmation flow

1. LLM calls `delete_habit`; executor stores a `ChatPendingAction`
   (10-minute expiry, one pending action per thread) and returns
   `confirm_required`. Mochi's text asks for confirmation.
2. UI renders an inline card with the habit name prominent and
   [Hapus] [Batal] buttons.
3. Approve → `POST /api/chat/confirm` executes the deletion, consumes the
   pending row, persists a tool message, and runs a short agent continuation
   (streamed the same way) so Mochi confirms in words. Decline → pending row
   discarded, Mochi acknowledges via the same continuation.
4. Sending a new chat message, starting a new thread, or expiry discards any
   outstanding pending action, so a delete can never fire from a stale card.
   A confirm request for a consumed/expired id returns `409` and the UI marks
   the card expired.

## Data model (Prisma)

Added to `apps/api/prisma/schema.prisma`, one migration, all relations
`onDelete: Cascade` from `User`/`ChatThread` following existing patterns:

```prisma
model ChatThread {
  id        String        @id @default(cuid())
  userId    String
  user      User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  messages  ChatMessage[]
  actions   ChatAction[]
  pending   ChatPendingAction[]
  createdAt DateTime      @default(now())
  updatedAt DateTime      @updatedAt
  @@map("chat_thread")
}

model ChatMessage {
  id        String     @id @default(cuid())
  threadId  String
  thread    ChatThread @relation(fields: [threadId], references: [id], onDelete: Cascade)
  role      String     // "user" | "assistant" | "tool"
  content   String
  toolName  String?
  toolMeta  Json?      // { callId, label, ok, summary, undoActionId, status }
  createdAt DateTime   @default(now())
  @@map("chat_message")
}

model ChatAction {
  id        String     @id @default(cuid())
  userId    String
  threadId  String
  thread    ChatThread @relation(fields: [threadId], references: [id], onDelete: Cascade)
  kind      String     // "create" | "mark" | "coins"
  payload   Json       // inverse data: habitId, date, count, createdEntryId, ...
  undoneAt  DateTime?
  createdAt DateTime   @default(now())
  @@map("chat_action")
}

model ChatPendingAction {
  id        String     @id @default(cuid())
  userId    String
  threadId  String
  thread    ChatThread @relation(fields: [threadId], references: [id], onDelete: Cascade)
  toolName  String
  args      Json
  expiresAt DateTime
  createdAt DateTime   @default(now())
  @@map("chat_pending_action")
}
```

`ChatAction` intentionally has no expiry: undo of a mark/coin stays valid as
long as the underlying entry still matches the recorded inverse; if the entry
was changed manually since, undo applies only the still-valid part and reports
what it did (e.g. coins floored at 0). `User` gains the reverse relations.

## Web UI (`apps/web`)

New files:

- `src/lib/chat.ts` — chat API client and SSE parser (fetch +
  `ReadableStream`, since `EventSource` cannot POST), shared event/message
  types, and the `notifyHabitsChanged()` helper dispatching a
  `clicky:habits-changed` window event.
- `src/components/chat/ChatPanel.tsx` — FAB, panel/sheet, message list, tool
  cards, confirmation card, quick-prompt chips, composer. Owns stream state
  and Mochi's derived status.
- `src/components/chat/Mochi3D.tsx` — lazy-loaded R3F mascot (see below).
- `src/components/chat/MochiFace.tsx` — static SVG fallback face, also used
  inside the FAB (the FAB never mounts WebGL).

Changed files:

- `src/App.tsx` — renders the chat FAB/panel for signed-in users only.
- `src/pages/HomePage.tsx`, `HabitPage.tsx`, `DashboardPage.tsx` — listen for
  `clicky:habits-changed` and refetch, so writes made through chat are visible
  when the panel closes.
- `src/lib/i18n.tsx` — all chat strings in EN and ID.
- `src/styles.css` — chat panel, bubbles, tool cards, chips, FAB, sheet.

### Layout and interaction

- FAB: fixed bottom-right above the mobile safe-area, clay pill with the SVG
  Mochi face and “Tanya Mochi” label. Minimum 44px touch target. It must not
  cover primary page actions; on habit pages it sits above the canvas overlay
  controls (offset on small screens as needed).
- Panel: desktop/tablet floating card 380–400px wide, max 70vh, anchored
  bottom-right. Below 640px it becomes a full-screen sheet. Closing the panel
  never loses history; it is refetched from `GET /api/chat/thread` on open.
- Header: Mochi 3D avatar (~84px), name, and a live status line
  (“online”, “lagi mikir…”, “lagi catat…”, “nulis jawaban…”). A “Chat baru”
  button starts a fresh thread.
- Messages: user bubbles right (mint), Mochi bubbles left (white clay) in the
  app's existing border/shadow language. Assistant text streams token by
  token. Long histories render as a plain scrollable list (no virtualization
  needed at this scale); auto-scroll follows new content only while the user
  is already near the bottom.
- Tool cards appear inside Mochi's turn in execution order: icon, human label,
  animated running state, then a green check with a one-line summary
  (“Streak 5 hari · total 47 koin”) or a soft-red failure with a short reason.
  Write successes include an Undo button that calls the undo endpoint and then
  flips the card to its undone state. Status is conveyed by text and icon,
  not color alone.
- Confirmation card: habit name in bold, explicit “ini permanen, tidak bisa
  di-undo” note, [Hapus] [Batal]. While a card is outstanding the composer
  stays usable; sending a new message cancels the pending action (server-side
  rule above) and the card renders as cancelled.
- Quick prompts: in an empty thread, and as dismissible chips above the
  composer afterwards — “Statistikku gimana?”, “Catat habit hari ini”,
  “Tambah habit baru” (localized). Clicking inserts and sends.
- Composer: textarea, Enter sends, Shift+Enter newline, send disabled while a
  turn is streaming (also enforced server-side: one active stream per user).
  A stop button aborts the fetch; the server persists the partial reply as
  interrupted.
- Accessibility: panel is `role="dialog"` with an accessible label; focus
  moves into the panel on open and returns to the FAB on close; Esc closes;
  live status text is polite-announced.

### Mochi 3D and mobile performance

Performance is a requirement, not a preference:

- Built only from primitives with the already-installed three /
  @react-three/fiber: scaled-sphere peach body, small spheres for the sprout,
  eyes, and cheeks, a tiny torus/sphere mouth. `MeshStandardMaterial` with
  high roughness (clay look), two lights, low segment counts.
- Status is driven by the same SSE state machine as the status line:
  `idle` (slow squash-and-stretch breathing), `thinking` (tilt + sprout
  wiggle), `tool` (one small hop per tool start), `speaking` (mouth opens and
  closes while text streams), `celebrate` (hop + small spin on write
  success), `error` (slow head shake). Animations are procedural in
  `useFrame`; no animation assets.
- The three.js chunk is loaded with `React.lazy` / dynamic `import()` only
  when the panel is first opened. Users who never open chat download none of
  it, and the FAB is pure SVG.
- Canvas is small (~84px), `dpr={1}`, no shadows, no post-processing. The
  render loop runs only while the panel is open and the tab is visible
  (paused on close and on `visibilitychange`).
- `prefers-reduced-motion` or any WebGL failure falls back to the static SVG
  Mochi face. Chat functionality never depends on WebGL.

## Error handling

| Case | Behavior |
|---|---|
| `LLM_*` env incomplete | `503 assistant_not_configured`; UI shows a friendly not-configured state with the panel otherwise intact. |
| Provider timeout / 5xx / malformed response / stream dies mid-turn | `error` SSE event, Mochi's turn closes with a short apology, user message stays saved, “Coba lagi” resends without duplicating the user message (client reuses the same turn; server treats a retry as continuing the persisted user message). |
| Tool failure (not found, wrong tracker type, invalid date) | Returned to the LLM as a tool error; Mochi explains and offers the fix. UI tool card shows the short failure reason. |
| Ambiguous habit name | `list_habits` first; still ambiguous → Mochi asks with the candidate names. No server-side fuzzy guessing. |
| Confirm for expired/consumed pending action | `409`; UI marks the card expired. |
| Undo of an already-undone or no-longer-applicable action | `200` with a report of what was (not) reversed; card reflects reality. |
| Message > 2,000 chars, second concurrent stream, >6 tool steps needed | Rejected politely (HTTP 400/409) or the agent stops and answers with what it has, stating the limit. |

Upstream error bodies and stack traces are logged server-side only.

## Testing

No test calls a real LLM.

- **Unit — LLM adapter:** recorded fixtures for both protocols covering
  plain text, streamed text deltas, streamed fragmented tool calls, and the
  non-streaming fallback. Assert the normalized event sequence.
- **Unit — tools & undo:** executors against a test database or mocked
  service: cross-user access denied for every tool; `mark_day` idempotent and
  never unmarks; coin undo floors at 0 and deletes empty entries; mark undo
  only removes entries the action created; pending delete expires and is
  discarded by a new message.
- **Integration — API:** run the agent with a stub LLM (injected adapter or a
  local stub HTTP server behind `LLM_BASE_URL`) and assert the SSE sequence
  `tool_start → tool_result → text_delta → done`, persistence of messages and
  tool cards, delete confirm approve/decline paths, and undo end-to-end.
- **Unit — web:** SSE parser (chunk boundaries mid-event, `error` and `done`
  handling); tool-card state reducer including undo flip.
- **Manual verification:** `bun run build:web`; migration applied on the local
  database; mobile viewport pass — sheet layout, FAB does not cover primary
  actions, no WebGL canvas or three.js chunk before the panel is first opened
  (network tab), SVG fallback with WebGL disabled; one full conversation
  against the real provider once `LLM_*` is filled in.

## Files touched (estimate)

API:

- New: `apps/api/src/chat/{llm,tools,agent,routes}.ts`,
  `apps/api/src/habits-service.ts` (extracted from existing routes).
- Changed: `apps/api/src/index.ts` (register chat routes + guard),
  `apps/api/prisma/schema.prisma` (+4 models, user relations), one new
  migration.

Web:

- New: `apps/web/src/lib/chat.ts`,
  `apps/web/src/components/chat/{ChatPanel,Mochi3D,MochiFace}.tsx`.
- Changed: `apps/web/src/App.tsx`, `src/pages/{HomePage,HabitPage,DashboardPage}.tsx`,
  `src/lib/i18n.tsx`, `src/styles.css`.

Root:

- `.env.example` (LLM block), `README.md` (LLM setup, both modes),
  `.gitignore` (`.superpowers/`).

No new dependencies: Bun's built-in `fetch` for the provider, and the
already-installed three / @react-three/fiber / framer-motion on the web.

## Out of scope for v1

- Thread list / history search UI (only latest thread + new thread).
- Attachments, images, voice input/output.
- Scheduled reminders or proactive messages from Mochi.
- Renaming habits via chat (no rename exists in the REST API either).
- Providers that support neither streaming nor the two implemented response
  shapes beyond the non-streaming fallback.
