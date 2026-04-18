#!/usr/bin/env python3
"""
Reconcile session work against Asana.
Marks completed subtasks and creates tasks for work not covered by existing tasks.
"""

import os
import sys
import json
import time
import requests
from pathlib import Path
from dotenv import load_dotenv

env_path = Path(__file__).resolve().parent.parent / ".env.local"
load_dotenv(env_path)

PAT = os.environ.get("ASANA_PERSONAL_ACCESS_TOKEN")
PROJECT_GID = os.environ.get("ASANA_PROJECT_GID")

if not PAT or not PROJECT_GID:
    print("ERROR: ASANA_PERSONAL_ACCESS_TOKEN and ASANA_PROJECT_GID required")
    sys.exit(1)

HEADERS = {
    "Authorization": f"Bearer {PAT}",
    "Content-Type": "application/json",
}
BASE = "https://app.asana.com/api/1.0"

# Load GID mapping
gids = json.loads((Path(__file__).resolve().parent.parent / "docs" / "asana-task-gids.json").read_text())


def api(method, path, data=None):
    url = f"{BASE}{path}"
    for attempt in range(3):
        resp = getattr(requests, method)(url, headers=HEADERS, json={"data": data} if data else None)
        if resp.status_code == 429:
            wait = int(resp.headers.get("Retry-After", 5))
            print(f"  Rate limited, waiting {wait}s...")
            time.sleep(wait)
            continue
        if resp.status_code >= 400:
            print(f"  ERROR {resp.status_code}: {resp.text[:200]}")
            return None
        return resp.json().get("data")
    return None


def complete_task(gid, name=""):
    """Mark a task or subtask as complete."""
    result = api("put", f"/tasks/{gid}", {"completed": True})
    if result:
        print(f"  ✅ Completed: {name or gid}")
    return result


def find_subtask_by_name(parent_gid, search_text):
    """Find a subtask under a parent by partial name match."""
    subtasks = api("get", f"/tasks/{parent_gid}/subtasks") or []
    # handle pagination
    if isinstance(subtasks, list):
        for st in subtasks:
            if search_text.lower() in st.get("name", "").lower():
                return st["gid"]
    return None


def get_subtasks(parent_gid):
    """Get all subtasks of a task."""
    url = f"{BASE}/tasks/{parent_gid}/subtasks?opt_fields=name,completed"
    all_tasks = []
    while url:
        resp = requests.get(url, headers=HEADERS)
        if resp.status_code != 200:
            break
        body = resp.json()
        all_tasks.extend(body.get("data", []))
        next_page = body.get("next_page")
        url = next_page.get("uri") if next_page else None
    return all_tasks


def complete_subtask_by_name(parent_gid, search_text):
    """Find and complete a subtask by name."""
    subtasks = get_subtasks(parent_gid)
    for st in subtasks:
        if search_text.lower() in st.get("name", "").lower():
            if not st.get("completed"):
                complete_task(st["gid"], st["name"])
            else:
                print(f"  (already done: {st['name']})")
            return True
    print(f"  ⚠️  Subtask not found: '{search_text}' under {parent_gid}")
    return False


def create_and_complete_task(section_gid, name, notes=""):
    """Create a new task, move to section, and mark complete."""
    task = api("post", "/tasks", {
        "name": name,
        "notes": notes,
        "projects": [PROJECT_GID],
        "completed": True,
    })
    if task:
        api("post", f"/sections/{section_gid}/addTask", {"task": task["gid"]})
        print(f"  ✅ Created & completed: {name}")
    return task


def main():
    print("Reconciling session work with Asana...\n")
    tasks = gids.get("tasks", {})
    sections = gids.get("sections", {})

    # ==============================================================
    # 1. Dashboard CRUD API — maps to "Dashboard CRUD API" task
    # ==============================================================
    print("--- Dashboard CRUD API ---")
    crud_gid = tasks.get("dashboard_crud")
    if crud_gid:
        complete_subtask_by_name(crud_gid, "GET /api/dashboards")
        complete_subtask_by_name(crud_gid, "POST /api/dashboards — create")
        complete_subtask_by_name(crud_gid, "GET /api/dashboards/[id]")
        complete_subtask_by_name(crud_gid, "PUT /api/dashboards/[id]")
        complete_subtask_by_name(crud_gid, "DELETE /api/dashboards/[id]")
        complete_subtask_by_name(crud_gid, "GET /api/dashboards/[id]/versions")
        complete_subtask_by_name(crud_gid, "POST /api/dashboards/[id]/versions")
        complete_subtask_by_name(crud_gid, "POST /api/dashboards/[id]/revert")
        # Mark parent complete
        complete_task(crud_gid, "Dashboard CRUD API")

    # ==============================================================
    # 2. Glossary CRUD API
    # ==============================================================
    print("\n--- Glossary CRUD API ---")
    # Find the glossary CRUD task - look in glossary section
    glossary_section = sections.get("glossary") or sections.get("glossary_system")
    # Create a completed task for this work
    if glossary_section:
        create_and_complete_task(glossary_section,
            "Glossary CRUD API — POST, PUT, DELETE, search",
            "Implemented full CRUD:\n"
            "- POST /api/glossary — create term (Admin)\n"
            "- PUT /api/glossary/[id] — update term (Admin)\n"
            "- DELETE /api/glossary/[id] — delete term (Admin)\n"
            "- GET /api/glossary/search?q=&category= — search terms in DB\n"
            "- Enhanced GET /api/glossary to support ?source=db for DB-backed terms\n"
            "Files: src/app/api/glossary/route.ts, src/app/api/glossary/[id]/route.ts, src/app/api/glossary/search/route.ts")

    # ==============================================================
    # 3. Widget renderers
    # ==============================================================
    print("\n--- Widget Renderers ---")
    widget_gid = tasks.get("widget_renderers")
    if widget_gid:
        complete_subtask_by_name(widget_gid, "Funnel")
        complete_subtask_by_name(widget_gid, "MetricRow")
        complete_subtask_by_name(widget_gid, "ScatterPlot")

    # ==============================================================
    # 4. Error handling — maps to "Error handling & logging framework"
    # ==============================================================
    print("\n--- Error Handling ---")
    error_gid = tasks.get("error_handling")
    if error_gid:
        complete_subtask_by_name(error_gid, "React error boundaries")
        complete_subtask_by_name(error_gid, "Client-side error reporting")

    # ==============================================================
    # 5. Keyboard shortcuts — maps to "Keyboard shortcuts" in canvas_ux
    # ==============================================================
    print("\n--- Keyboard Shortcuts ---")
    canvas_section = sections.get("canvas_ux") or sections.get("dashboard_canvas")
    if canvas_section:
        create_and_complete_task(canvas_section,
            "Keyboard shortcuts",
            "Implemented global keyboard shortcut hook:\n"
            "- Cmd+Z → undo\n"
            "- Cmd+Shift+Z → redo\n"
            "- Cmd+S → save dashboard\n"
            "- Cmd+K → search (placeholder)\n"
            "- / → focus chat input\n"
            "File: src/hooks/useKeyboardShortcuts.ts\n"
            "Wired into both /dashboard/[id] and /dashboard/new editors.")

    # ==============================================================
    # 6. Dashboard auto-save
    # ==============================================================
    print("\n--- Auto-save ---")
    if canvas_section:
        create_and_complete_task(canvas_section,
            "Dashboard auto-save (30s debounce)",
            "Implemented auto-save hook:\n"
            "- 30-second debounce after last change\n"
            "- POSTs to /api/dashboards/[id]/versions\n"
            "- Marks store as saved on success\n"
            "- Save button now wired to actually persist via API\n"
            "- Shows saving/saved/error states\n"
            "File: src/hooks/useAutoSave.ts")

    # ==============================================================
    # 7. Toast notification system
    # ==============================================================
    print("\n--- Toast System ---")
    foundation_section = sections.get("foundation")
    if foundation_section:
        create_and_complete_task(foundation_section,
            "Toast notification system",
            "Lightweight toast notification system:\n"
            "- ToastProvider context with useToast hook\n"
            "- 4 types: success, error, warning, info\n"
            "- Auto-dismiss after 4s, max 5 visible\n"
            "- Glassmorphism design matching app theme\n"
            "- Added to root layout\n"
            "File: src/components/ui/toast.tsx")

    # ==============================================================
    # 8. Health check endpoint
    # ==============================================================
    print("\n--- Health Check ---")
    deploy_section = sections.get("deployment")
    if deploy_section:
        create_and_complete_task(deploy_section,
            "Health check endpoint (/api/health)",
            "GET /api/health — returns status, DB connectivity, AI key check.\n"
            "Returns 503 if DB is disconnected.\n"
            "File: src/app/api/health/route.ts")

    # ==============================================================
    # 9. Page-level error boundary
    # ==============================================================
    print("\n--- Error Boundary ---")
    if foundation_section:
        create_and_complete_task(foundation_section,
            "Page-level error boundary component",
            "Reusable ErrorBoundary component for page-level crash recovery.\n"
            "Shows friendly error UI with 'Try Again' and 'Go Home' buttons.\n"
            "File: src/components/ui/ErrorBoundary.tsx")

    # ==============================================================
    # 10. Dashboard sharing API
    # ==============================================================
    print("\n--- Dashboard Sharing ---")
    sharing_gid = tasks.get("sharing")
    if sharing_gid:
        complete_subtask_by_name(sharing_gid, "API: POST /api/dashboards")
        # Create the share API subtask
        api("post", f"/tasks/{sharing_gid}/subtasks", {
            "name": "Share API: POST + GET /api/dashboards/[id]/share",
            "notes": "Implemented upsert share and list shares endpoints.",
            "completed": True,
        })
        print("  ✅ Created & completed share API subtask")

    print("\n🎉 Reconciliation complete! Re-syncing...")


if __name__ == "__main__":
    main()
