# Weekend Build Playbook
## How a Systems Architect Thinks Through a Complex App in 48 Hours

> **Context:** This guide uses InsightHub (an AI-powered dashboard builder) as a running example, but the mental framework applies to any ambitious proof-of-concept.

---

## The Core Mindset

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   "What is the ONE thing someone can do in the app that         │
│    makes them say 'holy shit, this is real'?"                   │
│                                                                 │
│    Everything else is scaffolding for that moment.              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

A senior architect doesn't think feature-by-feature. They think in **risk-ordered layers** — what's hardest and most uncertain gets proven first, then everything else stacks on top. A weekend build is an exercise in ruthless prioritization.

---

## Phase 0: Before You Write a Line of Code (1–2 hours)

```
┌──────────────────┐
│  DEFINE THE DEMO  │
│    MOMENT         │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐     ┌──────────────────┐
│  List every       │     │  Identify the     │
│  feature you      │────▶│  3–5 that make    │
│  dream of         │     │  the demo sing    │
└──────────────────┘     └────────┬─────────┘
                                  │
                                  ▼
                         ┌──────────────────┐
                         │  Cut everything   │
                         │  else. Seriously. │
                         └──────────────────┘
```

### The Questions to Ask

1. **Who is the audience?** (Boss? Investors? Yourself?)
2. **What's the demo script?** Write the literal 2-minute walkthrough.
3. **What's the "magic trick"?** The single interaction that feels like the future.

### InsightHub Example

| Dream Feature | Weekend POC? | Why |
|---|---|---|
| Natural language → dashboard | **YES** | This IS the magic trick |
| Undo/redo | **YES** | Makes it feel like a real editor |
| Drag-and-drop widgets | **YES** | Visual "wow" factor |
| Google OAuth with domain lock | NO | Use a dev bypass flag |
| Snowflake connector | NO | Sample data is fine for a demo |
| Admin panel | NO | Nobody sees this in a demo |
| Real-time collaboration | NO | Single-user is fine |
| Audit logging | NO | Invisible infrastructure |

**Rule of thumb:** If you can't show it in the demo, it doesn't exist this weekend.

---

## Phase 1: Architecture Decisions (30 minutes)

```
┌──────────────────────────────────────────────────────────┐
│                 DECISION FLOWCHART                         │
└──────────────────────────────────────────────────────────┘

For each technical choice, ask:

     ┌─────────────────────────┐
     │ Do I already know this  │
     │ tool/framework?         │
     └────────┬────────────────┘
              │
       ┌──────┴──────┐
       │YES          │NO
       ▼             ▼
  ┌─────────┐  ┌──────────────────────┐
  │ Use it. │  │ Is there a simpler   │
  │ Done.   │  │ tool I DO know that  │
  └─────────┘  │ gets 80% there?      │
               └──────────┬───────────┘
                          │
                   ┌──────┴──────┐
                   │YES          │NO
                   ▼             ▼
              ┌─────────┐  ┌─────────────────┐
              │ Use the  │  │ Can I learn it  │
              │ simpler  │  │ in < 2 hours?   │
              │ one.     │  └────────┬────────┘
              └─────────┘           │
                             ┌──────┴──────┐
                             │YES          │NO
                             ▼             ▼
                        ┌─────────┐  ┌──────────────┐
                        │ Learn   │  │ FAKE IT.     │
                        │ it now. │  │ Stub/mock it │
                        │         │  │ and move on. │
                        └─────────┘  └──────────────┘
```

### The "Boring Stack" Principle

A weekend build is NOT the time to learn three new technologies. Pick the stack you're fastest with and optimize for velocity:

| Decision | Weekend Choice | Production Choice (later) |
|---|---|---|
| **Auth** | Dev bypass flag (`DEV_MODE=true`) | OAuth + RBAC |
| **Database** | SQLite or local Postgres via Docker | Managed Postgres |
| **Data** | Hardcoded sample data generators | Live connectors |
| **Styling** | Tailwind + one component library | Custom design system |
| **Deployment** | `localhost` or quick Vercel deploy | EC2 / proper infra |

---

## Phase 2: The Dependency Graph (This Is the Real Architecture)

This is where architects earn their money. Before building, map **what depends on what**:

```
┌─────────────────────────────────────────────────────────────────────┐
│                    DEPENDENCY GRAPH                                   │
│                                                                      │
│   Level 0 (Foundation — build first, everything depends on these)    │
│   ┌──────────────┐  ┌──────────────┐  ┌─────────────────────────┐   │
│   │ Project Setup │  │ Data Models  │  │ Core Types/Interfaces   │   │
│   │ (Next.js,    │  │ (Prisma      │  │ (DashboardSchema,       │   │
│   │  Tailwind,   │  │  schema)     │  │  WidgetConfig, etc.)    │   │
│   │  deps)       │  │              │  │                         │   │
│   └──────┬───────┘  └──────┬───────┘  └────────────┬────────────┘   │
│          │                 │                        │                │
│          └─────────────────┼────────────────────────┘                │
│                            │                                         │
│   Level 1 (Core Engine — the thing that makes it work)              │
│                            ▼                                         │
│   ┌──────────────────────────────────────────────────────────────┐   │
│   │                   Zustand Store                               │   │
│   │        (Dashboard state, widgets, undo/redo)                 │   │
│   └──────────────────────────┬───────────────────────────────────┘   │
│                              │                                       │
│          ┌───────────────────┼──────────────────┐                    │
│          │                   │                  │                    │
│   Level 2 (Visible surfaces — what users see and touch)             │
│          ▼                   ▼                  ▼                    │
│   ┌──────────────┐  ┌───────────────┐  ┌────────────────┐          │
│   │ Chat Panel   │  │ Dashboard     │  │ Widget         │          │
│   │ (AI input)   │  │ Canvas        │  │ Renderers      │          │
│   │              │  │ (grid layout) │  │ (KPI, Chart,   │          │
│   │              │  │               │  │  Table, etc.)  │          │
│   └──────┬───────┘  └───────────────┘  └────────────────┘          │
│          │                                                          │
│   Level 3 (Integration — connecting the magic)                      │
│          ▼                                                          │
│   ┌──────────────────────────────────────────────────────────────┐   │
│   │              API Route: /api/chat                             │   │
│   │  (Receives message → calls Claude → returns schema patches)  │   │
│   └──────────────────────────────────────────────────────────────┘   │
│                              │                                       │
│   Level 4 (Polish — makes it feel real)                             │
│          ┌───────────────────┼──────────────────┐                    │
│          ▼                   ▼                  ▼                    │
│   ┌──────────────┐  ┌───────────────┐  ┌────────────────┐          │
│   │ Drag & Drop  │  │ Gallery /     │  │ Templates      │          │
│   │              │  │ Sharing       │  │                │          │
│   └──────────────┘  └───────────────┘  └────────────────┘          │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Why This Matters

- **You build bottom-up** (Level 0 → 4), but you **demo top-down** (Level 4 → 0).
- If you run out of time at Level 2, you still have a working app — it just has less polish.
- If you skip Level 0 and jump to UI, you'll rewrite everything when the data model changes.

---

## Phase 3: The Weekend Schedule

```
┌─────────────────────────────────────────────────────────────┐
│                    SATURDAY                                   │
├──────────┬──────────────────────────────────────────────────┤
│ Morning  │  Foundation + Data Model + Store                  │
│ (4 hrs)  │                                                   │
│          │  ┌─────────┐  ┌──────────┐  ┌─────────────────┐  │
│          │  │ next.js  │─▶│ prisma   │─▶│ zustand store   │  │
│          │  │ scaffold │  │ schema   │  │ + types         │  │
│          │  └─────────┘  └──────────┘  └─────────────────┘  │
├──────────┼──────────────────────────────────────────────────┤
│ Afternoon│  Widget Renderers + Canvas                        │
│ (4 hrs)  │                                                   │
│          │  ┌──────────────────────────────────────────────┐ │
│          │  │ Can I see widgets on screen with fake data?  │ │
│          │  │ YES → move on.  NO → keep going.             │ │
│          │  └──────────────────────────────────────────────┘ │
├──────────┼──────────────────────────────────────────────────┤
│ Evening  │  AI Integration (THE critical path)               │
│ (3 hrs)  │                                                   │
│          │  ┌───────────┐  ┌──────────────┐  ┌───────────┐  │
│          │  │ API route │─▶│ Claude call   │─▶│ Schema    │  │
│          │  │ /api/chat │  │ + prompt eng  │  │ patching  │  │
│          │  └───────────┘  └──────────────┘  └───────────┘  │
│          │                                                   │
│          │  Gate: "I can type 'show me a sales KPI' and a   │
│          │   widget appears on the canvas."                  │
│          │   If YES → sleep. If NO → stay up.               │
├──────────┼──────────────────────────────────────────────────┤
│                                                              │
│                    SUNDAY                                     │
├──────────┼──────────────────────────────────────────────────┤
│ Morning  │  Polish + UX                                      │
│ (4 hrs)  │                                                   │
│          │  - Drag-and-drop                                  │
│          │  - Undo/redo                                      │
│          │  - Context menus                                  │
│          │  - Loading states / animations                    │
│          │  - Dark theme / glassmorphism                     │
├──────────┼──────────────────────────────────────────────────┤
│ Afternoon│  Gallery + Templates + Edge Cases                 │
│ (4 hrs)  │                                                   │
│          │  - Template dashboards (pre-built)                │
│          │  - Gallery browsing                               │
│          │  - Widget library                                 │
│          │  - Error handling                                 │
├──────────┼──────────────────────────────────────────────────┤
│ Evening  │  Demo Prep                                        │
│ (2 hrs)  │                                                   │
│          │  - Write demo script                              │
│          │  - Fix the 3 worst bugs                           │
│          │  - Record a video or prep for live demo           │
│          │  - Deploy if needed                               │
└──────────┴──────────────────────────────────────────────────┘
```

---

## Phase 4: The Architect's Decision Framework

When you hit a fork in the road (and you will, every 30 minutes), use this:

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                  │
│            THE 15-MINUTE RULE                                    │
│                                                                  │
│   ┌─────────────────────────────────────┐                        │
│   │ Am I stuck on something?            │                        │
│   └──────────────┬──────────────────────┘                        │
│                  │                                                │
│           ┌──────┴──────┐                                        │
│           │YES          │NO                                      │
│           ▼             ▼                                        │
│   ┌───────────────┐  ┌──────────┐                                │
│   │ Have I spent  │  │ Keep     │                                │
│   │ > 15 min on   │  │ building │                                │
│   │ this?         │  └──────────┘                                │
│   └───────┬───────┘                                              │
│           │                                                      │
│    ┌──────┴──────┐                                               │
│    │YES          │NO                                             │
│    ▼             ▼                                               │
│  ┌────────────┐ ┌──────────┐                                     │
│  │ STOP.      │ │ Set a    │                                     │
│  │ Choose     │ │ timer.   │                                     │
│  │ one of:    │ │ Try for  │                                     │
│  │            │ │ 15 more  │                                     │
│  │ 1. Stub it │ │ min.     │                                     │
│  │ 2. Simplify│ └──────────┘                                     │
│  │ 3. Ask for │                                                  │
│  │    help    │                                                  │
│  └────────────┘                                                  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Common Weekend-Build Traps

| Trap | What It Looks Like | The Fix |
|---|---|---|
| **Yak Shaving** | "I just need to set up this one config..." for 2 hours | Use the default. Override later. |
| **Premature Abstraction** | Building a generic widget factory before you have 1 widget | Build the specific thing. Generalize on pass 2. |
| **Pixel Perfection** | Tweaking border-radius for 45 minutes | Get the layout right. Colors/spacing last. |
| **Gold Plating** | Adding error boundaries before the happy path works | Make it work → make it right → make it pretty |
| **Scope Creep** | "Wouldn't it be cool if it also..." | Write it down. Build it next weekend. |
| **Config Hell** | Fighting ESLint, TypeScript strict mode, etc. | Loosen configs for the POC. Tighten later. |

---

## Phase 5: The "Vertical Slice" Strategy

This is the single most important concept for weekend builds:

```
                        DON'T build like this:
                        (horizontal layers)

          ┌─────────────────────────────────────────┐
          │          ALL the UI                       │  ← Week 1
          ├─────────────────────────────────────────┤
          │          ALL the API routes               │  ← Week 2
          ├─────────────────────────────────────────┤
          │          ALL the database                  │  ← Week 3
          ├─────────────────────────────────────────┤
          │          ALL the AI integration            │  ← Week 4
          └─────────────────────────────────────────┘

          Nothing works until everything works. 😱


                        DO build like this:
                        (vertical slices)

    Slice 1          Slice 2          Slice 3          Slice 4
  ┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐
  │ Chat UI │     │ Canvas  │     │ Gallery │     │ Admin   │
  │─────────│     │─────────│     │─────────│     │─────────│
  │ /api/   │     │ Store   │     │ /api/   │     │ /api/   │
  │ chat    │     │ actions │     │ dash    │     │ admin   │
  │─────────│     │─────────│     │─────────│     │─────────│
  │ Claude  │     │ Widget  │     │ Prisma  │     │ Prisma  │
  │ prompt  │     │ render  │     │ queries │     │ queries │
  └─────────┘     └─────────┘     └─────────┘     └─────────┘
  Sat evening     Sat afternoon   Sun afternoon   NEXT WEEK

  Each slice is a working feature. Stop at any point
  and you have a demoable app.  ✅
```

### InsightHub Vertical Slices (Priority Order)

1. **Slice: "Talk to AI, see a widget"** — Chat input → API route → Claude → schema patch → widget renders on canvas
2. **Slice: "Edit the dashboard"** — Move widgets, resize, delete, undo/redo
3. **Slice: "Start from a template"** — Pick a pre-built dashboard, then modify it via chat
4. **Slice: "Browse and share"** — Gallery page, save/load dashboards
5. **Slice: "Widget library"** — Reusable components, forking, search

---

## Phase 6: Data Model First, Always

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                  │
│    "Show me your data model and I'll tell you what your          │
│     app does. Show me your UI and I'll have no idea              │
│     what's actually happening."                                  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### The Process

```
   ┌──────────────────┐
   │ Write down every │
   │ "noun" in the    │
   │ app              │
   └────────┬─────────┘
            │
            ▼
   ┌──────────────────┐     Nouns for InsightHub:
   │ Draw the          │     - User
   │ relationships     │     - Dashboard
   │                   │     - DashboardVersion (schema snapshots)
   └────────┬─────────┘     - Widget (part of schema, not a DB table)
            │                - GlossaryTerm
            ▼                - WidgetTemplate
   ┌──────────────────┐
   │ Define the        │     Key insight: Widget lives INSIDE
   │ boundaries        │     the DashboardVersion.schema JSON,
   │                   │     NOT as a separate DB table.
   │ What's a DB       │     This is a huge simplification.
   │ table vs. what's  │
   │ embedded JSON?    │
   └────────┬─────────┘
            │
            ▼
   ┌──────────────────┐
   │ Write the Prisma  │     Don't overthink migrations.
   │ schema (or SQL)   │     `prisma db push` is fine for a POC.
   │                   │
   └──────────────────┘
```

### The "JSON Blob" Shortcut

For a weekend build, not everything needs to be a normalized table. The architect's trick:

| Approach | When to Use | Example |
|---|---|---|
| **DB table** | Queried independently, has relationships | User, Dashboard |
| **JSON column** | Complex nested structure, always loaded with parent | DashboardSchema (widgets, layout, filters) |
| **Hardcoded file** | Reference data that rarely changes | Glossary terms, widget library |
| **In-memory only** | Ephemeral UI state | Undo/redo stack, drag position |

---

## Phase 7: The AI Integration Pattern

Since AI is your "magic trick," here's the specific pattern:

```
┌──────────────────────────────────────────────────────────────┐
│                  AI INTEGRATION PIPELINE                       │
│                                                               │
│  ┌──────────┐    ┌──────────────┐    ┌────────────────────┐  │
│  │ User     │    │ Build        │    │ Call Claude        │  │
│  │ Message  │───▶│ System       │───▶│ with structured    │  │
│  │          │    │ Prompt       │    │ output format      │  │
│  └──────────┘    └──────────────┘    └─────────┬──────────┘  │
│                                                │              │
│                   System prompt includes:       │              │
│                   - Available widget types      │              │
│                   - Current dashboard state     │              │
│                   - Glossary / business terms   │              │
│                   - Output format rules         │              │
│                                                │              │
│                                                ▼              │
│  ┌──────────┐    ┌──────────────┐    ┌────────────────────┐  │
│  │ Update   │    │ Apply        │    │ Parse response     │  │
│  │ Canvas   │◀───│ Patches to   │◀───│ as JSON patches    │  │
│  │          │    │ Zustand      │    │                    │  │
│  └──────────┘    └──────────────┘    └────────────────────┘  │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

### Key Insight: Schema Patches, Not Full Schemas

Don't have the AI regenerate the entire dashboard every time. Use a **patch-based approach**:

```json
// AI returns patches like:
[
  { "op": "add_widget", "widget": { "type": "kpi", "title": "Revenue", ... } },
  { "op": "update_widget", "widgetId": "abc", "changes": { "title": "New Title" } },
  { "op": "remove_widget", "widgetId": "xyz" },
  { "op": "use_widget", "widgetTemplateId": "tmpl_sales_pipeline" }
]
```

This is faster, cheaper (fewer tokens), and makes undo/redo trivial.

---

## Phase 8: The "Good Enough" Checklist

Before you call it done, check:

```
┌─────────────────────────────────────────────────────────────┐
│                                                              │
│   WEEKEND POC "DONE" CHECKLIST                               │
│                                                              │
│   ┌─── Must Have ──────────────────────────────────────────┐ │
│   │                                                        │ │
│   │   □  The magic trick works end-to-end                  │ │
│   │   □  No crashes on the happy path                      │ │
│   │   □  Looks professional (dark theme, consistent UI)    │ │
│   │   □  Can start fresh or from a template                │ │
│   │   □  2-minute demo is smooth                           │ │
│   │                                                        │ │
│   └────────────────────────────────────────────────────────┘ │
│                                                              │
│   ┌─── Nice to Have ──────────────────────────────────────┐  │
│   │                                                        │ │
│   │   □  Undo/redo works                                   │ │
│   │   □  Gallery page exists                               │ │
│   │   □  Error states are handled gracefully               │ │
│   │   □  Mobile doesn't completely break                   │ │
│   │                                                        │ │
│   └────────────────────────────────────────────────────────┘ │
│                                                              │
│   ┌─── Don't Even Think About It ─────────────────────────┐  │
│   │                                                        │ │
│   │   ✗  100% test coverage                                │ │
│   │   ✗  Perfect accessibility                             │ │
│   │   ✗  Production security hardening                     │ │
│   │   ✗  CI/CD pipeline                                    │ │
│   │   ✗  Documentation                                     │ │
│   │                                                        │ │
│   └────────────────────────────────────────────────────────┘ │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## The Mental Models That Matter

### 1. "Make It Work, Make It Right, Make It Fast"

```
   Weekend:     ████████████████░░░░░░░░░░░░░░░░
                 Make it work    (next week)  (later)

   Don't skip ahead. A working ugly thing beats a beautiful broken thing.
```

### 2. "Tracer Bullet Development"

From *The Pragmatic Programmer*: fire a single bullet through every layer of the system first.

```
   User clicks "Send" in chat
        │
        ▼
   API route receives message
        │
        ▼
   Claude generates a response
        │
        ▼
   Response is parsed into patches
        │
        ▼
   Patches update the Zustand store
        │
        ▼
   Canvas re-renders with new widget
        │
        ▼
   🎯 HIT — the tracer bullet works end-to-end

   Now go back and improve each layer.
```

### 3. "Fake It Till You Make It"

Production-quality features you can convincingly fake for a demo:

| Real Thing | Weekend Fake | Nobody Notices |
|---|---|---|
| Database queries against Snowflake | Hardcoded sample data generators | ✅ Data looks real |
| OAuth login flow | `DEV_MODE=true` auto-login | ✅ You're logged in |
| Real-time SSE streaming | Simulate a brief delay then render | ✅ Feels responsive |
| Full-text search | Simple `.includes()` string match | ✅ Works for demo terms |
| Permissions system | Everyone is admin | ✅ Everything is visible |

### 4. "Outside-In" vs "Inside-Out"

```
   Inside-Out (tempting but slow):
   Build database → build API → build store → build UI → pray it connects

   Outside-In (faster for POC):
   Hardcode UI with fake data → wire up store → add API → add database last

   Why? You see the app taking shape immediately.
   Motivation stays high. Feedback loops are tight.
```

---

## Quick Reference: The Weekend Build Flowchart

```
START
  │
  ▼
┌─────────────────────┐
│ Define demo moment   │ ← "Talk to AI, get a dashboard"
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Pick boring stack    │ ← Use what you know
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Map dependency graph │ ← What depends on what?
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Build Level 0        │ ← Project scaffold, types, data model
│ (2 hours)            │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Fire tracer bullet   │ ← One complete path: input → output
│ (3 hours)            │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Widen each slice     │ ← More widget types, more commands
│ (4 hours)            │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Polish & UX          │ ← Drag-drop, animations, dark theme
│ (4 hours)            │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Gallery + templates  │ ← Browse, share, start from template
│ (3 hours)            │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Demo prep            │ ← Fix top 3 bugs, practice walkthrough
│ (2 hours)            │
└──────────┬──────────┘
           │
           ▼
        ┌──────┐
        │ SHIP │
        │  IT  │
        └──────┘
```

---

## Final Thought

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                  │
│   The difference between a senior architect and a junior         │
│   developer on a weekend build is NOT that the senior writes     │
│   better code. It's that the senior knows what NOT to build.     │
│                                                                  │
│   Every hour spent on something that won't be in the demo        │
│   is an hour stolen from something that will.                    │
│                                                                  │
│   Scope is the enemy. Shipping is the goal.                      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

*Generated for the InsightHub project — April 2025*
