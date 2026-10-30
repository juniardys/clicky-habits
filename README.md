# Clicky Habits

A digital habit tracker that simulates physical habit trackers in 3D:

- 🗓️ **Cross off a calendar** - every time you finish a habit, cross off the date (once per day).
- 🪙 **Coins in a jar** - every time you finish a habit, drop in a coin. One jar holds **100 coins**; when it fills up, continue to the next jar (a jar = a unit of hundreds).

Plus a stats dashboard: streaks, 30-day consistency, and activity charts.

## Stack

- **Monorepo**: Bun workspaces
- **API** (`apps/api`): Bun + Hono + better-auth (Google SSO + email/password) + Prisma
- **Web** (`apps/web`): Vite + React + react-three-fiber (three.js) + Recharts
- **Database**: PostgreSQL (`clicky_habits`)

## Setup

```bash
# 1. Install dependencies
bun install

# 2. Prepare the env (a single file at the root)
cp .env.example .env
# edit .env - fill in BETTER_AUTH_SECRET (and Google creds if you want SSO)

# 3. Create the database (one time only)
psql -h localhost -U postgres -c "CREATE DATABASE clicky_habits;"

# 4. Migrate + generate the Prisma client
bun run db:migrate

# 5. Run (two terminals)
bun run dev:api   # http://localhost:3001
bun run dev:web   # http://localhost:5173
```

Open http://localhost:5173. The web dev server proxies `/api` to the API, so auth cookies stay on a single origin.

## Chat assistant (Mochi)

Signed-in users get a floating chat assistant that can answer questions about
their stats and perform actions (create habits, mark days, add coins) through
server-side tools. Tool calls show up live in the chat, writes come with an
Undo button, and deletes ask for confirmation first.

The assistant talks to any OpenAI-compatible provider. Configure it in the
root `.env`:

```bash
LLM_BASE_URL="https://api.meta.ai/v1"   # any OpenAI-compatible base URL
LLM_API_KEY="..."
LLM_MODEL="..."
LLM_API_MODE="responses"                # "responses" or "chat" (chat/completions)
```

Leave `LLM_API_KEY`/`LLM_MODEL` empty to disable chat — the UI then shows a
"Mochi isn't configured yet" notice and the rest of the app works as before.
The API key is only ever used by the API server, never sent to the browser.
Chat history, undoable actions, and pending delete confirmations are stored in
PostgreSQL (see the `chat_agent` migration).

## Login

- **Google SSO**: set `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` in `.env` (root).
  Redirect URI: `http://localhost:5173/api/auth/callback/google`.
- **Email/password**: enabled by default for local development without Google credentials.

## Structure

```
apps/
  api/   Hono + better-auth + Prisma (port 3001)
  web/   Vite + React + R3F (port 5173, proxy /api -> 3001)
```
