# Memory Hardening — Crash Course

> **Audience:** anyone debugging InsightHub on production (Jeff, future operators, the sysadmin, auditors who want to know "what protects against runaway processes").
> **Last updated:** 2026-05-19.
> **TL;DR:** A leaky Node process can no longer take down the EC2 box. systemd kills the InsightHub unit (only) at 768 MB and auto-restarts within 5 seconds. The kernel can no longer choose InsightHub as the OOM victim under global pressure.

## The incident that prompted this work

On **2026-05-15 at 16:00 UTC**, the EC2 host went unresponsive. `dmesg` told the story:

```
[Fri May 15 16:00:29 2026] Out of memory: Killed process 302256 (node)
  total-vm:4386580kB, anon-rss:1770464kB, file-rss:2360kB, shmem-rss:0kB,
  UID:1002 pgtables:56552kB oom_score_adj:0
```

A single Node process consumed **1.77 GB of resident memory**, the kernel's global OOM-killer ran, and several services were hard-killed before things stabilised. The operator (Jeff) had no AWS console access and was blocked on the sysadmin to recover.

The culprit was **almost certainly an `npm run dev` started over an SSH session and forgotten** — Next.js dev mode legitimately uses 2-3 GB of RAM on a codebase this size because it keeps the full unminified bundle, HMR runtime, every source map, and every dynamic import in memory.

Before the hardening, **nothing on the box distinguished "real production service" from "rogue dev process".** The systemd unit had `MemoryMax=infinity`, the kernel had no preference, and a runaway anything could exhaust 4 GB and SIGKILL whatever it could.

## The four layers of defence

We installed three layered limits + one kernel-preference setting in `@/Users/Jeffrey.Coy/CascadeProjects/InsightHub/scripts/ec2-deploy.sh:162-187` (which writes the systemd unit at every deploy). Each layer fails differently and buys time for the next.

### Layer 1 — V8 heap limit (`--max-old-space-size=512`)

Node V8 garbage-collects more aggressively as it approaches the heap limit. Without a limit, V8 grows the heap until it hits OS memory pressure — at which point you're already in trouble. **With** a 512 MB limit, V8 GCs eagerly and, in the worst case, throws a clean `JavaScript heap out of memory` exception **inside** Node before the OS notices.

**Failure mode:** clean exception inside the Node process. Stack trace, log line, no kernel involvement.

```ini
Environment=NODE_OPTIONS=--max-old-space-size=512
```

### Layer 2 — systemd soft cap (`MemoryHigh=512M`)

If V8's heap is fine but something OUTSIDE the V8 heap is leaking (native module, file handles, in-flight responses, Prisma cache, …), `MemoryHigh` is the next safety net. systemd asks the kernel to **throttle** the unit's allocations once it crosses 512 MB. The process keeps running, just slower. **This buys time for an operator (or the runtime itself) to react.**

**Failure mode:** the unit gets slow. Logs show high latency. Operator gets time to investigate.

```ini
MemoryHigh=512M
```

### Layer 3 — systemd hard cap (`MemoryMax=768M`)

If the leak keeps going past 768 MB, systemd OOM-kills **the unit only**. `Restart=always` + `RestartSec=5` brings it back within 5 seconds. **Crucially, the kernel never sees a global memory pressure event** — systemd handles it locally, the rest of the box stays up.

This is the layer that protects you from needing console access. **A leak no longer takes down the box.**

**Failure mode:** the InsightHub unit gets SIGKILL'd by systemd. It restarts in 5 seconds. journalctl shows the kill. The box stays alive.

```ini
MemoryMax=768M
```

### Layer 4 — OOMScoreAdjust=-100 (defence against co-tenants)

The EC2 host is shared. As of 2026-05-19 it also runs:

| Service | Memory | Owner |
|---|---|---|
| `autoqa` (gunicorn workers) | ~900 MB across 7 workers | the QA tool the box is named after |
| `coo-cockpit.service` | ~170 MB | a different Next.js app |
| `vapi-hub` | ~80 MB | a Vapi MCP server |
| InsightHub | ~90 MB (Layer 3 caps at 768 MB) | us |

If a co-tenant leaks — for example one of the autoqa gunicorn workers blows up — the kernel still has to pick a victim if global memory exhausts. **`OOMScoreAdjust=-100` tells the kernel to prefer killing other processes over InsightHub.** Range is -1000 (never kill) to +1000 (kill first); -100 is a moderate preference, not absolute immunity.

```ini
OOMScoreAdjust=-100
```

## Verifying the hardening is live

Three ways, in order of operator-friendliness:

### 1. The admin health endpoint
Hit `https://dashboards.jeffcoy.net/api/admin/health` while signed in as an admin. The `memory` block reflects everything:

```json
{
  "memory": {
    "heapUsedMB": 52,
    "heapTotalMB": 57,
    "heapLimitMB": 515,             ← Layer 1 (--max-old-space-size=512, V8 adds ~3 MB padding)
    "rssMB": 131,
    "externalMB": 4,
    "unit": {
      "currentMB": 106,             ← live cgroup current
      "highMB": 512,                ← Layer 2 (MemoryHigh)
      "maxMB": 768                  ← Layer 3 (MemoryMax)
    },
    "pressureRatio": 0.138          ← 0.0 idle, 1.0 at ceiling
  }
}
```

**Alert at `pressureRatio >= 0.75`. Page at `pressureRatio >= 0.90`.**

### 2. systemctl (from EC2 shell)
```bash
sudo systemctl show insighthub -p MemoryCurrent,MemoryHigh,MemoryMax,OOMScoreAdjust,Environment | grep -E 'Memory|OOM|NODE_OPTIONS'
```
Expected:
```
MemoryCurrent=...       (live, in bytes)
MemoryHigh=536870912    (512 MB)
MemoryMax=805306368     (768 MB)
OOMScoreAdjust=-100
Environment=...NODE_OPTIONS=--max-old-space-size=512
```

### 3. Direct cgroup pseudo-files
```bash
# Find the unit's cgroup dir, then read its memory pseudo-files:
CG=$(cat /proc/self/cgroup | head -1 | sed 's/0:://')
# For the running insighthub unit specifically:
sudo cat /sys/fs/cgroup/system.slice/insighthub.service/memory.current
sudo cat /sys/fs/cgroup/system.slice/insighthub.service/memory.high
sudo cat /sys/fs/cgroup/system.slice/insighthub.service/memory.max
```

## What to do if `pressureRatio` is high

The right answer depends on which layer is hot:

| Layer hot | What it means | What to do |
|---|---|---|
| `heapUsedMB` near `heapLimitMB` | V8 heap is full — JavaScript-level leak (caches, listeners, closures) | Take a heap snapshot via `node --inspect` or add `process.memoryUsage()` logging around suspect code paths |
| `rssMB` >> `heapTotalMB` | Native-side leak (Prisma client, Sharp image processing, native modules) | `pmap -x <PID>`; check for too many Prisma clients, leaked file handles |
| `unit.currentMB` near `unit.maxMB`, but heap normal | Process is spawning many subprocesses (e.g. child Node workers, ffmpeg) that share the cgroup | Check `ps -p <PID> --forest`; consider `TasksMax=` |
| `pressureRatio` flapping high then low | Healthy GC under load — not necessarily a leak | Look at concurrent request count; consider increasing `MemoryMax` if box has headroom |

## What this does NOT protect against

Honest list of remaining gaps:

1. **Build-on-prod OOM during deploy.** `npm run build` runs as `jeffreycoy`, not under the systemd unit, so it doesn't see the 768 MB ceiling. It legitimately peaks at ~1.2 GB during compile. The OOMScoreAdjust=-100 helps a little (kernel prefers killing other things) but the real fix is **Track B Phase 2 — move the build off-prod entirely into the CI runner**. Until that lands: don't run other heavy stuff during a deploy.

2. **Native-module leaks below the cgroup view.** If a native module mmaps shared memory or uses `tmpfs`, those bytes don't count toward `MemoryCurrent` in the same way. Rare but possible.

3. **CPU starvation.** Memory is bounded; CPU isn't. A runaway tight loop will still eat both vCPUs. Tier-3 follow-on: `CPUQuota=` on the systemd unit.

4. **Co-tenant OOM events.** If `autoqa` leaks past what the kernel can free, InsightHub is `OOMScoreAdjust=-100` preferred — but if there's literally no other process to kill, we'll still go. Realistic mitigation: tell the autoqa owner about their leak; or split services to separate boxes (G-22).

## Demo-day talking points (for JD / Lior / Avi)

If asked about availability defence:

> *"The 2026-05-15 OOM event taught us the box had no notion of per-service blast radius. We installed a three-layer memory budget on the InsightHub systemd unit: V8 heap, soft cgroup cap, hard cgroup cap. A leak now bounded to our unit only — kernel never sees global pressure, which means we never need console access to recover. Plus an OOMScoreAdjust hint so the kernel never picks us if anything else on the box misbehaves. We expose real-time pressure to the admin via `/api/admin/health` so we can alert at 75% and page at 90%, well before the hard kill."*

If asked about deploy-time risk:

> *"The build still runs on the EC2 today, which is the one window where memory pressure can spike. Track B Phase 2 — moving the build to the CI runner — closes that window entirely. Until then, the protective limits + the operator runbook ensure that even a worst-case build-time leak gets caught locally without paging the on-call."*

## File map

| Concern | Source of truth |
|---|---|
| systemd unit (with limits embedded) | `@/Users/Jeffrey.Coy/CascadeProjects/InsightHub/scripts/ec2-deploy.sh:140-194` |
| Admin health endpoint with cgroup readout | `@/Users/Jeffrey.Coy/CascadeProjects/InsightHub/src/app/api/admin/health/route.ts` |
| Compliance evidence (G-03 + this work) | `@/Users/Jeffrey.Coy/CascadeProjects/InsightHub/docs/COMPLIANCE_GAPS.md` |
| Original game-plan discussion | `@/Users/Jeffrey.Coy/CascadeProjects/InsightHub/docs/GAME_PLAN_2026-05-19.md` |
