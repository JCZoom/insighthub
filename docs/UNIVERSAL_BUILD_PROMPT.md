# The Universal Build Prompt

## What This Is

A generalized, app-agnostic prompt template that you can fill in with **any** application idea and hand to Cascade (or any AI coding assistant) to autonomously build as much as possible in a single session — and then pick up where it left off in subsequent sessions.

The key innovation: **Phase 0 creates a project management scaffold first**, so every future session has a persistent roadmap to read, update, and resume from. The AI never starts blind.

---

## How to Use

1. Copy the prompt below
2. Replace every `{{PLACEHOLDER}}` with your specific app details
3. Delete any sections that don't apply (e.g., remove the AI/LLM section if your app doesn't use AI)
4. Paste into a fresh Cascade window

For follow-up sessions, use the **Continuation Prompt** at the bottom of this document.

---

---

# THE PROMPT

> **Copy everything between the two ═══ lines below and paste into a fresh Cascade window.**

═══════════════════════ COPY START ═══════════════════════

# BUILD: {{APP_NAME}} — {{ONE_LINE_DESCRIPTION}}

You are autonomously building {{APP_NAME}} — {{2-3 SENTENCE DESCRIPTION OF WHAT THE APP DOES, WHO IT'S FOR, AND ITS CORE VALUE PROPOSITION}}.

---

## PHASE 0: PROJECT PLANNING SCAFFOLD (Do This First)

Before writing any code, create a comprehensive project plan in {{PROJECT_MANAGEMENT_TOOL}} that will serve as the persistent roadmap across multiple build sessions.

### If using Asana:

{{CHOOSE ONE — DELETE THE OTHER}}

**Option A: Asana (via API — for work projects)**

You have access to the Asana API. Create the project structure programmatically:

1. Create an Asana project called "{{APP_NAME}} — Build Tracker"
2. Create these sections (in order):
   - **Architecture & Planning** — Design decisions, tech stack, data model
   - **Foundation** — Scaffolding, dependencies, configuration, database schema
   - **Core Features** — The primary functionality (one task per feature)
   - **UI & Design** — Pages, components, design system
   - **Auth & Security** — Authentication, authorization, middleware, input validation
   - **Data & Integration** — Data layer, APIs, external services
   - **Testing & QA** — Unit tests, E2E tests, error handling
   - **DevOps & Deploy** — CI/CD, hosting, monitoring, scripts
   - **Polish & Hardening** — Performance, accessibility, edge cases
3. Under each section, create tasks with:
   - Clear title describing the deliverable
   - Description with acceptance criteria
   - Dependencies noted in description ("Blocked by: [task name]")
   - Subtasks for granular steps
4. Save the project GID and all task GIDs to `docs/project-tracker.json`
5. As you complete each task during the build, mark it complete via the API

**Required env vars:** `ASANA_PERSONAL_ACCESS_TOKEN`, `ASANA_WORKSPACE_GID`
Create a script at `scripts/update-project-tracker.py` or `.ts` that can:
- List all tasks and their status
- Mark a task complete by name or GID
- Add new tasks discovered during build

**Option B: ClickUp (via API — for personal projects)**

You have access to the ClickUp API. Create the project structure programmatically:

1. Create a ClickUp list called "{{APP_NAME}} — Build Tracker" in the specified space
2. Create these status groups: To Do, In Progress, Done, Blocked
3. Create the same section structure as above using ClickUp's folder/list hierarchy
4. Create tasks with descriptions, subtasks, and dependency tags
5. Save the list ID and task IDs to `docs/project-tracker.json`

**Required env vars:** `CLICKUP_API_TOKEN`, `CLICKUP_SPACE_ID`
Create a helper script at `scripts/update-project-tracker.py` or `.ts`.

### If no API access:

Create a detailed `docs/PROJECT_ROADMAP.md` file with:
- Every task organized by section (same sections as above)
- `[ ]` / `[x]` checkboxes for each task
- Dependencies noted inline
- Update this file as you complete each task

**This roadmap is your source of truth.** At the start of every session, read it to know what's done and what's next.

---

## TECH STACK

| Layer | Technology | Notes |
|-------|-----------|-------|
| **Framework** | {{FRAMEWORK — e.g., Next.js 16 (App Router), SvelteKit, Rails, FastAPI}} | {{any version-specific notes}} |
| **Language** | {{LANGUAGE — e.g., TypeScript (strict), Python 3.12, Go}} | |
| **Styling** | {{CSS FRAMEWORK — e.g., Tailwind CSS v4, styled-components, CSS Modules}} | |
| **UI Components** | {{COMPONENT LIB — e.g., Radix UI, shadcn/ui, Material UI, Headless UI}} | |
| **Database** | {{DB — e.g., PostgreSQL via Prisma, SQLite, MongoDB, Supabase}} | |
| **Auth** | {{AUTH — e.g., NextAuth.js, Clerk, Supabase Auth, custom JWT}} | |
| **State Management** | {{STATE — e.g., Zustand, Redux Toolkit, Jotai, React Context}} | |
| **AI/LLM (if applicable)** | {{AI — e.g., Anthropic Claude SDK, OpenAI API, local Ollama}} | |
| **Testing** | {{TESTING — e.g., Playwright, Vitest, Jest, pytest}} | |
| **Icons** | {{ICONS — e.g., Lucide React, Heroicons, Phosphor}} | |
| **Validation** | {{VALIDATION — e.g., Zod, Yup, joi}} | |
| **Deployment** | {{DEPLOY — e.g., Vercel, EC2, Railway, Fly.io, Docker}} | |

### Package Installation

After scaffolding, install ALL dependencies upfront. Do not add them piecemeal. Generate the full `package.json` (or equivalent) in one shot.

---

## CORE CONCEPT

### What does the app do?

{{DESCRIBE THE APP IN 3-5 PARAGRAPHS. Be specific about:
- Who uses it (audience / personas)
- What problem it solves
- Core user workflows (step by step)
- What makes it different / special
- Key screens or views the user will interact with}}

### Data Model

{{DESCRIBE YOUR ENTITIES AND RELATIONSHIPS. Be as specific as possible.
Even a rough sketch helps enormously. Examples:

- Users have many Projects
- Projects have many Tasks
- Tasks belong to a Column (Kanban) and have assignees, labels, due dates
- Comments belong to Tasks and Users

OR provide a full schema if you have one (Prisma, SQL, Mongoose, etc.)
The more specific the data model, the more the AI can build autonomously.}}

### Core User Flows

{{LIST THE PRIMARY USER JOURNEYS:
1. User signs up → sees onboarding → creates first [thing]
2. User opens [thing] → interacts with [feature] → sees result
3. Admin manages [settings] → configures [rules]
etc.}}

---

## DESIGN SYSTEM

### Visual Direction

{{DESCRIBE THE LOOK AND FEEL:
- Dark mode? Light mode? Both?
- Minimal and clean? Dense and data-rich? Playful and colorful?
- Reference sites or apps that look like what you want
- Specific color palette if you have one (hex values)
- Font preferences
- Card styles, border radius, shadows, animations}}

### Design Principles (apply universally)

1. **Mobile-responsive** — Works on all screen sizes (or show "desktop recommended" notice for complex UIs)
2. **Loading states** — Skeleton screens or spinners for every async operation
3. **Error states** — User-friendly error messages, never raw stack traces
4. **Empty states** — Helpful messages when lists are empty, with a CTA
5. **Accessibility** — ARIA labels, keyboard navigation, sufficient color contrast
6. **Consistent spacing** — Use a 4px/8px grid system
7. **Feedback** — Toast notifications for actions, visual confirmation for saves

---

## ARCHITECTURE PATTERNS

Apply these patterns regardless of what the app does:

### API Design
- All API routes validate input with {{VALIDATION_LIB}}
- Consistent error response format: `{ error: string, code: string, details?: any }`
- Authentication checked on every protected route
- Rate limiting on expensive operations (AI calls, file uploads, bulk operations)

### State Management
- Client state separated from server state
- Optimistic updates where appropriate
- Undo/redo for destructive actions (if applicable)

### Security (Non-Negotiable)
- All user input sanitized before rendering (XSS prevention)
- Parameterized queries only (SQL injection prevention)
- CSRF protection on all mutation endpoints
- Secrets in environment variables only, never in source code
- Security headers in middleware (CSP, HSTS, X-Frame-Options)
- Ownership validation on every resource access (IDOR prevention)
- Audit logging for sensitive operations

### Error Handling
- Error boundaries on every page/route
- Graceful degradation when external services are down
- Structured logging (JSON in production, human-readable in dev)

### Dev Experience
- Dev mode that bypasses auth for rapid iteration
- Seed script with realistic sample data
- Health check endpoint (`/api/health` or equivalent)
- Environment variable validation at startup (fail fast)

---

## BUILD ORDER

Execute in this exact sequence. Each step should be fully working before moving on.

### Step 1: Project Setup
- Initialize project with {{FRAMEWORK}}
- Install ALL dependencies
- Configure TypeScript / linting / formatting
- Set up `.env.example` with all required variables
- Create `.gitignore`, `README.md`

### Step 2: Data Layer
- Define database schema (all models, relations, indexes)
- Create seed script with realistic sample data
- Verify: database creates, seeds, and queries work

### Step 3: Type System
- Define all shared TypeScript interfaces / types
- These are the contracts — every component and API references them

### Step 4: Authentication
- Set up auth provider with dev mode bypass
- Session helpers (`getCurrentUser`, role checks)
- Protected route middleware
- Verify: can log in, session persists, protected routes redirect

### Step 5: Core Business Logic
- Build the primary feature that defines the app
- This is the thing that makes the app useful — build it first
- Include the API routes, data fetching, and basic UI
- Verify: the core workflow works end-to-end

### Step 6: Secondary Features
- Build supporting features in dependency order
- Each feature: API route → business logic → UI component → integration
- Verify each feature works before moving to the next

### Step 7: UI Polish
- Navigation (navbar, sidebar, breadcrumbs)
- Theme system (dark/light mode if applicable)
- Command palette / search (if applicable)
- Keyboard shortcuts
- Loading states, empty states, error states for all pages

### Step 8: Admin & Settings (if applicable)
- Admin panel for user management
- System settings / feature flags
- Audit log viewer

### Step 9: Testing
- E2E tests for critical user flows
- API integration tests for core endpoints
- Accessibility smoke tests

### Step 10: Deployment Infrastructure
- Deploy script / CI pipeline
- Health monitoring
- Database backup strategy
- Production environment configuration

### Step 11: Documentation
- Update README with setup instructions
- API reference (if building an API)
- Update project tracker: mark completed tasks, note any deferred items

---

## QUALITY STANDARDS (Apply to Every File)

- **No `any` types** — strict TypeScript (or equivalent type safety)
- **No hardcoded strings** — use constants, enums, or config
- **No console.log** — use structured logger
- **No unhandled promises** — every async has error handling
- **No magic numbers** — named constants with comments
- **Every API validates input** — reject bad data at the door
- **Every page has an error boundary** — the app never shows a blank screen
- **Every mutation is auditable** — log who did what and when
- **Every external call has a timeout** — don't hang forever
- **Every list has pagination** — don't load 10,000 items into memory

---

## SESSION MANAGEMENT

### During this session:

1. Update the project tracker (Asana/ClickUp/ROADMAP.md) as you complete each task
2. If you hit a blocker or make a significant decision, log it:
   - In the project tracker as a comment/note
   - In `docs/DECISIONS.md` with the format: `## [Decision Title] \n **Date:** ... \n **Context:** ... \n **Decision:** ... \n **Rationale:** ...`
3. Before the session ends (or if context is getting full), generate a handoff summary

### At the end of this session:

Create/update `docs/SESSION_HANDOFF.md` with:
- What was completed
- What's in progress (partially done)
- What's blocked and why
- Key decisions made
- Known bugs discovered
- Next priorities

Also update the project tracker to reflect current state.

---

## IMPORTANT CONSTRAINTS

- Build real, production-quality code — not prototypes or mockups
- Every file must be immediately runnable after creation
- Prefer completing fewer features at high quality over many features that are half-done
- If you're unsure about a design decision, make the simplest choice and document it in DECISIONS.md
- Do not create placeholder files with TODO comments — either build it fully or skip it for the next session

═══════════════════════ COPY END ═══════════════════════

---

---

# CONTINUATION PROMPT

> Use this at the start of every follow-up session. Copy, paste, and adjust.

> **Copy everything between the two ═══ lines below for follow-up sessions.**

═══════════════════════ COPY START ═══════════════════════

# CONTINUE BUILD: {{APP_NAME}}

You are resuming the build of {{APP_NAME}}. This is a continuation from a previous session.

## First Steps (Do These Before Writing Code)

1. **Read the project tracker:**
   {{CHOOSE ONE:}}
   - Read `docs/PROJECT_ROADMAP.md` to see what's done and what's next
   - Query Asana/ClickUp via `scripts/update-project-tracker.py --list` to see task status
   - Read `docs/project-tracker.json` for task GIDs, then check status via API

2. **Read the session handoff:** Read `docs/SESSION_HANDOFF.md` for context from the last session

3. **Read key decisions:** Read `docs/DECISIONS.md` to understand past architectural choices — do NOT redo these without explicit user direction

4. **Verify current state:**
   - Run `npm run check:types` (or equivalent) — are there existing errors?
   - Run the dev server — does it start?
   - Check for any partially-completed work that needs finishing

## Then Continue Building

- Pick up from where the last session left off
- Follow the same build order, quality standards, and patterns as the original prompt
- Update the project tracker as you complete tasks
- Log any new decisions in DECISIONS.md
- Before context fills up, create an updated SESSION_HANDOFF.md

═══════════════════════ COPY END ═══════════════════════

---

---

# WHY THIS WORKS: Design Principles Behind the Prompt

## 1. Persistent State Across Sessions

The biggest problem with AI coding assistants is **context amnesia**. Every new window starts from zero. The project tracker (Asana/ClickUp/ROADMAP.md) solves this by giving the AI a persistent artifact to read at the start of every session. It knows what's done, what's next, and what decisions were made.

## 2. Plan Before Build

Forcing the AI to create a complete project plan *before touching code* does three things:
- Makes the AI think through the full architecture upfront (reduces rework)
- Gives the human a review checkpoint (you can reorder, cut, or add tasks before coding starts)
- Creates the scaffold that makes continuation sessions work

## 3. Specificity Gradient

The prompt is structured from most-specific to least-specific:
- **Tech stack** — exact libraries and versions (eliminates 90% of decision-making)
- **Data model** — the schema drives everything (if this is right, the AI can derive API routes, types, and components)
- **Core concept** — what the app does (the AI fills in UX details)
- **Design system** — visual direction (the AI fills in specific CSS)

The more specific you are in the placeholders, the more the AI builds autonomously. Vague inputs → the AI asks questions or makes bad assumptions.

## 4. Dependency-Ordered Build Sequence

The build order isn't arbitrary — it's a topological sort:
- Types before components (contracts first)
- Auth before features (security from day one)
- Core feature before polish (working software first)
- Tests after features (test real behavior, not mocks)

This prevents the AI from building a beautiful UI that can't connect to the database.

## 5. Quality Standards as Constraints

Instead of hoping for quality, the prompt encodes quality as hard constraints:
- "No `any` types" is more actionable than "write good TypeScript"
- "Every API validates input" is more actionable than "be secure"
- "Every page has an error boundary" is more actionable than "handle errors"

The AI treats these as rules, not suggestions.

## 6. Human Review Checkpoints

The project tracker isn't just for the AI — it's for *you*:
- After Phase 0, review the plan before any code is written
- After each session, check the handoff and reprioritize if needed
- The decisions log lets you course-correct before bad patterns compound

## 7. Graceful Degradation Across Sessions

If the AI only gets through 40% of the build in one session, that's fine:
- The project tracker shows exactly what's done
- The handoff document captures in-progress state
- The continuation prompt picks up cleanly
- No work is lost, no context needs to be reconstructed from scratch

---

*Template version 1.0 — Generalized from the InsightHub build experience*
