#!/usr/bin/env bash
set -euo pipefail

# Required env vars:
# - SUPABASE_DB_HOST
# - SUPABASE_DB_USER
# - SUPABASE_DB_PASSWORD
# Optional env vars:
# - SUPABASE_DB_PORT (default: 5432)
# - SUPABASE_DB_NAME (default: postgres)
# - BACKUP_DIR (default: ./tmp/backups)
# - RETENTION_DAYS (default: 14)

: "${SUPABASE_DB_HOST:?SUPABASE_DB_HOST is required}"
: "${SUPABASE_DB_USER:?SUPABASE_DB_USER is required}"
: "${SUPABASE_DB_PASSWORD:?SUPABASE_DB_PASSWORD is required}"

SUPABASE_DB_PORT="${SUPABASE_DB_PORT:-5432}"
SUPABASE_DB_NAME="${SUPABASE_DB_NAME:-postgres}"
BACKUP_DIR="${BACKUP_DIR:-./tmp/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BASENAME="supabase-${SUPABASE_DB_NAME}-${TIMESTAMP}"
DUMP_PATH="$BACKUP_DIR/${BASENAME}.sql"
GZ_PATH="${DUMP_PATH}.gz"
SHA_PATH="${GZ_PATH}.sha256"

mkdir -p "$BACKUP_DIR"

if ! command -v pg_dump >/dev/null 2>&1; then
  echo "Error: pg_dump is not installed. Install PostgreSQL client tools first."
  exit 1
fi

export PGPASSWORD="$SUPABASE_DB_PASSWORD"

pg_dump \
  --host="$SUPABASE_DB_HOST" \
  --port="$SUPABASE_DB_PORT" \
  --username="$SUPABASE_DB_USER" \
  --dbname="$SUPABASE_DB_NAME" \
  --no-owner \
  --no-privileges \
  --format=plain \
  --file="$DUMP_PATH"

gzip -f "$DUMP_PATH"

if command -v shasum >/dev/null 2>&1; then
  shasum -a 256 "$GZ_PATH" > "$SHA_PATH"
else
  sha256sum "$GZ_PATH" > "$SHA_PATH"
fi

if ! zcat "$GZ_PATH" | head -n 5 | rg -q 'PostgreSQL database dump'; then
  echo "Backup verification failed: dump header not found"
  exit 1
fi

find "$BACKUP_DIR" -type f -name '*.sql.gz' -mtime +"$RETENTION_DAYS" -delete
find "$BACKUP_DIR" -type f -name '*.sha256' -mtime +"$RETENTION_DAYS" -delete

echo "Backup created: $GZ_PATH"
echo "Checksum: $SHA_PATH"
