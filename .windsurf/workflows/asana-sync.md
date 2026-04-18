---
description: Sync and review InsightHub Asana project tasks
---

# Asana Project Sync & Review

Use this workflow at the start of any session where we'll be working on InsightHub Asana tasks.

## Steps

// turbo
1. Read the daily summary file to get current project state:
   ```
   cat docs/asana-daily-summary.md
   ```

2. If the summary is stale (more than 4 hours old), re-sync from Asana:
   ```
   python3 scripts/sync_asana_state.py
   ```
   Then re-read the summary.

3. Read the Asana task GID mapping for API operations:
   - File: `docs/asana-task-gids.json`

4. Review what's most important and suggest what to tackle next.

5. **Reconcile session work against Asana.** After presenting the summary (or at the end of a session), review everything accomplished in the current chat and:
   - **Match completed work to existing tasks/subtasks** — mark them complete via the Asana API.
   - **If no matching task exists**, create a new task (or subtask under the relevant parent) with a clear name, description of what was done, and mark it complete immediately.
   - Use the section GIDs and task GID mapping from `docs/asana-task-gids.json` to place tasks correctly.
   - After all updates, re-sync: `python3 scripts/sync_asana_state.py`

   **Creating a task in Asana:**
   ```python
   import requests, os
   PAT = os.environ.get("ASANA_PERSONAL_ACCESS_TOKEN") or "<from .env.local>"
   headers = {"Authorization": f"Bearer {PAT}", "Content-Type": "application/json"}
   # Create task in a section
   resp = requests.post(
       "https://app.asana.com/api/1.0/tasks",
       headers=headers,
       json={"data": {
           "name": "Task name",
           "notes": "Description of what was done",
           "projects": ["1214122597260827"],
           "completed": True,
       }}
   )
   task_gid = resp.json()["data"]["gid"]
   # Move to correct section
   requests.post(
       f"https://app.asana.com/api/1.0/sections/<section_gid>/addTask",
       headers=headers,
       json={"data": {"task": task_gid}}
   )
   ```

   **Creating a subtask:**
   ```python
   resp = requests.post(
       f"https://app.asana.com/api/1.0/tasks/<parent_task_gid>/subtasks",
       headers=headers,
       json={"data": {
           "name": "Subtask name",
           "notes": "What was done",
           "completed": True,
       }}
   )
   ```

## Key Context

- **Project GID:** `1214122597260827`
- **Workspace GID:** `1177728265438418`
- **PAT:** In `.env.local` as `ASANA_PERSONAL_ACCESS_TOKEN`
- **CRITICAL:** Only modify project `1214122597260827` ("InsightHub — AI Dashboard Builder"). Do NOT touch any other project.

## Marking Tasks Complete

To mark a task complete in Asana:
```python
import requests
PAT = "<from .env.local>"
requests.put(
    f"https://app.asana.com/api/1.0/tasks/{task_gid}",
    headers={"Authorization": f"Bearer {PAT}", "Content-Type": "application/json"},
    json={"data": {"completed": True}}
)
```

After completing tasks, re-run `python3 scripts/sync_asana_state.py` to update the local state files.
