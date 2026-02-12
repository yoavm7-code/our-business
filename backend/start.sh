#!/bin/sh
# Use public DB URL for migrations (internal network may not be ready at start)
if [ -n "$DATABASE_PUBLIC_URL" ]; then
  export DATABASE_URL="$DATABASE_PUBLIC_URL"
fi

npx prisma migrate deploy
exec node dist/main.js
