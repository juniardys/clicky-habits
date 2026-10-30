# syntax=docker/dockerfile:1

# ============================================================
#  Clicky Habits - web image (Vite SPA served by nginx)
# ============================================================

# ---------- build ----------
FROM oven/bun:1-alpine AS build
WORKDIR /app
COPY package.json bun.lock ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN bun install --frozen-lockfile
COPY apps/web apps/web

# Public API URL baked into the SPA. The API lives on its own subdomain and the
# web container never proxies to it, so this is required in production
# (e.g. https://api.clickyhabits.com). Empty = dev only (Vite proxy).
ARG VITE_API_URL=""
ENV VITE_API_URL=$VITE_API_URL
RUN cd apps/web && bun run build

# ---------- runner ----------
FROM nginx:1.27-alpine AS runner

COPY docker/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/apps/web/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
