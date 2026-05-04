#!/bin/bash
set -uo pipefail

# TaskFlow Health Check Script
# Usage: ./scripts/health-check.sh [api-url]

API_URL="${1:-http://localhost:3001}"
ERRORS=0

echo "=== TaskFlow Health Check ==="
echo "Target: $API_URL"
echo "Time: $(date -Iseconds)"
echo ""

# Check /health/live
echo "Checking /health/live ..."
LIVE=$(curl -sf "$API_URL/health/live" 2>/dev/null)
if [ $? -eq 0 ]; then
  echo "  OK - $LIVE"
else
  echo "  FAIL - API is not alive"
  ERRORS=$((ERRORS + 1))
fi

# Check /health/ready
echo "Checking /health/ready ..."
READY=$(curl -sf "$API_URL/health/ready" 2>/dev/null)
if [ $? -eq 0 ]; then
  echo "  OK - $READY"
else
  echo "  FAIL - API is not ready (DB down?)"
  ERRORS=$((ERRORS + 1))
fi

# Check /health full
echo "Checking /health ..."
HEALTH=$(curl -sf "$API_URL/health" 2>/dev/null)
if [ $? -eq 0 ]; then
  STATUS=$(echo "$HEALTH" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
  echo "  Status: $STATUS"
  if [ "$STATUS" != "healthy" ]; then
    echo "  WARN - System status is $STATUS"
    ERRORS=$((ERRORS + 1))
  fi
else
  echo "  FAIL - Health endpoint unreachable"
  ERRORS=$((ERRORS + 1))
fi

# Check /metrics
echo "Checking /metrics ..."
METRICS=$(curl -sf "$API_URL/metrics" 2>/dev/null)
if [ $? -eq 0 ]; then
  REQ_COUNT=$(echo "$METRICS" | grep -c "http_requests_total" || echo "0")
  CONN_COUNT=$(echo "$METRICS" | grep "http_connections_active" | tail -1 | awk '{print $2}')
  echo "  OK - Metrics available"
  echo "  Active connections: ${CONN_COUNT:-N/A}"
  echo "  Request counters: $REQ_COUNT"
else
  echo "  FAIL - Metrics endpoint unreachable"
  ERRORS=$((ERRORS + 1))
fi

echo ""
if [ "$ERRORS" -eq 0 ]; then
  echo "All checks passed."
  exit 0
else
  echo "$ERRORS check(s) failed."
  exit 1
fi
