# Production smoke test — 2026-05-19 post-Track B Phase 1 deploy

> **Captured:** 2026-05-19 ~17:25 ET (UTC-04:00)  
> **Commit deployed:** `8e024ba` (release tag `track-b-phase1-2026-05-19`)  
> **CI run:** [GitHub Actions 26112939154](https://github.com/JCZoom/insighthub/actions/runs/26112939154) — first successful CI-driven deploy via self-hosted runner  
> **Operator:** Jeff Coy from `akiva.local` (laptop), no SSH session held open against the deploy box during/after deploy  
> **Purpose:** Audit-grade evidence that the new CI-driven deploy pipeline produces a healthy production system meeting USZoom Encryption Policy 3701 (ENC-01 TLS, ENC-04 HSTS) and the memory-hardening commitments documented in `docs/MEMORY_HARDENING_CRASH_COURSE.md`.

## 1. Application health (`/api/health`, public, unauthenticated)

```bash
$ curl -s https://dashboards.jeffcoy.net/api/health | jq
{
  "status": "ok",
  "timestamp": "2026-05-19T17:23:10.158Z",
  "version": "0.1.0",
  "node": "v20.20.2",
  "uptime": {
    "seconds": 262,
    "since": "2026-05-19T17:18:47.950Z"
  },
  "database": {
    "status": "connected",
    "latencyMs": 2
  },
  "memory": {
    "heapUsedMB": 52,
    "heapTotalMB": 55,
    "rssMB": 129
  }
}
```

**What this proves:**

- App boots cleanly under the new systemd unit (uptime 262s ≈ 4.4 min — matches the deploy completion timestamp).
- DB reachable, 2ms p50 latency on a SQLite read.
- Memory profile is well below caps: **52MB heap / 129MB RSS** vs. **512MB soft / 768MB hard** systemd limits and **512MB V8 ceiling**. Head-room of ~4× before any throttling kicks in. Pressure ratio ≈ 0.17.
- Endpoint shape matches the e2e contract (`smoke.spec.ts:15`, `production-health.spec.ts`) — verifies the `fd5acbc` enrichment landed correctly.

## 2. TLS posture (G-03 evidence)

```bash
$ curl -sI https://dashboards.jeffcoy.net | grep -iE 'strict-transport|server'
Server: nginx/1.24.0 (Ubuntu)
strict-transport-security: max-age=63072000; includeSubDomains; preload
Strict-Transport-Security: max-age=63072000; includeSubDomains
```

```bash
$ openssl s_client -connect dashboards.jeffcoy.net:443 \
    -servername dashboards.jeffcoy.net </dev/null 2>/dev/null \
  | grep -E 'Protocol|Cipher\s*:' | head -2
    Protocol  : TLSv1.3
    Cipher    : AEAD-CHACHA20-POLY1305-SHA256
```

**What this proves:**

- TLS 1.3 negotiated.
- Cipher is AEAD with perfect forward secrecy (ChaCha20-Poly1305) — auto-selected because the test client preferred it; AES-GCM is also available per `/etc/letsencrypt/options-ssl-nginx.conf`.
- HSTS asserted with 2-year max-age, `includeSubDomains`, **preload-eligible** (per nginx).
- ENC-01 (TLS≥1.2) and ENC-04 (HSTS) controls satisfied at the wire level.

**Predicted SSL Labs grade: A+** — pending live scan, see `docs/COMPLIANCE_GAPS.md` G-03 §"Pending operator action".

## 3. Site reachability

```bash
$ curl -sI -o /dev/null -w '%{http_code}\n' https://dashboards.jeffcoy.net/
200
```

Home page returns 200. Public route ungated (intentional — the gallery landing page is public).

---

## Polish observations (Tier-2 follow-ons, NOT demo-blockers)

These two cosmetic findings surfaced during smoke testing. Filed here so they don't get forgotten and so the audit trail shows we noticed them.

> **Both polish items below were closed in commit `3925f1e` later the same day.** SSL Labs re-scan confirmed A+ at 2026-05-19 13:50 ET. Evidence: `docs/evidence/ssllabs-2026-05-19-after-fix.json`.

### P-01 — Duplicate `Strict-Transport-Security` header — ✅ RESOLVED 2026-05-19

```
strict-transport-security: max-age=63072000; includeSubDomains; preload   ← nginx (lowercased)
Strict-Transport-Security: max-age=63072000; includeSubDomains            ← Next.js middleware
```

**Status:** not broken — RFC 6797 §11.2 says the user agent processes the first occurrence, and both occurrences encode at-least-as-strong policy. Browsers behave correctly.

**Why we still want one source of truth:**

1. The two values disagree on `preload` — only nginx's version is preload-eligible. An auditor reviewing response headers will ask "which one is canonical?" and we should have a one-word answer.
2. If we ever change the policy (e.g., bump max-age, drop `includeSubDomains` for a subdomain test), we'd have to remember to change it in two places. Drift hazard.

**Recommended fix:** drop the HSTS line from `middleware.ts` (let nginx own HSTS at the edge). Dev mode doesn't need HSTS — `npm run dev` is HTTP, browsers ignore HSTS on localhost. One-line change in `middleware.ts`. Verify after deploy: `curl -sI https://dashboards.jeffcoy.net | grep -ic 'strict-transport-security'` should return `1`.

### P-02 — `Server:` header leaks nginx version — ✅ RESOLVED 2026-05-19

```
Server: nginx/1.24.0 (Ubuntu)
```

**Status:** information disclosure, low-impact. Auditors who run automated header scanners will flag it under "minimize attack-surface metadata". Not a USZoom policy violation today but a cheap improvement.

**Recommended fix:** add `server_tokens off;` to the `http` block in `infra/nginx.conf`, redeploy. Reduces the header to `Server: nginx`. Verify: `curl -sI https://dashboards.jeffcoy.net | grep -i '^server:'` should show `Server: nginx` (no version).

---

## Files referenced

- Release tag: `track-b-phase1-2026-05-19` (annotated, points at `e3bd8f2`)
- Memory hardening doc: `docs/MEMORY_HARDENING_CRASH_COURSE.md`
- Compliance posture: `docs/COMPLIANCE_GAPS.md` (header notes the CI-driven re-deploy)
- TLS architecture: `docs/TLS_CONFIGURATION.md`
- Demo narrative: `docs/DEMO_2026-05-20_TALKING_POINTS.md`
- Asana roll-up: project `1214122597260827`, parent task `1214944770438858`
