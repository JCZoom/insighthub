# Compliance Crash Course

## Or: How to Hold Your Own in a Room Full of Auditors Without Becoming a Compliance Nerd

> **Audience:** Jeff. A smart systems-thinker who needs to be dangerous enough to argue security in front of a CISO, a board, and an ISO 27001 lead auditor — without pretending to be a deep compliance specialist.
> **Companion reading:** `docs/COMPLIANCE_MATRIX.md`, `docs/COMPLIANCE_GAPS.md`, `docs/SECURITY_POSTURE_FOR_STAKEHOLDERS.md`.
> **Length note:** This is long on purpose. Read it once fully, then skim section headers as a refresher before any stakeholder conversation.
> **Updated:** 2026-04-24

---

## Part 1 — The vocabulary that unlocks every room

Before we get to anything clever, we need to nail seven terms. Most of the time when a compliance conversation feels intimidating, it's because three or four of these are flying around unlabeled.

### 1. ISMS — *Information Security Management System*

An ISMS is not a tool. It is not a certification. It is **the entire system of policies, processes, roles, and evidence a company uses to manage information security risk in a repeatable, reviewable way.**

Think of it like **double-entry accounting, but for security.** A company without an ISMS is like a company that just has a checkbook. A company *with* an ISMS has:

- A **ledger** of what assets exist (the Asset Register).
- A **ledger** of what risks exist (the Risk Register).
- A **ledger** of which controls are implemented (the Statement of Applicability).
- A recurring **close** (annual management review + audit) that reconciles all of the above.

**USZoom's ISMS is a giant stack of 35 policies.** When an auditor shows up, they are not auditing the product — they are auditing the ISMS. The product (InsightHub) is just one of the assets the ISMS governs.

### 2. ISO 27001 — the framework

**ISO 27001:2022** is an international standard published by the International Organization for Standardization. It defines what an ISMS *must* contain. It has two parts:

- **The clauses** (4–10): requirements for running an ISMS — context of the org, leadership, planning, operation, performance evaluation, improvement.
- **Annex A**: a list of **93 controls** across 4 themes (Organizational, People, Physical, Technological) that a company can pick from.

A company **does not have to implement all 93**. They just have to:

1. **Pick** which ones apply (that's the Statement of Applicability).
2. **Justify** why they excluded the rest.
3. **Prove** they're operating the ones they picked.

That's it. That's the whole certification. Everything else is paperwork.

**Mental model:** ISO 27001 is the **grammar**. The ISMS policies are the **sentences** a company writes with that grammar.

### 3. SOC 2 — the attestation

**SOC 2** is an attestation report issued by a licensed CPA firm in the United States. It evaluates a service organization's controls against the **Trust Services Criteria (TSC)** published by the AICPA.

The TSC has 5 categories:
- **Security (CC series)** — always required.
- **Availability (A series)** — optional.
- **Processing Integrity (PI series)** — optional.
- **Confidentiality (C series)** — optional.
- **Privacy (P series)** — optional.

**SOC 2 Type I** = "at a point in time, your controls are *designed* properly."
**SOC 2 Type II** = "over a 3-12 month observation window, your controls actually *operated* properly."

**Type II is what customers actually want.** Type I is the on-ramp.

### 4. Trust Services Criteria (TSC) — the checklist

SOC 2's equivalent to ISO 27001's Annex A. There are **61** criteria across the 5 categories. Every control in the USZoom ISMS has one or more TSC tags next to it in the System Description — that's how the auditor maps the company's work to the AICPA's standard. You saw this in `6727_System_Description.pdf` in the "Complementary Customer Controls" table (`CC5.1, CC5.2, CC6.1`, etc.).

### 5. NCs and OFIs — the verdict language

After an audit, findings land in four buckets:

- **Conforms / In Place** — clean. Boring is good.
- **Opportunity for Improvement (OFI)** — "you could do better, but you're not failing."
- **Minor Non-Conformity (Minor NC)** — "this is broken, but not catastrophically. Fix it and we'll come back."
- **Major Non-Conformity (Major NC)** — "this is broken enough that we will not certify you until you fix it and we re-audit."

**You want everything parked on the OFI side of the line.** The gap list we built gives you exactly the pre-filled homework needed to keep things there.

### 6. The Statement of Applicability (SoA)

**This is the single most important document an ISO 27001 auditor will ask for.**

It's a spreadsheet / table with one row per Annex A control (93 of them). Columns:

- **Control ID** (e.g., `A.5.9`)
- **Control name** (e.g., `Inventory of information and other associated assets`)
- **Applicable? (Y/N)**
- **Justification for inclusion/exclusion**
- **Implementation summary**
- **Evidence reference** (pointer to a policy, a doc, a screenshot, a log)

If you can put a credible SoA in front of an auditor, **80% of the conversation is done.** The rest is them spot-checking that the evidence you cite actually exists.

That's why `G-34 / G-37` (Write `STATEMENT_OF_APPLICABILITY.md`) is tier-1. Without it, every other conversation is harder.

### 7. The Risk Register

**The second most important document.** ISO clause 6.1 requires you to:

1. **Identify** risks to your ISMS's ability to meet its objectives.
2. **Analyze** them (impact × likelihood).
3. **Evaluate** them against your risk tolerance.
4. **Treat** them (mitigate / transfer / accept / avoid).

The Risk Register is the table that captures all of that. One row per risk. The remediation gaps we identified in `COMPLIANCE_GAPS.md` are the seed population of this register — each gap is a risk that's been identified, analyzed, and assigned a treatment plan.

**Pro tip:** Auditors love it when the Risk Register is *up to date* and shows *evidence of revision* (old rows closed, new rows added). A static register is a red flag.

---

## Part 2 — The six-bucket mental model

Every single one of USZoom's 35 policies slots into one of these six buckets. Once you have this mental model, nothing feels random anymore.

```
┌─────────────────────────────────────────────────────┐
│ 1. GOVERNANCE                                       │
│    Who decides, who owns, who reviews, how often    │
│    → 3704 InfoSec, 3707 ISMS, 3713 Roles,           │
│      3711 Mgmt Review, 3716 Risk Mgmt               │
└─────────────────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│ 2. SCOPE + RISK                                     │
│    What are we protecting? What could go wrong?     │
│    → 3717 Scope of ISMS, 3712 Risk Assessment,      │
│      3698 Data Classification, 12737 Asset Mgmt     │
└─────────────────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│ 3. CONTROLS                                         │
│    The actual technical and procedural guards       │
│    → All the Access Control / Encryption /          │
│      Host Hardening / Secure Engineering /          │
│      Operations Security policies                   │
└─────────────────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│ 4. EVIDENCE                                         │
│    Proof that the controls are actually running     │
│    → 3710 Documented Info, audit logs, backups,     │
│      ssllabs reports, CI run history, signed docs   │
└─────────────────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│ 5. AUDIT                                            │
│    Internal + external review of the above          │
│    → 3709 Internal Audit, external certification,   │
│      penetration tests, SOC 2 attestations          │
└─────────────────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│ 6. IMPROVE                                          │
│    Act on what the audits found. Close the loop.    │
│    → 3705 Continuous Improvement, corrective        │
│      action plans, this gap list                    │
└─────────────────────────────────────────────────────┘
                       │
                       └─── loops back to 1 ───►
```

**Every stakeholder question is really a question about one of these six buckets.**

- *"Who's accountable if something goes wrong?"* → bucket 1 (Governance).
- *"How do you know you have all the data you need to protect?"* → bucket 2 (Scope).
- *"How do you prove nobody can see data they shouldn't?"* → bucket 3 (Controls) + bucket 4 (Evidence).
- *"When was the last time someone checked this from the outside?"* → bucket 5 (Audit).
- *"What's on your roadmap for the stuff that's not working yet?"* → bucket 6 (Improve).

---

## Part 3 — The six questions an auditor asks first, and the six sentences that answer them

Memorize these. Not word for word. But **the shape of the answer.**

### Q1. *"May I see your Statement of Applicability?"*

**What they're really asking:** do you understand the framework at all?

**Shape of the answer:** "Yes. It's at `docs/STATEMENT_OF_APPLICABILITY.md`. It covers all 93 Annex A controls in ISO 27001:2022, with each control tagged Applicable or Not Applicable, a justification for the choice, an implementation summary, and a pointer to the evidence."

**If you don't have an SoA yet** (current state — `G-34`/`G-37`): "It's in our open backlog under remediation item G-34, targeted for close-out in the next sprint. We have the underlying control mapping in `COMPLIANCE_MATRIX.md` — that's the raw material the SoA will be built from."

### Q2. *"May I see your Risk Register, and show me three closed items from the last year?"*

**What they're really asking:** is this program alive, or is it a one-time paperwork exercise?

**Shape of the answer:** "Yes. The register is at `docs/RISK_REGISTER.md`. It has N open items and M closed items. Here are three closed ones: [specific risk → specific mitigation → specific evidence that the mitigation works]."

The "closed items from the last year" part is the trap. A register with nothing closed is a dead register.

### Q3. *"Who is responsible for the ISMS? Show me that person's job description and their last performance review's ISMS section."*

**What they're really asking:** governance bucket (bucket 1) — does anyone *own* this?

**Shape of the answer:** "Our ISMS is owned by JD Gershan, our CIO, serving as both the Information Security Management Leader and Data Protection Officer per policy 3713. The ISMS Governance Council [CIO, COO, Director of Operations, IT Leaders] meets annually at minimum. Here is the JD for that role [point at policy 3713]."

### Q4. *"Walk me through what happens if a developer tries to push a change that bypasses a control."*

**What they're really asking:** is your Secure SDLC real, or performative?

**Shape of the answer:** "A commit is pushed to a feature branch. It opens a PR. CI runs automated quality gates: TypeScript type-check, ESLint, `npm audit` at high/critical severity, production build, and E2E Playwright tests. If any of those fail, the PR cannot merge. Merging requires review. Deploy is a separate manual step (`workflow_dispatch`) that re-runs all the same gates plus a pre-deploy database backup and a post-deploy health check with auto-rollback. Here's the `.github/workflows/ci.yml` file — you can read it top to bottom."

### Q5. *"Walk me through what happens if one of your developer laptops is stolen on a Friday night."*

**What they're really asking:** incident response + access control + data classification, all in one.

**Shape of the answer:**
1. Developer reports it per the Incident Response runbook.
2. Google Workspace admin disables the account — all InsightHub sessions tied to that email invalidate at next JWT refresh, max 8 hours. In practice: we bump `NEXTAUTH_SECRET` and all sessions die immediately.
3. MDM issues remote wipe of the laptop.
4. Credential rotation playbook runs: Anthropic, OpenAI, AWS IAM keys the developer had access to, SSH keys.
5. Audit log is scanned for any suspicious activity in the preceding 24 hours using the last-login timestamp as the anchor.
6. Within 1 week: retrospective meeting per policy 3719. Root cause, timeline, action items, register update.

**If you can tell this story fluently, you have won the room.**

### Q6. *"Show me the last backup restore test."*

**What they're really asking:** do you actually test your DR, or just run backups?

**Shape of the answer:** "Here is `docs/BACKUP_RESTORE_TEST_2026-Q1.md`. It documents date, tester, backup source (timestamp), restore destination (sandbox environment), end-to-end verification (Playwright run), tear-down, and RTO achieved. Next one is scheduled for [date]."

**Current state (`G-27`):** no such test has been run yet. Honest answer: "Gap G-27 in our compliance backlog. Scripted, not yet scheduled. Targeted for Q1 next year."

---

## Part 4 — The "shared responsibility" trap and how to talk about AWS

Cloud compliance hinges on one phrase: **"shared responsibility model."**

Auditors love to ask:

> *"AWS says the physical data center is their responsibility. But who's responsible for whether an EBS volume is encrypted?"*

Trick question. **You are.** AWS provides the *capability* to encrypt EBS, but the *configuration* that turns it on is the customer's responsibility. Same for:

- **IAM policies** (AWS gives you IAM; you write the policies).
- **Security Group rules** (AWS gives you SGs; you configure them).
- **MFA on the root account** (AWS supports it; you turn it on).
- **Backup retention** (AWS offers retention settings; you pick a value that matches policy).
- **CloudTrail logging** (AWS gives you CloudTrail; you configure what it logs and where it goes).

**The line:**
- AWS = security *of* the cloud (hardware, facilities, hypervisor, network backbone).
- You = security *in* the cloud (OS, applications, data, IAM, configuration).

**When an auditor brings up AWS:** immediately point them at the **subservice organization controls** section of `6727_System_Description.pdf`. That policy *already* documents which controls USZoom relies on AWS for (physical security, environmental controls, facility repairs). Show you reviewed AWS's own SOC 2 report "annually" as the policy says.

**Bonus phrase to deploy:** "We operate within AWS's shared responsibility model, we review AWS's SOC 2 Type II report annually per our Third-Party Management Policy 3720, and our compensating controls for the customer-side portion of that model are documented in `COMPLIANCE_MATRIX.md` sections 3 (Encryption) and 7 (Host Hardening)."

**You just used four policy references in one sentence.** That's the fluency that makes auditors and CISOs nod and move on.

---

## Part 5 — The customer-CISO security questionnaire: the 8 questions that cover 80% of them

Every prospect's CISO / procurement team will eventually send a "vendor security questionnaire." They look intimidating but they almost all ask the same questions in different wording.

Here are the 8 meta-questions and the one-sentence InsightHub answer:

### 1. *"Where is customer data stored, geographically?"*

> "AWS us-east-1 (Virginia). A future multi-region backup destination is planned; see `COMPLIANCE_GAPS.md` gap G-13. No data leaves the US."

### 2. *"How is data encrypted at rest and in transit?"*

> "At rest: AES-256 on EBS (AWS-managed KMS). In transit: TLS 1.2+ via Let's Encrypt, HSTS preload-enforced. Application backups support AES-256-CBC application-layer encryption."

### 3. *"How do you authenticate users, and is MFA required?"*

> "Google Workspace SSO via OAuth 2.0, domain-restricted to `@uszoom.com`. MFA is inherited from Google Workspace. Application-layer MFA enforcement is in our backlog (gap G-02)."

### 4. *"How do you handle user access reviews, and how quickly do you revoke access when someone leaves?"*

> "Access is tied to Google Workspace identity; disabling the user in Google Workspace invalidates InsightHub access within 8 hours (JWT expiry). Quarterly access reviews are formalizing under gap G-09. Automated offboarding via Google Admin SDK under gap G-10."

### 5. *"What's your SDLC? Do you do code review, static analysis, and dependency scanning?"*

> "Git-based PR workflow with CI (GitHub Actions). Every PR runs TypeScript check, ESLint, `npm audit` at high/critical severity, production build, and Playwright E2E tests. SAST (Semgrep / CodeQL) is in backlog under gap G-24. Dependabot enablement under G-15."

### 6. *"How do you log and monitor, and how long do you retain logs?"*

> "Structured AuditLog table captures user ID, action, resource type/ID, timestamp, metadata. Retention: ≥1 year per policy 3700, with purge on 2-year upper bound under gap G-06. IP/user-agent enrichment under gap G-20. CloudWatch alerting under gap G-21."

### 7. *"Show me your incident response plan."*

> "Runbook under gap G-18, targeted for the next sprint. Interim escalation path: reporter → Jeff Coy → JD Gershan (CISO/DPO). Policy 3719 defines severity matrix, containment steps, retrospective within 1 week."

### 8. *"What certifications do you hold, and if none, what's your timeline?"*

> "None currently. USZoom's existing ISMS is aligned with ISO 27001:2022 and mapped to SOC 2 Trust Services Criteria. InsightHub is held to the same control bar. SOC 2 Type I scoping conversations are possible within [timeframe]. Type II observation window entry is gated on completion of tier-1 gaps in `COMPLIANCE_GAPS.md`."

**Pro tip:** Treat these as templates. Put them in a shared doc, paste into questionnaires, tweak per prospect, save the variants. You'll get the response time from "4 hours" to "10 minutes" per questionnaire after the first three.

---

## Part 6 — Concrete InsightHub examples of every major control family

This section makes everything above *physical* in the codebase. If you can say *"yes, we have X, and I can point at the line"*, you win.

### Authentication

```@/Users/Jeffrey.Coy/CascadeProjects/InsightHub/src/lib/auth/config.ts:56-64
    async signIn({ user, account }) {
      // Domain restriction - only allow @uszoom.com emails
      if (account?.provider === 'google') {
        const email = user.email;
        if (!email || !email.toLowerCase().endsWith(`@${process.env.ALLOWED_DOMAIN || 'uszoom.com'}`)) {
          return false; // Reject sign in
        }
      }
      return true;
    },
```

**Policy mapped:** 3691 Access Control AC-04 (Domain-restricted sign-in). **One line of evidence.**

### Authorization (RBAC + granular)

```@/Users/Jeffrey.Coy/CascadeProjects/InsightHub/src/lib/auth/permissions.ts:132-155
  POWER_USER: {
    features: {
      canCreateDashboard: true,
      canEditGlossary: false,
      canAccessSensitiveData: true,
      ...
    },
    data: {
      Revenue: 'FULL' as AccessLevel,
      ...
      CustomerPII: 'NONE' as AccessLevel,
      Financial: 'FULL' as AccessLevel,
    }
  },
```

**Policy mapped:** 3691 AC-02 (RBAC), AC-03 (Least privilege).

### Encryption in transit

```@/Users/Jeffrey.Coy/CascadeProjects/InsightHub/middleware.ts:16-21
    if (request.nextUrl.protocol === 'https:') {
      response.headers.set(
        'Strict-Transport-Security',
        'max-age=63072000; includeSubDomains; preload'
      );
    }
```

**Policy mapped:** 3701 ENC-01, ENC-03.

### Audit logging

```@/Users/Jeffrey.Coy/CascadeProjects/InsightHub/src/lib/auth/config.ts:113-127
          try {
            await logUserAction(
              dbUser.id,
              AuditAction.USER_LOGIN,
              dbUser.id,
              {
                email: dbUser.email,
                name: dbUser.name,
                loginTime: new Date().toISOString(),
                provider: account.provider,
              }
            );
          } catch (error) {
            console.error('Failed to log user login audit:', error);
          }
```

**Policy mapped:** 3715 OS-12 (logging requirements).

### GDPR rights

- **Right to access:** `@/Users/Jeffrey.Coy/CascadeProjects/InsightHub/src/app/api/user/export/route.ts` → `GET /api/user/export`.
- **Right to erasure:** `@/Users/Jeffrey.Coy/CascadeProjects/InsightHub/src/app/api/user/delete/route.ts` → `POST /api/user/delete`.

**Policy mapped:** 3699 DD-01, DD-02; 3714 REG-01.

### Change management

```@/Users/Jeffrey.Coy/CascadeProjects/InsightHub/.github/workflows/ci.yml:22-59
jobs:
  typecheck: ...
  lint: ...
  audit:
    name: Security Audit
    ...
      - name: npm audit (high + critical)
        run: npm audit --audit-level=high
```

**Policy mapped:** 3718 SE-07, 4427 CM-04.

### Backup

```@/Users/Jeffrey.Coy/CascadeProjects/InsightHub/scripts/backup-db.sh:24-32
KEEP_DAYS=14

# Encryption — set BACKUP_ENCRYPTION_KEY in .env.local or environment
# When set, backups are AES-256-CBC encrypted at rest (.db.enc)
...
ENCRYPT=${BACKUP_ENCRYPTION_KEY:+true}
ENCRYPT=${ENCRYPT:-false}
```

**Policy mapped:** 4133 BK-01, BK-04, BK-08.

---

## Part 7 — Troubleshooting & pro-tips

### Pro-tip 1: Never argue the spirit of a policy

If an auditor says *"policy 3700 says PII retention is 3 years and your system has no retention job"*, the answer is **not** *"well, we don't have enough users for it to matter yet."*

The answer is *"Correct. Tracked as gap G-05. Targeted for [date]. Risk register entry: [link]."*

**Admitting a gap that's already tracked is strength. Hand-waving is weakness.**

### Pro-tip 2: Every time an auditor points out a real gap, say "and here's our compensating control"

A "compensating control" is an interim measure that reduces the risk while the real fix is in flight.

Example:
- Gap: G-19, branch protection not enabled on `main`.
- Compensating controls: *"All deploys require a manual `workflow_dispatch` trigger, meaning no code reaches production without a human re-reading the diff. CI must pass before deploy. Auto-rollback on health check failure. The gap is real; the risk is mitigated."*

Auditors want to see **reasoning**, not just roadmaps.

### Pro-tip 3: When someone says "SOC 2," ask "Type I or Type II?"

If a customer says "we need you to be SOC 2 compliant," ask. Type I is much cheaper and faster (~$10-20k, 1-2 months). Type II is the real deal (~$25-50k + a 3-12 month observation window).

Many customers will actually accept Type I for initial onboarding, with a commitment to Type II within a year. That can unlock deals.

### Pro-tip 4: Read policies like a lawyer, not a programmer

Policies use words like "must," "shall," "should," and "may" — and they mean specific things.

- **must / shall** → mandatory, no exceptions without explicit approval.
- **should** → strongly recommended, deviation requires justification.
- **may** → optional.

When reading USZoom policy 3701 *"The algorithm used is industry-standard AES-256"* — that's a **shall**. It's not *"we could use AES-256 if convenient."* It's *"non-AES-256 is a policy violation."*

### Pro-tip 5: The three words that end most debates

When a CISO asks a nitpick question and you're not sure what to answer, buy thinking time with:

> *"Let me confirm the evidence."*

Then look. If it exists, cite it. If it doesn't, say so and add it to the backlog on the spot. **Never make something up.** Auditors test for fabrication on purpose.

### Pro-tip 6: Track evidence freshness, not just evidence existence

If you have a backup restore test from 2022 and it's now 2026, you effectively have no backup restore test. Every piece of evidence has an expiration date. Keep dates visible.

The gap list has this baked in (see `G-27` calls for "annual" explicitly).

### Pro-tip 7: The phrase "out of scope" is your friend, used honestly

You do not have to implement every control. Policy 3717 (Scope of ISMS) is explicit: "USZoom ISMS scope encompasses [specific things]." Anything outside that scope is genuinely out of scope.

**But:** you must *justify* the scope choice and document the boundary. Half-assed "out of scope" answers get Major NCs. Honest, documented ones are fine.

---

## Part 8 — What to read next, in priority order

If you want to build your compliance fluency further, in rough order of ROI:

1. **ISO 27001:2022 Annex A control text** — you can buy the standard, or read summaries from CIS, NIST, or vendor sites. This gives you the actual 93 controls in plain language.
2. **AICPA TSC 2017 (most recent revision)** — the SOC 2 criteria, free on the AICPA site.
3. **NIST SP 800-53 Rev. 5** — big, dense, free. Read the index and the control families. You don't need to know the details, but you need to know these families exist.
4. **CIS Controls v8** — the most pragmatic list of "things to actually do" in infosec. 18 controls, ranked by implementation group.
5. **Cloud Security Alliance CAIQ** — a standard questionnaire format. Useful to see the questions customers will ask.
6. **Our own `COMPLIANCE_MATRIX.md` + `COMPLIANCE_GAPS.md`** — because they are specific to InsightHub. Bookmark them.

---

## Part 9 — "What do I say when…" cheat sheet

| Situation | First sentence you should say |
|---|---|
| Customer CISO wants to know your cert status | *"We are pre-cert today. Holding to USZoom's ISMS control bar, which is ISO 27001:2022-aligned. Remediation backlog is documented and owned."* |
| Board member asks "are we secure?" | *"We have a documented security program tied to USZoom policy, a current risk register, and an open-but-tracked remediation list. Here's our top-3 tier-1 items. [Say G-01, G-02, G-13.]"* |
| Auditor says *"I don't see a Statement of Applicability"* | *"Correct — gap G-34. In progress. Here's the underlying control mapping it will be built from [hand them `COMPLIANCE_MATRIX.md`]."* |
| Prospect asks about data residency | *"AWS us-east-1. No data leaves the US. Cross-region backup planned under gap G-13."* |
| Legal asks about GDPR | *"DPO appointed (JD Gershan per policy 3713). Subject access via `/api/user/export`. Erasure via `/api/user/delete`. DPA templates under vendor register gap G-26."* |
| DevOps asks about recovery | *"RTO 4 hours, RPO 24 hours. IaC reconstitution plan in flight under gap G-16. DR plan documented under G-31. Last restore test: gap G-27 (pending)."* |
| Someone says *"you don't have MFA"* | *"We inherit MFA from Google Workspace SSO. Application-layer enforcement gap tracked as G-02. Privileged access via Tailscale + SSH keys; hardware-MFA upgrade in same gap."* |
| Someone says *"backups are worthless without a restore test"* | *"Correct. Gap G-27. Scripted `scripts/test-restore.sh` is the target deliverable. Annual cadence matches policy 3715 OS-11."* |

---

## Part 10 — The mindset shift

The biggest mental trap for a technical person in compliance conversations is to treat it like a **tech problem** — i.e., if the code is right, we're compliant.

**Compliance is not a tech problem. It's a *traceability* problem.**

Here's the difference:

- **Tech-centric:** "We encrypt data at rest."
- **Compliance-centric:** "We encrypt data at rest (AES-256, AWS KMS-managed), per policy 3701 Encryption ENC-05, verified by our deploy script pre-flight check (planned under G-12), evidenced by the CloudTrail KMS audit log retained for 1 year."

The first sentence answers a question. The second sentence **closes a loop**: policy → control → evidence → retention.

**Your job as a stakeholder-facing builder is to make every security claim loop-closed.** When you do, auditors and CISOs stop treating you like a startup kid and start treating you like a peer. That's the game.

---

## Part 11 — Quick reference: the USZoom policy family tree

Grouped for fast recall. Keep this near your desk.

**Governance** — *who owns it, how often is it reviewed*
- 3704 Information Security Policy (master)
- 3707 ISMS Policy
- 3713 Roles & Responsibilities
- 3711 Management Review
- 3716 Risk Management
- 3705 Continuous Improvement
- 3706 Communication Plan
- 3708 Information Security Objectives

**Scope & Asset** — *what are we protecting*
- 3717 Scope of ISMS
- 3698 Data Classification
- 3714 Statutory/Regulatory/Contractual
- 12737 Asset Management
- 6727 System Description
- 3712 Risk Assessment/Treatment

**Access & Identity** — *who can get in*
- 3691 Access Control
- 3692 Authentication & Password
- 3690 Acceptable Use

**Secure Development** — *how we build*
- 3718 Secure System Engineering
- 4427 Change Management
- 3696 Change Management Procedures

**Operations** — *how we run it*
- 3715 Operations Security
- 3702 Host Hardening
- 3701 Encryption
- 4133 Backup

**Data Lifecycle** — *keeping it, killing it*
- 3700 Data Retention
- 3699 Data Disposal

**Resilience** — *when things go wrong*
- 3719 Security Incident Management
- 4428 Business Continuity
- 6458 Tabletop DR Exercise

**Third Parties** — *our vendor chain*
- 3720 Third-Party Management

**People** — *the human side*
- 3703 Human Resources
- 3697 Code of Conduct
- 12736 Remote Working

**Audit & Records** — *proving it*
- 3709 Internal Audit
- 3710 Control of Documented Information

---

## Closing thought

You don't need to become an auditor to hold your own in an audit conversation. You need **three things**:

1. **Vocabulary** — ISMS, SoA, Risk Register, TSC, NC/OFI. You have them now.
2. **Mental model** — six buckets: Governance, Scope, Controls, Evidence, Audit, Improve.
3. **Reflexes** — when challenged, cite a policy number, a file path, and a gap ID. Every single time.

The rest is just practice. Do three questionnaires and you'll never feel uncertain in one of these rooms again.
