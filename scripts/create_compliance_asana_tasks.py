#!/usr/bin/env python3
"""Create a parent Asana task + 38 gap subtasks for USZoom policy compliance remediation.

Run once. Idempotent-ish: checks for an existing parent by name first and only creates
subtasks that don't already exist on it.

Requires ASANA_PERSONAL_ACCESS_TOKEN in env (or .env.local).
"""
from __future__ import annotations

import os
import sys
import time
from pathlib import Path

try:
    import requests
except ImportError:
    print("pip install requests", file=sys.stderr)
    sys.exit(1)


REPO_ROOT = Path(__file__).resolve().parent.parent
PROJECT_GID = "1214122597260827"  # InsightHub Asana project
SECTION_GID = "1214125662423888"  # Auth & Security section


def load_pat() -> str:
    pat = os.environ.get("ASANA_PERSONAL_ACCESS_TOKEN")
    if pat:
        return pat
    # Prefer .env (canonical) over .env.local (may be stale).
    for candidate in (".env", ".env.local"):
        envfile = REPO_ROOT / candidate
        if not envfile.exists():
            continue
        for line in envfile.read_text().splitlines():
            if line.startswith("ASANA_PERSONAL_ACCESS_TOKEN="):
                return line.split("=", 1)[1].strip().strip('"').strip("'")
    raise SystemExit("ASANA_PERSONAL_ACCESS_TOKEN not set")


PARENT_NAME = "🛡️ USZoom Policy Compliance — Gap Remediation"
PARENT_NOTES = (
    "Tracks remediation of gaps identified between InsightHub's current state and "
    "the 35 USZoom ISMS policies in policies_USZoom_2026-04-24/.\n\n"
    "Details:\n"
    "- docs/COMPLIANCE_MATRIX.md — full controls mapping (138 controls).\n"
    "- docs/COMPLIANCE_GAPS.md — ranked gap list with effort + audit risk.\n"
    "- docs/SECURITY_POSTURE_FOR_STAKEHOLDERS.md — narrative for audit/board conversations.\n\n"
    "Each subtask corresponds to a gap ID (G-01 … G-38). Priority tiers:\n"
    "- Tier 1: Do before any external review.\n"
    "- Tier 2: Fix within 30 days of initial audit.\n"
    "- Tier 3: Document & track (OFI-grade)."
)


# (gap_id, tier, audit_risk, effort, title, policy_ref)
GAPS = [
    ("G-01", 1, "HIGH", "M", "Wire Data Classification into schema + UI", "Policy 3698 · DC-01/02/03"),
    ("G-02", 1, "HIGH", "M", "Enforce MFA at the application layer (amr claim check + hardware factor for privileged)", "Policy 3692 · AUTH-02 · AC-05"),
    ("G-03", 1, "MED", "S", "Pin TLS 1.2/1.3 in Nginx + annual SSL Labs test", "Policy 3701 · ENC-01"),
    ("G-04", 1, "HIGH", "M", "Build central Asset Register (docs/ASSET_REGISTER.md) + quarterly review", "Policy 12737 · AM-01/02/03"),
    ("G-05", 1, "HIGH", "M", "Automated PII retention/anonymization + nightly retention cron", "Policy 3700 · DR-01/02/03 · DD-04"),
    ("G-06", 1, "LOW", "S", "Enforce audit log retention upper bound (1-2 years)", "Policy 3700 · DR-04"),
    ("G-07", 1, "MED", "S", "Bump backup retention from 14 to 30 days (or accept + document)", "Policy 4133 · BK-07"),
    ("G-08", 1, "MED", "S", "Log USER_ACCOUNT_DELETION audit event before cascade delete", "Policy 3699 · DD-05"),
    ("G-09", 2, "MED-HIGH", "S", "Quarterly access review tooling + repeating Asana task", "Policy 3691 · AC-08"),
    ("G-10", 2, "MED", "M", "Automated offboarding via Google Admin SDK sync", "Policy 3691 · AC-09"),
    ("G-11", 2, "LOW", "L", "Separate privileged vs general admin accounts (document accepted risk)", "Policy 3691 · AC-10"),
    ("G-12", 2, "MED", "S", "Verify EBS/S3 encryption in deploy.sh pre-flight", "Policy 3701 · ENC-04/05"),
    ("G-13", 2, "HIGH", "M", "Cross-region isolated backups + enforced backup encryption + Secrets Manager for BACKUP_ENCRYPTION_KEY", "Policy 4133 · BK-03/04 · BCP-06"),
    ("G-14", 2, "MED", "M", "Apply CIS Level-1 hardening baseline + capture report", "Policy 3702 · HH-04/06"),
    ("G-15", 2, "MED", "S", "Enable Dependabot + unattended-upgrades + document patching SLAs", "Policy 3715 · OS-20 · HH-05 · SE-08"),
    ("G-16", 2, "MED", "L", "Capture AWS infra in Terraform/CDK (Security Group, EBS, IAM, Route53)", "Policy 4427 · CM-10 · BCP-05"),
    ("G-17", 2, "LOW", "S", "SSH idle timeout via sshd_config ClientAliveInterval", "Policy 3702 · HH-08"),
    ("G-18", 2, "HIGH", "M", "Write Incident Response Runbook + annual tabletop using policy 6458 scenarios", "Policy 3719 · IM-01..06 · 6458"),
    ("G-19", 2, "MED-HIGH", "S", "Enable branch protection on main + PR review (or document solo-dev accepted risk)", "Policy 3718 · SE-01/02 · CM-02"),
    ("G-20", 2, "MED", "S", "Add structured ipAddress/userAgent to AuditLog + metadata sanitizer", "Policy 3715 · OS-12/13"),
    ("G-21", 2, "MED", "M", "CloudWatch alarms for CPU/disk/memory/5xx + alerting wiring", "Policy 3702 · HH-16 · OS-03"),
    ("G-22", 2, "MED-HIGH", "L", "Stand up staging environment + rename dev.db→prod.db + env badge in UI", "Policy 3715 · OS-06 · SE-04"),
    ("G-23", 2, "MED", "M", "Enable AWS Inspector + Config + quarterly nmap vuln scans", "Policy 3715 · OS-18 · HH-10/17"),
    ("G-24", 2, "MED", "S", "Add SAST (Semgrep or CodeQL) to CI", "Policy 3718 · SE-07"),
    ("G-25", 2, "LOW", "S", "Write docs/RELEASE_CHECKLIST.md + link from deploy.sh", "Policy 3718 · SE-09"),
    ("G-26", 2, "MED-HIGH", "S", "Create docs/VENDOR_REGISTER.md with DPAs + SOC reports + annual review", "Policy 3720 · TP-01..05"),
    ("G-27", 2, "MED", "M", "Automated scripts/test-restore.sh + annual restore-test evidence", "Policy 3715 · OS-11 · BK-06 · BCP-07"),
    ("G-28", 3, "LOW-MED", "M", "File Integrity Monitoring on EC2 (AIDE or Wazuh agent)", "Policy 3715 · OS-16"),
    ("G-29", 3, "LOW", "S", "Subscribe to threat-intel feeds + document intake process", "Policy 3715 · OS-17"),
    ("G-30", 3, "LOW", "L", "DLP program (accept risk for current scope)", "Policy 3715 · OS-04"),
    ("G-31", 3, "MED", "M", "Write DR plan with RTO 4h / RPO 24h + annual DR test", "Policy 4428 · BCP-01/04/07"),
    ("G-32", 3, "MED", "L", "Commission third-party penetration test (~$5-15k)", "Policy 3715 · OS-19"),
    ("G-33", 3, "MED", "S", "Add /privacy page + CCPA/SHIELD/CalOPPA compliance UI", "Policy 3714 · REG-02/03/04"),
    ("G-34", 3, "HIGH", "M", "Write docs/RISK_REGISTER.md + docs/STATEMENT_OF_APPLICABILITY.md", "Policy 3716 · 3712"),
    ("G-35", 3, "LOW", "S", "Track annual security awareness training record in HR", "Policy 3704 · ISMS-08"),
    ("G-36", 3, "MED", "M", "Migrate production secrets to AWS Secrets Manager + 90-day rotation policy", "Policy 3701 · ENC-08"),
    ("G-37", 3, "HIGH", "M", "Statement of Applicability for ISO 27001:2022 (covered by G-34)", "Policy 3712"),
    ("G-38", 3, "LOW", "S", "Move ADMIN_EMAILS hardcode into DB-backed AdminRoleAssignment table", "Policy 3691 · AC-01"),
]


def main() -> int:
    pat = load_pat()
    headers = {"Authorization": f"Bearer {pat}", "Content-Type": "application/json"}

    # 1. Find or create the parent task.
    print("Looking for existing parent task...")
    r = requests.get(
        f"https://app.asana.com/api/1.0/projects/{PROJECT_GID}/tasks",
        headers=headers,
        params={"opt_fields": "name", "limit": 100},
        timeout=30,
    )
    r.raise_for_status()
    parent_gid = None
    for t in r.json().get("data", []):
        if t.get("name") == PARENT_NAME:
            parent_gid = t["gid"]
            print(f"  Found existing parent: {parent_gid}")
            break

    if not parent_gid:
        print("Creating parent task...")
        r = requests.post(
            "https://app.asana.com/api/1.0/tasks",
            headers=headers,
            json={
                "data": {
                    "name": PARENT_NAME,
                    "notes": PARENT_NOTES,
                    "projects": [PROJECT_GID],
                    "memberships": [{"project": PROJECT_GID, "section": SECTION_GID}],
                }
            },
            timeout=30,
        )
        r.raise_for_status()
        parent_gid = r.json()["data"]["gid"]
        print(f"  Created parent: {parent_gid}")

    # 2. List existing subtasks to skip duplicates.
    print("Listing existing subtasks...")
    r = requests.get(
        f"https://app.asana.com/api/1.0/tasks/{parent_gid}/subtasks",
        headers=headers,
        params={"opt_fields": "name", "limit": 100},
        timeout=30,
    )
    r.raise_for_status()
    existing_names = {s["name"] for s in r.json().get("data", [])}
    print(f"  Found {len(existing_names)} existing subtasks.")

    # 3. Create missing subtasks.
    created = 0
    skipped = 0
    for gap_id, tier, risk, effort, title, policy in GAPS:
        subtask_name = f"[{gap_id}] [T{tier} · {risk} · {effort}] {title}"
        if any(n.startswith(f"[{gap_id}]") for n in existing_names):
            skipped += 1
            continue
        notes = (
            f"Gap ID: {gap_id}\n"
            f"Priority tier: {tier}\n"
            f"Audit risk: {risk}\n"
            f"Effort: {effort}\n"
            f"Policy reference: {policy}\n\n"
            f"See docs/COMPLIANCE_GAPS.md#{gap_id.lower()} for full remediation plan.\n"
            f"See docs/COMPLIANCE_MATRIX.md for the control(s) this gap closes."
        )
        r = requests.post(
            f"https://app.asana.com/api/1.0/tasks/{parent_gid}/subtasks",
            headers=headers,
            json={"data": {"name": subtask_name, "notes": notes}},
            timeout=30,
        )
        if r.status_code >= 400:
            print(f"  ERROR creating {gap_id}: {r.status_code} {r.text[:200]}")
            continue
        created += 1
        time.sleep(0.2)  # polite to Asana API
        print(f"  + {subtask_name}")

    print("")
    print(f"Done. Parent: https://app.asana.com/0/{PROJECT_GID}/{parent_gid}")
    print(f"Created {created} new subtasks, skipped {skipped} existing.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
