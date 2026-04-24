#!/usr/bin/env python3
"""Close Asana subtasks for compliance gaps whose docs have shipped.

Usage: python3 scripts/close_compliance_asana_tasks.py G-04 G-18 G-34 G-37

Looks under the parent task "🛡️ USZoom Policy Compliance — Gap Remediation"
for subtasks whose name starts with "[G-NN]" and marks them completed.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

import requests


REPO_ROOT = Path(__file__).resolve().parent.parent
PROJECT_GID = "1214122597260827"
PARENT_NAME = "🛡️ USZoom Policy Compliance — Gap Remediation"


def load_pat() -> str:
    pat = os.environ.get("ASANA_PERSONAL_ACCESS_TOKEN")
    if pat:
        return pat
    for candidate in (".env", ".env.local"):
        envfile = REPO_ROOT / candidate
        if not envfile.exists():
            continue
        for line in envfile.read_text().splitlines():
            if line.startswith("ASANA_PERSONAL_ACCESS_TOKEN="):
                return line.split("=", 1)[1].strip().strip('"').strip("'")
    raise SystemExit("ASANA_PERSONAL_ACCESS_TOKEN not set")


def main(argv: list[str]) -> int:
    if not argv:
        print("Usage: close_compliance_asana_tasks.py G-NN [G-NN ...] [--note 'text']", file=sys.stderr)
        return 2

    note = None
    gap_ids = []
    i = 0
    while i < len(argv):
        if argv[i] == "--note" and i + 1 < len(argv):
            note = argv[i + 1]
            i += 2
        else:
            gap_ids.append(argv[i])
            i += 1

    pat = load_pat()
    headers = {"Authorization": f"Bearer {pat}", "Content-Type": "application/json"}

    # Find parent task.
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
            break
    if not parent_gid:
        print(f"ERROR: parent task '{PARENT_NAME}' not found in project.", file=sys.stderr)
        return 1

    # List subtasks.
    r = requests.get(
        f"https://app.asana.com/api/1.0/tasks/{parent_gid}/subtasks",
        headers=headers,
        params={"opt_fields": "name,completed", "limit": 100},
        timeout=30,
    )
    r.raise_for_status()
    subtasks = r.json().get("data", [])

    closed = 0
    missing = []
    for gap_id in gap_ids:
        prefix = f"[{gap_id}]"
        match = next((s for s in subtasks if s["name"].startswith(prefix)), None)
        if not match:
            missing.append(gap_id)
            continue
        if match.get("completed"):
            print(f"= {gap_id} already completed.")
            closed += 1
            continue
        # Mark complete + add a note comment if provided.
        r = requests.put(
            f"https://app.asana.com/api/1.0/tasks/{match['gid']}",
            headers=headers,
            json={"data": {"completed": True}},
            timeout=30,
        )
        r.raise_for_status()
        if note:
            requests.post(
                f"https://app.asana.com/api/1.0/tasks/{match['gid']}/stories",
                headers=headers,
                json={"data": {"text": note}},
                timeout=30,
            )
        print(f"✓ Closed {gap_id}: {match['name']}")
        closed += 1

    if missing:
        print(f"\nWARNING: not found: {', '.join(missing)}", file=sys.stderr)

    print(f"\nClosed {closed} of {len(gap_ids)} requested.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
