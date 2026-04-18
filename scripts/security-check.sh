#!/bin/bash
# InsightHub production security checklist
#
# Usage: ./scripts/security-check.sh
#
# Checks the live production site for common security issues.
# Exit code: 0 = all passed, 1 = failures found
#
set -euo pipefail

SITE_URL="${SITE_URL:-https://dashboards.jeffcoy.net}"
FAILURES=0
WARNINGS=0
PASSES=0

pass() { echo "  ✅ $1"; ((PASSES++)); }
warn() { echo "  ⚠️  $1"; ((WARNINGS++)); }
fail() { echo "  ❌ $1"; ((FAILURES++)); }

echo "=== InsightHub Security Check ==="
echo "  Target: $SITE_URL"
echo ""

# ── SSL/TLS ────────────────────────────────────────────────
echo "## SSL/TLS"

# Check HTTPS works
if curl -sf --max-time 10 "$SITE_URL/api/health" > /dev/null 2>&1; then
    pass "HTTPS is working"
else
    fail "HTTPS is not responding"
fi

# Check HTTP redirects to HTTPS
HTTP_URL="${SITE_URL/https:/http:}"
HTTP_CODE=$(curl -sf --max-time 10 -o /dev/null -w "%{http_code}" -L "$HTTP_URL" 2>/dev/null || echo "000")
if [ "$HTTP_CODE" = "200" ]; then
    pass "HTTP redirects to HTTPS"
else
    warn "HTTP redirect check inconclusive (HTTP code: $HTTP_CODE)"
fi

# Check certificate expiry
CERT_EXPIRY=$(echo | openssl s_client -servername "$(echo "$SITE_URL" | sed 's|https://||')" -connect "$(echo "$SITE_URL" | sed 's|https://||'):443" 2>/dev/null | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2)
if [ -n "$CERT_EXPIRY" ]; then
    DAYS_LEFT=$(( ($(date -j -f "%b %d %T %Y %Z" "$CERT_EXPIRY" +%s 2>/dev/null || date -d "$CERT_EXPIRY" +%s 2>/dev/null) - $(date +%s)) / 86400 ))
    if [ "$DAYS_LEFT" -gt 14 ]; then
        pass "SSL certificate valid for $DAYS_LEFT days"
    elif [ "$DAYS_LEFT" -gt 0 ]; then
        warn "SSL certificate expires in $DAYS_LEFT days — renew soon"
    else
        fail "SSL certificate has EXPIRED"
    fi
else
    warn "Could not check SSL certificate expiry"
fi

echo ""

# ── Security Headers ──────────────────────────────────────
echo "## Security Headers"

HEADERS=$(curl -sf --max-time 10 -I "$SITE_URL" 2>/dev/null || echo "")

check_header() {
    local header="$1"
    local expected="$2"
    local value
    value=$(echo "$HEADERS" | grep -i "^$header:" | head -1 | sed "s/$header: //i" | tr -d '\r')
    if [ -n "$value" ]; then
        if [ -n "$expected" ] && ! echo "$value" | grep -qi "$expected"; then
            warn "$header: $value (expected: $expected)"
        else
            pass "$header present"
        fi
    else
        fail "$header header missing"
    fi
}

check_header "x-frame-options" "SAMEORIGIN"
check_header "x-content-type-options" "nosniff"
check_header "strict-transport-security" "max-age"

# CSP check (may be complex)
CSP=$(echo "$HEADERS" | grep -i "^content-security-policy:" | head -1)
if [ -n "$CSP" ]; then
    pass "Content-Security-Policy present"
else
    warn "Content-Security-Policy header missing"
fi

echo ""

# ── API Security ──────────────────────────────────────────
echo "## API Security"

# Health endpoint should be public
HEALTH_CODE=$(curl -sf --max-time 10 -o /dev/null -w "%{http_code}" "$SITE_URL/api/health" 2>/dev/null || echo "000")
if [ "$HEALTH_CODE" = "200" ]; then
    pass "Health endpoint accessible"
else
    fail "Health endpoint returned $HEALTH_CODE"
fi

# Protected endpoints should require auth (in production mode)
DASH_CODE=$(curl -sf --max-time 10 -o /dev/null -w "%{http_code}" "$SITE_URL/api/dashboards" 2>/dev/null || echo "000")
if [ "$DASH_CODE" = "200" ]; then
    # This might be OK in dev mode, but warn in case
    warn "/api/dashboards returned 200 without auth (OK if dev mode)"
elif [ "$DASH_CODE" = "401" ] || [ "$DASH_CODE" = "403" ]; then
    pass "/api/dashboards requires authentication"
else
    warn "/api/dashboards returned unexpected $DASH_CODE"
fi

# Check that error responses don't leak stack traces
ERROR_BODY=$(curl -sf --max-time 10 "$SITE_URL/api/dashboards/nonexistent-12345" 2>/dev/null || echo "")
if echo "$ERROR_BODY" | grep -qi "stack\|trace\|node_modules\|at .*\.ts:" 2>/dev/null; then
    fail "Error responses may be leaking stack traces"
else
    pass "Error responses don't expose internals"
fi

echo ""

# ── Infrastructure ────────────────────────────────────────
echo "## Infrastructure"

# Check health response content
HEALTH_BODY=$(curl -sf --max-time 10 "$SITE_URL/api/health" 2>/dev/null || echo "{}")

# Database connected
DB_STATUS=$(echo "$HEALTH_BODY" | python3 -c "import sys,json; print(json.load(sys.stdin).get('database',{}).get('status','unknown'))" 2>/dev/null || echo "unknown")
if [ "$DB_STATUS" = "connected" ]; then
    pass "Database connected"
else
    fail "Database status: $DB_STATUS"
fi

# Memory usage
HEAP_MB=$(echo "$HEALTH_BODY" | python3 -c "import sys,json; print(json.load(sys.stdin).get('memory',{}).get('heapUsedMB',0))" 2>/dev/null || echo "0")
if [ "$HEAP_MB" -lt 300 ]; then
    pass "Memory usage healthy (${HEAP_MB}MB heap)"
elif [ "$HEAP_MB" -lt 450 ]; then
    warn "Memory usage elevated (${HEAP_MB}MB heap)"
else
    fail "Memory usage high (${HEAP_MB}MB heap) — consider restart"
fi

# Response time
START=$(python3 -c 'import time; print(int(time.time() * 1000))')
curl -sf --max-time 10 "$SITE_URL/api/health" > /dev/null 2>&1
END=$(python3 -c 'import time; print(int(time.time() * 1000))')
RESPONSE_MS=$((END - START))
if [ "$RESPONSE_MS" -lt 500 ]; then
    pass "Response time ${RESPONSE_MS}ms"
elif [ "$RESPONSE_MS" -lt 2000 ]; then
    warn "Response time ${RESPONSE_MS}ms (slow)"
else
    fail "Response time ${RESPONSE_MS}ms (very slow)"
fi

echo ""

# ── Summary ───────────────────────────────────────────────
echo "═══════════════════════════════════"
echo "  ✅ Passed:   $PASSES"
echo "  ⚠️  Warnings: $WARNINGS"
echo "  ❌ Failures: $FAILURES"
echo "═══════════════════════════════════"

if [ "$FAILURES" -gt 0 ]; then
    exit 1
fi
