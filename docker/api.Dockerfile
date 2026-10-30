# syntax=docker/dockerfile:1

# ============================================================
#  Clicky Habits - API image (Bun + Hono + better-auth + Prisma)
# ============================================================

FROM oven/bun:1-alpine AS base
WORKDIR /app

# ---------- deps + generated prisma client ----------
# Full install (not --production): the prisma CLI is a devDependency. Without
# it, `bunx prisma` downloads the latest prisma from npm instead of the locked
# version, which breaks `generate`. The generated client is written inside
# node_modules, so node_modules from this stage is what the runner ships.
FROM base AS prod-deps
COPY package.json bun.lock ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN bun install --frozen-lockfile
COPY apps/api/prisma apps/api/prisma
RUN cd apps/api && bunx --no-install prisma generate

# ---------- runner ----------
FROM base AS runner

ENV NODE_ENV=production \
    PORT=3001

COPY --from=prod-deps /app/node_modules /app/node_modules
COPY --from=prod-deps /app/apps/api/node_modules /app/apps/api/node_modules
COPY apps/api/package.json apps/api/tsconfig.json /app/apps/api/
COPY apps/api/prisma /app/apps/api/prisma
# Bun runs TS directly
COPY apps/api/src /app/apps/api/src

WORKDIR /app/apps/api
USER bun

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/health" || exit 1

CMD ["bun", "src/index.ts"]
