#!/usr/bin/env bash
# apply-oauth-fix.sh — InsightHub auth lockdown remediation (2026-05-20)
#
# Patches /opt/insighthub/.env.local with real Google OAuth credentials,
# corrects NEXTAUTH_URL, and flips NEXT_PUBLIC_DEV_MODE to "false".
# Backs up the previous file with a timestamp before any modification.
#
# Usage: bash /opt/insighthub/scripts/apply-oauth-fix.sh
#   - Prompts interactively for GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET
#   - Shows a redacted diff before committing
#   - Requires explicit "yes" confirmation
#   - Starts insighthub.service after patch (with confirmation)
#
# Idempotent: re-running with the same values is a no-op (diff will show empty).

set -euo pipefail

ENV_FILE="/opt/insighthub/.env.local"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP_FILE="${ENV_FILE}.bak-pre-oauth-fix-${TIMESTAMP}"
NEW_NEXTAUTH_URL="https://dashboards.jeffcoy.net"

echo "==> InsightHub OAuth remediation"
echo "    Env file:       ${ENV_FILE}"
echo "    Backup will be: ${BACKUP_FILE}"
echo

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "ERROR: ${ENV_FILE} not found." >&2
  exit 1
fi

# Pre-flight: confirm service is currently stopped (we expect it to be).
if systemctl is-active --quiet insighthub; then
  echo "WARNING: insighthub.service is currently ACTIVE."
  echo "         The handoff says it should be inactive (stopped at 02:25 UTC)."
  read -r -p "         Continue anyway? [yes/NO]: " confirm_active
  if [[ "${confirm_active}" != "yes" ]]; then
    echo "Aborted."
    exit 1
  fi
fi

# Prompt for credentials. Secret read silently.
echo "Paste credentials from Google Cloud Console (Credentials -> OAuth 2.0 Client IDs)."
echo
read -r -p "GOOGLE_CLIENT_ID:     " GOOGLE_CLIENT_ID
read -r -s -p "GOOGLE_CLIENT_SECRET: " GOOGLE_CLIENT_SECRET
echo

# Validate.
if [[ -z "${GOOGLE_CLIENT_ID}" ]]; then
  echo "ERROR: GOOGLE_CLIENT_ID is empty." >&2
  exit 1
fi
if [[ -z "${GOOGLE_CLIENT_SECRET}" ]]; then
  echo "ERROR: GOOGLE_CLIENT_SECRET is empty." >&2
  exit 1
fi
if [[ "${GOOGLE_CLIENT_ID}" != *.apps.googleusercontent.com ]]; then
  echo "WARNING: GOOGLE_CLIENT_ID does not end in '.apps.googleusercontent.com'."
  echo "         That's the expected suffix. Did you paste the right value?"
  read -r -p "         Continue anyway? [yes/NO]: " confirm_id
  if [[ "${confirm_id}" != "yes" ]]; then
    echo "Aborted."
    exit 1
  fi
fi

# Backup.
cp -p "${ENV_FILE}" "${BACKUP_FILE}"
echo "==> Backed up to ${BACKUP_FILE}"

# Build new file in a tmp location, then atomic-mv.
TMP_FILE="$(mktemp "${ENV_FILE}.XXXXXX")"
trap 'rm -f "${TMP_FILE}"' EXIT

# Use awk to patch only the 4 target keys. Preserves all other lines.
# If a key is missing entirely, we'll detect that and append at end.
awk -v gid="${GOOGLE_CLIENT_ID}" \
    -v gsec="${GOOGLE_CLIENT_SECRET}" \
    -v nurl="${NEW_NEXTAUTH_URL}" '
  BEGIN { seen_id=0; seen_sec=0; seen_url=0; seen_dev=0 }
  /^GOOGLE_CLIENT_ID=/      { print "GOOGLE_CLIENT_ID=\"" gid "\"";    seen_id=1;  next }
  /^GOOGLE_CLIENT_SECRET=/  { print "GOOGLE_CLIENT_SECRET=\"" gsec "\""; seen_sec=1; next }
  /^NEXTAUTH_URL=/          { print "NEXTAUTH_URL=\"" nurl "\"";       seen_url=1; next }
  /^NEXT_PUBLIC_DEV_MODE=/  { print "NEXT_PUBLIC_DEV_MODE=\"false\"";  seen_dev=1; next }
  { print }
  END {
    if (!seen_id)  print "GOOGLE_CLIENT_ID=\"" gid "\""           > "/dev/stderr"
    if (!seen_sec) print "GOOGLE_CLIENT_SECRET=\"" gsec "\""      > "/dev/stderr"
    if (!seen_url) print "NEXTAUTH_URL=\"" nurl "\""              > "/dev/stderr"
    if (!seen_dev) print "NEXT_PUBLIC_DEV_MODE=\"false\""         > "/dev/stderr"
  }
' "${ENV_FILE}" > "${TMP_FILE}" 2>/tmp/awk-missing-keys.txt

if [[ -s /tmp/awk-missing-keys.txt ]]; then
  echo "WARNING: One or more target keys were missing from ${ENV_FILE}."
  echo "         Missing lines (will be appended):"
  sed 's/^/           /' /tmp/awk-missing-keys.txt
  cat /tmp/awk-missing-keys.txt >> "${TMP_FILE}"
fi
rm -f /tmp/awk-missing-keys.txt

# Preserve permissions (600) — `cp -p` on backup already did this for the
# backup, but the tmp file from mktemp gets default umask. Match the
# original explicitly.
chmod --reference="${ENV_FILE}" "${TMP_FILE}"
chown --reference="${ENV_FILE}" "${TMP_FILE}" 2>/dev/null || true

# Show redacted diff.
echo
echo "==> Diff (secrets redacted):"
echo "----"
diff -u "${ENV_FILE}" "${TMP_FILE}" \
  | sed -E 's/(GOOGLE_CLIENT_SECRET=").{0,8}/\1***REDACTED***/' \
  | sed -E 's/(GOOGLE_CLIENT_ID=")[^"]{0,12}/\1***/' \
  || true
echo "----"
echo

read -r -p "==> Apply these changes? [yes/NO]: " confirm
if [[ "${confirm}" != "yes" ]]; then
  echo "Aborted. ${ENV_FILE} unchanged. Backup retained at ${BACKUP_FILE}."
  exit 1
fi

# Atomic move.
mv "${TMP_FILE}" "${ENV_FILE}"
trap - EXIT
echo "==> Patched ${ENV_FILE}."

# Show final non-secret values for sanity.
echo
echo "==> Final values (non-secret):"
grep -E '^(NEXTAUTH_URL|NEXT_PUBLIC_DEV_MODE|ALLOWED_DOMAIN|GOOGLE_CLIENT_ID)=' "${ENV_FILE}" \
  | sed -E 's/(GOOGLE_CLIENT_ID=")[^"]{0,12}/\1***/'
echo

read -r -p "==> Start insighthub.service now? [yes/NO]: " start_confirm
if [[ "${start_confirm}" != "yes" ]]; then
  echo "Service NOT started. Run: sudo systemctl start insighthub"
  echo "Then run smoke tests printed at end of this script (see /opt/insighthub/scripts/oauth-fix-smoke-tests.txt)."
  exit 0
fi

echo "==> sudo systemctl start insighthub"
sudo systemctl start insighthub
sleep 2
sudo systemctl status insighthub --no-pager -n 5 || true
echo
echo "==> Service started. Run smoke tests now:"
echo "    cat /opt/insighthub/scripts/oauth-fix-smoke-tests.txt"
