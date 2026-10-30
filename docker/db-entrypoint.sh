#!/bin/sh
set -e

# No args or "migrate": apply pending migrations, then stay alive for manual ops.
if [ "$1" = "migrate" ] || [ -z "$1" ]; then
  echo "Running database migrations (prisma migrate deploy)..."
  bunx prisma migrate deploy
  touch /tmp/migrations-complete
  echo "Migrations complete. Container stays running for manual db operations."
  echo "Example: docker exec -it clicky-habits-migration bunx prisma studio"
  exec tail -f /dev/null
fi

# Anything else runs as-is, e.g. `bunx prisma migrate status`
if [ "$#" -gt 0 ]; then
  exec "$@"
fi
