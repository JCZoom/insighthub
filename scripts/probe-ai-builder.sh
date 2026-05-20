#!/bin/bash
# probe-ai-builder.sh — pressure-test the AI dashboard builder by firing a
# natural-language prompt at POST /api/chat and reporting which data sources,
# widget types, and filters the LLM emitted, plus the integrity-verification
# verdict.
#
# Usage:
#   ./scripts/probe-ai-builder.sh "Build me a dashboard for today's phone tickets" 01-today-phone
#
# Override the target by setting BASE_URL (defaults to prod). Examples:
#   BASE_URL=http://localhost:3000 \
#       ./scripts/probe-ai-builder.sh "Today's phone calls" 01-today-phone
#   BASE_URL=https://dashboards.jeffcoy.net \
#       ./scripts/probe-ai-builder.sh "..." ...
#
# Output: writes the raw JSON response to /tmp/insighthub-probes/${LABEL}.json
# and prints a human-readable summary to stdout.
#
# History: created 2026-05-19 during the AI dashboard builder pressure test
# documented in docs/AI_DASHBOARD_BUILDER_FINDINGS_2026-05-19.md. Made
# BASE_URL-configurable 2026-05-19 for local re-probes after the
# Freshworks-catalog fix landed.
PROMPT="$1"
LABEL="$2"
BASE_URL="${BASE_URL:-https://dashboards.jeffcoy.net}"
mkdir -p /tmp/insighthub-probes
OUT="/tmp/insighthub-probes/${LABEL}.json"

curl -sS -X POST "${BASE_URL}/api/chat" \
  -H 'Content-Type: application/json' \
  -d "$(jq -n --arg m "$PROMPT" '{message:$m, stream:false}')" > "$OUT"

echo "=== $LABEL ==="
echo "PROMPT: $PROMPT"
echo "---"
jq -r '
  if .error then "ERROR: " + .error
  else
    "EXPLANATION: " + (.explanation // "(none)" | .[0:200]),
    "PATCHES:",
    (.patches // [] | .[] |
      "  type=" + (.type // "?") +
      " widget=" + ((.widget.type // .schema.widgets[0].type) // "?") +
      " source=" + ((.widget.dataConfig.source // .schema.widgets[0].dataConfig.source) // "?") +
      " title=" + ((.widget.title // .schema.widgets[0].title) // "?")),
    "QUICKACTIONS: " + ([.quickActions // [] | .[].label] | tostring),
    if .verification then "VERIFY: verdict=" + (.verification.overallVerdict // "?") + " conf=" + (.verification.overallConfidence | tostring) else empty end
  end
' "$OUT"
echo ""
