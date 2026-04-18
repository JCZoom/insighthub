# Session Handoff Prompt

Use this prompt at the end of a long chat to generate a handoff you can paste into a fresh Cascade conversation. Works in any repository.

---

## The Prompt

```
The context window is getting full. Generate a concise session handoff I can
paste into a new Cascade conversation. Use these sections with markdown headers:

## Project
- Root path, tech stack, runtime versions (only what's non-obvious)

## Architecture & What's Been Built
- High-level architecture (data flow, key patterns)
- Features completed this session or recently

## Key Files
- Table of files a new session needs to know about: path, one-line purpose
- Focus on files that were created or heavily modified — skip obvious ones

## Decisions & Trade-offs
- Architectural or design decisions made and WHY
- Anything a new session might question or redo without this context

## Active Bugs & Gotchas
- Known issues, workarounds in place, edge cases discovered
- Things that look wrong but are intentional

## Current State & Next Steps
- What we just finished or were in the middle of
- What to work on next, in priority order
- Any blockers

Keep it factual and tight — no preamble, no filler. Prefer bullet points.
Omit any section that has nothing to report.
```

---

## Why This Works

- **No working-style preferences.** Those belong in Cascade memories or user
  rules — they persist automatically and don't need to be repeated per session.
- **"Decisions & Trade-offs" is explicit.** This is the hardest context to
  reconstruct and the most common source of rework in new sessions.
- **"Omit empty sections"** keeps short sessions short.
- **Repo-agnostic.** Nothing here is tied to a specific project.

## Tips

- **Save stable facts as memories.** If something is true across every session
  (tech stack, DB choice, deployment target), save it as a Cascade memory once
  instead of regenerating it every handoff.
- **Edit before pasting.** Skim the output and cut anything stale or wrong
  before feeding it to a new chat.
- **Pair with the Cascade memory system.** The handoff captures *volatile*
  session context. Memories capture *durable* project context. Use both.
