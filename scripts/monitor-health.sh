#!/bin/bash
# InsightHub production health monitor
#
# Usage:
#   ./scripts/monitor-health.sh                    # One-shot check
#   ./scripts/monitor-health.sh --watch             # Continuous monitoring (every 60s)
#   ./scripts/monitor-health.sh --json              # JSON output (for piping to other tools)
#
# Cron (every 5 minutes):
#   */5 * * * * /opt/insighthub/scripts/monitor-health.sh --json >> /var/log/insighthub-health.log 2>&1
#
set -euo pipefail

SITE_URL="${SITE_URL:-https://dashboards.jeffcoy.net}"
HEALTH_URL="$SITE_URL/api/health"
TIMEOUT=10
WATCH=false
JSON_OUTPUT=false
WATCH_INTERVAL=60

for arg in "$@"; do
    case "$arg" in
        --watch) WATCH=true ;;
        --json) JSON_OUTPUT=true ;;
    esac
done

check_health() {
    local timestamp
    timestamp="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

    # Measure response time
    local start_ms
    start_ms=$(python3 -c 'import time; print(int(time.time() * 1000))')

    local http_code body
    http_code=$(curl -sf --max-time "$TIMEOUT" -o /tmp/insighthub-health-response.json -w "%{http_code}" "$HEALTH_URL" 2>/dev/null) || http_code="000"

    local end_ms
    end_ms=$(python3 -c 'import time; print(int(time.time() * 1000))')
    local response_ms=$(( end_ms - start_ms ))

    # Parse response
    local status="unknown" db_status="unknown" db_latency="?" heap_mb="?" uptime_s="?"
    if [ -f /tmp/insighthub-health-response.json ] && [ "$http_code" != "000" ]; then
        body=$(cat /tmp/insighthub-health-response.json)
        status=$(echo "$body" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('status','unknown'))" 2>/dev/null || echo "parse_error")
        db_status=$(echo "$body" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('database',{}).get('status','unknown'))" 2>/dev/null || echo "?")
        db_latency=$(echo "$body" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('database',{}).get('latencyMs','?'))" 2>/dev/null || echo "?")
        heap_mb=$(echo "$body" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('memory',{}).get('heapUsedMB','?'))" 2>/dev/null || echo "?")
        uptime_s=$(echo "$body" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('uptime',{}).get('seconds','?'))" 2>/dev/null || echo "?")
    fi

    local is_healthy=false
    if [ "$http_code" = "200" ] && [ "$status" = "ok" ]; then
        is_healthy=true
    fi

    if [ "$JSON_OUTPUT" = true ]; then
        cat <<EOF
{"timestamp":"$timestamp","healthy":$is_healthy,"httpCode":$http_code,"responseMs":$response_ms,"status":"$status","database":"$db_status","dbLatencyMs":$db_latency,"heapMB":$heap_mb,"uptimeSeconds":$uptime_s}
EOF
    else
        if [ "$is_healthy" = true ]; then
            echo "✅ [$timestamp] HEALTHY — ${response_ms}ms | DB: ${db_latency}ms | Heap: ${heap_mb}MB | Uptime: ${uptime_s}s"
        elif [ "$http_code" = "000" ]; then
            echo "🔴 [$timestamp] UNREACHABLE — $HEALTH_URL timed out after ${TIMEOUT}s"
        elif [ "$http_code" = "503" ]; then
            echo "🟡 [$timestamp] DEGRADED (HTTP $http_code) — DB: $db_status | ${response_ms}ms"
        else
            echo "🔴 [$timestamp] UNHEALTHY (HTTP $http_code) — ${response_ms}ms | Status: $status"
        fi
    fi

    # Return non-zero for unhealthy (useful for scripting)
    [ "$is_healthy" = true ]
}

if [ "$WATCH" = true ]; then
    echo "Monitoring $SITE_URL every ${WATCH_INTERVAL}s (Ctrl+C to stop)"
    echo ""
    while true; do
        check_health || true
        sleep "$WATCH_INTERVAL"
    done
else
    check_health
fi
