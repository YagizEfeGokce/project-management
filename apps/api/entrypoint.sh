#!/bin/sh
set -e

# Run Prisma migrations if DATABASE_URL is configured
if [ -n "$DATABASE_URL" ]; then
  echo "Running Prisma migrations..."
  npx prisma migrate deploy --schema prisma/schema.prisma
fi

exec node apps/api/src/server.js
