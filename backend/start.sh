#!/bin/sh
echo "=== START.SH ==="
echo "DATABASE_URL set: $([ -n "$DATABASE_URL" ] && echo YES || echo NO)"
echo "DATABASE_PUBLIC_URL set: $([ -n "$DATABASE_PUBLIC_URL" ] && echo YES || echo NO)"
echo "PORT=${PORT:-not set, will default to 4000}"

# Use public DB URL (internal network may not be ready at container start)
if [ -n "$DATABASE_PUBLIC_URL" ]; then
  export DATABASE_URL="$DATABASE_PUBLIC_URL"
  echo "Using DATABASE_PUBLIC_URL"
fi

echo "Running prisma migrate deploy..."
npx prisma migrate deploy || echo "WARNING: migrate failed (continuing anyway)"

echo "Starting node dist/main.js..."
exec node dist/main.js
