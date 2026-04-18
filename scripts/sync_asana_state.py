#!/usr/bin/env python3
"""
Sync Asana project state to local summary file.
Reads all tasks/subtasks from the InsightHub project and generates:
  - docs/asana-daily-summary.md   (human-readable overview)
  - docs/asana-task-gids.json     (updated GID mapping)
"""

import os
import sys
import json
import datetime
import requests
from pathlib import Path
from dotenv import load_dotenv

env_path = Path(__file__).resolve().parent.parent / ".env.local"
load_dotenv(env_path)

PAT = os.environ.get("ASANA_PERSONAL_ACCESS_TOKEN")
PROJECT_GID = os.environ.get("ASANA_PROJECT_GID")

if not PAT or not PROJECT_GID:
    print("ERROR: ASANA_PERSONAL_ACCESS_TOKEN and ASANA_PROJECT_GID required in .env.local")
    sys.exit(1)

HEADERS = {
    "Authorization": f"Bearer {PAT}",
    "Content-Type": "application/json",
}
BASE = "https://app.asana.com/api/1.0"
DOCS = Path(__file__).resolve().parent.parent / "docs"


def api_get(path, params=None):
    """GET from Asana API with pagination support."""
    url = f"{BASE}{path}"
    all_data = []
    while url:
        resp = requests.get(url, headers=HEADERS, params=params)
        if resp.status_code == 429:
            import time
            time.sleep(int(resp.headers.get("Retry-After", 5)))
            continue
        if resp.status_code >= 400:
            print(f"  ERROR {resp.status_code}: {resp.text[:200]}")
            return all_data
        body = resp.json()
        all_data.extend(body.get("data", []))
        next_page = body.get("next_page")
        if next_page:
            url = next_page.get("uri")
            params = None  # URI already has params
        else:
            break
    return all_data


def get_sections():
    """Get all sections in the project."""
    return api_get(f"/projects/{PROJECT_GID}/sections")


def get_tasks_in_section(section_gid):
    """Get tasks in a section with details."""
    return api_get(
        f"/sections/{section_gid}/tasks",
        params={"opt_fields": "name,completed,due_on,notes,assignee.name"}
    )


def get_subtasks(task_gid):
    """Get subtasks of a task."""
    return api_get(
        f"/tasks/{task_gid}/subtasks",
        params={"opt_fields": "name,completed"}
    )


def build_summary():
    """Build project summary from Asana."""
    print("Fetching project state from Asana...")
    sections = get_sections()

    summary_lines = []
    summary_lines.append("# InsightHub — Asana Project Summary")
    summary_lines.append(f"\n> Generated: {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    summary_lines.append(f"> Project GID: {PROJECT_GID}")
    summary_lines.append(f"> [View in Asana](https://app.asana.com/0/{PROJECT_GID})\n")

    total_tasks = 0
    completed_tasks = 0
    total_subtasks = 0
    completed_subtasks = 0
    gid_map = {"project": PROJECT_GID, "sections": {}, "tasks": {}}

    for section in sections:
        section_name = section["name"]
        section_gid = section["gid"]
        # Derive a short key from section name
        key = section_name.lower()
        for ch in "🏗️🔐🤖📊🎨📁📖💾⚙️🧪🚀🔮📝 ":
            key = key.replace(ch, "")
        key = key.strip().replace(" ", "_").replace("&", "and").replace("(", "").replace(")", "")[:20]
        gid_map["sections"][key or section_gid] = section_gid

        tasks = get_tasks_in_section(section_gid)
        if not tasks and section_name == "TO SORT":
            summary_lines.append(f"\n## {section_name}\n")
            summary_lines.append("_No items in inbox._\n")
            continue

        summary_lines.append(f"\n## {section_name}\n")

        for task in tasks:
            total_tasks += 1
            check = "x" if task.get("completed") else " "
            if task.get("completed"):
                completed_tasks += 1

            task_name = task["name"]
            task_gid = task["gid"]
            due = f" (due {task['due_on']})" if task.get("due_on") else ""
            summary_lines.append(f"- [{check}] **{task_name}**{due}")

            # Store in GID map
            task_key = task_name.lower().replace(" ", "_")[:40]
            gid_map["tasks"][task_key] = task_gid

            # Subtasks
            subtasks = get_subtasks(task_gid)
            for st in subtasks:
                total_subtasks += 1
                sc = "x" if st.get("completed") else " "
                if st.get("completed"):
                    completed_subtasks += 1
                summary_lines.append(f"  - [{sc}] {st['name']}")

    # Stats header
    stats = [
        "\n---\n",
        "## Quick Stats\n",
        f"| Metric | Count |",
        f"|--------|-------|",
        f"| Total tasks | {total_tasks} |",
        f"| Completed tasks | {completed_tasks} |",
        f"| Total subtasks | {total_subtasks} |",
        f"| Completed subtasks | {completed_subtasks} |",
        f"| **Overall progress** | **{completed_tasks + completed_subtasks}/{total_tasks + total_subtasks} ({round((completed_tasks + completed_subtasks) / max(total_tasks + total_subtasks, 1) * 100)}%)** |",
    ]

    final = stats + ["\n---\n"] + summary_lines

    # Write files
    DOCS.mkdir(exist_ok=True)

    summary_file = DOCS / "asana-daily-summary.md"
    with open(summary_file, "w") as f:
        f.write("\n".join(final))
    print(f"✅ Summary written to {summary_file}")

    gid_file = DOCS / "asana-task-gids.json"
    with open(gid_file, "w") as f:
        json.dump(gid_map, f, indent=2)
    print(f"✅ GID map updated at {gid_file}")

    print(f"\n📊 {completed_tasks}/{total_tasks} tasks complete, "
          f"{completed_subtasks}/{total_subtasks} subtasks complete")


if __name__ == "__main__":
    build_summary()
