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

### Reset and seed the local database

```bash
bun run db:seed          # add a verified demo user (demo@clickyhabits.local / demo12345) with sample habits
bun run db:reset         # drop the DB and re-run all migrations, no seed (asks for confirmation)
bun run db:reset:force   # same as db:reset, without the confirmation prompt
```

`db:migrate` and `db:reset` never seed. To get a fresh DB with demo data, run
`bun run db:reset` then `bun run db:seed`.

`db:reset` and `db:reset:force` delete all data in the database pointed to by
`DATABASE_URL`. Only use them against a local database. The seed lives in
`apps/api/prisma/seed.ts`, is safe to re-run (it recreates only the demo user),
and refuses to run when `NODE_ENV=production`.

Open http://localhost:5173. The web dev server proxies the API paths (`/auth`, `/health`, `/habits`, `/chat`, `/me`) to the API on :3001, so auth cookies stay on a single origin while developing.

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
  Redirect URI: `http://localhost:5173/auth/callback/google`. The OAuth flow
  always shows the Google account picker (`prompt=select_account`), even when
  the browser is already signed in to Google.
- **Google One Tap**: the login page also shows the floating "Continue as ..."
  prompt (like Notion) to visitors already signed in to Google in the browser.
  Set `VITE_GOOGLE_CLIENT_ID` to the same client ID as `GOOGLE_CLIENT_ID` (it
  is baked into the web bundle at build time) and register every web origin
  that shows the prompt under **Authorized JavaScript origins** of the OAuth
  client in Google Cloud Console (`http://localhost:5173` locally,
  `https://clickyhabits.com` in production). Leave it empty to disable the
  prompt; the regular Google button is unaffected either way.
- **Email/password**: enabled by default for local development without Google credentials.
- **Email verification**: sign-up sends a verification link. Unverified users
  can still use the app and see a banner with a resend button. The same SMTP
  setup sends the confirmation link when a user changes their email from the
  Profile page.

## Email (SMTP)

Account emails go out through any SMTP server. Configure it in the root `.env`:

```bash
SMTP_HOST="smtp.gmail.com"   # empty = print emails (and links) to the API console
SMTP_PORT="587"              # 587 STARTTLS, 465 TLS
SMTP_SECURE="false"          # "true" for port 465
SMTP_USER="you@gmail.com"    # empty = no SMTP auth
SMTP_PASS="app-password"
EMAIL_FROM="Clicky Habits <no-reply@clickyhabits.com>"
```

With `SMTP_HOST` empty (the local default) nothing is sent: each email is
logged by the API with an `[email]` prefix, so you can open the verification
link from the terminal. Send failures are logged and never break sign-up.

## Structure

```
apps/
  api/   Hono + better-auth + Prisma (port 3001)
  web/   Vite + React + R3F (port 5173, proxy /auth /health /habits /chat /me -> 3001)
docker/
  api.Dockerfile        api image (Bun runtime)
  web.Dockerfile        web image (Vite build served by nginx)
  nginx.conf.template   SPA only, no API proxy (the API lives on its subdomain)
  api-db.Dockerfile     migration / db-ops image
  db-entrypoint.sh
docker-compose.yml        production (no host ports)
docker-compose.local.yml  local Docker testing (publishes host ports)
```

## Deploy (Docker Compose / Dokploy)

Three containers, one process each:

| Service | Image | Purpose |
|---|---|---|
| `prisma-migration` | `docker/api-db.Dockerfile` | runs `prisma migrate deploy` on start, then stays alive for manual ops (`bunx prisma studio`, `migrate status`, ...) |
| `api` | `docker/api.Dockerfile` | Bun API on port `3001`. Starts only after `prisma-migration` is healthy |
| `web` | `docker/web.Dockerfile` | nginx serving the Vite build only. No API proxy: it cannot reach the API |

The API always lives on its own subdomain (`api.<domain>`) and serves at its
root: `/auth/*`, `/health`, `/habits/*`, `/chat/*`, `/me/*`. The web origin has no
route to it: `<domain>/auth`, `/health`, `/habits`, `/chat` and `/me` never reach
the API. nginx answers them like any unknown path, with the SPA's
`index.html` (HTTP 200), and the client-side router handles it.

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
   VITE_GOOGLE_CLIENT_ID=
   SMTP_HOST=smtp.example.com
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_USER=
   SMTP_PASS=
   EMAIL_FROM=Clicky Habits <no-reply@clickyhabits.com>
   ```

3. Domains (Dokploy **Domains** tab, container ports):
   - `clickyhabits.com` -> service `web`, port `80`
   - `api.clickyhabits.com` -> service `api`, port `3001`
4. Google SSO redirect URI: `https://api.clickyhabits.com/auth/callback/google`.

Notes:

- The compose file publishes **no host ports**. Traefik reaches the
  containers over the Docker network, so there is no clash with ports already
  in use on the server (Dokploy itself listens on 3000) and the API is not
  reachable via `http://<server-ip>:3001`.
- Behind a Cloudflare Tunnel, TLS ends at Cloudflare: route both hostnames in
  the tunnel to Traefik (e.g. `http://localhost:80`) and leave HTTPS /
  Let's Encrypt off on the Dokploy domains. The public URLs in the env stay
  `https://`.
- `VITE_API_URL` is a **build arg** of `web`: changing it requires a rebuild.
  It is required in production; leaving it empty makes the SPA call its own
  origin, which has no API.
- `VITE_GOOGLE_CLIENT_ID` is also a **build arg** of `web` (same rebuild
  rule). It only enables the Google One Tap prompt on the login page; set it
  to the same value as `GOOGLE_CLIENT_ID` and register the web origin under
  Authorized JavaScript origins in Google Cloud Console.
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
# The web container has no API proxy, so mimic the two-domain setup:
#   BETTER_AUTH_URL="http://localhost:3001"
#   VITE_API_URL="http://localhost:3001"
#   TRUSTED_ORIGINS="http://localhost:3000"
docker compose -f docker-compose.yml -f docker-compose.local.yml up -d --build
# web: http://localhost:3000, api: http://localhost:3001
```

