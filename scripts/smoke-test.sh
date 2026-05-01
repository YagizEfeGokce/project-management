#!/bin/bash
set -euo pipefail

# Smoke test for TaskFlow API
# Starts the API in JSON-fallback mode and verifies all health endpoints

API_URL="${1:-http://localhost:3001}"
TIMEOUT=30

echo "=== TaskFlow Smoke Test ==="
echo "Target: $API_URL"
echo ""

# Wait for API to be ready
wait_for_api() {
  local url=$1
  local attempts=0
  while ! curl -sf --max-time 10 --connect-timeout 5 "$url/health/live" > /dev/null 2>&1; do
    attempts=$((attempts + 1))
    if [ $attempts -ge $TIMEOUT ]; then
      echo "ERROR: API did not start within ${TIMEOUT}s"
      exit 1
    fi
    echo "  Waiting for API... ($attempts/$TIMEOUT)"
    sleep 1
  done
}

# If API is not running, start it in background
if ! curl -sf --max-time 10 --connect-timeout 5 "$API_URL/health/live" > /dev/null 2>&1; then
  echo "Starting API in background (JSON fallback mode)..."
  cd apps/api
  PORT=3001 NODE_ENV=test node src/server.js &
  API_PID=$!
  cd ../..

  # Cleanup on exit
  trap 'kill $API_PID 2>/dev/null || true' EXIT

  wait_for_api "$API_URL"
  echo "API is live (PID: $API_PID)"
  echo ""
fi

ERRORS=0

# Test /health/live
echo "Test 1: /health/live"
LIVE=$(curl -sf --max-time 10 --connect-timeout 5 "$API_URL/health/live")
if echo "$LIVE" | grep -q '"alive":true'; then
  echo "  PASS"
else
  echo "  FAIL: $LIVE"
  ERRORS=$((ERRORS + 1))
fi

# Test /health/ready
echo "Test 2: /health/ready"
READY=$(curl -sf --max-time 10 --connect-timeout 5 "$API_URL/health/ready")
if echo "$READY" | grep -q '"ready":true'; then
  echo "  PASS"
else
  echo "  FAIL: $READY"
  ERRORS=$((ERRORS + 1))
fi

# Test /health
echo "Test 3: /health"
HEALTH=$(curl -sf --max-time 10 --connect-timeout 5 "$API_URL/health")
if echo "$HEALTH" | grep -q '"status":"healthy"'; then
  echo "  PASS"
else
  echo "  FAIL: $HEALTH"
  ERRORS=$((ERRORS + 1))
fi

# Test /metrics
echo "Test 4: /metrics"
METRICS=$(curl -sf --max-time 10 --connect-timeout 5 "$API_URL/metrics")
if echo "$METRICS" | grep -q "TYPE"; then
  echo "  PASS"
else
  echo "  FAIL"
  ERRORS=$((ERRORS + 1))
fi

# Test auth (login with demo account)
echo "Test 5: POST /api/auth/login"
LOGIN=$(curl -sf --max-time 10 --connect-timeout 5 -X POST "$API_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@taskflow.local","password":"admin123"}')
if echo "$LOGIN" | grep -q '"token"'; then
  echo "  PASS"
else
  echo "  FAIL: $LOGIN"
  ERRORS=$((ERRORS + 1))
fi

# Test dashboard (with auth)
echo "Test 6: GET /api/dashboard/summary"
TOKEN=$(echo "$LOGIN" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
DASHBOARD=$(curl -sf --max-time 10 --connect-timeout 5 "$API_URL/api/dashboard/summary" \
  -H "Authorization: Bearer $TOKEN")
if [ -n "$DASHBOARD" ]; then
  echo "  PASS"
else
  echo "  FAIL"
  ERRORS=$((ERRORS + 1))
fi

echo ""
if [ "$ERRORS" -eq 0 ]; then
  echo "All smoke tests passed."
  exit 0
else
  echo "$ERRORS test(s) failed."
  exit 1
fi
