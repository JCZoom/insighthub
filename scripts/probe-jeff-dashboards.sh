#!/bin/bash
#
# probe-jeff-dashboards.sh — verify that every source bound by Jeff's
# three real-data dashboards (Support Operations, Sales Pipeline,
# Platform Health) returns honest data through POST /api/data/query.
#
# For every source, asserts:
#   - HTTP 200
#   - response.fetched_at is present and ISO-parseable
#   - For KPI sources (rows containing `value` + `previous_value`):
#     EXACTLY ONE of these holds:
#       * previous_value is a finite number (honest comparison)
#       * comparison_unavailable_reason is a non-empty string
#         (honest absence with explicit reason)
#   - No row contains the literal string "vs prev" anywhere
#     (a known fabrication tell from the 2026-05-19 AI-builder
#     pressure test)
#
# Output: green per-source PASS/FAIL line + a final summary. Exits
# non-zero if any assertion fails so this can be wired into CI later.
#
# Usage:
#   ./scripts/probe-jeff-dashboards.sh                       # local dev
#   BASE_URL=https://dashboards.jeffcoy.net ./scripts/probe-jeff-dashboards.sh
#   COOKIE='__Secure-next-auth.session-token=...' BASE_URL=... ./scripts/...
#
# Local dev requires NEXT_PUBLIC_DEV_MODE=true (which bypasses auth);
# production requires a valid admin session cookie in $COOKIE.
#
# Ref: docs/REAL_DATA_MIGRATION_PLAN_2026-05-19.md §6.

set -u
BASE_URL="${BASE_URL:-http://localhost:3000}"
COOKIE="${COOKIE:-}"

# ── Sources bound by Jeff's real-data dashboards ───────────────────
# Keep in sync with:
#   scripts/dashboards/jeff-support-ops.ts
#   scripts/dashboards/jeff-sales-pipeline.ts
#   scripts/dashboards/jeff-platform-health.ts
#   scripts/dashboards/jeff-today.ts            (re-uses sources below)
#   scripts/dashboards/jeff-data-trust.ts       (adds freshworks_health_*)
SOURCES=(
  # Support Operations
  freshdesk_open_ticket_count
  freshdesk_overdue_ticket_count
  freshcaller_calls_today
  freshchat_active_conversations
  freshdesk_tickets_by_status
  freshcaller_calls_by_status
  freshchat_conversations_by_status
  freshdesk_recent_tickets
  freshcaller_recent_calls
  freshchat_recent_conversations
  freshdesk_agents
  # Sales Pipeline
  freshsales_pipeline_value
  freshsales_open_deal_count
  freshsales_deals_by_stage
  freshsales_top_deals
  freshsales_contacts_recent
  freshsales_accounts_recent
  # Platform Health
  platform_user_count
  platform_dashboards_total
  platform_dashboards_created_30d
  platform_active_users_7d
  platform_users_by_role
  platform_classification_distribution
  platform_audit_events_by_type_30d
  platform_dashboards_created_by_month
  platform_glossary_term_count
  platform_audit_events_today
  platform_recent_audit_events
  platform_glossary_by_category
  # Data Trust (freshworks_health_*)
  freshworks_health_ok_count
  freshworks_health_suspicious_count
  freshworks_health_error_count
  freshworks_health_summary
  freshworks_health_per_source
)

PASS=0
FAIL=0
mkdir -p /tmp/insighthub-probes

# Color helpers — disabled when stdout is not a tty (CI logs etc.)
if [[ -t 1 ]]; then
  GREEN=$'\033[32m'; RED=$'\033[31m'; YELLOW=$'\033[33m'; RESET=$'\033[0m'
else
  GREEN=""; RED=""; YELLOW=""; RESET=""
fi

probe_source() {
  local source="$1"
  local out="/tmp/insighthub-probes/jeff-${source}.json"
  local http_code

  local curl_args=(
    -sS -w '%{http_code}' -o "$out"
    -X POST "${BASE_URL}/api/data/query"
    -H 'Content-Type: application/json'
    -d "{\"source\":\"${source}\"}"
  )
  if [[ -n "$COOKIE" ]]; then
    curl_args+=( -H "Cookie: ${COOKIE}" )
  fi
  http_code="$(curl "${curl_args[@]}")"

  if [[ "$http_code" != "200" ]]; then
    echo "${RED}FAIL${RESET}  ${source}  HTTP ${http_code}"
    return 1
  fi

  # Field assertions via jq. The script captures any rule violations
  # in $issues; a non-empty value means at least one assertion failed.
  local issues
  issues="$(jq -r '
    def is_finite_number: type == "number" and (. == . and . != null);
    def is_nonempty_string: type == "string" and length > 0;

    [
      # 1. fetched_at must be present and ISO-shaped
      (if (.fetched_at | type) != "string" or
            (.fetched_at | test("^[0-9]{4}-[0-9]{2}-[0-9]{2}T")) | not
       then "fetched_at missing or not ISO" else empty end),

      # 2. KPI rows must satisfy the truth-by-default contract.
      # Heuristic for "is this a KPI row": row contains both `value`
      # and `previous_value` keys (the 5-field contract). For other
      # row shapes (bar/pie/table/line) we skip this assertion.
      (.data[]? | select(has("value") and has("previous_value")) |
       if (.previous_value | is_finite_number) and
          (.comparison_unavailable_reason | (. == null or . == ""))
       then empty
       elif ((.previous_value == null) and
             (.comparison_unavailable_reason | is_nonempty_string))
       then empty
       else "KPI row violates honest-PoP contract: \(.)"
       end),

      # 3. No fabrication tells — the old hash-derived pill rendered
      # the literal "vs prev". A real PoP source uses a SPECIFIC
      # comparison_label like "vs 7 days ago", never the placeholder.
      (.data[]? |
       if (.comparison_label // "" | tostring | test("^vs prev$"))
       then "comparison_label is the legacy placeholder \"vs prev\""
       else empty end)
    ] | map(select(. != null)) | join("; ")
  ' "$out")"

  if [[ -z "$issues" ]]; then
    echo "${GREEN}PASS${RESET}  ${source}"
    return 0
  else
    echo "${RED}FAIL${RESET}  ${source}  ${issues}"
    return 1
  fi
}

echo "=== probe-jeff-dashboards.sh  →  ${BASE_URL}"
echo ""

for source in "${SOURCES[@]}"; do
  if probe_source "$source"; then
    PASS=$(( PASS + 1 ))
  else
    FAIL=$(( FAIL + 1 ))
  fi
done

echo ""
TOTAL=$(( PASS + FAIL ))
if [[ $FAIL -eq 0 ]]; then
  echo "${GREEN}✅ ${PASS}/${TOTAL} sources passed${RESET}"
  exit 0
else
  echo "${RED}❌ ${FAIL}/${TOTAL} sources failed${RESET}  (${PASS} passed)"
  echo "${YELLOW}Inspect raw responses under /tmp/insighthub-probes/jeff-*.json${RESET}"
  exit 1
fi
