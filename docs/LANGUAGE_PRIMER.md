# Programming Languages & File Formats: A Primer

> **Audience:** Anyone exploring the InsightHub codebase who wants to understand what each file type does, how to recognize it, what it excels at, and where it falls short.

---

## Table of Contents

1. [TypeScript (.ts)](#1-typescript-ts)
2. [TSX (.tsx)](#2-tsx-tsx)
3. [JavaScript / MJS (.js / .mjs)](#3-javascript--mjs-js--mjs)
4. [JSON (.json)](#4-json-json)
5. [CSS (.css)](#5-css-css)
6. [YAML (.yaml / .yml)](#6-yaml-yaml--yml)
7. [Markdown (.md)](#7-markdown-md)
8. [SVG (.svg)](#8-svg-svg)
9. [Prisma Schema (.prisma)](#9-prisma-schema-prisma)
10. [Shell Script (.sh)](#10-shell-script-sh)
11. [Python (.py)](#11-python-py)
12. [Dotfiles and Config Files](#12-dotfiles-and-config-files)
13. [Quick-Reference Comparison Table](#13-quick-reference-comparison-table)
14. [How to Tell Them Apart at a Glance](#14-how-to-tell-them-apart-at-a-glance)

---

## 1. TypeScript (.ts)

### What It Is

TypeScript is a **superset of JavaScript** created by Microsoft. Every valid JavaScript program is also valid TypeScript, but TypeScript adds one major feature: **static types**. Types let you declare what kind of data a variable holds (a number, a string, a list of users) *before* the program runs, so bugs get caught early instead of in production.

### What It Looks Like

```ts
// A type definition (this doesn't exist in plain JavaScript)
interface User {
  id: string;
  email: string;
  name: string;
  role: "ADMIN" | "VIEWER";       // Only these two strings allowed
  createdAt: Date;
}

// A function with typed parameters and return value
function getActiveUsers(users: User[]): User[] {
  return users.filter(u => u.role !== "VIEWER");
}
```

**How to spot it:** Look for type annotations after colons (`: string`, `: number`), the `interface` or `type` keywords, and angle-bracket generics like `Array<User>` or `Promise<Response>`.

### Where We Use It in InsightHub

| Folder | Purpose |
|--------|---------|
| `src/lib/` | Business logic, AI prompt builders, data helpers, auth |
| `src/app/api/` | Server-side API request handlers |
| `src/stores/` | Zustand state management |
| `scripts/` | Build and sync scripts |
| Root | `next.config.ts` |

### Strengths

- **Catches bugs before runtime.** Misspell a property name? TypeScript flags it instantly in your editor.
- **Autocomplete.** Your IDE suggests every field on an object and can jump to definitions.
- **Self-documenting.** `(users: User[]): User[]` immediately tells you the function takes and returns an array of Users.
- **Refactoring safety net.** Rename a field and the compiler shows every place that needs updating.
- **Scales to large codebases.** The bigger the project, the more value TypeScript provides.

### Weaknesses

- **Learning curve.** The type system can get complex (generics, conditional types, mapped types).
- **Compilation step.** TypeScript must be compiled to JavaScript before it runs.
- **Verbosity.** Simple scripts can feel over-engineered when every variable needs a type.
- **Type gymnastics.** Third-party libraries sometimes need elaborate type wrappers.

---

## 2. TSX (.tsx)

### What It Is

TSX is **TypeScript + JSX**. JSX is a syntax extension that lets you write HTML-like markup *inside* your code. It was popularized by React and is the standard for modern UI development. A `.tsx` file is simply a `.ts` file that can also contain angle-bracket tags that look like HTML.

### What It Looks Like

```tsx
'use client';

import { AreaChart, Area, XAxis, YAxis } from 'recharts';

interface ChartProps {
  data: Record<string, unknown>[];
}

export function MyChart({ data }: ChartProps) {
  return (
    <div className="flex items-center h-full">
      <AreaChart data={data} width={600} height={300}>
        <XAxis dataKey="month" />
        <YAxis />
        <Area dataKey="revenue" fill="#6baaff" />
      </AreaChart>
    </div>
  );
}
```

**How to spot it:** The `.tsx` extension, `'use client'` at the top, and functions that return blocks of HTML-like markup with curly-brace expressions like `{data.length}`.

### Where We Use It in InsightHub

- **Every UI component** in `src/components/` (charts, canvas, chat panel, widget library)
- **All pages and layouts** in `src/app/` (`page.tsx`, `layout.tsx`, `error.tsx`)

### Strengths

- **Visual and intuitive.** `<button onClick={save}>Save</button>` is easier to reason about than programmatic DOM manipulation.
- **Component-based.** Build small, reusable pieces that snap together like Legos.
- **Full TypeScript support.** Get type-checking on your component props, event handlers, and state.
- **Ecosystem.** Thousands of React component libraries (Recharts, Radix, shadcn/ui).

### Weaknesses

- **Not real HTML.** You use `className` instead of `class`, `htmlFor` instead of `for`.
- **Can get tangled.** Mixing logic and markup in one file can get messy in large components.
- **React-specific.** TSX is coupled to the React ecosystem. Vue and Svelte use different syntax.

### TSX vs. TS: When to Use Which

| Use `.tsx` when... | Use `.ts` when... |
|--------------------|-------------------|
| The file renders UI (components, pages) | Pure logic, no markup |
| It returns JSX/HTML-like markup | Utility functions, stores, API routes |
| It lives in `components/` or as a page | It lives in `lib/`, `stores/`, `scripts/` |

---

## 3. JavaScript / MJS (.js / .mjs)

### What It Is

JavaScript is **the language of the web**. Every browser runs it natively. TypeScript compiles *down to* JavaScript before execution.

The `.mjs` extension stands for **Module JavaScript**. It tells Node.js to treat the file as an ES Module (using `import`/`export` syntax) rather than the older CommonJS system (`require`/`module.exports`). Same language, different module system.

### What It Looks Like

```mjs
// postcss.config.mjs
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
```

**How to spot it:** No type annotations, no `interface` or `type` keywords. Otherwise looks very similar to TypeScript.

### Where We Use It in InsightHub

- **Config files only:** `postcss.config.mjs`, `eslint.config.mjs` (tools that require plain JavaScript)
- **Build output:** The compiled app inside `.next/` is all JavaScript

### Strengths

- **Universal.** Runs in every browser and server-side via Node.js.
- **No compilation needed.** Run it directly.
- **Huge ecosystem.** npm has over 2 million packages.
- **Flexible.** Dynamic typing makes quick prototypes fast to write.

### Weaknesses

- **No type safety.** Typos and wrong argument types only surface at runtime.
- **Quirky behavior.** `"1" + 1` gives `"11"` but `"1" - 1` gives `0`.
- **Two module systems.** CommonJS vs. ES Modules causes confusion (hence `.mjs`).
- **Harder to maintain at scale.** Without types, large codebases are harder to navigate.

### Why InsightHub Mostly Uses TypeScript Instead

TypeScript gives us safety while still being JavaScript under the hood. We only use `.mjs` where external tools specifically require plain JavaScript config.

---

## 4. JSON (.json)

### What It Is

JSON stands for **JavaScript Object Notation**. It is a **data format**, not a programming language. You cannot write logic, loops, or functions in JSON. It is purely for storing and transmitting structured data. It is the universal data interchange format of the modern web.

### What It Looks Like

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "strict": true,
    "jsx": "react-jsx",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["**/*.ts", "**/*.tsx"],
  "exclude": ["node_modules"]
}
```

**How to spot it:** Curly braces and square brackets, keys in double quotes, no comments (JSON does not support comments, though some tools like `tsconfig.json` use a superset called JSONC that does), no trailing commas.

### Where We Use It in InsightHub

| File | Purpose |
|------|---------|
| `package.json` | Project metadata, dependencies, npm scripts |
| `package-lock.json` | Exact dependency tree (auto-generated) |
| `tsconfig.json` | TypeScript compiler configuration |
| `docs/asana-task-gids.json` | Asana task ID mapping |

### Strengths

- **Universal.** Every language can read and write JSON.
- **Human-readable.** Easy to scan and understand at a glance.
- **Simple.** Only six data types: string, number, boolean, null, array, object.
- **Standard.** The default format for REST APIs and config files.

### Weaknesses

- **No comments.** Standard JSON has no way to annotate why a setting exists.
- **Strict syntax.** A missing comma or trailing comma breaks the whole file.
- **No code.** You cannot compute anything; it is static data only.
- **Verbose.** Repeated keys and quoting make large files noisy compared to YAML.

---

## 5. CSS (.css)

### What It Is

CSS stands for **Cascading Style Sheets**. It controls the **visual appearance** of your app: colors, spacing, fonts, layouts, animations. If HTML/TSX is the skeleton, CSS is the skin and clothing.

### What It Looks Like

```css
@import "tailwindcss";

:root {
  --bg-primary: #0a0e14;
  --text-primary: #e6edf3;
  --border-color: rgba(255, 255, 255, 0.08);
}

.card {
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 1.5rem;
}
```

**How to spot it:** Selectors followed by curly-brace blocks of `property: value;` pairs. Properties use kebab-case (words-separated-by-hyphens).

### Where We Use It in InsightHub

- `src/app/globals.css` is our single global stylesheet
- Most styling is done via **Tailwind CSS utility classes** directly in TSX files (`className="flex items-center text-sm"`) rather than traditional CSS files

### Strengths

- **Separation of concerns.** Keeps visual styling out of your logic code.
- **Cascading and inheritance.** Styles flow down the component tree naturally.
- **CSS variables.** Define colors and spacing once, reuse everywhere.
- **Powerful layout.** Flexbox and Grid make complex layouts straightforward.

### Weaknesses

- **Global scope.** Without careful naming, styles in one file can accidentally affect other parts of the app.
- **Specificity wars.** When multiple rules compete, the cascade can be unintuitive.
- **No logic.** You cannot loop or branch (though preprocessors like Sass add these).
- **Verbose for repetitive patterns.** This is exactly why Tailwind utility classes are popular.

### The Tailwind Approach

Instead of writing custom CSS classes, Tailwind gives you small, single-purpose utility classes that you compose:

```tsx
// Traditional CSS approach
<div className="card-header">...</div>  // Defined in a .css file

// Tailwind approach (no separate .css needed)
<div className="flex items-center gap-2 p-4 bg-white/5 rounded-lg">...</div>
```

Tailwind means less custom CSS to write and maintain, at the cost of longer `className` strings.

---

## 6. YAML (.yaml / .yml)

### What It Is

YAML stands for **YAML Ain't Markup Language**. Like JSON, it is a data format for storing structured data, but it uses **indentation** instead of braces, making it more human-friendly for configuration files. `.yaml` and `.yml` are the same format (just different extension length).

### What It Looks Like

```yaml
- term: "Churn Rate"
  category: "Retention"
  definition: >
    The percentage of customers who cancel their subscription
    within a given period.
  formula: "(cancelled_in_period / active_at_period_start) * 100"
  data_source: "sample_subscriptions"
  exclusions:
    - "Trial accounts (< 14 days)"
    - "Internal test accounts"
  related_terms: ["MRR", "LTV", "Retention Rate"]
```

**How to spot it:** Indentation-based structure, colons separating keys from values, dashes for list items, no curly braces or quotes required for most values.

### Where We Use It in InsightHub

| File | Purpose |
|------|---------|
| `glossary/terms.yaml` | Canonical business glossary definitions |
| `docker-compose.yml` | Docker container configuration |
| `.github/workflows/ci-deploy.yml` | GitHub Actions CI/CD pipeline |
| `bitbucket-pipelines.yml` | Bitbucket CI/CD pipeline |

### Strengths

- **Very readable.** Indentation makes hierarchy visually obvious.
- **Supports comments.** Use `#` to annotate (unlike JSON).
- **Less noise.** No curly braces, fewer quotes, no trailing-comma debates.
- **Multi-line strings.** The `>` and `|` operators handle long text blocks elegantly.

### Weaknesses

- **Whitespace-sensitive.** A wrong indent or mixing tabs with spaces silently breaks things.
- **Ambiguity.** `yes`, `no`, `on`, `off` are automatically parsed as booleans, which catches people off guard.
- **Not great for deeply nested data.** Deep indentation becomes hard to follow.
- **Security risk.** Some YAML parsers support code execution; always use safe-load functions.
- **Multiple valid representations.** The same data can be written many ways, making diffs noisy.

### YAML vs. JSON

| YAML | JSON |
|------|------|
| Indentation-based | Brace-based |
| Supports comments | No comments |
| More readable for configs | More reliable for data exchange |
| Easier to write by hand | Easier to parse programmatically |
| Used for config files | Used for APIs and data storage |

---

## 7. Markdown (.md)

### What It Is

Markdown is a lightweight **markup language** for creating formatted text using plain text syntax. It was designed to be readable even without rendering. This very document is written in Markdown.

### What It Looks Like

```markdown
# Heading 1
## Heading 2

Regular paragraph text with **bold** and *italic*.

- Bullet point one
- Bullet point two

| Column A | Column B |
|----------|----------|
| Data 1   | Data 2   |

```code block here```
```

**How to spot it:** `#` headings, `**bold**`, `*italic*`, `-` or `*` bullet lists, and fenced code blocks with triple backticks.

### Where We Use It in InsightHub

| File | Purpose |
|------|---------|
| `docs/*.md` | Specifications, session logs, decision log |
| `README.md` | Project overview and setup instructions |
| `AGENTS.md`, `CLAUDE.md` | AI assistant guidelines |
| `.windsurf/workflows/*.md` | IDE workflow definitions |

### Strengths

- **Dead simple.** You can learn the basics in five minutes.
- **Readable raw.** Even without rendering, the plain text makes sense.
- **Universal.** GitHub, Notion, Slack, and most dev tools render Markdown.
- **Version-control friendly.** Plain text diffs cleanly in Git.

### Weaknesses

- **Limited formatting.** No native support for colored text, complex layouts, or precise positioning.
- **Inconsistent rendering.** Different tools render Markdown slightly differently (GitHub-Flavored Markdown vs. CommonMark vs. others).
- **No interactivity.** It is static text only.
- **Tables are painful.** Complex tables with long content are hard to write and maintain by hand.

---

## 8. SVG (.svg)

### What It Is

SVG stands for **Scalable Vector Graphics**. It is an XML-based format for describing two-dimensional graphics. Unlike raster images (PNG, JPG) which are grids of pixels, SVGs are mathematical descriptions of shapes. They scale to any size without losing quality.

### What It Looks Like

```svg
<svg fill="none" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
  <path d="M14.5 13.5V5.41a1 1 0 0 0-.3-.7L9.8.29A1 1 0 0 0 9.08 0H1.5v13.5"
        fill="#666" fill-rule="evenodd"/>
</svg>
```

**How to spot it:** Opens with `<svg`, contains XML-style tags like `<path>`, `<circle>`, `<rect>`, and coordinate data in `d=` attributes.

### Where We Use It in InsightHub

- `public/*.svg` contains icon files (file icon, globe, Next.js logo, Vercel logo)
- `src/app/insighthub-logo.svg` is the app logo

### Strengths

- **Infinitely scalable.** Looks crisp on any screen size or resolution.
- **Tiny file size.** Simple icons are just a few hundred bytes.
- **Styleable with CSS.** Colors, strokes, and sizes can be changed without editing the image.
- **Animatable.** Paths and shapes can be animated with CSS or JavaScript.
- **Accessible.** You can add `<title>` and `<desc>` elements for screen readers.

### Weaknesses

- **Not for photos.** Complex, photographic images belong in JPG/PNG/WebP.
- **Hard to hand-write.** Path data (`d="M14.5 13.5V5.41..."`) is basically unreadable without a design tool.
- **Performance at scale.** An SVG with thousands of shapes is slower to render than a raster image.
- **Security.** SVG can embed scripts; never render untrusted SVGs without sanitization.

---

## 9. Prisma Schema (.prisma)

### What It Is

Prisma Schema Language is a **domain-specific language** (DSL) used exclusively by Prisma, our database ORM (Object-Relational Mapper). It defines your database tables, their columns, relationships, and constraints in a clean, declarative syntax. Prisma then generates type-safe TypeScript code to query the database.

### What It Looks Like

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model User {
  id          String    @id @default(cuid())
  email       String    @unique
  name        String
  role        String    @default("VIEWER")
  createdAt   DateTime  @default(now())
  dashboards  Dashboard[] @relation("owner")
}
```

**How to spot it:** `model` blocks that look like simplified TypeScript interfaces, `@` decorators for constraints, and `generator`/`datasource` blocks at the top.

### Where We Use It in InsightHub

- `prisma/schema.prisma` is the single source of truth for our database structure

### Strengths

- **Readable schema.** The entire database structure is in one file, easy to review.
- **Type-safe queries.** Prisma generates TypeScript types from your schema, so your database queries are type-checked.
- **Migration management.** Prisma tracks schema changes and generates SQL migrations automatically.
- **Database-agnostic.** Switch from SQLite to PostgreSQL by changing one line.

### Weaknesses

- **Prisma-only.** This language is useless outside the Prisma ecosystem.
- **Limited expressiveness.** Complex database features (stored procedures, custom functions) are not representable.
- **Abstraction layer.** Sometimes you need raw SQL for performance-critical queries, bypassing Prisma's benefits.
- **Learning curve.** Relation syntax (`@relation`) and some decorators take time to learn.

---

## 10. Shell Script (.sh)

### What It Is

Shell scripts are programs written for the Unix/Linux command-line shell (usually Bash or Zsh). They automate sequences of terminal commands: deploying code, running builds, setting up environments. Think of them as saved terminal sessions that can be replayed.

### What It Looks Like

```bash
#!/bin/bash
# Deploy InsightHub to EC2 via Tailscale SSH
set -euo pipefail

EC2_HOST="jeffreycoy@autoqa"
APP_DIR="/opt/insighthub"

echo "=== InsightHub EC2 Deploy ==="
rsync -avz --delete .next/standalone/ "$EC2_HOST:$APP_DIR/"
ssh "$EC2_HOST" "sudo systemctl restart insighthub"
echo "Deploy complete!"
```

**How to spot it:** Starts with `#!/bin/bash` (called a "shebang"), uses `$VARIABLE` syntax, and chains commands like `echo`, `rsync`, `ssh`, `cd`.

### Where We Use It in InsightHub

- `scripts/ec2-deploy.sh` deploys the app to our EC2 server

### Strengths

- **Direct system access.** Can do anything your terminal can: copy files, restart services, install packages.
- **Automation.** Turn a 10-step manual process into one command.
- **Universal on Unix/Mac.** Available on every Mac and Linux system out of the box.
- **Pipeline glue.** Great for CI/CD workflows that chain multiple tools together.

### Weaknesses

- **Fragile.** A missing quote or space can cause catastrophic bugs (deleting wrong files, etc.).
- **Poor error handling.** Without `set -euo pipefail`, errors are silently ignored by default.
- **Hard to debug.** No IDE support, no types, no stack traces.
- **Not cross-platform.** Shell scripts often break on Windows.
- **Unreadable at scale.** Complex logic in Bash quickly becomes cryptic.

---

## 11. Python (.py)

### What It Is

Python is a **general-purpose programming language** known for its clean, readable syntax. It uses indentation to define code blocks (no curly braces) and reads almost like pseudocode. It is the dominant language in data science, AI/ML, scripting, and automation.

### What It Looks Like

```python
import requests

def sync_asana_tasks(project_gid: str, token: str) -> list:
    """Fetch all tasks from an Asana project."""
    headers = {"Authorization": f"Bearer {token}"}
    url = f"https://app.asana.com/api/1.0/projects/{project_gid}/tasks"
    response = requests.get(url, headers=headers)
    return response.json()["data"]

if __name__ == "__main__":
    tasks = sync_asana_tasks("1214122597260827", os.getenv("ASANA_TOKEN"))
    print(f"Found {len(tasks)} tasks")
```

**How to spot it:** Indentation-based blocks (no braces), `def` for functions, `import` at the top, `:` after function signatures and `if`/`for` statements, and f-strings like `f"Hello {name}"`.

### Where We Use It in InsightHub

| File | Purpose |
|------|---------|
| `scripts/create_asana_project.py` | One-time Asana project setup |
| `scripts/reconcile_session.py` | Session reconciliation |
| `scripts/sync_asana_state.py` | Sync Asana project state locally |

### Strengths

- **Extremely readable.** Often called "executable pseudocode."
- **Batteries included.** Rich standard library for file I/O, HTTP, JSON, CSV, etc.
- **Vast ecosystem.** Libraries for everything: web APIs, data analysis, machine learning.
- **Fast to write.** Less boilerplate than TypeScript or Java for quick scripts.
- **Cross-platform.** Runs on Mac, Linux, and Windows.

### Weaknesses

- **Slower runtime.** Python is significantly slower than compiled languages.
- **Dynamic typing.** Like JavaScript, type errors only appear at runtime (though type hints help).
- **Dependency management.** pip, venv, conda, poetry... the packaging ecosystem is fragmented.
- **Not for the browser.** Python does not run in web browsers (unlike JavaScript).
- **Indentation is syntax.** Mixing tabs and spaces causes silent bugs.

### Why We Use Python for Scripts (Not TypeScript)

Python's standard library has excellent HTTP, file, and JSON support without any dependencies. For quick automation scripts that call APIs (like Asana), Python is faster to write and easier to run standalone. TypeScript would require a build step or `ts-node` and `node_modules` setup.

---

## 12. Dotfiles and Config Files

Several files in the repo do not have a traditional "language" but serve critical roles:

### .env / .env.example / .env.local

**What:** Environment variable files. Store secrets and configuration that should never be committed to Git.

```
DATABASE_URL="file:./dev.db"
ANTHROPIC_API_KEY="sk-ant-..."
NEXT_PUBLIC_DEV_MODE=true
```

**Key rule:** `.env.local` contains real secrets and is in `.gitignore`. `.env.example` is committed as a template showing which variables are needed.

### .gitignore

**What:** Tells Git which files to exclude from version control.

```
node_modules/
.next/
.env.local
*.db
```

**One line = one pattern.** Supports wildcards (`*`), directory matching (`/`), and negation (`!`).

### Dockerfile / docker-compose.yml

**What:** Docker configuration for containerized services. `docker-compose.yml` is YAML that defines services, ports, volumes, and health checks. In our repo it configures a PostgreSQL database container for future production use.

---

## 13. Quick-Reference Comparison Table

| Format | Type | Purpose | Runs Code? | Human-Readable? | Used For |
|--------|------|---------|------------|-----------------|----------|
| **.ts** | Language | Application logic | Yes (compiled) | Yes | Business logic, APIs, stores |
| **.tsx** | Language | UI components | Yes (compiled) | Yes | React components, pages |
| **.js/.mjs** | Language | General scripting | Yes (direct) | Yes | Config files, build output |
| **.json** | Data | Structured data | No | Yes | Config, package info, data |
| **.css** | Stylesheet | Visual styling | No (interpreted) | Yes | Colors, layout, typography |
| **.yaml/.yml** | Data | Configuration | No | Very | CI/CD, glossary, Docker |
| **.md** | Markup | Documentation | No | Very | Docs, READMEs, specs |
| **.svg** | Graphics | Vector images | No (rendered) | Somewhat | Icons, logos |
| **.prisma** | DSL | Database schema | No (generates code) | Yes | Database models |
| **.sh** | Language | Shell automation | Yes (direct) | Somewhat | Deployment scripts |
| **.py** | Language | Scripting | Yes (direct) | Very | Automation, API scripts |

---

## 14. How to Tell Them Apart at a Glance

When you open a file and need to quickly identify what you are looking at, here are the fastest signals:

### It starts with...

| First line contains... | It is probably... |
|------------------------|-------------------|
| `#!/bin/bash` | Shell script (.sh) |
| `import` or `from ... import` with no types | Python (.py) |
| `import` with `: type` annotations | TypeScript (.ts) |
| `'use client'` or returns `<JSX>` | TSX (.tsx) |
| `{` with quoted keys | JSON (.json) |
| `<svg` | SVG (.svg) |
| `@import "tailwindcss"` or selectors with `{}` | CSS (.css) |
| `- item:` or `key: value` with indentation | YAML (.yml) |
| `# Heading` | Markdown (.md) |
| `generator client` or `model` blocks | Prisma (.prisma) |
| `export default` with no types | JavaScript (.mjs) |

### Mental Model: The File Extension Tells You the "Job"

Think of each extension as a job title:

- **`.ts`** = The Architect (designs the logic and rules)
- **`.tsx`** = The Interior Designer (builds what users see)
- **`.css`** = The Painter (applies colors and styles)
- **`.json`** = The Filing Cabinet (stores structured data)
- **`.yaml`** = The Instruction Manual (human-friendly configuration)
- **`.md`** = The Technical Writer (documentation)
- **`.svg`** = The Artist (scalable graphics)
- **`.prisma`** = The Database Blueprint (defines data models)
- **`.sh`** = The Handyman (automates system tasks)
- **`.py`** = The Swiss Army Knife (quick scripts for anything)
- **`.mjs`** = The Translator (configuration that tools can understand)

---

## Putting It All Together

When a request comes into InsightHub, here is how these languages collaborate:

1. The user visits the app in their browser, which loads **TSX** components styled with **CSS** (via Tailwind).
2. The page layout and icons come from **SVG** files in `public/`.
3. User actions trigger **TypeScript** logic in stores and utilities.
4. API calls hit **TypeScript** route handlers in `src/app/api/`.
5. Those handlers query the database defined by the **Prisma** schema.
6. The AI chat sends prompts built in **TypeScript** to the Anthropic API, using glossary terms from the **YAML** file.
7. Dashboard schemas are stored as **JSON** strings in the database.
8. CI/CD pipelines defined in **YAML** run on every push to GitHub.
9. Deployment is automated by **Shell** scripts.
10. Project management scripts in **Python** keep Asana in sync.
11. All of this is documented in **Markdown** files like this one.

Every language and format has a specific job. None of them are interchangeable; each was chosen because it is the best tool for its particular purpose. Understanding which file type you are looking at and what it is responsible for is the first step to navigating any codebase with confidence.
