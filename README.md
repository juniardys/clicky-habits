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

## Deploy (Dokploy, subdomain setup)

Two services from one repo. The API runs on `api.clickyhabits.com`, the static web
build on `clickyhabits.com`.

### api service

- Domain: `api.clickyhabits.com` -> port `3001`
- Build: `bun install && bun run db:generate`
- Start: `bun run --filter '@clicky/api' start`
- First deploy only, run migrations once:
  `bun run --filter '@clicky/api' db:migrate:deploy`
- Env:
  - `DATABASE_URL` (Postgres connection string)
  - `BETTER_AUTH_SECRET` (`openssl rand -base64 32`)
  - `BETTER_AUTH_URL=https://api.clickyhabits.com`
  - `BETTER_AUTH_TRUSTED_ORIGINS=https://clickyhabits.com`
  - `CORS_ORIGINS=https://clickyhabits.com`
  - `PORT=3001`
  - `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` (optional)

### web service (static)

- Domain: `clickyhabits.com`, publish directory `apps/web/dist`
- Build (env vars are baked in at build time):

  ```bash
  bun install
  VITE_API_URL=https://api.clickyhabits.com bun run build:web
  ```

### Google SSO

Authorized redirect URI in Google Console:

```
https://api.clickyhabits.com/api/auth/callback/google
```

Cookie note: browser treats `clickyhabits.com` and `api.clickyhabits.com` as the
same site, so better-auth's default `SameSite=Lax` cookies work across the
subdomain without extra configuration.
