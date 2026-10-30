# syntax=docker/dockerfile:1

# ============================================================
#  Clicky Habits - single app image
#  web (Vite SPA, served by nginx) + api (Bun/Hono, proxied by nginx)
# ============================================================

FROM oven/bun:1-alpine AS base
WORKDIR /app

# ---------- deps ----------
FROM base AS deps
COPY package.json bun.lock ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN bun install --frozen-lockfile

# ---------- build ----------
FROM deps AS build
COPY . .
RUN cd apps/api && bunx prisma generate

# Public API URL baked into the SPA. Empty = same origin (nginx proxies /api).
# Set to e.g. https://api.clickyhabits.com when the API is served on a subdomain.
ARG VITE_API_URL=""
ENV VITE_API_URL=$VITE_API_URL
RUN cd apps/web && bun run build

FROM deps AS prod-deps
COPY apps/api/prisma apps/api/prisma
RUN bun install --frozen-lockfile --production
# Generated client lives in node_modules; must be regenerated after the prod install
RUN cd apps/api && bunx prisma generate

# ---------- runner ----------
FROM base AS runner

RUN apk add --no-cache nginx supervisor curl

ENV NODE_ENV=production \
    PORT=3001

# API: runtime deps + generated prisma client + source (Bun runs TS directly)
COPY --from=prod-deps /app/node_modules /app/node_modules
COPY --from=prod-deps /app/apps/api/node_modules /app/apps/api/node_modules
COPY --from=build /app/apps/api/src /app/apps/api/src
COPY --from=build /app/apps/api/package.json /app/apps/api/package.json
COPY --from=build /app/apps/api/tsconfig.json /app/apps/api/tsconfig.json
COPY --from=build /app/apps/api/prisma /app/apps/api/prisma

# Web: static build output
COPY --from=build /app/apps/web/dist /usr/share/nginx/html

# nginx + supervisor config
COPY docker/nginx.conf /etc/nginx/http.d/default.conf
COPY docker/supervisord.conf /etc/supervisord.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD curl -fsS http://127.0.0.1/api/health || exit 1

CMD ["supervisord", "-c", "/etc/supervisord.conf"]
