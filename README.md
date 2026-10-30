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
docker/
  nginx.conf           SPA + /api reverse proxy
  supervisord.conf     runs api (bun) + nginx in one container
  api-db.Dockerfile    migration / db-ops image
  db-entrypoint.sh
Dockerfile             app image (web build + api runtime)
docker-compose.yml
```

## Deploy (Docker Compose / Dokploy)

Two containers:

| Service | Purpose |
|---|---|
| `prisma-migration` | runs `prisma migrate deploy` on start, then stays alive for manual ops (`bunx prisma studio`, `migrate status`, ...) |
| `app` | nginx serving the Vite build + Bun API on `127.0.0.1:3001`, nginx proxies `/api` to it. Starts only after `prisma-migration` is healthy |

Because the SPA and the API share one origin, auth cookies work without CORS.

### Dokploy

1. Create a **Compose** app pointing at this repo, source path `docker-compose.yml`.
2. Fill in the environment variables (Dokploy env editor):

   ```
   DATABASE_URL=postgresql://user:pass@host:5432/clicky_habits
   BETTER_AUTH_SECRET=<openssl rand -base64 32>
   BETTER_AUTH_URL=https://your-domain.tld
   GOOGLE_CLIENT_ID=
   GOOGLE_CLIENT_SECRET=
   PORT=3001
   APP_PORT=3000
   ```

3. Set the domain to route to the `app` service's published port (`APP_PORT`, default `3000`).
4. Google SSO redirect URI: `https://your-domain.tld/api/auth/callback/google`.

If Postgres runs as another Dokploy service in the same compose project, use its
service name as the host (`postgresql://user:pass@postgres:5432/clicky_habits`).

Manual db ops:

```bash
docker exec -it clicky-habits-migration bunx prisma migrate status
docker exec -it clicky-habits-migration bunx prisma studio
```

### API on a subdomain (e.g. `api.clickyhabits.com`)

Same compose file, same `app` container. Point **both** domains at the `app`
service's port in Dokploy:

- `clickyhabits.com` -> SPA (nginx)
- `api.clickyhabits.com` -> same container; the SPA calls it directly at
  `https://api.clickyhabits.com/api/...`

Env (Dokploy env editor):

```
BETTER_AUTH_URL=https://api.clickyhabits.com
TRUSTED_ORIGINS=https://clickyhabits.com
VITE_API_URL=https://api.clickyhabits.com
```

- `VITE_API_URL` is a **build arg**: changing it requires a redeploy (rebuild).
- `TRUSTED_ORIGINS` enables credentialed CORS for the web origin and adds it
  to better-auth's trusted origins.
- Google SSO redirect URI: `https://api.clickyhabits.com/api/auth/callback/google`.
- Cookies: `clickyhabits.com` and `api.clickyhabits.com` are the same site, so
  better-auth's default `SameSite=Lax` cookies work without extra config.

### Local

```bash
cp .env.example .env   # point DATABASE_URL at a reachable Postgres
docker compose up -d --build
# http://localhost:3000 (or APP_PORT)
```

