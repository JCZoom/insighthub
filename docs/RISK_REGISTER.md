# InsightHub — Risk Register

> **Policy reference:** USZoom Policy 3712 Risk Assessment/Treatment; Policy 3716 Risk Management.
> **Gap closed:** G-34 (from `docs/COMPLIANCE_GAPS.md`).
> **Review cadence:** Quarterly (synchronized with Asset Register).
> **Owner:** Jeff Coy (technical) + JD Gershan (policy-level).
> **Last reviewed:** 2026-04-24
> **Next review due:** 2026-07-24

## How this register works

This register follows USZoom Policy 3712 and ISO 27001:2022 clause 6.1:

1. **Identify** — every risk to information confidentiality, integrity, or availability, sourced from the gap list, the AI red-team review, operational awareness, and threat intelligence.
2. **Analyze** — score each risk on **Impact (1-5)** and **Likelihood (1-5)**. Multiply for a raw risk rating (1-25).
3. **Evaluate** — compare against risk tolerance (see below) to decide a treatment.
4. **Treat** — one of:
   - **Mitigate** — reduce the risk via a control (this is the default).
   - **Transfer** — push the risk to a third party (insurance, vendor SLA).
   - **Accept** — document why living with the risk is acceptable (requires compensating controls).
   - **Avoid** — remove the activity that creates the risk.
5. **Monitor** — track status and revisit on the next review.

### Scoring scale

**Impact (1-5):**
1. **Negligible** — minor inconvenience, no regulatory or customer impact.
2. **Minor** — limited internal impact, recoverable same-day.
3. **Moderate** — single-system outage, audit finding, minor data exposure (no PII).
4. **Major** — prolonged outage, regulatory reporting required, PII exposure.
5. **Severe** — regulated data breach, loss of SOC 2 attestation, multi-system compromise.

**Likelihood (1-5):**
1. **Rare** — <1% annual probability.
2. **Unlikely** — 1-10%.
3. **Possible** — 10-30%.
4. **Likely** — 30-60%.
5. **Almost certain** — >60%.

### Risk tolerance (inherited from USZoom Policy 3716)

- **Raw rating 1-4:** Accept with standard controls, review annually.
- **Raw rating 5-9:** Mitigate during the next planning cycle. Review quarterly.
- **Raw rating 10-15:** Mitigate this sprint. Weekly status.
- **Raw rating 16-25:** Top priority. Daily status until rating drops below 10.

### Status values

- **Open** — identified, treatment not yet started.
- **In Progress** — treatment active, residual rating being reduced.
- **Monitoring** — treatment implemented, observing for effectiveness.
- **Closed** — residual rating at acceptable level.
- **Accepted** — living with it; compensating controls documented.

---

## Active risks

Each row references the corresponding gap in `docs/COMPLIANCE_GAPS.md` (`G-NN`) and the Asana subtask where applicable.

| Risk ID | Description | Impact | Likelihood | Raw | Treatment | Owner | Status | Residual rating | Linked gap | Last reviewed |
|---|---|---|---|---|---|---|---|---|---|---|
| **R-001** | Data classification absent — no structured way to apply retention/encryption/access by sensitivity | 4 | 4 | **16** | Mitigate | Jeff Coy | Open | — | G-01 | 2026-04-24 |
| **R-002** | MFA not enforced at application layer — reliant entirely on Google Workspace config | 4 | 3 | **12** | Mitigate | Jeff Coy | Open | — | G-02 | 2026-04-24 |
| **R-003** | Production backups reside on same host as primary database — host compromise = both lost | 5 | 2 | **10** | Mitigate | Jeff Coy | In Progress (code shipped 2026-04-24, AWS setup pending operator) | 4 (after operator runs `scripts/setup-backup-isolation.sh`) | G-13 | 2026-04-24 |
| **R-004** | Secrets copied to production via scp from `.env.local`; no rotation policy; flagged in red-team H-1 | 4 | 3 | **12** | Mitigate | Jeff Coy | Open | — | G-36 | 2026-04-24 |
| **R-005** | No Incident Response runbook — response to a real incident is improvised | 4 | 2 | **8** | Mitigate | Jeff Coy | In Progress | 4 (after G-18 close) | G-18 | 2026-04-24 |
| **R-006** | No Asset Register in production — unmanaged assets cannot be protected | 3 | 3 | **9** | Mitigate | Jeff Coy | Closed (this review) | 3 | G-04 | 2026-04-24 |
| **R-007** | No Statement of Applicability — audit readiness blocked | 3 | 4 | **12** | Mitigate | Jeff Coy | In Progress | 4 | G-34, G-37 | 2026-04-24 |
| **R-008** | No automated PII retention / anonymization — GDPR Art. 5 retention minimization at risk | 4 | 2 | **8** | Mitigate | Jeff Coy | Open | — | G-05 | 2026-04-24 |
| **R-009** | Audit logs lack structured IP/user-agent; metadata not sanitized before persistence | 3 | 2 | **6** | Mitigate | Jeff Coy | Open | — | G-20 | 2026-04-24 |
| **R-010** | Branch protection not enabled on `main`; single-developer review risk | 3 | 2 | **6** | Accept (solo-dev era) | Jeff Coy | Accepted | 6 | G-19 | 2026-04-24 |
| **R-011** | No Dev / Staging / Production separation; production DB named `dev.db` | 4 | 2 | **8** | Mitigate | Jeff Coy | Open | — | G-22 | 2026-04-24 |
| **R-012** | `NEXT_PUBLIC_DEV_MODE=true` may be set in production, bypassing auth | 5 | 2 | **10** | Mitigate | Jeff Coy | In Progress | 2 (once validator fixed) | G-22 (related) | 2026-04-24 |
| **R-013** | No static application security testing (SAST) in CI beyond `npm audit` | 3 | 3 | **9** | Mitigate | Jeff Coy | Open | — | G-24 | 2026-04-24 |
| **R-014** | No quarterly access review — stale permissions accumulate | 3 | 3 | **9** | Mitigate | Jeff Coy | Open | — | G-09 | 2026-04-24 |
| **R-015** | No automated offboarding — departed users retain InsightHub data footprint | 3 | 2 | **6** | Mitigate | Jeff Coy | Open | — | G-10 | 2026-04-24 |
| **R-016** | No vendor register / DPA review — supply-chain risk unmanaged | 4 | 2 | **8** | Mitigate | Jeff Coy | Open | — | G-26 | 2026-04-24 |
| **R-017** | No annual backup restore test — backups may silently be corrupt | 4 | 2 | **8** | Mitigate | Jeff Coy | Open | — | G-27 | 2026-04-24 |
| **R-018** | No AWS resources in IaC — rebuild after regional outage is manual and slow | 4 | 1 | **4** | Accept (low likelihood) then Mitigate | Jeff Coy | Accepted (temporary) | 4 | G-16 | 2026-04-24 |
| **R-019** | No FIM on production host — file tampering would go undetected | 3 | 1 | **3** | Accept | Jeff Coy | Accepted | 3 | G-28 | 2026-04-24 |
| **R-020** | No CloudWatch alerting — outages discovered only by user report | 4 | 3 | **12** | Mitigate | Jeff Coy | Open | — | G-21 | 2026-04-24 |
| **R-021** | TLS config relies on Certbot defaults; not explicitly pinned or SSL-Labs tested | 3 | 2 | **6** | Mitigate | Jeff Coy | Open | — | G-03 | 2026-04-24 |
| **R-022** | No quarterly vulnerability scans on infrastructure | 3 | 3 | **9** | Mitigate | Jeff Coy | Open | — | G-23 | 2026-04-24 |
| **R-023** | No third-party penetration test — only AI-generated internal red-team | 4 | 3 | **12** | Mitigate | Jeff Coy | Open | — | G-32 | 2026-04-24 |
| **R-024** | No privacy notice / CCPA compliance UI exposed publicly | 3 | 3 | **9** | Mitigate | Jeff Coy | Open | — | G-33 | 2026-04-24 |
| **R-025** | `ADMIN_EMAILS` list hardcoded in source — changes require deploy, not auditable by admins | 2 | 2 | **4** | Mitigate | Jeff Coy | Open | — | G-38 | 2026-04-24 |
| **R-026** | Admins use regular accounts for privileged actions (no separate admin account) | 2 | 2 | **4** | Accept (single-admin era) | Jeff Coy | Accepted | 4 | G-11 | 2026-04-24 |
| **R-027** | Backup retention is 14 days vs. policy 30-day minimum | 3 | 1 | **3** | Mitigate | Jeff Coy | Closed 2026-04-24 | 0 (KEEP_DAYS=30 shipped) | G-07 | 2026-04-24 |
| **R-028** | User deletion may not log `USER_ACCOUNT_DELETION` audit entry | 3 | 2 | **6** | Mitigate | Jeff Coy | Open | — | G-08 | 2026-04-24 |
| **R-029** | Audit log retention upper bound not enforced — unbounded growth + privacy exposure | 2 | 3 | **6** | Mitigate | Jeff Coy | Open | — | G-06 | 2026-04-24 |
| **R-030** | Phase 3 Snowflake integration will elevate production to Customer Confidential tier | 5 | 4 | **20** | Mitigate (blocked-pending) | Jeff Coy | In Progress — **gate on tier-1 closed** | depends on G-01/G-02/G-13 | Multiple | 2026-04-24 |
| **R-031** | Single-employee scope — bus-factor risk on operational recovery | 4 | 2 | **8** | Transfer (document runbook so successor can execute) | Jeff Coy | In Progress | 4 (after G-18, OPS_RUNBOOK expansion) | G-18 | 2026-04-24 |
| **R-032** | No DLP — no automated detection of sensitive data exfiltration via exports | 3 | 2 | **6** | Accept (current scope) | Jeff Coy | Accepted | 6 | G-30 | 2026-04-24 |
| **R-033** | No security awareness training record for Jeff | 2 | 2 | **4** | Transfer (HR process) | JD Gershan | Open | — | G-35 | 2026-04-24 |
| **R-034** | EBS encryption status not verified in deploy pipeline | 3 | 1 | **3** | Mitigate (script exists, needs wiring) | Jeff Coy | Open | — | G-12 | 2026-04-24 |
| **R-035** | No documented DR plan with RTO/RPO — recovery is ad hoc | 4 | 2 | **8** | Mitigate | Jeff Coy | Open | — | G-31 | 2026-04-24 |
| **R-036** | Patching SLA undocumented; Dependabot not enabled | 3 | 3 | **9** | Mitigate | Jeff Coy | Open | — | G-15 | 2026-04-24 |
| **R-037** | No file integrity monitoring on production host | 3 | 1 | **3** | Accept | Jeff Coy | Accepted | 3 | G-28 | 2026-04-24 |
| **R-038** | No CIS Benchmark applied to host — baseline hardening unverified | 3 | 2 | **6** | Mitigate | Jeff Coy | Open | — | G-14 | 2026-04-24 |
| **R-039** | SSH sessions have no idle timeout | 2 | 2 | **4** | Mitigate (folded into G-14) | Jeff Coy | Open | — | G-17 | 2026-04-24 |
| **R-040** | Prompt injection against Claude system prompt — flagged by red-team as low but not zero | 3 | 3 | **9** | Mitigate (input sanitization already partial) | Jeff Coy | Monitoring | 6 | Red-team H-4 | 2026-04-24 |

---

## Risk heat map (at-a-glance)

```
Impact →    1          2          3          4          5
Likelihood ↓
    5       |          |          |          |          |          |
    4       |          |          |          | R-001    |          |
            |          |          |          |          |          |
    3       |          | R-009    | R-013    | R-002    | R-023    |
            |          | R-029    | R-022    | R-004    |          |
            |          | R-040    | R-014    | R-020    |          |
            |          |          | R-024    | R-036    |          |
    2       |          | R-010    | R-028    | R-005    | R-003    |
            |          | R-025    | R-038    | R-008    | R-012    |
            |          | R-026    | R-015    | R-011    |          |
            |          | R-033    | R-032    | R-016    |          |
            |          | R-039    |          | R-017    |          |
            |          |          |          | R-027(0) |          |
            |          |          |          | R-021    |          |
            |          |          |          | R-031    |          |
            |          |          |          | R-035    |          |
            |          |          |          | R-037    |          |
    1       |          |          | R-019    | R-018    | R-030    |
            |          |          | R-034    |          |          |
```

**Top-left quadrant is safer; bottom-right is more dangerous.**
**R-030 (Phase 3 elevation) is the highest-rated open risk at likelihood × impact = 20.** All tier-1 gaps are precursors to lowering that rating.

---

## Closed / superseded risks

| Risk ID | Description | Closure date | Closure rationale |
|---|---|---|---|
| R-006 | No Asset Register | 2026-04-24 | Created `docs/ASSET_REGISTER.md` with 52 asset entries and a quarterly review process. |
| R-027 | Backup retention 14 days vs. policy 30-day minimum | 2026-04-24 | `KEEP_DAYS=30` shipped in `scripts/backup-db.sh:29` as part of G-13 delivery. Effective on EC2 after next `./deploy.sh`. |

---

## Review procedure

Per USZoom Policy 3716 Risk Management:

1. **Quarterly** — full walk of all open and accepted risks. Re-score impact and likelihood. Update residual rating. Move closed/superseded items into the archive table.
2. **On material change** — any of:
   - New asset added at CC classification.
   - Security incident (any severity).
   - Vendor contract change affecting data handling.
   - New regulatory obligation.
   - Red-team / pentest / audit finding.
3. **On closure of a linked gap** — the gap author updates the risk row (residual rating, status → Closed) with commit-linked evidence.
4. **Annual** — the ISMS Governance Council reviews the register as an input to Management Review (per Policy 3711).

### Accepted-risk re-evaluation triggers

Risks in status `Accepted` are re-evaluated automatically when any of these events occur:

- Headcount grows past 5 engineers (re-examine R-010, R-026).
- InsightHub enters SOC 2 scope (re-examine all accepted risks).
- Data classification elevates to Customer Confidential anywhere (re-examine R-019, R-032, R-037).
- Annual renewal regardless — accepted risks older than 12 months must be re-justified.

---

## Integration with the gap list

Every risk row's `Linked gap` column points to a gap in `docs/COMPLIANCE_GAPS.md`. Each gap has an Asana subtask under parent `1214267948143167`. Closing an Asana subtask should:

1. Move the risk to `Monitoring` status (not `Closed` immediately — observe for one review cycle).
2. Re-score residual rating.
3. Commit an update to this register.
4. Reference the closing commit SHA in the risk row's Last-reviewed column.

---

## Review history

| Date | Reviewer | Summary of changes |
|---|---|---|
| 2026-04-24 | Jeff Coy | Initial register created. 40 open/accepted risks seeded from `docs/COMPLIANCE_GAPS.md`, red-team report findings, and red-team H-4 (prompt injection). R-006 closed on creation via `docs/ASSET_REGISTER.md` delivery. |
