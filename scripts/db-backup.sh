#!/bin/bash
set -euo pipefail

# TaskFlow PostgreSQL Backup Script
# Usage: ./scripts/db-backup.sh [--dry-run] [backup-dir]
#
# Environment variables:
#   POSTGRES_DB       - database name (default: taskflow)
#   POSTGRES_USER     - database user (default: taskflow)
#   POSTGRES_PASSWORD - database password (required unless POSTGRES_HOST_AUTH_METHOD=trust)
#   POSTGRES_HOST     - database host (default: localhost)
#   POSTGRES_PORT     - database port (default: 5432)
#   BACKUP_RETENTION_DAYS - retention period (default: 14)

DRY_RUN=false
if [ "${1:-}" = "--dry-run" ]; then
  DRY_RUN=true
  shift
fi

BACKUP_DIR="${1:-./backups}"
DB_NAME="${POSTGRES_DB:-taskflow}"
DB_USER="${POSTGRES_USER:-taskflow}"
DB_HOST="${POSTGRES_HOST:-localhost}"
DB_PORT="${POSTGRES_PORT:-5432}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/taskflow_${TIMESTAMP}.sql.gz"

mkdir -p "$BACKUP_DIR"

# Pre-flight checks
if ! command -v pg_dump >/dev/null 2>&1; then
  echo "ERROR: pg_dump not found. Install postgresql-client."
  exit 2
fi

if ! command -v gzip >/dev/null 2>&1; then
  echo "ERROR: gzip not found."
  exit 2
fi

# Connectivity check
export PGPASSWORD="${POSTGRES_PASSWORD:-}"
if ! pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" >/dev/null 2>&1; then
  echo "ERROR: Database $DB_NAME on $DB_HOST:$DB_PORT is not reachable"
  exit 3
fi

echo "Starting backup of $DB_NAME at $TIMESTAMP..."

if [ "$DRY_RUN" = true ]; then
  echo "[DRY-RUN] Would write to: $BACKUP_FILE"
  echo "[DRY-RUN] Would run: pg_dump -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME --no-owner --no-acl | gzip > $BACKUP_FILE"
  exit 0
fi

# Run backup
if ! pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" --no-owner --no-acl --verbose 2>"${BACKUP_FILE}.err" | gzip > "$BACKUP_FILE"; then
  echo "ERROR: Backup failed"
  rm -f "$BACKUP_FILE"
  if [ -f "${BACKUP_FILE}.err" ]; then
    echo "pg_dump stderr:"
    cat "${BACKUP_FILE}.err"
    rm -f "${BACKUP_FILE}.err"
  fi
  exit 1
fi

# Cleanup stderr log on success
rm -f "${BACKUP_FILE}.err"

BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
echo "Backup completed: $BACKUP_FILE ($BACKUP_SIZE)"

# Validate backup is not empty
if [ ! -s "$BACKUP_FILE" ]; then
  echo "ERROR: Backup file is empty"
  rm -f "$BACKUP_FILE"
  exit 4
fi

# Retention cleanup
echo "Cleaning up backups older than ${RETENTION_DAYS} days..."
find "$BACKUP_DIR" -name "taskflow_*.sql.gz" -type f -mtime +"$RETENTION_DAYS" -delete

echo "Backup process complete"
exit 0
