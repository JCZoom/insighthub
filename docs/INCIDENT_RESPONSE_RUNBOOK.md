# InsightHub — Incident Response Runbook

> **Policy reference:** USZoom Policy 3719 Security Incident Management; Policy 6458 Tabletop DR Exercise.
> **Gap closed:** G-18 (from `docs/COMPLIANCE_GAPS.md`).
> **Runbook owner:** Jeff Coy (first responder) / JD Gershan (escalation & decision authority).
> **Review cadence:** Annual + after every declared incident.
> **Last reviewed:** 2026-04-24
> **Next review due:** 2027-04-24 (earlier if an incident is declared).

---

## 1. Scope

This runbook covers security incidents affecting InsightHub — the web application at `https://dashboards.jeffcoy.net`, its supporting infrastructure (EC2 instance `autoqa`, backups, secrets), its source repository, and any USZoom data processed by InsightHub.

For non-security operational issues (plain outage with no indication of compromise), see `@/Users/Jeffrey.Coy/CascadeProjects/InsightHub/docs/OPS_RUNBOOK.md`.

## 2. Mindset

**When in doubt, declare.** It is much cheaper to declare an incident and close it in an hour than to delay response on something that turns out to be real. Policy 3719 explicitly prefers over-reporting.

**Preserve evidence before you fix.** Do not immediately blow away the compromised system if you can help it. A snapshot of EBS, a copy of logs, and a DB backup taken *before* remediation are invaluable to the retrospective.

**Communicate early and often.** Even a one-line status update every 30 minutes is better than silence.

## 3. Roles

| Role | Name | Responsibility |
|---|---|---|
| **Incident Commander (IC)** | Jeff Coy | Coordinates response, makes go/no-go calls, owns communications. |
| **Technical Responder** | Jeff Coy | Executes containment, recovery, and eradication steps. |
| **Decision Authority** | JD Gershan (CIO/CISO/DPO, per Policy 3713) | Approves customer / regulator notifications. Signs off on closure. |
| **Compliance Advisor** | Avi Katz (Director of Compliance) | Reviews regulatory reporting requirements (GDPR 72-hour window, state breach laws). |
| **Security Manager** | Lior Zamir | Advises on forensics and evidence collection. |

Until headcount grows, Jeff Coy holds both IC and Technical Responder roles. If an incident exceeds ~4 hours or requires customer notification, IC hands off to JD Gershan.

## 4. Severity matrix

Per USZoom Policy 3719.

### S1 — CRITICAL (declare within 15 minutes of detection)

**Definition:** Active or strongly suspected breach of confidentiality, integrity, or availability with potential for customer data exposure, regulated data exposure, or multi-system compromise.

**Examples for InsightHub:**
- Anthropic / OpenAI / Google OAuth key posted publicly.
- SQL injection or auth bypass with evidence of exploitation.
- Production database exfiltrated or ransomed.
- Admin account compromise.
- Production host (EC2) rooted.
- Supply-chain compromise of a deployed dependency (e.g., `event-stream`-style backdoor).

**Response:**
- IC declared immediately.
- Status updates every 15 minutes to JD Gershan via email + Slack/phone.
- Retrospective within **1 week** (policy 3719 requirement).
- Customer/regulator notification assessment within 24 hours.
- **GDPR:** if any EU PII is affected, 72-hour breach notification clock starts at detection.

### S2 — HIGH (declare within 1 hour)

**Definition:** Genuine security weakness being actively exploited, or confirmed weakness that is *not* yet exploited but cannot be contained quickly.

**Examples:**
- Confirmed auth bypass with no known exploitation.
- Exposure of UR data (dashboards, glossary) to an unauthorized internal user.
- Malware detected on Jeff's development laptop.
- Targeted credential phishing against a USZoom employee with InsightHub access.
- Denial-of-service attack against production.

**Response:**
- IC declared within 1 hour.
- Status updates every 1 hour.
- Retrospective within **1 week**.

### S3 — MEDIUM (declare same business day)

**Definition:** Real security issue with low exploitation potential or narrow blast radius.

**Examples:**
- Vulnerable dependency published in the ecosystem, not yet exploited against us.
- Non-admin user with unexpected permissions discovered during access review.
- Failed logins spike from a single IP (probable credential stuffing).
- Anomalous AWS CloudTrail activity (if we had alerting — see gap G-21).

**Response:**
- IC declared same business day.
- Retrospective within **2 weeks**.

### S4 — LOW (log + backlog)

**Definition:** Observed concern with no immediate impact.

**Examples:**
- Self-reported anomaly (user says "this feels weird").
- Minor policy violation (shared credential, ignored security guidance).
- npm audit moderate-severity finding.

**Response:**
- Log as a risk in the Risk Register. Address during normal work.

## 5. The six phases

Per USZoom Policy 3719.

### 5.1 DETECT

Incidents surface from:
- Alerts (CloudWatch when G-21 closes; `/api/health` failures; systemd unit failures).
- Audit log anomalies (`/admin/audit` page review).
- User reports (email, Slack, in-person).
- Automated security scans (npm audit in CI, planned Inspector/Config under G-23).
- Third-party notifications (AWS Trust & Safety, GitHub, vendor bulletins).
- External red-team / bug bounty / pentest.

**Anyone** at USZoom can report a suspected incident. Default contact: Jeff Coy → JD Gershan.

### 5.2 DECLARE

1. IC assigns a **severity** and an **incident ID**: `INC-YYYYMMDD-NNN` (e.g., `INC-20260424-001`).
2. IC opens a private channel — an Asana task under a section named "Incidents" (create if missing) OR a GitHub Discussion marked private OR a thread in direct messages with the Decision Authority.
3. First message captures:
   - Severity.
   - Detection source and timestamp.
   - One-sentence description.
   - Immediate containment actions planned.
4. **Clock starts** for regulatory notification windows.

### 5.3 CONTAIN

**Goal:** stop the bleeding without destroying forensic evidence.

Standard containment actions (pick by incident type — see playbooks below).

### 5.4 ERADICATE

**Goal:** remove the root cause. Do not skip to recovery until this is complete, unless the containment itself is sufficient (e.g., credential rotation).

### 5.5 RECOVER

**Goal:** restore normal service.

- Restore from a clean backup if the primary was tampered with.
- Redeploy from a known-good Git SHA.
- Verify recovery with the E2E Playwright suite + `/api/health` + manual smoke tests.
- Monitor for reoccurrence for at least 24 hours.

### 5.6 RETROSPECTIVE

Per policy 3719, a retrospective is mandatory within **1 week for S1/S2, 2 weeks for S3**. Template at the bottom of this document. Outputs:

- Root cause analysis.
- Timeline (detection → declaration → containment → recovery).
- Action items with owners and due dates — added to the Risk Register as new risks, to Asana as tasks.
- Notification decisions (who was told, who wasn't, why).

---

## 6. Containment playbooks

Quick-reference for the most likely incident types.

### 6.1 Credential leak (API key posted in public repo, Slack, etc.)

**Containment:**
1. Rotate the leaked credential at the issuing provider:
   - **Anthropic:** `https://console.anthropic.com` → API Keys → revoke.
   - **OpenAI:** `https://platform.openai.com/api-keys` → revoke.
   - **Google OAuth:** Cloud Console → Credentials → regenerate client secret.
   - **Asana PAT:** Account settings → Developer apps → revoke.
   - **NEXTAUTH_SECRET:** generate new with `openssl rand -base64 64`.
   - **AWS IAM:** `aws iam delete-access-key` + issue new.
2. Update `.env.local` locally and on EC2.
3. Restart systemd service: `sudo systemctl restart insighthub`.
4. Monitor provider dashboards for abuse of the old key over the next 24 hours.
5. Review git history for any other exposed secrets.

**Regulatory:** unlikely to trigger notification unless the key unlocked PII access.

### 6.2 Production host compromise (EC2 rooted / unexpected processes)

**Containment:**
1. **Do not reboot.** Reboot wipes in-memory forensic data.
2. Take an EBS snapshot of the compromised volume immediately: `aws ec2 create-snapshot --volume-id <id> --description "IR evidence INC-..."`.
3. Revoke SSH access from all known authorized keys in `~/.ssh/authorized_keys`.
4. Revoke the instance's IAM role (if any) via the AWS Console.
5. Remove the instance from the Security Group that allows public 443 — effectively taking it offline.
6. Rotate all secrets that existed on the host per playbook 6.1.
7. Stand up a fresh EC2 instance from a known-good Ubuntu AMI + `deploy.sh`.
8. Restore the **most recent pre-compromise backup** — determine this by reviewing the AuditLog for anomalous events.

**Regulatory:** likely GDPR + state breach notification if PII was on the host. Start the 72-hour clock at detection.

### 6.3 Auth bypass / authorization flaw

**Containment:**
1. Identify the specific flaw (which route, which check).
2. Short-term: add a middleware guard that blocks the affected route entirely while a fix is developed.
3. Deploy the block via `./deploy.sh`.
4. Rotate `NEXTAUTH_SECRET` to invalidate all live sessions — forces re-auth through the fixed path.
5. Review the AuditLog for evidence of exploitation. Export the relevant rows before any purge.

**Eradication:**
- Write a regression test that reproduces the bypass.
- Patch the flaw.
- Extend the patch to any similar patterns elsewhere in the codebase.
- Deploy.

### 6.4 Supply-chain compromise (malicious npm package)

**Containment:**
1. Identify the affected package (via GitHub Advisories, Socket.dev, or npm security alert).
2. Check `package-lock.json` and `node_modules` for the affected version.
3. If present: pin to a safe version, run `npm install`, run full test suite.
4. Deploy.
5. If the package had executed in production: treat as 6.2 (host compromise).

### 6.5 Lost or stolen employee laptop

**Containment:**
1. Google Workspace admin disables the account.
2. **Bump `NEXTAUTH_SECRET`** — this forces all sessions to re-auth. Takes <5 minutes and is safer than waiting for the 8-hour JWT TTL.
3. Rotate secrets per playbook 6.1 that the user had any access to.
4. Revoke any SSH keys the user controlled via Tailscale + direct EC2 authorized_keys.
5. MDM issues remote wipe (when MDM is enrolled — currently gap-tracked).

### 6.6 DDoS / availability attack

**Containment:**
1. Nginx rate limiting is already on (10 req/s + burst 20 per IP, `@/Users/Jeffrey.Coy/CascadeProjects/InsightHub/infra/nginx.conf`).
2. If insufficient: put Cloudflare in front (free tier) via DNS change on `dashboards.jeffcoy.net`.
3. If targeted L7: block offending IPs or ASNs at Nginx.
4. Scale EC2 vertically if legitimate traffic surge is mixed in.

### 6.7 Suspected insider misuse of legitimate access

**Containment:**
1. Preserve AuditLog rows for the user.
2. Disable the user in Google Workspace.
3. Bump `NEXTAUTH_SECRET`.
4. Export relevant AuditLog + database deltas as evidence.
5. Escalate to JD Gershan + HR; do not proceed without approval.

### 6.8 Prompt-injection / LLM manipulation (red-team H-4)

**Containment:**
1. Review the affected chat session in `ChatMessage` table.
2. If the injection caused unintended data retrieval: treat as a potential authorization flaw (playbook 6.3).
3. Add the prompt pattern to a deny-list for future sessions.
4. Harden the system prompt (`@/Users/Jeffrey.Coy/CascadeProjects/InsightHub/src/lib/ai/`).

---

## 7. Communications templates

### 7.1 Internal status update (every 15 min for S1, every 1 hr for S2)

```
INC-YYYYMMDD-NNN | SEV: S{1-4} | Status: {Declared / Contained / Eradicated / Recovering / Closed}
T+{mins since detection}: {one-sentence update}
Next update: {HH:MM}
```

### 7.2 External customer notification (approved by Decision Authority)

Draft template — JD Gershan signs and sends:

```
Subject: Security advisory affecting InsightHub

Dear {customer},

On {date}, we detected and contained a security incident that {brief impact
statement}. We are writing to inform you because {reason — data affected /
abundance of caution / regulatory requirement}.

What happened: {1-2 sentences, no speculation, no blame}.
What we've done: {containment + eradication summary}.
What data was affected: {specific types — or "no customer data was affected"}.
What we recommend: {rotate credentials / monitor / no action required}.

We take security extremely seriously. Our Data Protection Officer, JD Gershan,
is available at {contact} for any questions.

Regards,
{Decision Authority signature}
```

### 7.3 Regulator notification (GDPR 72-hour — if EU PII is in scope)

Use the ICO/supervisory-authority online form. Required fields pre-populated from this runbook's incident record. Ensure **Avi Katz (Director of Compliance)** reviews before submission.

---

## 8. Retrospective template

Copy and fill out within the deadline. Save under `docs/incidents/INC-YYYYMMDD-NNN.md`.

```markdown
# Incident INC-YYYYMMDD-NNN — {one-line summary}

**Severity:** S{1-4}
**Detection date/time:** {ISO 8601}
**Declaration date/time:** {ISO 8601}
**Containment date/time:** {ISO 8601}
**Recovery date/time:** {ISO 8601}
**Retrospective date:** {ISO 8601}

## Summary
{2-4 sentences plainly describing what happened.}

## Impact
- Systems affected:
- Data affected (classification):
- Users affected (count + role):
- Regulatory notification required: {Yes / No — with reason}
- Customer notification required: {Yes / No — with reason}

## Timeline

| Time (UTC) | Event | Source |
|---|---|---|
| ... | ... | ... |

## Root cause

{1-3 paragraphs explaining the *technical* and *organizational* causes.}

## What went well

- ...

## What didn't go well

- ...

## Action items

| Action | Owner | Due date | Risk register ID |
|---|---|---|---|
| ... | ... | ... | R-NNN |

## Lessons learned / policy updates

{Bullet list of anything that changes going forward — runbook edits, policy edits, control changes.}
```

---

## 9. Annual tabletop exercise (policy 6458)

Per USZoom Policy 6458, we run one tabletop per year. The policy explicitly names three scenarios:

1. **DDoS attack on production** — walk through playbook 6.6.
2. **Data sabotage** (insider or outsider tampering with database) — walk through playbooks 6.2 + 6.7.
3. **Erroneous production push** — walk through rollback + incident declaration for an availability incident.

### 9.1 Format

- 90 minutes scheduled on the calendar.
- One facilitator (Jeff or JD Gershan).
- Scenario read aloud.
- Participants walk through each phase (Detect → Declare → Contain → Eradicate → Recover → Retrospective).
- Facilitator injects twists ("oh, and the backup from last night is corrupted").
- End with an after-action report using the retrospective template.

### 9.2 Evidence

File the after-action report as `docs/tabletops/TABLETOP-YYYY-Q{1-4}.md`. This is **primary audit evidence** of our resilience program.

### 9.3 Schedule

| Year | Scenario | Target date | Status |
|---|---|---|---|
| 2026 | Data sabotage | Q4 2026 | Scheduled |
| 2027 | DDoS | Q3 2027 | Planned |
| 2028 | Erroneous production push | Q2 2028 | Planned |

---

## 10. Quick contacts

| Role | Name | Contact |
|---|---|---|
| CISO / DPO / Decision Authority | JD Gershan | email per Policy 3713 directory |
| Security Manager | Lior Zamir | same |
| Director of Compliance | Avi Katz | same |
| InsightHub IC | Jeff Coy | same |
| AWS root account contact | USZoom IT | — |
| Google Workspace admin | USZoom IT | — |

---

## 11. Review history

| Date | Reviewer | Summary |
|---|---|---|
| 2026-04-24 | Jeff Coy | Initial runbook created as part of the USZoom ISMS compliance pass (gap G-18 closure). Severity matrix, 8 containment playbooks, retrospective template, and 3-year tabletop schedule established. |
