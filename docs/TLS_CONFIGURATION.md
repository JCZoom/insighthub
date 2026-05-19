# TLS Configuration — InsightHub

> **Compliance reference:** USZoom Encryption Policy **3701**, controls **ENC-01** (TLS ≥ 1.2, AES-128+) and **ENC-04** (Enforce HTTPS).
> **Gap:** G-03 — closed 2026-05-19.
> **Owner:** Jeff Coy.
> **Annual review due:** 2027-05-19.

---

## What we enforce, in one paragraph

InsightHub's public hostname (`dashboards.jeffcoy.net`) only accepts **TLS 1.2 and TLS 1.3**. All older protocols (SSL 2/3, TLS 1.0, TLS 1.1) are rejected at the Nginx layer. The cipher suite is pinned to the **Mozilla intermediate** baseline — every accepted cipher provides AES-128-GCM or stronger and perfect forward secrecy. HSTS is set to **2 years with `includeSubDomains`**, session tickets are off, and the `Server` response header is suppressed (`server_tokens off`). OCSP stapling is **not in use** (Let's Encrypt deprecated OCSP in 2025 — see the dedicated note in `infra/nginx-tls-options.conf`); SSL Labs treats this as informational, not a grade deduction. This satisfies USZoom Encryption Policy 3701 controls ENC-01 and ENC-04.

## Where the config lives

| Layer | File | Purpose |
|---|---|---|
| Source of truth | `infra/nginx-tls-options.conf` | The TLS hardening directives. Pinned, version-controlled, change-reviewed. |
| Deploy mechanism | `scripts/ec2-deploy.sh` step 9a | Uploads the snippet to `/etc/nginx/snippets/insighthub-tls.conf` on every deploy (idempotent). |
| Production reference | `/etc/nginx/sites-available/insighthub.conf` (HTTPS server block) | Contains `include /etc/nginx/snippets/insighthub-tls.conf;` — Certbot preserves the include across renewals. |
| Cert provisioning | `sudo certbot --nginx -d dashboards.jeffcoy.net` | Issues + renews the Let's Encrypt cert. Auto-renews via Certbot's systemd timer. |

This split is deliberate: Certbot is allowed to manage the HTTPS server block (cert paths, redirect rules) so its renewals work cleanly; **we** manage the cryptographic hardening via a separate snippet that Certbot does not touch.

## Why these choices (systems-thinking notes for stakeholder conversations)

### Why "Mozilla intermediate" and not "Mozilla modern"?

- **Modern** = TLS 1.3 only. Bleeding-edge browsers and SDKs only. Would lock out any HubSpot/Salesforce/Freshworks API caller still defaulting to TLS 1.2 negotiation, plus older mobile devices.
- **Intermediate** = TLS 1.2 + TLS 1.3. Mozilla's recommended default for "general-purpose servers with a variety of clients." Covers ~98% of real traffic without dropping a single cipher below the policy bar.
- **Old** = also allows TLS 1.0/1.1. Violates USZoom policy 3701 ENC-01.

Intermediate is the right pick for a B2B dashboard tool. Revisit if the audience ever narrows to TLS-1.3-only clients (e.g., a mobile-only product).

### Why HSTS 2 years, not 1 year, not 6 months?

- The RFC recommends ≥ 1 year for production. 2 years (63072000 seconds) is the modern norm and what Google, Cloudflare, and the HSTS preload list expect.
- We did **NOT** enable the `preload` directive yet. Once a hostname is on the HSTS preload list it's painful to remove — every browser ships hardcoded with the entry. We can add preload after 6 months of stable HTTPS-only operation with zero plain-HTTP fallback events.

### Why session tickets off, sessions cached?

Two different mechanisms:

- **Session ID cache** (which we keep, 10MB shared, 1d timeout) — server-side. If the key never leaves the server, forward secrecy holds.
- **Session tickets** (which we disable) — server hands the client an encrypted ticket. If the ticket-encryption key is ever compromised, an attacker can decrypt *past* recorded sessions. This breaks forward secrecy retroactively.

Disabling tickets is the right call for any system handling regulated data. Minor perf cost, big posture win.

### Why we are NOT doing OCSP stapling

Historically, OCSP stapling was best practice — without it, every client TLS handshake triggers a separate OCSP request from the client to the CA's revocation responder, which leaks browsing patterns to the CA and adds handshake latency. Stapling moved that lookup to the server.

In May 2024, Let's Encrypt announced they would stop issuing OCSP responses, completing the transition by mid-2026. Certs from their newer intermediates (`E8` and successors) **no longer carry an OCSP responder URL** in the Authority Information Access extension — there is literally nothing to staple. CRL-based revocation has replaced OCSP for LE-issued certs.

If we configure `ssl_stapling on` against such a cert, nginx logs a warning at config-test time (`"ssl_stapling" ignored, no OCSP responder URL`) and silently does nothing. We removed the directives to avoid the noisy warning and the false impression that stapling is active.

Per the SSL Labs grading guide, OCSP stapling is **not a grade-affecting factor** — its absence does not block A+. Verified against `dashboards.jeffcoy.net` on 2026-05-19: the only A+ blocker was a duplicate HSTS response header, addressed at the same deploy.

If we ever switch to a CA that still issues OCSP responders (commercial vendors like DigiCert, Sectigo), re-enable per the commented-out block in `infra/nginx-tls-options.conf`.

## How we verify it

After every deploy that touches TLS:

```bash
# 1. HSTS header present?
curl -sI https://dashboards.jeffcoy.net | grep -i strict-transport
# Expected: strict-transport-security: max-age=63072000; includeSubDomains

# 2. Old protocols rejected?
openssl s_client -connect dashboards.jeffcoy.net:443 -tls1_1 </dev/null 2>&1 | grep -E "(alert|protocol)"
# Expected: alert handshake_failure / "no protocols available"

# 3. Cipher enumeration:
nmap --script ssl-enum-ciphers -p 443 dashboards.jeffcoy.net | head -60
# Expected: only TLSv1.2 and TLSv1.3 sections, all ciphers grade A or higher.

# 4. End-to-end grade (run annually, save the PDF):
# https://www.ssllabs.com/ssltest/analyze.html?d=dashboards.jeffcoy.net&hideResults=on&latest
# Target: grade A or A+.
```

## Annual review checklist

Run on or before **2027-05-19**:

- [ ] Re-fetch Mozilla intermediate config from https://ssl-config.mozilla.org/ and diff against `infra/nginx-tls-options.conf`. Apply deltas (cipher suites do shift year-to-year).
- [ ] Run SSL Labs scan, save PDF to `docs/evidence/ssllabs-YYYY-MM-DD.pdf`, link from this file.
- [ ] Confirm Certbot auto-renewal has executed in the last 90 days (`sudo certbot renew --dry-run`).
- [ ] Bump the "Last reviewed" date in `infra/nginx-tls-options.conf` and this doc's "Annual review due" date.
- [ ] Asana: close the recurring "Annual TLS / SSL Labs review" task; let it auto-recreate.

## Baseline scan — captured 2026-05-19

| Date | Grade | Evidence | Notes |
|---|---|---|---|
| 2026-05-19 13:25 ET | **A-** | `docs/evidence/ssllabs-2026-05-19-before-fix.json` | Initial scan after G-03 closure deploy. Deduction: `hstsPolicy: invalid` ("Server provided more than one HSTS header") — both Nginx and Next.js middleware were emitting HSTS. Pre-fix baseline. |
| 2026-05-19 13:50 ET | **A+** | `docs/evidence/ssllabs-2026-05-19-after-fix.json` | After commit `3925f1e` removed HSTS from `middleware.ts`. Single header, `hstsPolicy: present`, no warnings. |

The next SSL Labs scan should run on or before 2027-05-19 per the annual review checklist above. Save the new JSON next to these files using the same naming convention (`ssllabs-YYYY-MM-DD.json`).
