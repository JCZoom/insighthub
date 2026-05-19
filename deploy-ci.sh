#!/usr/bin/env bash
# deploy-ci.sh — deploy InsightHub via the CI-driven pipeline without leaving
# your terminal. Replaces deploy.sh (SSH path) as the operator's primary
# entry point as of 2026-05-19 (Track B Phase 1).
#
# WHY THIS SCRIPT EXISTS
# ──────────────────────
# The old deploy.sh SSH'd into EC2 directly using your operator credentials.
# That worked but had three audit problems:
#   1. The deploy log lived on the operator's laptop. If Jeff's laptop died,
#      the audit trail died with it. Auditors call this "non-repudiation
#      failure".
#   2. There was no second-party check — Jeff alone could push anything to
#      prod, including code that hadn't passed CI.
#   3. The deploy was tied to whatever was in Jeff's working tree at that
#      moment, not a specific git SHA. Drift hazard.
#
# Track B Phase 1 fixed all three by routing deploys through GitHub Actions
# on a self-hosted runner that lives on the EC2 box. CI runs every gate
# (typecheck, lint, audit, build, e2e) before the deploy job is even
# eligible, then the production environment requires an approval before the
# deploy job runs. Every deploy now has an immutable workflow log row
# pinned to the github.sha.
#
# The downside of that change is operator UX: now you have to leave the
# terminal, open the browser, find the run, click Approve. This script
# closes that gap by approving via the GitHub API in your shell.
#
# WHAT THIS SCRIPT DOES
# ─────────────────────
#   1. Pre-flight your local git state (clean, on main, synced with origin).
#   2. Show what will deploy (commit range vs last successful prod tag).
#   3. Trigger the CI workflow via `gh workflow run`.
#   4. Watch all five pre-deploy jobs (Security Audit, ESLint, TypeScript,
#      Build, E2E Tests).
#   5. When the deploy job hits the production-environment gate, prompt
#      you to approve, then approve it via the GitHub API.
#   6. Watch the deploy job through to completion.
#   7. Run a production smoke test (TLS + /api/health + memory profile).
#   8. Summarize.
#
# FLAGS
# ─────
#   --yes, -y         Auto-approve the production gate (no prompt).
#   --no-confirm      Skip the pre-deploy "are you sure" prompt.
#   --watch-only      Don't trigger; attach to the most recent CI run.
#   --no-smoke        Skip the post-deploy smoke test.
#   --help, -h        Show this help.
#
# REQUIREMENTS
# ────────────
#   - gh CLI authenticated with `repo` scope (for workflow_dispatch + the
#     pending_deployments approval endpoint).
#   - Local git checkout on `main`, working tree clean.
#   - Network reachability to api.github.com and dashboards.jeffcoy.net.

set -euo pipefail

# ─── Config (edit here, not inline) ────────────────────────────────────────
REPO="JCZoom/insighthub"
WORKFLOW="ci.yml"
BRANCH="main"
ENV_NAME="production"
SITE_URL="https://dashboards.jeffcoy.net"
LAST_PROD_TAG_PREFIX="track-b-phase1-"

# ─── Color helpers (TTY-aware so logs stay greppable when piped) ───────────
if [[ -t 1 ]]; then
  C_RESET="$(printf '\033[0m')"
  C_BOLD="$(printf '\033[1m')"
  C_DIM="$(printf '\033[2m')"
  C_RED="$(printf '\033[31m')"
  C_GREEN="$(printf '\033[32m')"
  C_YELLOW="$(printf '\033[33m')"
  C_BLUE="$(printf '\033[34m')"
  C_CYAN="$(printf '\033[36m')"
else
  C_RESET=""; C_BOLD=""; C_DIM=""; C_RED=""; C_GREEN=""; C_YELLOW=""; C_BLUE=""; C_CYAN=""
fi

say()  { printf "%s\n" "$*"; }
ok()   { printf "${C_GREEN}✓${C_RESET} %s\n" "$*"; }
warn() { printf "${C_YELLOW}⚠${C_RESET} %s\n" "$*"; }
err()  { printf "${C_RED}✗${C_RESET} %s\n" "$*" >&2; }
hdr()  { printf "\n${C_BOLD}${C_CYAN}── %s${C_RESET}\n" "$*"; }

die()  { err "$*"; exit 1; }

# ─── Flag parsing ──────────────────────────────────────────────────────────
AUTO_APPROVE=false
NO_CONFIRM=false
WATCH_ONLY=false
NO_SMOKE=false
SHOW_HELP=false

for arg in "$@"; do
  case "$arg" in
    --yes|-y)      AUTO_APPROVE=true ;;
    --no-confirm)  NO_CONFIRM=true ;;
    --watch-only)  WATCH_ONLY=true ;;
    --no-smoke)    NO_SMOKE=true ;;
    --help|-h)     SHOW_HELP=true ;;
    *)             die "unknown flag: $arg (try --help)" ;;
  esac
done

if [[ "$SHOW_HELP" = true ]]; then
  sed -n '1,/^set -euo pipefail$/p' "$0" | sed 's/^# \{0,1\}//' | head -n 60
  exit 0
fi

# ─── Pre-flight ────────────────────────────────────────────────────────────
hdr "Pre-flight"

command -v gh   >/dev/null 2>&1 || die "gh CLI not installed (brew install gh)"
command -v jq   >/dev/null 2>&1 || die "jq not installed (brew install jq)"
command -v curl >/dev/null 2>&1 || die "curl not installed"

gh auth status -h github.com >/dev/null 2>&1 || die "gh not authenticated (run: gh auth login)"

# Confirm token has the scopes we need. `gh auth status` returns the
# scope list in human-readable form; we just check for `repo`.
if ! gh auth status -h github.com 2>&1 | grep -q "'repo'"; then
  die "gh token missing 'repo' scope (needed for workflow_dispatch + environment approval). Run: gh auth refresh -s repo"
fi
ok "gh authenticated with required scopes"

if [[ "$WATCH_ONLY" = false ]]; then
  # Only enforce git hygiene when we're triggering a NEW deploy. Watch-only
  # mode might be used post-hoc to monitor someone else's run.
  current_branch="$(git rev-parse --abbrev-ref HEAD)"
  [[ "$current_branch" = "$BRANCH" ]] || die "not on $BRANCH (currently on $current_branch). Switch with: git checkout $BRANCH"
  ok "on branch $BRANCH"

  if ! git diff --quiet || ! git diff --cached --quiet; then
    die "working tree dirty. Commit or stash before deploying (we deploy a SHA, not your local files)."
  fi
  ok "working tree clean"

  git fetch --quiet origin "$BRANCH"
  local_sha="$(git rev-parse "$BRANCH")"
  remote_sha="$(git rev-parse "origin/$BRANCH")"
  if [[ "$local_sha" != "$remote_sha" ]]; then
    behind=$(git rev-list --count "$local_sha..origin/$BRANCH" 2>/dev/null || echo 0)
    ahead=$(git rev-list --count "origin/$BRANCH..$local_sha" 2>/dev/null || echo 0)
    if [[ "$ahead" -gt 0 && "$behind" -eq 0 ]]; then
      warn "you are $ahead commit(s) ahead of origin/$BRANCH. Pushing first…"
      git push origin "$BRANCH"
      ok "pushed"
    else
      die "local $BRANCH out of sync with origin/$BRANCH (ahead=$ahead, behind=$behind). Reconcile first."
    fi
  fi
  ok "in sync with origin/$BRANCH"
fi

# ─── Show what will deploy ─────────────────────────────────────────────────
if [[ "$WATCH_ONLY" = false ]]; then
  hdr "What will deploy"

  head_sha="$(git rev-parse --short HEAD)"
  head_subject="$(git log -1 --format='%s')"

  # Find the most recent production tag (best-effort — falls back gracefully
  # if no tag matches the prefix).
  last_tag="$(git tag --list "${LAST_PROD_TAG_PREFIX}*" --sort=-creatordate 2>/dev/null | head -1)"
  if [[ -n "$last_tag" ]]; then
    range="${last_tag}..HEAD"
    say "${C_DIM}Range: $range${C_RESET}"
    n_commits=$(git rev-list --count "$range")
    if [[ "$n_commits" -eq 0 ]]; then
      warn "no new commits since $last_tag — this would be a no-op redeploy"
    else
      say "${C_BOLD}$n_commits commit(s) since $last_tag:${C_RESET}"
      git log --oneline --no-decorate "$range" | sed 's/^/  /'
    fi
  else
    warn "no prior tag matching ${LAST_PROD_TAG_PREFIX}* — showing last 10 commits as a hint"
    git log --oneline --no-decorate -10 | sed 's/^/  /'
  fi

  say ""
  say "${C_BOLD}HEAD:${C_RESET} $head_sha — $head_subject"
fi

# ─── Confirm ───────────────────────────────────────────────────────────────
if [[ "$WATCH_ONLY" = false && "$NO_CONFIRM" = false ]]; then
  printf "\n${C_BOLD}Trigger deploy of %s to %s? [y/N] ${C_RESET}" "$head_sha" "$SITE_URL"
  read -r answer
  case "$answer" in
    y|Y|yes|YES) ;;
    *) die "aborted" ;;
  esac
fi

# ─── Trigger workflow ──────────────────────────────────────────────────────
if [[ "$WATCH_ONLY" = false ]]; then
  hdr "Triggering workflow"
  trigger_ts="$(date -u +%s)"
  gh workflow run "$WORKFLOW" --ref "$BRANCH" --repo "$REPO"
  ok "workflow_dispatch event sent"

  # `gh workflow run` does not return a run ID. Poll the runs list and
  # grab the newest workflow_dispatch run created after our trigger
  # timestamp. 10s ceiling is generous; usually appears within 2-3s.
  RUN_ID=""
  for i in 1 2 3 4 5 6 7 8 9 10; do
    sleep 1
    candidate=$(gh run list \
      --workflow="$WORKFLOW" \
      --branch="$BRANCH" \
      --event=workflow_dispatch \
      --limit=1 \
      --repo "$REPO" \
      --json databaseId,createdAt \
      --jq '.[0]')
    if [[ -n "$candidate" && "$candidate" != "null" ]]; then
      run_created=$(echo "$candidate" | jq -r '.createdAt')
      run_created_ts=$(date -j -f "%Y-%m-%dT%H:%M:%SZ" "${run_created%.*Z}Z" +%s 2>/dev/null \
        || python3 -c "import sys,datetime; print(int(datetime.datetime.fromisoformat('$run_created'.replace('Z','+00:00')).timestamp()))" 2>/dev/null \
        || echo 0)
      if (( run_created_ts >= trigger_ts - 5 )); then
        RUN_ID=$(echo "$candidate" | jq -r '.databaseId')
        break
      fi
    fi
  done
  [[ -n "$RUN_ID" ]] || die "could not locate the new run within 10s (check https://github.com/$REPO/actions)"
  ok "run id: $RUN_ID"
  say "${C_DIM}https://github.com/$REPO/actions/runs/$RUN_ID${C_RESET}"
else
  hdr "Attaching to most recent run"
  RUN_ID=$(gh run list --workflow="$WORKFLOW" --branch="$BRANCH" --limit=1 --repo "$REPO" --json databaseId --jq '.[0].databaseId')
  [[ -n "$RUN_ID" && "$RUN_ID" != "null" ]] || die "no recent runs found"
  ok "run id: $RUN_ID"
fi

# ─── Watch pre-deploy jobs ─────────────────────────────────────────────────
hdr "Watching pre-deploy jobs"
say "${C_DIM}(typecheck → lint → audit → build → e2e → deploy gate)${C_RESET}"

# Poll until the deploy job is either waiting for approval, in progress,
# completed, or the run is in a terminal state.
PRE_DEPLOY_DONE=false
for i in $(seq 1 120); do  # 120 × 5s = 10 min max for pre-deploy
  sleep 5
  jobs_json=$(gh run view "$RUN_ID" --repo "$REPO" --json jobs --jq '.jobs')
  run_status=$(gh run view "$RUN_ID" --repo "$REPO" --json status,conclusion --jq '.status + " / " + (.conclusion // "running")')

  # Render a one-line dashboard.
  render=$(echo "$jobs_json" | jq -r '
    .[] | (
      if .name == "Deploy to EC2" then empty else
        .name + ":" + (
          if .status == "completed" then
            (if .conclusion == "success" then "✓" else "✗" end)
          elif .status == "in_progress" then "•"
          else "·"
          end
        )
      end
    )
  ' | tr '\n' ' ')

  printf "\r${C_DIM}[%3ds]${C_RESET} %s ${C_DIM}(%s)${C_RESET}    " "$((i*5))" "$render" "$run_status"

  # Detect failure of any pre-deploy job.
  failed=$(echo "$jobs_json" | jq -r '[.[] | select(.name != "Deploy to EC2" and .conclusion == "failure")] | length')
  if [[ "$failed" -gt 0 ]]; then
    printf "\n"
    err "pre-deploy job failed:"
    echo "$jobs_json" | jq -r '.[] | select(.name != "Deploy to EC2" and .conclusion == "failure") | "  - " + .name + " → " + .url'
    die "fix and re-run. See the run UI for logs."
  fi

  # Detect run terminating without ever reaching deploy (cancelled, etc).
  if echo "$run_status" | grep -q "completed"; then
    printf "\n"
    deploy_concl=$(echo "$jobs_json" | jq -r '.[] | select(.name == "Deploy to EC2") | .conclusion // "skipped"')
    if [[ "$deploy_concl" = "skipped" || "$deploy_concl" = "null" ]]; then
      die "run completed without deploying (deploy job: $deploy_concl). Check the run UI."
    fi
    PRE_DEPLOY_DONE=true
    break
  fi

  # Detect the deploy gate.
  deploy_status=$(echo "$jobs_json" | jq -r '.[] | select(.name == "Deploy to EC2") | .status')
  if [[ "$deploy_status" = "waiting" || "$deploy_status" = "queued" ]]; then
    # `waiting` means awaiting approval; `queued` can also occur briefly.
    # Confirm the run is genuinely waiting on a pending_deployment.
    pending=$(gh api "repos/$REPO/actions/runs/$RUN_ID/pending_deployments" 2>/dev/null || echo '[]')
    if [[ "$(echo "$pending" | jq 'length')" -gt 0 ]]; then
      printf "\n"
      ok "all pre-deploy jobs green; deploy is awaiting approval"
      break
    fi
  fi
done

# ─── Approval gate ─────────────────────────────────────────────────────────
if [[ "$PRE_DEPLOY_DONE" = false ]]; then
  hdr "Production environment approval"

  pending=$(gh api "repos/$REPO/actions/runs/$RUN_ID/pending_deployments")
  env_id=$(echo "$pending" | jq -r '.[0].environment.id')
  env_name=$(echo "$pending" | jq -r '.[0].environment.name')
  current_user=$(gh api user --jq .login)

  say "Run:        ${C_DIM}https://github.com/$REPO/actions/runs/$RUN_ID${C_RESET}"
  say "Environment: $env_name (id: $env_id)"
  say "Approver:    $current_user (you)"

  if [[ "$AUTO_APPROVE" = false ]]; then
    printf "\n${C_BOLD}Approve and deploy? [y/N] ${C_RESET}"
    read -r answer
    case "$answer" in
      y|Y|yes|YES) ;;
      *)
        warn "deploy NOT approved. The run will sit in 'waiting' until someone approves or rejects via the UI."
        say "  Approve later: https://github.com/$REPO/actions/runs/$RUN_ID"
        exit 0
        ;;
    esac
  fi

  approve_payload=$(jq -n \
    --argjson env_ids "[$env_id]" \
    --arg comment "Approved via deploy-ci.sh by $current_user at $(date -u +%FT%TZ)" \
    '{environment_ids: $env_ids, state: "approved", comment: $comment}')

  gh api \
    --method POST \
    -H "Accept: application/vnd.github+json" \
    "repos/$REPO/actions/runs/$RUN_ID/pending_deployments" \
    --input - <<< "$approve_payload" \
    >/dev/null
  ok "approval submitted"
fi

# ─── Watch the deploy job ──────────────────────────────────────────────────
hdr "Deploying"

DEPLOY_RESULT=""
for i in $(seq 1 120); do  # 120 × 5s = 10 min max for the deploy itself
  sleep 5
  job=$(gh run view "$RUN_ID" --repo "$REPO" --json jobs --jq '.jobs[] | select(.name == "Deploy to EC2")')
  job_status=$(echo "$job" | jq -r '.status')
  job_concl=$(echo "$job" | jq -r '.conclusion // ""')
  current_step=$(echo "$job" | jq -r '[.steps[] | select(.status == "in_progress")] | .[0].name // "—"')

  printf "\r${C_DIM}[%3ds]${C_RESET} status=%s  step=${C_BOLD}%s${C_RESET}    " "$((i*5))" "$job_status" "$current_step"

  if [[ "$job_status" = "completed" ]]; then
    printf "\n"
    DEPLOY_RESULT="$job_concl"
    break
  fi
done

if [[ "$DEPLOY_RESULT" = "success" ]]; then
  ok "deploy succeeded"
elif [[ -n "$DEPLOY_RESULT" ]]; then
  err "deploy concluded: $DEPLOY_RESULT"
  say "Logs: gh run view $RUN_ID --repo $REPO --log-failed"
  exit 1
else
  warn "deploy still running after 10 min. Check the UI."
  exit 1
fi

# ─── Smoke test ────────────────────────────────────────────────────────────
if [[ "$NO_SMOKE" = false ]]; then
  hdr "Smoke test"

  # Give the new process ~10s to fully come up — the deploy job restarts
  # systemd, but Next.js can take a few seconds to be ready for traffic.
  sleep 10

  # 1. /api/health
  health_json=$(curl -fsS "$SITE_URL/api/health" 2>/dev/null || true)
  if [[ -z "$health_json" ]]; then
    err "/api/health did not respond — site may be down"
    exit 1
  fi

  status=$(echo "$health_json" | jq -r '.status // "?"')
  db_status=$(echo "$health_json" | jq -r '.database.status // "?"')
  heap_mb=$(echo "$health_json" | jq -r '.memory.heapUsedMB // "?"')
  rss_mb=$(echo "$health_json" | jq -r '.memory.rssMB // "?"')
  uptime_s=$(echo "$health_json" | jq -r '.uptime.seconds // "?"')
  version=$(echo "$health_json" | jq -r '.version // "?"')

  if [[ "$status" = "ok" && "$db_status" = "connected" ]]; then
    ok "/api/health: status=$status db=$db_status heap=${heap_mb}MB rss=${rss_mb}MB uptime=${uptime_s}s version=$version"
  else
    err "/api/health degraded: status=$status db=$db_status"
    say "$health_json" | jq .
    exit 1
  fi

  # 2. TLS + HSTS
  headers=$(curl -fsSI "$SITE_URL" 2>/dev/null || true)
  if echo "$headers" | grep -qi 'strict-transport-security'; then
    hsts=$(echo "$headers" | grep -i 'strict-transport-security' | head -1 | tr -d '\r')
    ok "HSTS: $hsts"
  else
    warn "no HSTS header on $SITE_URL"
  fi

  # 3. TLS protocol (best-effort — openssl may not be available)
  if command -v openssl >/dev/null 2>&1; then
    proto=$(echo "Q" | openssl s_client -connect "${SITE_URL#https://}:443" -servername "${SITE_URL#https://}" 2>/dev/null \
      | grep -E '^\s+Protocol\s*:' | head -1 | awk -F': ' '{print $2}' | xargs || true)
    [[ -n "$proto" ]] && ok "TLS: $proto"
  fi

  # 4. Home page returns 200
  http_code=$(curl -sS -o /dev/null -w '%{http_code}' "$SITE_URL/")
  if [[ "$http_code" = "200" ]]; then
    ok "GET / → 200"
  else
    warn "GET / → $http_code"
  fi
fi

# ─── Summary ───────────────────────────────────────────────────────────────
hdr "Done"
deployed_sha=$(gh run view "$RUN_ID" --repo "$REPO" --json headSha --jq '.headSha')
deployed_short="${deployed_sha:0:7}"

cat <<EOF
${C_GREEN}${C_BOLD}✓ Deploy successful${C_RESET}

  Commit:    $deployed_short
  Site:      $SITE_URL
  Run:       https://github.com/$REPO/actions/runs/$RUN_ID
  Asana:     https://app.asana.com/0/1214122597260827/1214944770438858

Next steps you might want:
  - Tag the release:  git tag -a v\$(date +%Y.%m.%d) -m "..." && git push --tags
  - Sync Asana:       /asana-sync (in your IDE)
  - Watch logs:       gh run view $RUN_ID --repo $REPO --log
EOF
