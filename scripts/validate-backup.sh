#!/bin/bash
set -euo pipefail

# TaskFlow Backup Validation Script
# Usage: ./scripts/validate-backup.sh [backup-file]
# Verifies a pg_dump backup is readable and non-empty.

BACKUP_FILE="${1:-}"

if [ -z "$BACKUP_FILE" ] || [ ! -f "$BACKUP_FILE" ]; then
  echo "Usage: ./scripts/validate-backup.sh <backup-file>"
  echo "ERROR: Backup file not found: ${BACKUP_FILE:-<none provided>}"
  exit 1
fi

echo "=== Backup Validation ==="
echo "File: $BACKUP_FILE"
echo "Size: $(du -h "$BACKUP_FILE" | cut -f1)"
echo ""

# Check file is valid gzip
if ! gzip -t "$BACKUP_FILE" 2>/dev/null; then
  echo "ERROR: File is not valid gzip"
  exit 2
fi

echo "1. gzip integrity: OK"

# Decompress to temp and check for PostgreSQL dump signature
TEMP_FILE=$(mktemp)
trap 'rm -f "$TEMP_FILE"' EXIT

gunzip -c "$BACKUP_FILE" > "$TEMP_FILE"

if ! head -n 5 "$TEMP_FILE" | grep -q "PostgreSQL database dump"; then
  echo "ERROR: Missing PostgreSQL dump header"
  exit 3
fi

echo "2. PostgreSQL dump header: OK"

# Count SQL statements (CREATE, COPY, INSERT) as a proxy for content richness
STATEMENT_COUNT=$(grep -cE '^(CREATE|COPY|INSERT|ALTER|GRANT)' "$TEMP_FILE" || echo "0")
if [ "$STATEMENT_COUNT" -lt 10 ]; then
  echo "ERROR: Backup appears empty or incomplete ($STATEMENT_COUNT statements)"
  exit 4
fi

echo "3. Statement count: $STATEMENT_COUNT (OK)"

# Check for critical tables
CRITICAL_TABLES=("Task" "Project" "User" "Comment" "ActivityLog" "Notification" "Risk" "Stakeholder")
MISSING=0
for table in "${CRITICAL_TABLES[@]}"; do
  if ! grep -q "CREATE TABLE.*${table}" "$TEMP_FILE"; then
    echo "  WARN: Table schema not found for ${table}"
    MISSING=$((MISSING + 1))
  fi
done

if [ "$MISSING" -gt 0 ]; then
  echo "4. Schema completeness: $MISSING tables missing (WARN)"
else
  echo "4. Schema completeness: All critical tables present (OK)"
fi

echo ""
echo "Backup validation passed."
