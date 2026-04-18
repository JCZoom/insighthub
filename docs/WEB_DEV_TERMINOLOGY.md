# Web Development & Software Terminology: A Deep Primer

> **Audience:** Anyone building or managing InsightHub who wants to speak the same language as developers. Every term is explained with a real example from our app.

---

## Table of Contents

1. [The Pages of Your Website](#1-the-pages-of-your-website)
2. [UI Elements You See and Interact With](#2-ui-elements-you-see-and-interact-with)
3. [Dashboard-Specific Vocabulary](#3-dashboard-specific-vocabulary)
4. [How the Web Actually Works](#4-how-the-web-actually-works)
5. [Client vs. Server](#5-client-vs-server)
6. [APIs: How the Pieces Talk to Each Other](#6-apis-how-the-pieces-talk-to-each-other)
7. [State, Stores, and Data Flow](#7-state-stores-and-data-flow)
8. [Authentication and Security](#8-authentication-and-security)
9. [Databases and Data](#9-databases-and-data)
10. [Deployment and Infrastructure](#10-deployment-and-infrastructure)
11. [Development Workflow Concepts](#11-development-workflow-concepts)
12. [Common Acronyms Quick Reference](#12-common-acronyms-quick-reference)

---

## 1. The Pages of Your Website

Every website is made up of **pages** — distinct screens that have their own URL. Here is every page in InsightHub and what it is properly called.

### Landing Page (Home Page)

**URL:** `/` (the root — just `https://dashboards.jeffcoy.net` with nothing after it)

**What it is:** The first page a user sees when they visit your site. It is called the **landing page** because it is where users "land" when they arrive. If your site were a store, this is the front door and lobby.

**What you see on ours:**
- The greeting ("Good morning")
- The headline "What would you like to visualize?"
- The text input (prompt box) where you describe a dashboard
- Four **quick-action cards** (Executive Summary, Churn Analysis, Support Overview, Sales Pipeline)
- A "Browse saved dashboards" link at the bottom
- The top navigation bar with the InsightHub logo

**Other names people use:** Home page, hero page, splash page. "Landing page" and "home page" are the most accurate for InsightHub.

**Common mistake:** Saying "main page" — developers will understand you, but the precise term is "landing page" or "home page."

---

### Gallery Page (Dashboard List)

**URL:** `/dashboards`

**What it is:** A page that displays a **collection of items** in a browsable format. In our case, it shows all your dashboards as a grid or list of cards. Think of it like a photo gallery, but for dashboards.

**What you see on ours:**
- Tab bar (All, My Dashboards, Company, Shared with Me, Templates)
- Search bar
- Sort dropdown
- Grid/List view toggle
- Favorites section
- Individual **dashboard cards** showing title, description, tags, owner, and age
- A "Create New Dashboard" card with a big + icon

**Other names people use:** Index page, list view, library, catalog, browse page.

---

### Dashboard Editor Page

**URL:** `/dashboard/new` (new dashboard) or `/dashboard/[id]` (editing an existing one)

**What it is:** The main workspace where dashboards are built and edited. This is a **split-panel layout** — meaning the screen is divided into two side-by-side sections.

**What you see on ours:**
- **Left side:** The **canvas** (where widgets appear in a grid)
- **Right side:** The **chat panel** (where you talk to the AI) with the **version timeline** below it
- **Top:** The **navbar** (navigation bar)
- **Optionally:** The **widget library panel** slides in from the right edge

**Other names people use:** Editor, builder, workspace, studio.

---

### Glossary Page

**URL:** `/glossary`

**What it is:** A reference page that lists and defines business terms (like "MRR," "Churn Rate," "CSAT"). Think of it as a dictionary for your company's metrics.

---

### Admin Page

**URL:** `/admin`

**What it is:** A restricted page only accessible to administrators. It contains settings and tools for managing the application — user permissions, audit logs, and system configuration. Most users never see this page.

---

### Login Page

**URL:** `/login`

**What it is:** The page where users enter their credentials (username/password) to gain access to the application. In development mode, InsightHub bypasses this and auto-logs you in.

---

### Error Page

**What it is:** A fallback page that displays when something goes wrong — a page that does not exist (404), a server error (500), or a permission issue (403). Instead of showing a broken screen, the app shows a friendly error message.

---

### The Anatomy of a URL

Since we are talking about pages, let us break down a URL:

```
https://dashboards.jeffcoy.net/dashboard/new?prompt=Build+me+a+dashboard
└─┬──┘  └──────────┬──────────┘└─────┬──────┘└──────────────┬──────────┘
scheme      domain (host)         path              query string
```

| Part | What it means |
|------|---------------|
| **Scheme** (`https://`) | The protocol. `https` means encrypted; `http` means unencrypted. |
| **Domain** (`dashboards.jeffcoy.net`) | The human-readable address of your server. |
| **Path** (`/dashboard/new`) | Which page on the server to show. Like a folder path on your computer. |
| **Query string** (`?prompt=Build...`) | Extra data passed to the page. Starts with `?`, uses `key=value` pairs separated by `&`. |
| **Port** (`:3000`) | Which "door" on the server to connect to. Usually hidden in production (443 for HTTPS). In development, you see `localhost:3000`. |

---

## 2. UI Elements You See and Interact With

These are the visual building blocks of any web application. When you want to ask for a change, using the right name helps your developer (or AI) know exactly what you mean.

### Navigation Bar (Navbar)

**What it is:** The horizontal strip at the very top of the page. It stays visible as you scroll and contains the app logo, links to other pages, and user controls.

**InsightHub's navbar contains:**
- The InsightHub logo + name (clicking it takes you home — this is called the **logo link** or **home link**)
- Navigation links: "My Dashboards," "Glossary"
- Theme toggle (dark/light mode switch)
- Profile bubble (your initials in a circle)

**Other names:** Top bar, header, app bar, menu bar.

**Important distinction:** The navbar is NOT the browser's address bar (where you type URLs). The navbar is part of your application; the address bar is part of Chrome/Safari/Firefox.

---

### Sidebar

**What it is:** A vertical panel on the left or right side of the screen. Sidebars typically contain navigation, tools, or supplementary content.

**In InsightHub:** The **chat panel** on the right side of the dashboard editor is technically a sidebar. The **widget library panel** is also a sidebar that slides in.

---

### Modal (Dialog / Popup)

**What it is:** A box that appears **on top of** the current page, usually with a darkened background behind it. It demands your attention — you cannot interact with the page behind it until you close the modal.

**InsightHub examples:**
- The **Share Modal** (when you share a dashboard)
- The **Shortcut Help Overlay** (keyboard shortcuts reference)
- Browser `confirm()` and `prompt()` dialogs (like "Are you sure you want to delete?")

**Other names:** Dialog, popup, lightbox, overlay.

**Important distinction:** A **modal** blocks interaction with the page behind it. A **dropdown** or **popover** does not.

---

### Dropdown

**What it is:** A small menu that appears when you click a button or field, showing a list of options. It closes when you pick one or click elsewhere.

**InsightHub examples:**
- The **profile dropdown** (click your initials → shows Profile, Settings, Sign Out)
- The **sort dropdown** on the gallery page (Most Recent, Oldest First, A→Z, Z→A)
- The **type filter** in the widget library

**Other names:** Select menu, popover menu, flyout.

---

### Toast (Notification)

**What it is:** A small, temporary message that slides in from a corner of the screen, stays for a few seconds, then disappears on its own. It confirms an action ("Dashboard saved") or reports an error without interrupting your workflow.

**InsightHub examples:**
- "Dashboard saved" (success toast, usually green)
- "Delete failed" (error toast, usually red)
- "Link copied to clipboard" (info toast)

**Other names:** Snackbar (Material Design term), notification, flash message.

**Important distinction:** A toast disappears on its own. An **alert** stays until you dismiss it.

---

### Tooltip

**What it is:** A tiny text label that appears when you **hover** your mouse over an element. It provides extra context without taking up permanent screen space.

**Example:** Hovering over the microphone icon shows "Voice input (⇧⌘M)".

---

### Button vs. Link

**What it is:** Both look clickable, but they serve different purposes:

| Element | Purpose | Example in InsightHub |
|---------|---------|----------------------|
| **Button** | Performs an action (save, delete, send) | "Send" button in chat, template cards on landing page |
| **Link** | Navigates to another page | "My Dashboards" in the navbar, "Browse saved dashboards" |

**How to tell them apart:** If clicking it takes you to a new URL, it is a link. If clicking it does something on the current page, it is a button.

---

### Input / Text Field

**What it is:** A box where users type text. There are several variants:

| Type | Description | InsightHub Example |
|------|-------------|-------------------|
| **Text input** | Single line of text | Search bar on gallery page |
| **Textarea** | Multiple lines of text | The prompt box on the landing page, chat message input |
| **Password input** | Text is hidden as dots | Login password field |

---

### Card

**What it is:** A rectangular container with a border and subtle shadow that groups related information together. Think of a physical index card or business card.

**InsightHub examples:**
- Each **dashboard card** in the gallery (shows title, description, tags, owner)
- Each **quick-action card** on the landing page (Executive Summary, Churn Analysis, etc.)
- Each **widget card** in the widget library panel

---

### Badge / Tag / Pill

**What it is:** A small, rounded label — usually colored — that categorizes or highlights something.

**InsightHub examples:**
- Tags on dashboard cards ("revenue," "churn," "executive")
- The "AI working…" pill in the toolbar
- Type filter buttons in the widget library ("KPI," "Bar Chart," "Table")

**Naming note:** "Badge," "tag," "pill," and "chip" are often used interchangeably. "Tag" usually refers to a category label. "Badge" often shows a count (like "3 new messages"). "Pill" describes the shape (rounded ends).

---

### Icon

**What it is:** A small graphic symbol that represents an action or concept. InsightHub uses the **Lucide** icon library — over 1,000 open-source icons.

**Examples:** The magnifying glass (search), the paper plane (send), the trash can (delete), the gear (settings), the bar chart (analytics).

**Best practice:** Icons should always have either visible text next to them or a **tooltip** explaining what they do. An icon alone can be ambiguous.

---

### Toggle / Switch

**What it is:** A control that switches between two states (on/off, dark/light, grid/list).

**InsightHub examples:**
- The **theme toggle** (switches between dark mode and light mode)
- The **grid/list view toggle** on the gallery page

---

### Divider / Separator

**What it is:** A thin horizontal or vertical line that visually separates sections of content.

**InsightHub example:** The line with "or start from a template" on the landing page that separates the text input from the quick-action cards. The **resizable divider** between the canvas and chat panel that you can drag to resize.

---

### Skeleton / Loading State

**What it is:** A placeholder animation (usually gray, pulsing rectangles) shown while content is loading. It gives users a preview of the layout before data arrives, which feels faster than showing a blank screen or spinner.

---

### Overlay

**What it is:** Any element that appears **on top of** the main content. Modals are overlays. The "Building your dashboard…" card that appears while the AI is working is an overlay.

---

### Context Menu

**What it is:** A menu that appears when you **right-click** on something. It shows actions specific to whatever you clicked on.

**InsightHub:** Right-clicking the canvas shows options like "Add KPI Card" and "Add Bar Chart." Right-clicking a widget shows "Duplicate," "Make Wider," "Delete," etc.

---

## 3. Dashboard-Specific Vocabulary

These terms are specific to InsightHub and the dashboard-building domain.

### Canvas

**What it is:** The main workspace area where widgets are arranged in a grid. If a dashboard were a painting, the canvas is the blank surface you place things on.

**Technical detail:** InsightHub's canvas uses a 12-column grid. Each widget occupies a certain number of columns (width) and rows (height) at a specific position (x, y).

---

### Widget

**What it is:** A single, self-contained visual element on the dashboard — a chart, a number, a table, or a text block. Widgets are the building blocks of a dashboard. Each widget displays one piece of information.

**InsightHub widget types:**
| Type | What it shows |
|------|---------------|
| **KPI Card** | A single big number with trend arrow (e.g., "MRR: $45,200 ↑12%") |
| **Bar Chart** | Vertical bars comparing categories |
| **Area Chart** | A line chart with the area below filled in |
| **Line Chart** | Data points connected by lines showing trends over time |
| **Pie / Donut Chart** | A circle divided into slices showing proportions |
| **Data Table** | Rows and columns of data (like a spreadsheet) |
| **Gauge** | A speedometer-like dial showing a value within a range |
| **Heatmap** | A grid of colored cells where color intensity represents value |
| **Funnel** | A narrowing shape showing conversion through stages |
| **Scatter Plot** | Dots on an X-Y axis showing correlation between two variables |
| **Text Block** | Free-form text for notes, headers, or explanations |
| **Metric Row** | A horizontal row of small metric values |

**Other names:** Tile, card, panel, component, block.

---

### Schema

**What it is:** A structured description of what something looks like and contains — a blueprint. In InsightHub, the **dashboard schema** is a JSON document that describes every widget on the dashboard: what type it is, where it is positioned, what data it shows, and how it looks.

**Why it matters:** When the AI "builds" a dashboard, it does not draw pixels. It generates a schema (a recipe), and the app reads that schema to render the actual visuals.

**Analogy:** A schema is to a dashboard what a floor plan is to a house. The floor plan says "put a kitchen here, a bedroom there, these dimensions." The builders (our code) follow the plan to construct the actual rooms.

---

### Schema Patch

**What it is:** A small, targeted change to the dashboard schema. Instead of replacing the entire dashboard, a patch says "add this widget" or "change the title of that chart" or "replace everything with this new layout."

**Patch types in InsightHub:**
| Patch Type | What it does |
|------------|-------------|
| `replace_all` | Replaces the entire dashboard schema (used for new dashboards) |
| `add_widget` | Adds a single new widget |
| `update_widget` | Modifies an existing widget's settings |
| `remove_widget` | Deletes a widget |
| `use_widget` | Copies a widget from the widget library |

---

### Template

**What it is:** A pre-built dashboard that serves as a starting point. Templates cannot be deleted or modified — they are read-only examples. InsightHub has four built-in templates: Executive Summary, Support Operations, Churn Analysis, and Sales Pipeline.

**Other names:** Starter, preset, blueprint, boilerplate.

---

### Widget Library

**What it is:** A browsable catalog of pre-made widgets that you can add to any dashboard with one click. It is like a parts catalog — instead of describing a widget from scratch, you pick one off the shelf.

---

### KPI (Key Performance Indicator)

**What it is:** A measurable value that shows how effectively a company is achieving a key business objective. "MRR is $45,200" is a KPI. KPI cards in InsightHub display these metrics prominently with trend indicators.

---

### Trend Indicator

**What it is:** A small arrow or percentage next to a KPI that shows whether the number is going up or down compared to a previous period. Green/up = good (usually), red/down = bad (usually). Some metrics are inverted — for example, a churn rate going UP is bad even though the arrow points up.

---

### Filter (Global Filter)

**What it is:** A control (usually a dropdown or date picker) that narrows the data shown across all widgets on a dashboard simultaneously. For example, a "Date Range" filter set to "Last 90 days" makes every chart and table show only the last 90 days of data.

---

### Drill Down

**What it is:** Clicking on a data point to see more detail. For example, clicking on a bar in a "Revenue by Region" chart might show a breakdown of revenue by city within that region. (This is a future feature for InsightHub.)

---

## 4. How the Web Actually Works

Understanding these fundamentals will make everything else click into place.

### HTTP (HyperText Transfer Protocol)

**What it is:** The set of rules that web browsers and servers use to communicate. When you visit a website, your browser sends an HTTP **request** to a server, and the server sends back an HTTP **response** containing the page.

**Analogy:** HTTP is like the postal system's rules. You put a letter (request) in a specific format, put it in the mailbox (the internet), and eventually get a response back. Both sides follow the same rules so the exchange works.

### HTTP Methods (Verbs)

When your browser talks to a server, it specifies what kind of action it wants:

| Method | Purpose | Real-world analogy |
|--------|---------|-------------------|
| **GET** | Retrieve data (load a page, fetch dashboards) | "Show me the menu" |
| **POST** | Create something new (send a chat message, create a dashboard) | "I'd like to place a new order" |
| **PUT** | Replace something entirely (rename a dashboard) | "Replace my order with this new one" |
| **PATCH** | Partially update something (change one field) | "Change the drink on my order to water" |
| **DELETE** | Remove something (delete a dashboard) | "Cancel my order" |

### HTTP Status Codes

Every response from the server includes a three-digit number indicating what happened:

| Code | Meaning | When you see it in InsightHub |
|------|---------|-------------------------------|
| **200** | OK — everything worked | Dashboard loaded, chat message processed |
| **201** | Created — something new was made | New dashboard saved to the database |
| **301/302** | Redirect — go to a different URL | After login, redirect to the dashboard |
| **400** | Bad Request — you sent something invalid | Missing required field in a form |
| **401** | Unauthorized — you are not logged in | Trying to access the app without a session |
| **403** | Forbidden — you are logged in but not allowed | The CSRF error you just encountered! |
| **404** | Not Found — that page does not exist | Visiting `/dashboard/abc123` when that ID does not exist |
| **429** | Too Many Requests — rate limited | Sending too many chat messages too quickly |
| **500** | Internal Server Error — the server broke | A bug in our code crashed the request |

---

### URL Routing

**What it is:** The system that maps URLs to pages. When you visit `/dashboards`, the router decides which page component to render.

**In Next.js (our framework):** The folder structure inside `src/app/` directly maps to URLs:

| Folder | URL |
|--------|-----|
| `src/app/page.tsx` | `/` (landing page) |
| `src/app/dashboard/new/page.tsx` | `/dashboard/new` |
| `src/app/dashboard/[id]/page.tsx` | `/dashboard/abc123` (any ID) |
| `src/app/glossary/page.tsx` | `/glossary` |
| `src/app/admin/page.tsx` | `/admin` |
| `src/app/api/chat/route.ts` | `/api/chat` (API, not a visible page) |

The `[id]` in brackets is a **dynamic route** — it matches any value. So `/dashboard/abc123` and `/dashboard/xyz789` both use the same page component but load different data.

---

### Rendering: What Happens When You Visit a Page

When you type a URL and press Enter, here is what happens:

1. **Your browser** sends an HTTP GET request to the server.
2. **The server** runs the matching page's code (fetches data from the database, etc.).
3. **The server sends back HTML** — the page's structure and content.
4. **Your browser renders** the HTML visually.
5. **JavaScript loads** and makes the page interactive (buttons work, chat responds, etc.).

This process happens in milliseconds. The distinction between what runs on the **server** vs. in the **browser** is one of the most important concepts in web development.

---

## 5. Client vs. Server

This is the single most important concept for understanding how a web application works.

### The Client (Frontend)

**What it is:** Everything that runs in the user's web browser. The HTML, CSS, and JavaScript that the browser downloads and executes. The client is what the user directly sees and interacts with.

**InsightHub client examples:**
- The landing page UI (buttons, text input, animations)
- The dashboard canvas rendering widgets
- The chat panel sending messages and displaying responses
- Theme toggling (dark mode / light mode)
- Drag-and-drop widget repositioning

**Key characteristic:** Client code runs on the user's computer. You can see it by opening "View Source" or the browser's Developer Tools. It cannot directly access the database or secret API keys.

### The Server (Backend)

**What it is:** A computer (in our case, an EC2 instance on Amazon Web Services) that runs code to process requests, access the database, and return responses. The server is invisible to the user.

**InsightHub server examples:**
- The `/api/chat` route that sends your message to the Anthropic Claude API
- The `/api/dashboards` route that saves and loads dashboards from the database
- Authentication (checking if you are logged in)
- Rate limiting (preventing abuse)

**Key characteristic:** Server code runs on our machine, not the user's. It can access secrets (API keys, database credentials) safely. Users cannot see or modify server code.

### The Handoff

When you type a chat message and hit Send:

1. **Client:** The ChatPanel component in your browser sends a POST request to `/api/chat`.
2. **Network:** The request travels over the internet to our server.
3. **Server:** The route handler receives the request, calls the Anthropic API, processes the response.
4. **Network:** The server sends the AI's response back.
5. **Client:** The ChatPanel receives the response and updates the UI.

This round trip typically takes 2-10 seconds (most of that is the AI thinking).

---

### Frontend vs. Backend

| | Frontend (Client) | Backend (Server) |
|---|---|---|
| **Runs where** | User's browser | Our EC2 server |
| **Language** | JavaScript (compiled from TypeScript) | Node.js (also JavaScript/TypeScript) |
| **Can access** | What the user sees, local storage, cookies | Database, API keys, file system |
| **Cannot access** | Database directly, secret keys | The user's screen or browser |
| **Files** | `src/components/`, `src/app/*/page.tsx` | `src/app/api/`, `src/lib/`, `middleware.ts` |

**Note:** Next.js (our framework) blurs this line. Some code runs on both the server AND the client. A file that starts with `'use client'` runs in the browser. A file in `src/app/api/` runs only on the server.

---

## 6. APIs: How the Pieces Talk to Each Other

### API (Application Programming Interface)

**What it is:** A set of rules that allows one piece of software to talk to another. When the chat panel in your browser needs to send a message to Claude, it calls the chat **API endpoint** on our server.

**Analogy:** An API is like a restaurant's ordering system. You (the client) do not walk into the kitchen. You give your order (request) to the waiter (API), who brings it to the kitchen (server), and brings back your food (response).

### Endpoint

**What it is:** A specific URL on the server that accepts requests and returns responses. Each endpoint handles one type of operation.

**InsightHub API endpoints:**
| Endpoint | Method | What it does |
|----------|--------|-------------|
| `/api/chat` | POST | Send a message to the AI, get dashboard patches back |
| `/api/dashboards` | GET | List all dashboards |
| `/api/dashboards` | POST | Create a new dashboard |
| `/api/dashboards/[id]` | GET | Load a specific dashboard |
| `/api/dashboards/[id]` | PUT | Update a dashboard (rename, save) |
| `/api/dashboards/[id]` | DELETE | Delete a dashboard |
| `/api/glossary` | GET | List glossary terms |
| `/api/health` | GET | Check if the server is running |
| `/api/widgets` | GET | Search the widget library |

### Request and Response

Every API interaction has two parts:

**Request** (what you send):
- **Method** — GET, POST, PUT, DELETE
- **URL** — which endpoint to hit
- **Headers** — metadata (like `Content-Type: application/json`)
- **Body** — the data payload (for POST/PUT only)

**Response** (what you get back):
- **Status code** — 200, 404, 500, etc.
- **Headers** — metadata about the response
- **Body** — the data (usually JSON)

**Example — sending a chat message:**
```
Request:
  POST /api/chat
  Content-Type: application/json
  Body: {"message": "Build me an executive summary", "currentSchema": null}

Response:
  Status: 200 OK
  Body: {"explanation": "I've created...", "patches": [...], "quickActions": [...]}
```

### REST (Representational State Transfer)

**What it is:** A convention for organizing API endpoints. REST says you should use nouns for URLs (`/dashboards`, `/glossary`) and HTTP methods for actions (GET to read, POST to create, PUT to update, DELETE to remove).

InsightHub follows REST conventions. This is why the dashboard endpoint is `/api/dashboards/[id]` and you use different HTTP methods to read, update, or delete it, rather than having separate URLs like `/api/getDashboard`, `/api/updateDashboard`, `/api/deleteDashboard`.

### JSON (JavaScript Object Notation)

**What it is:** The standard data format used for sending data between client and server. It looks like this:

```json
{
  "title": "Executive Summary",
  "description": "Key business metrics at a glance",
  "tags": ["revenue", "churn", "executive"],
  "widgetCount": 8
}
```

Every API request body and response body in InsightHub is JSON.

---

## 7. State, Stores, and Data Flow

### State

**What it is:** The current data that determines what the UI shows at any given moment. "State" is everything the application is keeping track of.

**Examples of state in InsightHub:**
- Which dashboard is currently loaded (its schema, title, ID)
- The list of chat messages in the conversation
- Whether the AI is currently working (shows the "Building your dashboard…" overlay)
- Whether the widget library panel is open or closed
- Which theme is active (dark or light)
- The user's undo/redo history

**Analogy:** State is like the current position of all pieces on a chess board. Every move changes the state. The UI is just a visual representation of the current state.

### Store (State Management)

**What it is:** A centralized place where state is kept and managed. Instead of each component tracking its own data independently, a store holds shared data that multiple components need.

**InsightHub uses Zustand** (a lightweight state management library) for its dashboard store. The store holds:
- The current dashboard schema
- The undo/redo history stack
- The dashboard title and ID
- Whether the AI is working

When the AI adds a widget, the store updates the schema, and every component that reads from the store automatically re-renders with the new data.

### Props

**What it is:** Data that a parent component passes down to a child component. Props are like function arguments — they tell the child what to display or how to behave.

**Example:** The landing page passes each quick-action card its icon, label, color, and prompt text as props.

### Component

**What it is:** A reusable, self-contained piece of UI. A component receives data (props) and returns what should appear on screen. Components can contain other components, like nesting boxes.

**InsightHub component examples:**
- `ChatPanel` — the entire chat sidebar
- `DashboardCanvas` — the widget grid area
- `KpiCard` — a single KPI widget
- `BarChartWidget` — a single bar chart widget
- `Navbar` — the top navigation bar
- `DashboardCard` — a single card in the gallery
- `ThemeToggle` — the dark/light mode switch

**Hierarchy example:**
```
NewDashboardPage
├── Navbar
├── DashboardCanvas
│   ├── WidgetRenderer
│   │   ├── KpiCard
│   │   ├── BarChartWidget
│   │   └── DataTableWidget
│   └── ContextMenu
├── WidgetLibraryPanel
├── ChatPanel
└── VersionTimeline
```

### Hook

**What it is:** A reusable piece of logic that a component can "hook into." Hooks let you share behavior across components without duplicating code.

**InsightHub hooks:**
| Hook | What it does |
|------|-------------|
| `useAutoSave` | Automatically saves the dashboard periodically |
| `useKeyboardShortcuts` | Listens for Cmd+S, Cmd+Z, etc. |
| `useSpeechToText` | Handles microphone input for voice-to-text |

---

## 8. Authentication and Security

### Authentication (AuthN)

**What it is:** Verifying **who** you are. "Prove your identity." This is the login step — you provide credentials (username + password, or a social login like Google), and the system confirms you are who you claim to be.

### Authorization (AuthZ)

**What it is:** Verifying **what you are allowed to do**. "Check your permissions." After you have proven who you are (authentication), the system checks whether you have permission to perform the requested action.

**Example:** You are authenticated as "Jeffrey Coy" (you proved your identity). You are authorized as "Admin" (you have permission to access the admin page). A "Viewer" user would be authenticated but NOT authorized to delete dashboards.

**Memory aid:** AutheNtication = "who are you?" AuthoriZation = "what can you do?"

### Session

**What it is:** A temporary record on the server that tracks a logged-in user. After you log in, the server creates a session so it remembers you across page loads. Without sessions, you would need to log in on every single page visit.

**How it works:** The server gives your browser a small piece of data (a **cookie**) that acts like a wristband at a concert. On every request, your browser sends the cookie back, and the server checks: "Oh, this wristband belongs to Jeffrey, he's an admin, let him through."

### Cookie

**What it is:** A small piece of data stored in your browser by a website. Cookies are automatically sent with every request to that website. They are used for sessions, preferences, and tracking.

**InsightHub cookies:**
- `next-auth.session-token` — your login session (proves you are authenticated)
- `next-auth.csrf-token` — the CSRF protection token (see below)

### JWT (JSON Web Token)

**What it is:** A compact, self-contained token that encodes information (like user ID, name, role) in a secure, tamper-proof format. InsightHub uses JWTs for session management — your login session is stored as a JWT in a cookie.

**Analogy:** A JWT is like a sealed, signed envelope. Anyone can read the outside (your name, role), but no one can change the contents without breaking the seal (the cryptographic signature).

### CSRF (Cross-Site Request Forgery)

**What it is:** A type of attack where a malicious website tricks your browser into making a request to a site you are logged into, using your cookies. Because your browser automatically sends cookies, the server thinks the request is legitimate.

**Example attack:** You are logged into InsightHub. You visit a malicious site that contains a hidden form that POSTs to `/api/dashboards/abc123` with method DELETE. Your browser sends the request with your InsightHub cookies, and your dashboard gets deleted — even though you never intended it.

**How CSRF protection works:** The server generates a secret token and stores it in a cookie AND requires it in the request. A malicious site can not read the cookie's value (browsers prevent this), so it cannot include the token in its forged request. Our server rejects any request without a matching token.

**This is exactly the error you hit!** An old version of our middleware required every POST request to include a CSRF token header. The chat panel was never sending that header, so the middleware rejected the request with "CSRF token missing." The fix was removing the overly aggressive custom CSRF check and relying on NextAuth's built-in cookie-based protection instead.

### Middleware

**What it is:** Code that runs **between** receiving a request and processing it. Think of middleware as a security checkpoint at an airport — every passenger (request) must pass through it before reaching their gate (the page or API endpoint).

**InsightHub's middleware checks:**
1. Is the user authenticated? (Do they have a valid session cookie?)
2. Are they accessing a public route? (The login page does not require authentication.)
3. Set security headers on every response.

### Rate Limiting

**What it is:** Restricting how many requests a user can make in a given time period. This prevents abuse, accidental infinite loops, and excessive API costs.

**InsightHub example:** The chat API uses a sliding window rate limiter — you can send at most 20 messages per minute. If you exceed the limit, you get a 429 (Too Many Requests) response.

---

## 9. Databases and Data

### Database

**What it is:** A structured system for storing and retrieving data. InsightHub uses **SQLite** — a lightweight database stored as a single file (`prisma/dev.db`) on the server. No separate database server needed.

**What we store:**
- User accounts (name, email, role)
- Dashboards (title, description, tags)
- Dashboard versions (the schema JSON for each saved version)
- Glossary terms
- Audit logs

### ORM (Object-Relational Mapper)

**What it is:** A library that lets you interact with the database using your programming language (TypeScript) instead of writing raw SQL queries. InsightHub uses **Prisma** as its ORM.

**Without an ORM (raw SQL):**
```sql
SELECT * FROM dashboards WHERE owner_id = 'user_123' ORDER BY updated_at DESC;
```

**With Prisma (our ORM):**
```typescript
const dashboards = await prisma.dashboard.findMany({
  where: { ownerId: 'user_123' },
  orderBy: { updatedAt: 'desc' },
});
```

Both do the same thing. The ORM version is type-safe and auto-completes in the editor.

### Schema (Database Schema)

**What it is:** The structure definition of the database — which tables exist, what columns they have, and how they relate to each other. Defined in `prisma/schema.prisma`.

**Note:** "Schema" is used in two different contexts in InsightHub:
1. **Dashboard schema** — the JSON blueprint describing a dashboard's widgets and layout
2. **Database schema** — the Prisma definition of our database tables and columns

Context usually makes it clear which one is meant.

### Migration

**What it is:** A controlled change to the database structure. When you add a new table or column, a migration script updates the database without losing existing data. Think of it like a renovation — you add a room to the house without demolishing what is already there.

### CRUD

**What it is:** The four basic operations you can perform on data:

| Letter | Operation | HTTP Method | Example |
|--------|-----------|-------------|---------|
| **C** | Create | POST | Create a new dashboard |
| **R** | Read | GET | Load a dashboard |
| **U** | Update | PUT/PATCH | Rename a dashboard |
| **D** | Delete | DELETE | Delete a dashboard |

Almost every feature in a web application boils down to CRUD.

### Seed Data

**What it is:** Pre-loaded sample data inserted into the database for development and demos. InsightHub's seed data includes sample customers, subscriptions, tickets, revenue events, deals, and product usage — all generated by `prisma/seed.ts`.

---

## 10. Deployment and Infrastructure

### Development Environment (Dev / Local)

**What it is:** Your own computer, running the app at `http://localhost:3000`. This is where you build and test changes. Changes you make here do not affect anyone else.

**Characteristics:**
- Fast refresh — edit code, see changes instantly
- Debug tools available
- Uses `NEXT_PUBLIC_DEV_MODE=true` to skip login
- Database is a local file

### Production Environment (Prod / Live)

**What it is:** The real, public version of the app that users access. InsightHub's production is at `https://dashboards.jeffcoy.net`, running on an AWS EC2 server.

**Characteristics:**
- Optimized for speed (compiled, minified code)
- Real authentication required
- SSL encryption (HTTPS)
- Must be explicitly deployed

### Deployment (Deploy)

**What it is:** The process of moving your code from development to production. For InsightHub, our deploy script (`scripts/ec2-deploy.sh`) does:
1. Sync files to the EC2 server
2. Install dependencies
3. Build the optimized version
4. Restart the service

**Analogy:** Development is rehearsing a play. Deployment is opening night. The code goes from your laptop to the live server.

### Build

**What it is:** The compilation step that transforms your source code (TypeScript, TSX) into optimized JavaScript and HTML that can run in production. The build process:
- Compiles TypeScript to JavaScript
- Bundles files together (fewer network requests)
- Minifies code (removes whitespace, shortens variable names)
- Optimizes images and assets
- Pre-renders static pages

The build output lives in the `.next/` folder.

### EC2 (Elastic Compute Cloud)

**What it is:** Amazon's virtual server service. Our InsightHub production server is an EC2 instance — essentially a rented computer in Amazon's data center that runs 24/7.

### Nginx

**What it is:** A web server that sits in front of our Node.js application. It handles SSL (HTTPS encryption), serves static files efficiently, and forwards requests to our app. Think of Nginx as the receptionist who directs visitors to the right department.

### SSL / TLS / HTTPS

**What it is:** Encryption that protects data in transit between the browser and server. The padlock icon in your browser's address bar means SSL is active. Without it, anyone on the same network could read your data (passwords, messages, etc.).

**InsightHub:** Our SSL certificate is from Let's Encrypt, managed by Certbot, and renewed automatically.

### DNS (Domain Name System)

**What it is:** The internet's phone book. It translates human-readable domain names (`dashboards.jeffcoy.net`) into IP addresses (`3.14.143.169`) that computers use to find each other.

**Our DNS:** A Cloudflare CNAME record points `dashboards.jeffcoy.net` to our EC2 instance.

### CI/CD (Continuous Integration / Continuous Deployment)

**What it is:** Automated systems that test and deploy code whenever changes are pushed.

- **CI (Continuous Integration):** Automatically runs checks (type-checking, tests, build) on every code push to catch bugs early.
- **CD (Continuous Deployment):** Automatically deploys to production after CI passes.

**InsightHub:** We have a GitHub Actions workflow (`.github/workflows/ci.yml`) for CI. Deployment is currently manual via the deploy script.

### Systemd Service

**What it is:** The Linux system that manages long-running processes. Our app runs as a systemd service called `insighthub`, which means Linux automatically:
- Starts the app when the server boots
- Restarts it if it crashes
- Provides log management

Useful commands: `systemctl status insighthub`, `systemctl restart insighthub`, `journalctl -u insighthub` (view logs).

---

## 11. Development Workflow Concepts

### Git / Version Control

**What it is:** A system that tracks every change to your code over time. Think of it as unlimited undo for your entire project, plus the ability to work on different features simultaneously without interfering with each other.

**Key concepts:**
| Term | Meaning |
|------|---------|
| **Repository (repo)** | The entire project and its history |
| **Commit** | A saved snapshot of changes, with a message describing what changed |
| **Branch** | A parallel version of the code for working on a feature without affecting `main` |
| **Main** | The primary branch — the "official" version |
| **Push** | Upload your commits to the remote server (GitHub) |
| **Pull** | Download others' commits from the remote server |
| **Merge** | Combine one branch's changes into another |
| **Diff** | A comparison showing what changed between two versions |

### npm (Node Package Manager)

**What it is:** The tool that manages third-party libraries (packages) that the project depends on. `package.json` lists what we need; `npm install` downloads them into `node_modules/`.

**Key commands:**
| Command | What it does |
|---------|-------------|
| `npm install` | Download all dependencies |
| `npm run dev` | Start the development server |
| `npm run build` | Create the production build |
| `npx` | Run a package's CLI tool without installing it globally |

### Framework vs. Library

**What it is:**
- A **library** is a tool you call when you need it. (Example: Recharts — you call it to render a chart.)
- A **framework** is a structure that calls YOUR code. (Example: Next.js — it decides when to render your pages, when to run your API routes, how routing works.)

**Analogy:** A library is a set of power tools. A framework is the entire house frame — you fill in the walls and rooms, but the frame decides the structure.

**InsightHub's key framework:** Next.js (which is built on React)
**InsightHub's key libraries:** Recharts (charts), Prisma (database), Zustand (state), Lucide (icons), Tailwind CSS (styling)

### Environment Variables

**What it is:** Configuration values that live outside the code, stored in `.env` files. They configure the app for different environments (development vs. production) without changing code.

**Examples:**
| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Where the database file is |
| `ANTHROPIC_API_KEY` | Secret key to use Claude AI |
| `NEXTAUTH_SECRET` | Secret key for encrypting sessions |
| `NEXT_PUBLIC_DEV_MODE` | Whether to skip login (dev only) |
| `NEXTAUTH_URL` | The base URL of the app |

**Critical rule:** Never commit secrets (API keys, passwords) to Git. Use `.env.local` (which is in `.gitignore`) for real values. Use `.env.example` as a template showing what variables are needed.

### Hot Reload / Fast Refresh

**What it is:** When you edit a file during development, the browser automatically updates to show your changes — without needing to manually refresh the page or restart the server. This is why the development experience feels so fast. Next.js uses a system called **Turbopack** for this.

### TypeScript Compilation

**What it is:** Browsers cannot run TypeScript directly. A compiler transforms TypeScript into plain JavaScript. This happens automatically during development (via Turbopack) and during the build step.

### Linting

**What it is:** Automated code quality checking. A linter (ESLint in our case) scans your code for common mistakes, style violations, and potential bugs — like a spell-checker for code.

---

## 12. Common Acronyms Quick Reference

| Acronym | Stands For | One-line Definition |
|---------|------------|---------------------|
| **API** | Application Programming Interface | How software components talk to each other |
| **CRUD** | Create, Read, Update, Delete | The four basic data operations |
| **CSS** | Cascading Style Sheets | The language for visual styling |
| **CSRF** | Cross-Site Request Forgery | An attack where a malicious site sends requests using your cookies |
| **CI/CD** | Continuous Integration / Continuous Deployment | Automated testing and deployment |
| **DNS** | Domain Name System | Translates domain names to IP addresses |
| **EC2** | Elastic Compute Cloud | Amazon's virtual server service |
| **HTML** | HyperText Markup Language | The language that structures web page content |
| **HTTP** | HyperText Transfer Protocol | The rules browsers and servers use to communicate |
| **HTTPS** | HTTP Secure | HTTP with encryption |
| **IDE** | Integrated Development Environment | The code editor (Windsurf, VS Code) |
| **JSON** | JavaScript Object Notation | Standard data format for APIs |
| **JWT** | JSON Web Token | A secure, self-contained authentication token |
| **KPI** | Key Performance Indicator | A measurable business metric |
| **MRR** | Monthly Recurring Revenue | Total subscription revenue per month |
| **npm** | Node Package Manager | Tool for managing JavaScript dependencies |
| **ORM** | Object-Relational Mapper | Library for database queries in your programming language |
| **REST** | Representational State Transfer | A convention for organizing API endpoints |
| **SQL** | Structured Query Language | The standard language for querying databases |
| **SSH** | Secure Shell | Encrypted remote access to a server's command line |
| **SSL** | Secure Sockets Layer | Encryption for web traffic (now TLS, but still called SSL) |
| **SSR** | Server-Side Rendering | Generating HTML on the server before sending to the browser |
| **TSX** | TypeScript + JSX | TypeScript files that contain HTML-like markup |
| **UI** | User Interface | What the user sees and interacts with |
| **URL** | Uniform Resource Locator | A web address |
| **UX** | User Experience | How the product feels to use (not just how it looks) |

---

## Putting It All Together: What Happens When You Click "Executive Summary"

Let us trace the complete journey from click to dashboard, using every concept we have covered:

1. **You are on the landing page** (`/`) in your **browser** (the **client**).

2. **You click the "Executive Summary" quick-action card** (a **button** **component** with an **icon** and label).

3. **The client-side JavaScript** encodes your prompt into a **query string** and uses the **router** to navigate to `/dashboard/new?prompt=Build+me+an+executive+summary...`.

4. **Next.js** (our **framework**) matches the **URL route** to `src/app/dashboard/new/page.tsx` and **renders** the dashboard editor page.

5. **The page component** initializes the **Zustand store** with an empty **dashboard schema** and mounts the **canvas**, **chat panel**, and **navbar** **components**.

6. **The ChatPanel** sees the `initialPrompt` **prop** (from the query string) and automatically sends a **POST** request to the `/api/chat` **API endpoint**.

7. **The middleware** intercepts the request, checks your **session cookie** (**authentication**), and lets it through.

8. **The rate limiter** checks that you have not exceeded 20 requests/minute.

9. **The route handler** extracts the message from the **JSON request body**, builds a **system prompt** (including the **glossary** and **widget library**), and calls the **Anthropic API** (an external API).

10. **Claude** (the AI) returns an **explanation** and **schema patches** (a `replace_all` patch with the full dashboard schema).

11. **The server** sends the **JSON response** back with **status 200**.

12. **The ChatPanel** receives the response, displays the explanation as a chat message, and passes the **patches** to the **schema patcher**.

13. **The schema patcher** applies each patch to the dashboard **schema** in the **Zustand store**.

14. **The store update** triggers a **re-render** — every **widget component** reads the new schema and renders the appropriate charts, KPI cards, and tables on the **canvas**.

15. **You see your Executive Summary dashboard**, built in seconds.

---

*This document complements the [Programming Languages & File Formats Primer](./LANGUAGE_PRIMER.md), which covers the file types and languages used in the codebase. Together, they provide a complete foundation for understanding and communicating about InsightHub.*
