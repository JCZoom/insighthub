#!/usr/bin/env python3
"""
Create and populate the InsightHub Asana project with comprehensive tasks.
Run once to bootstrap the project board.
"""

import os
import sys
import json
import time
import requests
from pathlib import Path
from dotenv import load_dotenv

# Load env from .env.local
env_path = Path(__file__).resolve().parent.parent / ".env.local"
load_dotenv(env_path)

PAT = os.environ.get("ASANA_PERSONAL_ACCESS_TOKEN")
WORKSPACE_GID = os.environ.get("ASANA_WORKSPACE_GID", "1177728265438418")

if not PAT:
    print("ERROR: ASANA_PERSONAL_ACCESS_TOKEN not found in .env.local")
    sys.exit(1)

HEADERS = {
    "Authorization": f"Bearer {PAT}",
    "Content-Type": "application/json",
}
BASE = "https://app.asana.com/api/1.0"


def api(method, path, data=None):
    """Make an Asana API call with rate-limit retry."""
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


def create_project():
    """Create the InsightHub project."""
    print("Creating InsightHub project...")
    data = api("post", "/projects", {
        "name": "InsightHub — AI Dashboard Builder",
        "workspace": WORKSPACE_GID,
        "notes": (
            "AI-powered internal dashboard builder.\n\n"
            "Tech: Next.js, TypeScript, Tailwind CSS, Recharts, Claude API, PostgreSQL, Prisma, Zustand.\n\n"
            "Spec: docs/DASHBOARD_BUILDER_SPEC.md\n"
            "Repo: windsurf-project-7"
        ),
        "color": "dark-purple",
        "default_view": "board",
    })
    if not data:
        print("Failed to create project!")
        sys.exit(1)
    print(f"  Created project: {data['gid']}")
    return data["gid"]


def create_section(project_gid, name):
    """Create a section in the project."""
    data = api("post", f"/projects/{project_gid}/sections", {"name": name})
    if data:
        print(f"  Section: {name} ({data['gid']})")
    return data["gid"] if data else None


def create_task(project_gid, section_gid, name, notes="", due_on=None):
    """Create a task in a project section."""
    payload = {
        "name": name,
        "notes": notes,
        "projects": [project_gid],
    }
    if due_on:
        payload["due_on"] = due_on
    task = api("post", "/tasks", payload)
    if task and section_gid:
        api("post", f"/sections/{section_gid}/addTask", {"task": task["gid"]})
    if task:
        print(f"    Task: {name}")
    return task["gid"] if task else None


def create_subtask(parent_gid, name, notes=""):
    """Create a subtask under a parent task."""
    data = api("post", f"/tasks/{parent_gid}/subtasks", {
        "name": name,
        "notes": notes,
    })
    if data:
        print(f"      ↳ {name}")
    return data["gid"] if data else None


def main():
    project_gid = create_project()
    gid_map = {"project": project_gid, "sections": {}, "tasks": {}}

    # =====================================================================
    # SECTIONS & TASKS
    # =====================================================================

    # --- Section 1: Foundation & Infrastructure ---
    s = create_section(project_gid, "🏗️ Foundation & Infrastructure")
    gid_map["sections"]["foundation"] = s

    t = create_task(project_gid, s,
        "Database migrations & seeding",
        "Run Prisma migrations against PostgreSQL. Ensure schema.prisma matches spec Section 3.\n"
        "Create seed script with realistic 18-month sample data (5k customers, 50k tickets, etc).")
    if t:
        gid_map["tasks"]["db_migrations"] = t
        create_subtask(t, "Run prisma migrate dev to create all tables")
        create_subtask(t, "Build seed script (scripts/seed-sample-data.ts) with 5,000 customers")
        create_subtask(t, "Generate 50,000 support tickets with seasonal patterns")
        create_subtask(t, "Generate monthly revenue events (~3-5% churn)")
        create_subtask(t, "Generate product usage data with weekday-heavy patterns")
        create_subtask(t, "Generate 200 sales pipeline deals")
        create_subtask(t, "Verify seed data loads correctly and relationships are intact")

    t = create_task(project_gid, s,
        "Environment configuration & secrets management",
        "Consolidate all env vars. Add Google OAuth credentials, Snowflake stubs, etc.")
    if t:
        gid_map["tasks"]["env_config"] = t
        create_subtask(t, "Add Google OAuth credentials (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET)")
        create_subtask(t, "Add Snowflake connection stubs for Phase 3")
        create_subtask(t, "Create .env.example with all required variables documented")
        create_subtask(t, "Set up environment validation on app startup")

    t = create_task(project_gid, s,
        "Docker Compose for local development",
        "PostgreSQL + optional Redis for caching. One-command dev environment.")
    if t:
        gid_map["tasks"]["docker"] = t
        create_subtask(t, "PostgreSQL container with persistent volume")
        create_subtask(t, "Redis container for query caching (Phase 3)")
        create_subtask(t, "Health check scripts")
        create_subtask(t, "README instructions for docker compose up")

    t = create_task(project_gid, s,
        "Glossary YAML → DB sync system",
        "glossary/terms.yaml is canonical source. Build CLI sync script.\n"
        "Ref: spec Section 4.8")
    if t:
        gid_map["tasks"]["glossary_sync"] = t
        create_subtask(t, "Build scripts/sync-glossary.ts CLI tool")
        create_subtask(t, "Upsert logic — match by term name, update definition/formula")
        create_subtask(t, "Run sync on deploy (npm run glossary:sync)")
        create_subtask(t, "Validate YAML schema before importing")

    t = create_task(project_gid, s,
        "Error handling & logging framework",
        "Structured logging, error boundaries, global API error handling.")
    if t:
        gid_map["tasks"]["error_handling"] = t
        create_subtask(t, "Add React error boundaries for widget crashes")
        create_subtask(t, "Structured JSON logging for API routes")
        create_subtask(t, "Global error handler middleware for API routes")
        create_subtask(t, "Client-side error reporting (toast notifications)")

    # --- Section 2: Auth & Security ---
    s = create_section(project_gid, "🔐 Auth & Security")
    gid_map["sections"]["auth"] = s

    t = create_task(project_gid, s,
        "Google OAuth integration (NextAuth.js)",
        "uszoom.com domain restriction. Role mapping. Session management.\n"
        "Ref: spec Section 4.6")
    if t:
        gid_map["tasks"]["google_oauth"] = t
        create_subtask(t, "Configure NextAuth.js with Google provider")
        create_subtask(t, "Domain restriction — only @uszoom.com emails allowed")
        create_subtask(t, "Auto-create User record on first login")
        create_subtask(t, "Map roles from DB (default VIEWER, admin list for ADMIN)")
        create_subtask(t, "Session persistence with JWT strategy")
        create_subtask(t, "Login page with Google sign-in button")
        create_subtask(t, "Redirect flow — login → onboarding (first visit) or gallery")

    t = create_task(project_gid, s,
        "Role-based access control (RBAC)",
        "4-tier system: VIEWER, CREATOR, POWER_USER, ADMIN.\n"
        "Enforce on both API routes and UI.")
    if t:
        gid_map["tasks"]["rbac"] = t
        create_subtask(t, "Permission helper functions (src/lib/utils/permissions.ts)")
        create_subtask(t, "API middleware to check role before processing requests")
        create_subtask(t, "UI conditional rendering based on user role")
        create_subtask(t, "Admin-only routes protection (/admin/*)")
        create_subtask(t, "Creator+ check for dashboard creation")

    t = create_task(project_gid, s,
        "API rate limiting",
        "Prevent AI/chat abuse. Rate limit per user per endpoint.")
    if t:
        gid_map["tasks"]["rate_limiting"] = t
        create_subtask(t, "Implement sliding window rate limiter")
        create_subtask(t, "Chat API: 30 requests/min per user")
        create_subtask(t, "Dashboard CRUD: 60 requests/min per user")
        create_subtask(t, "Return 429 with Retry-After header")

    t = create_task(project_gid, s,
        "Audit logging",
        "Capture every significant action for GDPR/SOC2 compliance.\n"
        "Ref: spec Section 10.2")
    if t:
        gid_map["tasks"]["audit_logging"] = t
        create_subtask(t, "AuditLog model already in Prisma — wire up creation")
        create_subtask(t, "Log: dashboard.create, dashboard.share, dashboard.delete")
        create_subtask(t, "Log: version.save, version.revert")
        create_subtask(t, "Log: glossary.create, glossary.update, glossary.delete")
        create_subtask(t, "Log: user.login, user.role_change")
        create_subtask(t, "Admin audit log viewer page (/admin/audit)")

    t = create_task(project_gid, s,
        "Session timeout & security headers",
        "8-hour inactivity timeout. CSRF protection. Security headers.")
    if t:
        create_subtask(t, "Configure 8-hour session expiry")
        create_subtask(t, "Add security headers via Next.js middleware (CSP, HSTS, etc)")
        create_subtask(t, "CSRF token validation on mutations")

    # --- Section 3: AI & Chat ---
    s = create_section(project_gid, "🤖 AI & Chat System")
    gid_map["sections"]["ai_chat"] = s

    t = create_task(project_gid, s,
        "SSE streaming for AI responses",
        "Stream schema patches in real-time via Server-Sent Events.\n"
        "Widgets appear progressively as AI generates them.\n"
        "Ref: spec Section 4.2")
    if t:
        gid_map["tasks"]["sse_streaming"] = t
        create_subtask(t, "Convert /api/chat to SSE endpoint (ReadableStream)")
        create_subtask(t, "Stream partial JSON patches as they're generated")
        create_subtask(t, "Client-side EventSource handling in ChatPanel")
        create_subtask(t, "Progress indicator while AI is generating")
        create_subtask(t, "Error recovery if stream disconnects")

    t = create_task(project_gid, s,
        "Chat session persistence",
        "Save chat sessions to DB. Load history when editing existing dashboards.")
    if t:
        gid_map["tasks"]["chat_persistence"] = t
        create_subtask(t, "Create/update ChatSession on conversation start")
        create_subtask(t, "Save each ChatMessage to DB (user + assistant)")
        create_subtask(t, "Load session history when opening dashboard editor")
        create_subtask(t, "API: GET /api/chat/sessions — list user sessions")
        create_subtask(t, "API: GET /api/chat/sessions/[id] — get session + messages")

    t = create_task(project_gid, s,
        "Smart AI suggestions & quick actions",
        "After building a dashboard, AI suggests relevant additions.\n"
        "Quick action buttons for common follow-ups.\n"
        "Ref: spec Sections 4.2 and 10.1")
    if t:
        gid_map["tasks"]["ai_suggestions"] = t
        create_subtask(t, "Post-generation suggestions (\"you might also want NRR and LTV\")")
        create_subtask(t, "Quick action buttons below AI responses")
        create_subtask(t, "\"Add a filter by region\" type suggestions based on current schema")
        create_subtask(t, "\"Explain this metric\" button on widgets → AI explains the calculation")

    t = create_task(project_gid, s,
        "AI change summaries for version history",
        "Auto-generate one-line summaries for each schema change.\n"
        "Ref: spec Section 10.1 point 2")
    if t:
        create_subtask(t, "Generate change note on each patch application")
        create_subtask(t, "Store changeNote in DashboardVersion record")
        create_subtask(t, "Show in version timeline sidebar")

    t = create_task(project_gid, s,
        "Context-aware system prompt builder",
        "Dynamic system prompt includes glossary, current schema, user permissions.\n"
        "Ref: spec Section 4.2")
    if t:
        create_subtask(t, "Inject full glossary into system prompt")
        create_subtask(t, "Inject current dashboard schema")
        create_subtask(t, "Filter available data sources by user role/permissions")
        create_subtask(t, "Include widget library listings for use_widget patches")

    # --- Section 4: Widget System ---
    s = create_section(project_gid, "📊 Widget System")
    gid_map["sections"]["widgets"] = s

    t = create_task(project_gid, s,
        "Complete all widget renderers",
        "Implement all widget types from the spec.\n"
        "Currently have: KPI, Line, Bar, Area, Pie, Gauge, DataTable, TextBlock.\n"
        "Ref: spec Section 4.4")
    if t:
        gid_map["tasks"]["widget_renderers"] = t
        create_subtask(t, "DonutChart widget (variation of PieChart with inner radius)")
        create_subtask(t, "StackedBar widget")
        create_subtask(t, "ScatterPlot widget")
        create_subtask(t, "Heatmap widget")
        create_subtask(t, "PivotTable widget")
        create_subtask(t, "Funnel widget")
        create_subtask(t, "MetricRow widget (horizontal row of KPIs)")
        create_subtask(t, "ImageWidget (embedded image/logo)")
        create_subtask(t, "Divider widget (visual separator)")

    t = create_task(project_gid, s,
        "Widget click-to-edit config panel",
        "Clicking a widget opens inline configuration editor.\n"
        "Change chart type, colors, filters, thresholds.\n"
        "Ref: spec Section 4.4")
    if t:
        gid_map["tasks"]["widget_editor"] = t
        create_subtask(t, "WidgetEditor component with tabbed interface")
        create_subtask(t, "General tab: title, subtitle, type selector")
        create_subtask(t, "Data tab: source, filters, aggregation, groupBy")
        create_subtask(t, "Visual tab: color scheme, legend, grid, labels, stacked")
        create_subtask(t, "Threshold editor (value + color + label)")
        create_subtask(t, "Live preview as settings change")

    t = create_task(project_gid, s,
        "Widget interactions & drill-down",
        "Hover tooltips, click-through filtering, export.\n"
        "Ref: spec Section 4.4")
    if t:
        create_subtask(t, "Hover tooltips showing exact values on all chart types")
        create_subtask(t, "Click a bar/slice to filter entire dashboard")
        create_subtask(t, "Export widget as PNG (html2canvas)")
        create_subtask(t, "Export widget data as CSV")
        create_subtask(t, "Full-screen mode for any widget")

    t = create_task(project_gid, s,
        "Widget resize handles",
        "Drag edges/corners to resize widgets on the grid.\n"
        "Snap to grid columns.")
    if t:
        create_subtask(t, "Resize handles on widget edges (visible on hover)")
        create_subtask(t, "Snap to grid columns during resize")
        create_subtask(t, "Minimum size constraints per widget type")
        create_subtask(t, "Update store with new dimensions on resize end")

    t = create_task(project_gid, s,
        "\"Explain this metric\" tooltip",
        "ℹ️ button on each widget shows glossary definition + calculation.\n"
        "Ref: spec Section 10.1 point 1")
    if t:
        create_subtask(t, "Link widgets to glossaryTermIds")
        create_subtask(t, "Info icon on widget header")
        create_subtask(t, "Popover showing definition, formula, data source")
        create_subtask(t, "Power user toggle to show underlying query")

    # --- Section 5: Dashboard Canvas & UX ---
    s = create_section(project_gid, "🎨 Dashboard Canvas & UX")
    gid_map["sections"]["canvas_ux"] = s

    t = create_task(project_gid, s,
        "Responsive preview mode",
        "Toggle between desktop/tablet/mobile preview.\n"
        "Ref: spec Section 4.3")
    if t:
        create_subtask(t, "Preview toggle buttons in toolbar (desktop/tablet/mobile)")
        create_subtask(t, "Responsive grid layout adaptation")
        create_subtask(t, "Widget stacking on smaller viewports")

    t = create_task(project_gid, s,
        "Version timeline sidebar",
        "Visual timeline showing all dashboard versions with diff.\n"
        "Ref: spec Section 4.5")
    if t:
        gid_map["tasks"]["version_timeline"] = t
        create_subtask(t, "VersionTimeline component (already scaffolded)")
        create_subtask(t, "Fetch version history from API")
        create_subtask(t, "Show timestamp, change note, author for each version")
        create_subtask(t, "One-click revert to any previous version")
        create_subtask(t, "Named checkpoints (\"Before Q4 changes\")")
        create_subtask(t, "Visual diff overlay showing added/removed/modified widgets")

    t = create_task(project_gid, s,
        "Onboarding flow (first-login walkthrough)",
        "Welcome modal with 3-4 animated slides. Guided first dashboard.\n"
        "Ref: spec Section 4.1")
    if t:
        gid_map["tasks"]["onboarding"] = t
        create_subtask(t, "Create /onboarding page")
        create_subtask(t, "Welcome modal with animated walkthrough slides")
        create_subtask(t, "Guided first dashboard prompt in chat")
        create_subtask(t, "Template gallery prompt with 4-6 pre-built examples")
        create_subtask(t, "Store onboarding_completed flag in User record")
        create_subtask(t, "Auto-redirect first-time users to onboarding")

    t = create_task(project_gid, s,
        "Keyboard shortcuts",
        "Ctrl+Z undo, Ctrl+Shift+Z redo, Ctrl+S save, Cmd+K search, / focus chat.\n"
        "Ref: spec Section 10.1 point 6")
    if t:
        create_subtask(t, "Global keyboard shortcut handler")
        create_subtask(t, "Ctrl+Z / Cmd+Z → undo")
        create_subtask(t, "Ctrl+Shift+Z / Cmd+Shift+Z → redo")
        create_subtask(t, "Ctrl+S / Cmd+S → save version")
        create_subtask(t, "Cmd+K → search dashboards")
        create_subtask(t, "/ → focus chat input")
        create_subtask(t, "Keyboard shortcuts help modal (?)")

    t = create_task(project_gid, s,
        "Dark/light theme toggle",
        "Dark-first design with light mode support.\n"
        "Ref: spec Section 6.1")
    if t:
        create_subtask(t, "ThemeToggle component in navbar")
        create_subtask(t, "CSS variables for dark and light palettes")
        create_subtask(t, "Persist theme preference in localStorage")
        create_subtask(t, "System preference detection as default")

    t = create_task(project_gid, s,
        "Dashboard auto-save",
        "Auto-save after 30 seconds of inactivity.\n"
        "Ref: spec Section 4.5")
    if t:
        create_subtask(t, "Debounced auto-save (30s after last change)")
        create_subtask(t, "isDirty indicator in toolbar")
        create_subtask(t, "Unsaved changes warning on navigate away")
        create_subtask(t, "Save version to DB via API")

    # --- Section 6: Gallery & Sharing ---
    s = create_section(project_gid, "📁 Gallery & Sharing")
    gid_map["sections"]["gallery"] = s

    t = create_task(project_gid, s,
        "Dashboard gallery improvements",
        "Full-text search, filtering, sorting, card/list views.\n"
        "Ref: spec Section 4.7")
    if t:
        gid_map["tasks"]["gallery"] = t
        create_subtask(t, "Full-text search across titles, descriptions, tags")
        create_subtask(t, "Filter by owner, department, tag, date range")
        create_subtask(t, "Sort by: recently updated, most viewed, alphabetical")
        create_subtask(t, "Toggle between card view (thumbnails) and list view")
        create_subtask(t, "Recently viewed section")
        create_subtask(t, "Favorites system (star dashboards)")

    t = create_task(project_gid, s,
        "Dashboard sharing system",
        "Share with specific users at VIEW/COMMENT/EDIT permission levels.\n"
        "Ref: spec Section 4.6")
    if t:
        gid_map["tasks"]["sharing"] = t
        create_subtask(t, "Share modal — search and select users")
        create_subtask(t, "Permission dropdown (View / Comment / Edit)")
        create_subtask(t, "API: POST /api/dashboards/[id]/share")
        create_subtask(t, "\"Shared with Me\" gallery section")
        create_subtask(t, "Publish to gallery (make public to all authenticated users)")
        create_subtask(t, "Email notification on share (optional)")

    t = create_task(project_gid, s,
        "Folder system",
        "Create, nest, and organize dashboards in folders.\n"
        "Ref: spec Section 4.7")
    if t:
        create_subtask(t, "FolderTree component with nested navigation")
        create_subtask(t, "Create/rename/delete folders")
        create_subtask(t, "Drag dashboards between folders")
        create_subtask(t, "Folder visibility (private/team/public)")
        create_subtask(t, "Breadcrumb navigation")

    t = create_task(project_gid, s,
        "Dashboard cloning",
        "One-click duplicate any dashboard as a starting point.\n"
        "Ref: spec Section 10.1 point 7")
    if t:
        create_subtask(t, "API: POST /api/dashboards/[id]/duplicate")
        create_subtask(t, "Clone current version schema with new IDs")
        create_subtask(t, "\"Duplicate\" option in context menu and gallery card")

    t = create_task(project_gid, s,
        "Template system — promote to templates",
        "Admin can promote dashboards to template gallery.\n"
        "Templates appear in onboarding and /templates page.\n"
        "Ref: spec Section 4.7")
    if t:
        create_subtask(t, "Admin action to mark dashboard as template")
        create_subtask(t, "/templates page showing all template dashboards")
        create_subtask(t, "\"Use this template\" creates a clone for the user")
        create_subtask(t, "Template categories/tags")

    t = create_task(project_gid, s,
        "Dashboard thumbnails (auto-generated previews)",
        "Capture dashboard screenshots for gallery cards.\n"
        "Ref: spec Phase 2")
    if t:
        create_subtask(t, "Server-side screenshot generation (Puppeteer or html2canvas)")
        create_subtask(t, "Generate thumbnail on save")
        create_subtask(t, "Store in public/ or S3")
        create_subtask(t, "Fallback placeholder for dashboards without thumbnails")

    # --- Section 7: Glossary ---
    s = create_section(project_gid, "📖 Glossary System")
    gid_map["sections"]["glossary"] = s

    t = create_task(project_gid, s,
        "Glossary browse & search UI",
        "Full glossary page with category filters, search, term cards.\n"
        "Ref: spec Section 4.8")
    if t:
        create_subtask(t, "/glossary page with searchable term listing")
        create_subtask(t, "Category filter pills")
        create_subtask(t, "TermCard component showing definition, formula, data source")
        create_subtask(t, "Related terms links")
        create_subtask(t, "Approved by / last reviewed metadata")

    t = create_task(project_gid, s,
        "Glossary CRUD API",
        "Admin-only create/update/delete. All users can read/search.\n"
        "Ref: spec Section 8")
    if t:
        create_subtask(t, "GET /api/glossary — list all terms")
        create_subtask(t, "POST /api/glossary — add term (Admin)")
        create_subtask(t, "PUT /api/glossary/[id] — update term (Admin)")
        create_subtask(t, "DELETE /api/glossary/[id] — remove term (Admin)")
        create_subtask(t, "GET /api/glossary/search?q= — full-text search")

    t = create_task(project_gid, s,
        "Glossary reference panel in dashboard editor",
        "Always-available side panel to browse terms while editing.\n"
        "Link terms to widgets for tooltip display.")
    if t:
        create_subtask(t, "Glossary panel toggle in editor toolbar")
        create_subtask(t, "Search/browse terms inline")
        create_subtask(t, "Link terms to widgets (glossaryTermIds)")
        create_subtask(t, "Widget hover shows linked term tooltips")

    # --- Section 8: Data Layer ---
    s = create_section(project_gid, "💾 Data Layer")
    gid_map["sections"]["data_layer"] = s

    t = create_task(project_gid, s,
        "Dashboard CRUD API",
        "Full CRUD for dashboards including version management.\n"
        "Ref: spec Section 8")
    if t:
        gid_map["tasks"]["dashboard_crud"] = t
        create_subtask(t, "GET /api/dashboards — list (filtered by user access)")
        create_subtask(t, "POST /api/dashboards — create new dashboard")
        create_subtask(t, "GET /api/dashboards/[id] — get dashboard + current schema")
        create_subtask(t, "PUT /api/dashboards/[id] — update metadata")
        create_subtask(t, "DELETE /api/dashboards/[id] — soft-delete (archive)")
        create_subtask(t, "GET /api/dashboards/[id]/versions — list versions")
        create_subtask(t, "POST /api/dashboards/[id]/versions — save new version")
        create_subtask(t, "POST /api/dashboards/[id]/revert/[versionId] — revert")

    t = create_task(project_gid, s,
        "Sample data query engine",
        "Unified query interface for Phase 1 sample data.\n"
        "Ref: spec Sections 5 and 8")
    if t:
        create_subtask(t, "Query engine abstraction (src/lib/data/query-engine.ts)")
        create_subtask(t, "Sample data adapter using in-memory generated data")
        create_subtask(t, "Support aggregation, groupBy, orderBy, limit, filters")
        create_subtask(t, "API: POST /api/data/query")
        create_subtask(t, "API: GET /api/data/sources (list available tables)")
        create_subtask(t, "API: GET /api/data/sources/[name]/schema (columns + types)")

    t = create_task(project_gid, s,
        "Snowflake connector (Phase 3)",
        "Production data source. Connection management, query execution, caching.\n"
        "Ref: spec Phase 3")
    if t:
        gid_map["tasks"]["snowflake"] = t
        create_subtask(t, "Snowflake Node.js SDK integration")
        create_subtask(t, "Connection pool management")
        create_subtask(t, "Query execution with parameterized queries (no SQL injection)")
        create_subtask(t, "Query caching layer (Redis) to avoid hammering Snowflake")
        create_subtask(t, "Data source browser — table/view/column explorer")
        create_subtask(t, "Data-level permission enforcement (sensitive data tags)")
        create_subtask(t, "Row-level security for PII/financial data")

    # --- Section 9: Admin ---
    s = create_section(project_gid, "⚙️ Admin Panel")
    gid_map["sections"]["admin"] = s

    t = create_task(project_gid, s,
        "User management page",
        "Admin-only. List users, change roles, view activity.\n"
        "Ref: spec Section 8")
    if t:
        create_subtask(t, "/admin page with user list table")
        create_subtask(t, "Role dropdown to change user roles")
        create_subtask(t, "User activity summary (dashboards created, last login)")
        create_subtask(t, "API: GET /api/admin/users")
        create_subtask(t, "API: PUT /api/admin/users/[id]/role")

    t = create_task(project_gid, s,
        "Audit log viewer",
        "Admin-only. Search and filter all logged actions.\n"
        "Ref: spec Section 8")
    if t:
        create_subtask(t, "/admin/audit page")
        create_subtask(t, "Filterable table: user, action, resource type, date range")
        create_subtask(t, "API: GET /api/admin/audit with query params")
        create_subtask(t, "Export audit log as CSV")

    t = create_task(project_gid, s,
        "System settings & configuration",
        "Admin-configurable settings for the platform.")
    if t:
        create_subtask(t, "Default user role for new signups")
        create_subtask(t, "AI model selection (Claude model version)")
        create_subtask(t, "Data source connection management")
        create_subtask(t, "Feature flags for Phase 2/3 features")

    # --- Section 10: Testing & QA ---
    s = create_section(project_gid, "🧪 Testing & QA")
    gid_map["sections"]["testing"] = s

    t = create_task(project_gid, s,
        "Unit tests — core logic",
        "Test schema patcher, query engine, permissions, glossary sync.")
    if t:
        gid_map["tasks"]["unit_tests"] = t
        create_subtask(t, "Set up Jest/Vitest for the project")
        create_subtask(t, "Test schema-patcher.ts (all patch types)")
        create_subtask(t, "Test permissions.ts (role-based checks)")
        create_subtask(t, "Test glossary sync logic")
        create_subtask(t, "Test sample data generation")
        create_subtask(t, "Test dashboard store actions (undo/redo, widget CRUD)")

    t = create_task(project_gid, s,
        "Integration tests — API routes",
        "Test all API endpoints with authenticated requests.")
    if t:
        create_subtask(t, "Test /api/chat route (mock Claude responses)")
        create_subtask(t, "Test /api/dashboards CRUD")
        create_subtask(t, "Test /api/glossary CRUD")
        create_subtask(t, "Test /api/admin routes (role enforcement)")
        create_subtask(t, "Test /api/data/query with sample data")

    t = create_task(project_gid, s,
        "E2E tests — critical user flows",
        "Playwright tests for key user journeys.")
    if t:
        create_subtask(t, "Set up Playwright")
        create_subtask(t, "Test: Login → Gallery → New Dashboard → Chat → Save")
        create_subtask(t, "Test: Open existing dashboard → Edit via chat → Undo → Redo")
        create_subtask(t, "Test: Share dashboard → Verify recipient can view")
        create_subtask(t, "Test: Admin → Change user role → Verify permissions")
        create_subtask(t, "Test: Glossary → Add term → Verify appears in AI prompt")

    t = create_task(project_gid, s,
        "Performance testing & optimization",
        "Meet performance targets from spec Section 10.3.")
    if t:
        create_subtask(t, "Gallery load: < 1s")
        create_subtask(t, "Dashboard canvas render: < 2s (all widgets)")
        create_subtask(t, "AI response (first token): < 1s via SSE")
        create_subtask(t, "Widget data refresh: < 3s per widget")
        create_subtask(t, "Search results: < 200ms")
        create_subtask(t, "Lazy-load widgets below the fold")
        create_subtask(t, "Virtual scrolling for data tables")

    # --- Section 11: Deployment & DevOps ---
    s = create_section(project_gid, "🚀 Deployment & DevOps")
    gid_map["sections"]["deployment"] = s

    t = create_task(project_gid, s,
        "EC2 deployment setup",
        "Deploy on AWS EC2 (same infra as freshchat-poc dashboards).")
    if t:
        gid_map["tasks"]["ec2_deploy"] = t
        create_subtask(t, "Provision EC2 instance (t3.medium or similar)")
        create_subtask(t, "Install Node.js, PostgreSQL, Nginx")
        create_subtask(t, "Configure Nginx reverse proxy to Next.js (port 3000)")
        create_subtask(t, "SSL certificate (Let's Encrypt or ACM)")
        create_subtask(t, "PM2 or systemd process manager for Next.js")
        create_subtask(t, "Environment variables in production (.env.production)")
        create_subtask(t, "PostgreSQL production database setup")

    t = create_task(project_gid, s,
        "CI/CD pipeline",
        "Automated build, test, deploy on push to main.")
    if t:
        create_subtask(t, "GitHub Actions or BitBucket Pipelines config")
        create_subtask(t, "Run linting + type checking on PR")
        create_subtask(t, "Run unit + integration tests on PR")
        create_subtask(t, "Auto-deploy to staging on merge to develop")
        create_subtask(t, "Manual promotion to production")
        create_subtask(t, "Database migration on deploy")

    t = create_task(project_gid, s,
        "Production monitoring & alerting",
        "Health checks, error tracking, performance monitoring.")
    if t:
        create_subtask(t, "Health check endpoint (/api/health)")
        create_subtask(t, "Uptime monitoring (e.g., UptimeRobot)")
        create_subtask(t, "Error tracking (Sentry or similar)")
        create_subtask(t, "Performance monitoring (Web Vitals)")
        create_subtask(t, "Database connection pool monitoring")
        create_subtask(t, "Disk space / memory alerts")

    t = create_task(project_gid, s,
        "Backup & disaster recovery",
        "Database backups, recovery procedures.")
    if t:
        create_subtask(t, "Automated daily PostgreSQL backups to S3")
        create_subtask(t, "Point-in-time recovery documentation")
        create_subtask(t, "Backup verification/restoration test procedure")

    t = create_task(project_gid, s,
        "Domain & DNS setup",
        "Production URL, DNS configuration, SSL.")
    if t:
        create_subtask(t, "Register subdomain (e.g., insighthub.uszoom.com or insighthub.jeffcoy.net)")
        create_subtask(t, "DNS A/CNAME records pointing to EC2")
        create_subtask(t, "SSL certificate provisioning")
        create_subtask(t, "Update NEXTAUTH_URL for production domain")

    # --- Section 12: Advanced Features (Phase 4) ---
    s = create_section(project_gid, "🔮 Advanced Features (Phase 4)")
    gid_map["sections"]["advanced"] = s

    t = create_task(project_gid, s,
        "Dashboard comments & annotations",
        "Users can leave comments on specific widgets or data points.\n"
        "Ref: spec Phase 4")
    if t:
        create_subtask(t, "Comment data model (linked to widget + position)")
        create_subtask(t, "Comment thread UI on widgets")
        create_subtask(t, "Notification when someone comments on your dashboard")

    t = create_task(project_gid, s,
        "Collaborative editing (real-time)",
        "Multiple users editing same dashboard simultaneously.\n"
        "WebSocket-based cursor sharing.\n"
        "Ref: spec Phase 4")
    if t:
        create_subtask(t, "WebSocket server for real-time updates")
        create_subtask(t, "Cursor presence indicators")
        create_subtask(t, "Conflict resolution for simultaneous edits")
        create_subtask(t, "\"X is editing\" indicator")

    t = create_task(project_gid, s,
        "Natural language filtering",
        "\"Show me Q4 2025 only\" applies filters via AI.\n"
        "Ref: spec Phase 4")
    if t:
        create_subtask(t, "NL filter parser using Claude")
        create_subtask(t, "Apply parsed filters to global/widget filters")
        create_subtask(t, "Filter chips showing active NL filters")

    t = create_task(project_gid, s,
        "Dashboard alerts & notifications",
        "Notify when a metric crosses a threshold.\n"
        "Ref: spec Phase 4")
    if t:
        create_subtask(t, "Alert rule configuration per widget")
        create_subtask(t, "Threshold evaluation on data refresh")
        create_subtask(t, "Email/Slack notifications")
        create_subtask(t, "Alert history and acknowledgement")

    t = create_task(project_gid, s,
        "Custom calculated fields",
        "User-defined formulas for computed metrics.\n"
        "Ref: spec Phase 4")
    if t:
        create_subtask(t, "Formula editor UI")
        create_subtask(t, "Expression parser and evaluator")
        create_subtask(t, "Save custom fields to schema")

    t = create_task(project_gid, s,
        "SQL editor mode for power users",
        "Direct SQL query editing for POWER_USER and ADMIN roles.\n"
        "Ref: spec Phase 4")
    if t:
        create_subtask(t, "Code editor component (Monaco or CodeMirror)")
        create_subtask(t, "SQL syntax highlighting and autocomplete")
        create_subtask(t, "Query execution with results preview")
        create_subtask(t, "Save query as widget data source")

    t = create_task(project_gid, s,
        "Dashboard embedding (iframe mode)",
        "Embed dashboards in other tools via iframe with auth token.\n"
        "Ref: spec Phase 3")
    if t:
        create_subtask(t, "Embed-specific view route (/dashboard/[id]/embed)")
        create_subtask(t, "Token-based authentication for embedded views")
        create_subtask(t, "Configurable toolbar visibility in embed mode")
        create_subtask(t, "Copy embed code button in share modal")

    t = create_task(project_gid, s,
        "Scheduled dashboard snapshots & email digests",
        "Auto-email dashboard screenshots on a schedule.\n"
        "Ref: spec Phase 3")
    if t:
        create_subtask(t, "Cron job for scheduled snapshots")
        create_subtask(t, "Screenshot generation via Puppeteer")
        create_subtask(t, "Email template with dashboard preview")
        create_subtask(t, "Subscription management (weekly/monthly)")

    t = create_task(project_gid, s,
        "API access (programmatic dashboard creation)",
        "REST API for external tools to create/manage dashboards.\n"
        "Ref: spec Phase 4")
    if t:
        create_subtask(t, "API key management for service accounts")
        create_subtask(t, "Rate limiting for API consumers")
        create_subtask(t, "API documentation (OpenAPI/Swagger)")

    t = create_task(project_gid, s,
        "\"Ask about this data\" — contextual AI queries",
        "Right-click a data point to ask AI follow-up questions.\n"
        "Ref: spec Section 10.1 point 8")
    if t:
        create_subtask(t, "Right-click context menu on chart data points")
        create_subtask(t, "Send data context + question to AI")
        create_subtask(t, "AI cross-references with other data sources")

    # --- Section 13: Documentation ---
    s = create_section(project_gid, "📝 Documentation")
    gid_map["sections"]["documentation"] = s

    t = create_task(project_gid, s,
        "User documentation / help center",
        "End-user docs for employees using InsightHub.")
    if t:
        create_subtask(t, "Getting started guide")
        create_subtask(t, "How to create a dashboard via chat")
        create_subtask(t, "How to share and organize dashboards")
        create_subtask(t, "Widget types reference with examples")
        create_subtask(t, "Glossary guide for admins")
        create_subtask(t, "FAQ / troubleshooting")

    t = create_task(project_gid, s,
        "Developer documentation",
        "Technical docs for dev team maintaining the codebase.")
    if t:
        create_subtask(t, "Architecture overview diagram")
        create_subtask(t, "Local development setup guide")
        create_subtask(t, "Adding new widget types guide")
        create_subtask(t, "AI system prompt customization guide")
        create_subtask(t, "Database schema reference")
        create_subtask(t, "API endpoint reference")
        create_subtask(t, "Deployment runbook")

    t = create_task(project_gid, s,
        "README and project setup",
        "Clear README with badges, quickstart, and feature overview.")
    if t:
        create_subtask(t, "Project overview and feature list")
        create_subtask(t, "Prerequisites (Node.js, Docker, etc)")
        create_subtask(t, "Installation and setup steps")
        create_subtask(t, "Environment variables reference")
        create_subtask(t, "Running locally instructions")
        create_subtask(t, "Deployment instructions")

    # --- Section 14: TO SORT (Brain Dump) ---
    s = create_section(project_gid, "TO SORT")
    gid_map["sections"]["to_sort"] = s

    # =====================================================================
    # Save GID mapping
    # =====================================================================
    docs_dir = Path(__file__).resolve().parent.parent / "docs"
    docs_dir.mkdir(exist_ok=True)
    gid_file = docs_dir / "asana-task-gids.json"
    with open(gid_file, "w") as f:
        json.dump(gid_map, f, indent=2)
    print(f"\n✅ GID mapping saved to {gid_file}")

    # Save project GID to .env.local
    env_file = Path(__file__).resolve().parent.parent / ".env.local"
    with open(env_file, "a") as f:
        f.write(f"ASANA_PROJECT_GID={project_gid}\n")
    print(f"✅ ASANA_PROJECT_GID={project_gid} appended to .env.local")

    print(f"\n🎉 InsightHub Asana project created successfully!")
    print(f"   Project GID: {project_gid}")
    print(f"   View at: https://app.asana.com/0/{project_gid}")


if __name__ == "__main__":
    main()
