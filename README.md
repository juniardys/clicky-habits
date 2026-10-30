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

Open http://localhost:5173. The web dev server proxies the API paths (`/auth`, `/health`, `/habits`, `/chat`) to the API on :3001, so auth cookies stay on a single origin while developing.

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
  Redirect URI: `http://localhost:5173/auth/callback/google`.
- **Email/password**: enabled by default for local development without Google credentials.

## Structure

```
apps/
  api/   Hono + better-auth + Prisma (port 3001)
  web/   Vite + React + R3F (port 5173, proxy /auth /health /habits /chat -> 3001)
docker/
  api.Dockerfile        api image (Bun runtime)
  web.Dockerfile        web image (Vite build served by nginx)
  nginx.conf.template   SPA only, no API proxy (the API lives on its subdomain)
  api-db.Dockerfile     migration / db-ops image
  db-entrypoint.sh
docker-compose.yml
```

## Deploy (Docker Compose / Dokploy)

Three containers, one process each:

| Service | Image | Purpose |
|---|---|---|
| `prisma-migration` | `docker/api-db.Dockerfile` | runs `prisma migrate deploy` on start, then stays alive for manual ops (`bunx prisma studio`, `migrate status`, ...) |
| `api` | `docker/api.Dockerfile` | Bun API on port `3001`. Starts only after `prisma-migration` is healthy |
| `web` | `docker/web.Dockerfile` | nginx serving the Vite build only. No API proxy: it cannot reach the API |

The API always lives on its own subdomain (`api.<domain>`) and serves at its
root: `/auth/*`, `/health`, `/habits/*`, `/chat/*`. The web origin has no
route to it, so `<domain>/auth`, `/health`, `/habits` and `/chat` all 404.

### Dokploy - API on a subdomain (e.g. `api.clickyhabits.com`)

1. Create a **Compose** app pointing at this repo, source path `docker-compose.yml`.
2. Environment variables (Dokploy env editor):

   ```
   DATABASE_URL=postgresql://user:pass@host:5432/clicky_habits
   BETTER_AUTH_SECRET=<openssl rand -base64 32>
   BETTER_AUTH_URL=https://api.clickyhabits.com
   TRUSTED_ORIGINS=https://clickyhabits.com
   VITE_API_URL=https://api.clickyhabits.com
   GOOGLE_CLIENT_ID=
   GOOGLE_CLIENT_SECRET=
   ```

3. Domains:
   - `clickyhabits.com` -> service `web`, port `80`
   - `api.clickyhabits.com` -> service `api`, port `3001`
4. Google SSO redirect URI: `https://api.clickyhabits.com/auth/callback/google`.

Notes:

- `VITE_API_URL` is a **build arg** of `web`: changing it requires a rebuild.
  It is required in production; leaving it empty makes the SPA call its own
  origin, which has no API.
- `TRUSTED_ORIGINS` enables credentialed CORS for the web origin and adds it
  to better-auth's trusted origins.
- `clickyhabits.com` and `api.clickyhabits.com` are the same site, so
  better-auth's default `SameSite=Lax` cookies work without extra config.

### Database

If Postgres runs as another service in the same Dokploy project, use its
service name as the host (`postgresql://user:pass@postgres:5432/clicky_habits`).

Manual db ops:

```bash
docker exec -it clicky-habits-migration bunx prisma migrate status
docker exec -it clicky-habits-migration bunx prisma studio
```

### Local

```bash
cp .env.example .env   # point DATABASE_URL at a reachable Postgres
docker compose up -d --build
# web: http://localhost:3000 (APP_PORT), api: http://localhost:3001 (API_PORT)
```

