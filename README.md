# Clicky Habits

Habit tracker digital yang mensimulasikan habit tracker fisik dalam 3D:

- 🗓️ **Coret kalender** — tiap kebiasaan selesai, coret tanggalnya (1x per hari).
- 🪙 **Koin dalam toples** — tiap kebiasaan selesai, masukkan koin. Satu toples muat **100 koin**; penuh, lanjut ke toples berikutnya (toples = satuan ratusan).

Plus dashboard statistik: streak, konsistensi 30 hari, grafik aktivitas.

## Stack

- **Monorepo**: Bun workspaces
- **API** (`apps/api`): Bun + Hono + better-auth (Google SSO + email/password) + Prisma
- **Web** (`apps/web`): Vite + React + react-three-fiber (three.js) + Recharts
- **Database**: PostgreSQL (`clicky_habits`)

## Setup

```bash
# 1. Install dependencies
bun install

# 2. Siapkan env (satu file di root)
cp .env.example .env
# edit .env — isi BETTER_AUTH_SECRET (dan Google creds jika mau SSO)

# 3. Buat database (sekali saja)
psql -h localhost -U postgres -c "CREATE DATABASE clicky_habits;"

# 4. Migrasi + generate Prisma client
bun run db:migrate

# 5. Jalankan (dua terminal)
bun run dev:api   # http://localhost:3001
bun run dev:web   # http://localhost:5173
```

Buka http://localhost:5173. Web dev server mem-proxy `/api` ke API, jadi cookie auth satu origin.

## Login

- **Google SSO**: isi `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` di `.env` (root).
  Redirect URI: `http://localhost:5173/api/auth/callback/google`.
- **Email/password**: aktif secara default untuk development lokal tanpa kredensial Google.

## Struktur

```
apps/
  api/   Hono + better-auth + Prisma (port 3001)
  web/   Vite + React + R3F (port 5173, proxy /api -> 3001)
```
