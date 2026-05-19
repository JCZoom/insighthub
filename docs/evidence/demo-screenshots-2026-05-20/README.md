# Demo Screenshots — 2026-05-20

> **Purpose:** Pre-capture every screen the demo references so the meeting doesn't depend on live network or ad-hoc admin actions. If the prod deploy hiccups during the demo, we can still walk through the evidence from these images.
>
> **Audience:** JD Gershan, Lior Zamir, Avi Katz.
> **Demo doc:** `docs/DEMO_2026-05-20_TALKING_POINTS.md`.
> **Capture target:** PNG, 1440x900 or wider, system theme, Chrome devtools NOT visible (unless explicitly noted).

---

## Capture environment prep

1. Open Chrome (or Brave) **incognito/private window** so cookies don't carry over between role switches.
2. Sign in to https://dashboards.jeffcoy.net as **Jeff Coy (ADMIN)** for screens 1-9.
3. Use **macOS screenshot** (`Cmd+Shift+5` → Window) to avoid the menu bar / wallpaper bleeding in.
4. Save each PNG into this folder using the listed filename. Filenames are referenced from the talking-points doc — please don't rename without updating that doc.
5. After capturing, run `ls -la docs/evidence/demo-screenshots-2026-05-20/` and confirm 12 PNGs (one per checklist item).

---

## Checklist (in demo order)

### Compliance / TLS evidence

- [ ] **`01-ssllabs-grade.png`** — final SSL Labs result page after the P-01 fix deploys. Browser: https://www.ssllabs.com/ssltest/analyze.html?d=dashboards.jeffcoy.net . Capture the **summary card with the grade letter** (full page if it fits). Target grade: **A+**. If the grade is still A or A-, do NOT capture; investigate first (the post-deploy fix may not have landed).
- [ ] **`02-headers-cli.png`** — terminal screenshot of:
  ```bash
  curl -sI https://dashboards.jeffcoy.net | grep -iE 'strict-transport|server|x-frame|content-security|referrer'
  ```
  Should show **exactly one** `Strict-Transport-Security` header, `Server: nginx` (no version), and the security headers from `middleware.ts`.

### Tier-1 closure evidence (from talking-points §1)

- [ ] **`03-mfa-admin-list.png`** — `/admin/users` showing the MFA badges column (verified / stale / missing). Filter or sort so at least one row of each badge state is visible if data permits.
- [ ] **`04-classification-badge-widget.png`** — `/demo/freshworks-suite` Freshsales widget close-up showing the `CUSTOMER_CONFIDENTIAL` classification badge in the widget header.
- [ ] **`05-audit-classification-change.png`** — `/admin/audit?action=data.classification_change&limit=20` showing recent classification-change entries with actor + timestamp + before/after fields.
- [ ] **`06-audit-dashboard-unshare.png`** — `/admin/audit?action=dashboard.unshare&limit=20` showing the dashboard share-DELETE audit entries (closes G-08 evidence).

### Memory hardening + health (from talking-points §2)

- [ ] **`07-admin-health-pressure-ratio.png`** — `/api/admin/health` JSON pretty-printed in browser, with `pressureRatio` field visible and < 0.5. Capture either the raw browser-rendered JSON or the formatted view.

### Freshworks demo (from talking-points §2c-2f)

- [ ] **`08-suite-dashboard-admin.png`** — `/demo/freshworks-suite` rendered as ADMIN. KPI numbers visible, no masking applied.
- [ ] **`09-suite-dashboard-viewer.png`** — same page rendered as a VIEWER role (sign in as a VIEWER user in a second incognito window). Names initial-redacted, emails partially masked, ticket subjects `<masked: N chars>`. Critical evidence for the masking story.

### Retention demo (from talking-points §2d)

- [ ] **`10-retention-dryrun-response.png`** — terminal or browser-rendered JSON response from a `target=all, dryRun=true` POST to `/api/admin/retention`. Shows `chat.matched`, `audit.matched`, `inactiveUsers.matched`, `freshworksCache.matched` numbers without deletion. Capture the whole response.
- [ ] **`11-retention-purge-audit.png`** — `/admin/audit?action=retention.purge_freshworks_cache&limit=10` showing the audit entry from the live demo purge. Capture this **last**, after running the actual purge button click.

### RBAC enforcement (from talking-points §2c bonus / Q&A)

- [ ] **`12-rbac-403.png`** — VIEWER attempts to load an admin-only page (e.g. `/admin/users` or `/admin/audit`). Capture the 403 / "not authorized" UI page (or the network tab's 403 response). Demonstrates middleware-layer RBAC.

### Live-build inside dashboard builder (from talking-points §2g)

- [ ] **`13-builder-source-dropdown.png`** — Dashboard builder, **Data** tab open on a new widget, the data source dropdown expanded so all 17 Freshworks suite entries (`Freshsales *`, `Freshdesk *`, `Freshcaller *`, `Freshchat *`) are visible alongside the sample sources. Tightest evidence that the catalog merge worked.
- [ ] **`14-builder-freshworks-widget-rendered.png`** — A widget you just configured pointing at e.g. `Freshsales Pipeline Value` with the live KPI value rendered. Capture the widget body + the classification badge + the value.
- [ ] **`15-builder-audit-fired.png`** — `/admin/audit?action=integration.freshworks.read&limit=5` showing the row that fired when the widget above rendered. Take this **immediately after** capture 14 so the timestamp lines up.

---

## After capture

1. Quick sanity check: every PNG is non-empty (`du -h *.png` — none should be 0B).
2. Optionally `git add docs/evidence/demo-screenshots-2026-05-20/*.png` and commit. PNGs are not gitignored.
3. Update `docs/DEMO_2026-05-20_TALKING_POINTS.md` only if any filename references drift.

## If something doesn't capture cleanly

Don't burn time. Note the gap here, fall back to a verbal description during the demo, and document a Tier-2 follow-on.

| Captured? | Filename | Notes |
|---|---|---|
|  | 01-ssllabs-grade.png | |
|  | 02-headers-cli.png | |
|  | 03-mfa-admin-list.png | |
|  | 04-classification-badge-widget.png | |
|  | 05-audit-classification-change.png | |
|  | 06-audit-dashboard-unshare.png | |
|  | 07-admin-health-pressure-ratio.png | |
|  | 08-suite-dashboard-admin.png | |
|  | 09-suite-dashboard-viewer.png | |
|  | 10-retention-dryrun-response.png | |
|  | 11-retention-purge-audit.png | |
|  | 12-rbac-403.png | |
|  | 13-builder-source-dropdown.png | |
|  | 14-builder-freshworks-widget-rendered.png | |
|  | 15-builder-audit-fired.png | |
