#!/bin/sh
set -e

echo "🚀 Starting SchoolBite container..."

# Ensure database directory exists
mkdir -p /app/prisma

# Sync database schema with Prisma database (if DATABASE_URL is set)
if [ -n "$DATABASE_URL" ]; then
  echo "🔄 Checking and syncing database schema with Prisma..."
  npx prisma db push --skip-generate || echo "⚠️ Prisma sync skipped"
fi

# If SEED_ON_INIT is set to "true", seed initial demo data
if [ "$SEED_ON_INIT" = "true" ]; then
  echo "🌱 SEED_ON_INIT is true. Seeding database..."
  npx prisma db seed || echo "⚠️ Seed script completed or skipped."
fi

echo "✅ Database initialized. Starting application server..."
exec "$@"
