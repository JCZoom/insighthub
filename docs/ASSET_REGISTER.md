# InsightHub — Asset Register

> **Policy reference:** USZoom Policy 12737 Asset Management.
> **Gap closed:** G-04 (from `docs/COMPLIANCE_GAPS.md`).
> **Review cadence:** Quarterly.
> **Owner of this register:** Jeff Coy (technical implementation) / JD Gershan (policy compliance per USZoom policy 3713).
> **Last reviewed:** 2026-04-24
> **Next review due:** 2026-07-24

## How to read this register

Policy 12737 requires every asset used to store, process, or transmit information to be tracked with a named owner, classification, location, lifecycle state, and contractual reference. The register is organized into the four policy-defined asset classes plus a fifth service-asset class:

1. **Information assets** — data sets, secrets, credentials, code.
2. **Software assets** — runtime dependencies, SaaS applications.
3. **Hardware assets** — physical machines.
4. **Service assets** — third-party services the system depends on.
5. **Human assets** — named individuals with documented responsibilities.

**Classification values** (per USZoom Policy 3698):

- **CC** = Customer Confidential
- **UR** = USZoom Restricted
- **UC** = USZoom Confidential
- **P** = Public

**Lifecycle values:** `Planned` / `Active` / `Deprecated` / `Retired`.

**Data-classification note for InsightHub:** as of 2026-04-24 the production database contains **only synthetic seed data** (`SampleCustomer`, `SampleSubscription`, etc. — see `@/Users/Jeffrey.Coy/CascadeProjects/InsightHub/prisma/schema.prisma:191-282`). When Phase 3 Snowflake integration goes live, several assets below will escalate from `UR` to `CC`. Escalation is tracked in the Risk Register under the Phase 3 gate.

---

## 1. Information Assets

| ID | Asset | Classification | Owner | Location | Lifecycle | Notes |
|---|---|---|---|---|---|---|
| INFO-01 | Production SQLite database (`prisma/dev.db`) | UR (will become CC in Phase 3) | Jeff Coy | EC2 `/opt/insighthub/prisma/dev.db` | Active | Encrypted at rest via EBS AES-256. Rename to `prod.db` tracked under gap G-22. |
| INFO-02 | Database backups | UR (will become CC in Phase 3) | Jeff Coy | EC2 `/opt/insighthub/backups/` | Active | Daily cron; retention 14d (G-07 to bump to 30d); optional AES-256-CBC via `BACKUP_ENCRYPTION_KEY` (G-13 to enforce). |
| INFO-03 | Audit log (`AuditLog` table) | UC | Jeff Coy | Inside INFO-01 | Active | See `@/Users/Jeffrey.Coy/CascadeProjects/InsightHub/prisma/schema.prisma:176-189`. |
| INFO-04 | Source code repository | UC | Jeff Coy | GitHub `JCZoom/insighthub` + Bitbucket mirror | Active | Private visibility. Branch protection pending under G-19. |
| INFO-05 | Git history (includes commit metadata, author emails) | UC | Jeff Coy | Same as INFO-04 | Active | — |
| INFO-06 | CI run logs & artifacts | UC | Jeff Coy | GitHub Actions | Active | 90-day default retention. |
| INFO-07 | Production secrets (`.env.local` on EC2) | CC | Jeff Coy | EC2 `/opt/insighthub/.env.local` + local macOS `.env.local` | Active | Contains Anthropic API key, OpenAI key, Asana PAT, Google OAuth secret, `NEXTAUTH_SECRET`, `BACKUP_ENCRYPTION_KEY`. Migration to AWS Secrets Manager tracked under G-36. |
| INFO-08 | Google OAuth client ID + secret | CC | Jeff Coy | INFO-07 + Google Cloud Console | Active | Rotate on compromise. No documented rotation cadence. |
| INFO-09 | Anthropic API key | CC | Jeff Coy | INFO-07 + Anthropic console | Active | Key value flagged in `docs/RED_TEAM_SECURITY_REPORT.md` H-1 as at risk due to scp-based deploy. See G-36. |
| INFO-10 | OpenAI API key | CC | Jeff Coy | INFO-07 + OpenAI console | Active | Same risk model as INFO-09. |
| INFO-11 | Asana Personal Access Token | UC | Jeff Coy | `.env` + Asana account | Active | PAT lifetime managed by Asana; rotated 2026-04-24 (prior PAT in `.env.local` was stale). |
| INFO-12 | `NEXTAUTH_SECRET` (JWT signing key) | CC | Jeff Coy | INFO-07 | Active | Bumping this invalidates all live sessions instantly — incident-response lever. |
| INFO-13 | Tailscale auth keys | UC | Jeff Coy | Tailscale admin console | Active | Used for EC2 SSH. |
| INFO-14 | AWS IAM credentials (deploy-time) | UR | Jeff Coy | macOS keychain via `aws configure` | Active | Principle-of-least-privilege pending under G-16 (IaC). |
| INFO-15 | Let's Encrypt ACME account key | UR | Jeff Coy | EC2 `/etc/letsencrypt/` | Active | Renewals automatic via certbot timer. |
| INFO-16 | Dashboard schemas & widget configurations | UR | Dashboard owner (per `Dashboard.ownerId`) | INFO-01 | Active | Stored as JSON in `Dashboard.versions.schema`. |
| INFO-17 | Glossary terms + definitions | UR | Jeff Coy | INFO-01 + `glossary/terms.yaml` seed | Active | Business-metric definitions; not customer-identifying. |
| INFO-18 | Chat sessions & messages (AI conversation history) | UR (will be CC in Phase 3) | Session owner | INFO-01 | Active | 90-day retention via `/api/admin/retention`. |
| INFO-19 | User profile data (email, name, role) | CC (PII) | Jeff Coy | INFO-01 | Active | Minimal PII — email + display name only. GDPR right-to-export/delete implemented. |
| INFO-20 | Permission Group definitions | UC | Jeff Coy | INFO-01 | Active | See `@/Users/Jeffrey.Coy/CascadeProjects/InsightHub/prisma/schema.prisma:285-346`. |
| INFO-21 | Thumbnail images (dashboard previews) | UR | Dashboard owner | EC2 `public/thumbnails/` | Active | Auto-generated from dashboards. |
| INFO-22 | Overnight-build and session logs | UC | Jeff Coy | Repo `logs/` + `docs/` | Active | Development records. Some contain internal architecture details. |
| INFO-23 | Compliance documentation (this register, matrix, gaps, etc.) | UC | Jeff Coy | Repo `docs/` | Active | Governed by USZoom policy 3710 Control of Documented Information. |

---

## 2. Software Assets

| ID | Asset | Classification | Owner | Location | Lifecycle | Notes |
|---|---|---|---|---|---|---|
| SW-01 | Next.js 15 (framework) | N/A (open source) | Jeff Coy | `package.json` | Active | Per AGENTS.md, uses breaking APIs different from training data — check `node_modules/next/dist/docs/`. |
| SW-02 | React 19 | N/A | Jeff Coy | `package.json` | Active | — |
| SW-03 | Prisma ORM | N/A | Jeff Coy | `package.json` | Active | SQLite adapter. Schema at `@/Users/Jeffrey.Coy/CascadeProjects/InsightHub/prisma/schema.prisma`. |
| SW-04 | NextAuth.js | N/A | Jeff Coy | `package.json` | Active | Google OAuth provider. |
| SW-05 | TailwindCSS | N/A | Jeff Coy | `package.json` | Active | — |
| SW-06 | Playwright (E2E test tooling) | N/A | Jeff Coy | `package.json` + `e2e/` | Active | — |
| SW-07 | All other production npm dependencies | N/A | Jeff Coy | `package-lock.json` | Active | Dependabot enablement pending under G-15. |
| SW-08 | Ubuntu 22.04 LTS (host OS) | N/A | Jeff Coy | EC2 instance | Active | `unattended-upgrades` enablement pending under G-15. |
| SW-09 | Nginx | N/A | Jeff Coy | EC2 | Active | Config at `@/Users/Jeffrey.Coy/CascadeProjects/InsightHub/infra/nginx.conf`. |
| SW-10 | Node.js 20 LTS | N/A | Jeff Coy | EC2 + local dev | Active | — |
| SW-11 | systemd service (`insighthub.service`) | N/A | Jeff Coy | EC2 `/etc/systemd/system/` | Active | Source: `@/Users/Jeffrey.Coy/CascadeProjects/InsightHub/infra/insighthub.service`. |
| SW-12 | certbot (Let's Encrypt client) | N/A | Jeff Coy | EC2 | Active | — |

---

## 3. Hardware Assets

| ID | Asset | Classification | Owner | Location | Lifecycle | Notes |
|---|---|---|---|---|---|---|
| HW-01 | Production EC2 instance (`autoqa`) | N/A | Jeff Coy | AWS us-east-1 | Active | EBS-encrypted root. Reachable only via Tailscale + HTTPS. |
| HW-02 | EBS root volume | N/A | Jeff Coy | Attached to HW-01 | Active | AES-256 at rest (AWS default). Verification in deploy tracked under G-12. |
| HW-03 | Jeff's MacBook (development endpoint) | N/A | Jeff Coy | Personal / home office | Active | FileVault assumed on (non-enforced — MDM gap). |
| HW-04 | YubiKey or equivalent hardware MFA (planned) | N/A | Jeff Coy | — | Planned | Tracked under G-02 for privileged access. |

---

## 4. Service Assets (third-party SaaS & infrastructure)

| ID | Service | Data classification handled | DPA / SOC report | Owner | Lifecycle | Exit strategy |
|---|---|---|---|---|---|---|
| SVC-01 | AWS (us-east-1) | UR/CC (hosts INFO-01, INFO-02) | SOC 2 Type II (current) | Jeff Coy | Active | Migrate EC2 + EBS + Route53 to alternate IaaS (Azure / GCP). Gated on G-16 (IaC). |
| SVC-02 | Google Workspace (OAuth IdP) | CC (auth identity) | SOC 2 Type II, ISO 27001 (current) | USZoom Admin | Active | Replace with corporate Okta / Auth0 SSO. |
| SVC-03 | Anthropic (Claude API) | UR (chat content — may contain business terms) | SOC 2 Type II (current) | Jeff Coy | Active | Replaceable with SVC-04 or OSS model (Llama, Mistral). |
| SVC-04 | OpenAI (voice transcription, embeddings) | UR (transcript content) | SOC 2 Type II (current) | Jeff Coy | Active | Replaceable with self-hosted Whisper + local embeddings. |
| SVC-05 | GitHub (source control + Actions) | UC (source code) | SOC 2 Type II, ISO 27001 (current) | Jeff Coy | Active | Primary mirror; can switch to Bitbucket-primary. |
| SVC-06 | Bitbucket (source mirror) | UC | SOC 2 Type II (current) | Jeff Coy | Active | Secondary mirror. |
| SVC-07 | Asana (project management) | UC (project metadata) | SOC 2 Type II (current) | Jeff Coy | Active | Replaceable with Linear / Jira. Data export via Asana API. |
| SVC-08 | Snowflake (planned — Phase 3) | CC (customer analytics) | SOC 2 Type II, ISO 27001 (current) | Jeff Coy | Planned | Pre-integration DPA review required per G-26. |
| SVC-09 | Let's Encrypt (TLS certificate authority) | P (certs are public) | Public CA, CA/B Forum audited | Jeff Coy | Active | Fallback: ZeroSSL or commercial CA. |
| SVC-10 | Tailscale (zero-trust SSH access) | UR (SSH session metadata) | SOC 2 Type II (current) | Jeff Coy | Active | Replaceable with AWS SSM Session Manager. |
| SVC-11 | Netlify (legacy deployment provider) | N/A | — | Jeff Coy | Deprecated | Current deploys are EC2-only; `netlify.toml` kept for config reference. |
| SVC-12 | CloudWatch (observability — planned) | UC | Included with SVC-01 | Jeff Coy | Planned | Enablement tracked under G-21. |
| SVC-13 | AWS Secrets Manager (planned) | CC | Included with SVC-01 | Jeff Coy | Planned | Enablement tracked under G-36. |

---

## 5. Human Assets (named responsibilities)

| Role | Name | Policy reference |
|---|---|---|
| Chief Information Security Officer / Information Security Management Leader / Data Protection Officer | JD Gershan | USZoom Policy 3713 |
| Security Manager | Lior Zamir | USZoom Policy 3713 |
| Director of Compliance | Avi Katz | USZoom Policy 3713 |
| InsightHub technical implementation owner | Jeff Coy | This register |
| InsightHub operational owner (EC2, deploys, on-call) | Jeff Coy | This register |
| ISMS Governance Council | CIO + COO + Director of Operations + IT Leaders | USZoom Policy 3713 |

---

## Review procedure (quarterly)

1. Jeff Coy or designate walks each row.
2. For each asset:
   - Still exists? If not, move to Retired state with retire date + reason.
   - Classification still correct? (Especially: has the asset been connected to real customer data since last review?)
   - Owner still accurate? (Especially relevant if headcount grows.)
   - Lifecycle state current?
   - New dependencies, vendor changes, contract renewals?
3. New assets added since last review must be included with all columns populated.
4. Any asset elevated to CC classification triggers a Risk Register review to ensure compensating controls are documented.
5. Reviewer signs off at the bottom of this file with date + reviewer name.
6. Diff is committed to Git (this register IS our audit trail for asset changes).

---

## Review history

| Date | Reviewer | Summary |
|---|---|---|
| 2026-04-24 | Jeff Coy | Initial register created as part of USZoom ISMS compliance pass. 23 information assets, 12 software assets, 4 hardware assets, 13 service assets tracked. |
