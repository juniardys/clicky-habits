# Utility image: runs `prisma migrate deploy` then stays alive for manual db ops
# (seed, prisma studio, psql, etc.). Mirrors the prisma-migration service pattern.
FROM oven/bun:1-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json bun.lock ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
# Full install (incl. devDeps) so the prisma CLI is available at runtime
RUN bun install --frozen-lockfile

FROM deps AS runner
COPY --from=deps /app/node_modules /app/node_modules
COPY --from=deps /app/apps/api/node_modules /app/apps/api/node_modules
COPY apps/api/prisma /app/apps/api/prisma
COPY apps/api/package.json apps/api/package.json
COPY docker/db-entrypoint.sh /usr/local/bin/db-entrypoint.sh
RUN chmod +x /usr/local/bin/db-entrypoint.sh

WORKDIR /app/apps/api

# Keeps the container useful for `docker exec` after migrations finish
ENTRYPOINT ["db-entrypoint.sh"]
