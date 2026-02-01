#!/bin/sh
set -e

# Use DATABASE_PUBLIC_URL when railway.internal fails (P1001)
# Add variable in Railway: DATABASE_PUBLIC_URL = ${{Postgres.DATABASE_PUBLIC_URL}}
if [ -n "$DATABASE_PUBLIC_URL" ]; then
  export DATABASE_URL="$DATABASE_PUBLIC_URL"
fi

# Give Railway's private network time to initialize
sleep 5

npx prisma migrate deploy
exec npm run start
