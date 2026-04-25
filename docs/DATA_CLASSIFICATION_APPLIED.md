# Data Classification — Applied to InsightHub

**Status:** ✅ Implemented (2026-04-25, gap **G-01** closed)
**Policy:** USZoom Policy 3698 — Data Classification (controls **DC-01**, **DC-02**, **DC-03**)
**Code:** [`src/lib/data/classification.ts`](../src/lib/data/classification.ts)
**Owner:** Jeff Coy (technical) · JD Gershan (CISO/DPO)

This document explains how InsightHub maps its information assets into the
four-tier USZoom classification framework, what the defaults are, and how
to change a classification with the audit trail required by **DC-02**.

---

## 1. The four tiers

| Tier | Sensitivity rank | Allowed audience | Typical content in InsightHub |
|---|---|---|---|
| `PUBLIC` | 0 (lowest) | Anyone, including outside USZoom | Marketing dashboards approved for external sharing; demo templates seeded with synthetic data only. |
| `USZOOM_CONFIDENTIAL` | 1 | All USZoom employees | Internal documentation, glossary terms describing internal-only metrics, dashboards intended for full-company viewing. |
| `USZOOM_RESTRICTED` | 2 (**default**) | Limited USZoom employees by need-to-know | Default classification for any new dashboard or glossary term. Department-scoped financial views, vendor-specific data. |
| `CUSTOMER_CONFIDENTIAL` | 3 (highest) | Limited USZoom employees with explicit role | Anything containing customer PII, financial data, regulated data, or future Snowflake-sourced rows that contain customer identifiers. |

The ranking matters for two operational decisions:

- **Downgrades to `PUBLIC`** require an Administrator. Every other transition
  is permitted to anyone with edit rights on the object.
- **Retention guidance** (advisory at G-01 closure, consumed by retention.ts
  under G-05) shortens with sensitivity:
  `PUBLIC` → no ceiling · `USZOOM_CONFIDENTIAL` → 7y · `USZOOM_RESTRICTED` → 5y · `CUSTOMER_CONFIDENTIAL` → 3y (GDPR-aligned).

---

## 2. Where classification lives

| Object | Field | Default | Notes |
|---|---|---|---|
| `Dashboard` | `classification` | `USZOOM_RESTRICTED` | Surfaced as a compact badge on dashboard cards (non-default tiers only). Always visible in the editor's Details panel and Admin → Templates. |
| `Dashboard` | `dataOwnerId` | creator's `User.id` | The steward responsible for the classification decision; audited separately from `ownerId` (which is the creator/holder). |
| `GlossaryTerm` | `classification` | `USZOOM_RESTRICTED` | Surfaced in the glossary admin view. |
| `GlossaryTerm` | `dataOwnerId` | creator's `User.id` | Same semantics as Dashboard. |
| Snowflake source metadata | (planned) | — | Phase 3 — when Snowflake is connected, every source table will carry classification metadata propagated from the Snowflake catalog. Tracked under future risk **R-030** + gap **G-01-Phase3**. |

Schema reference: [`prisma/schema.prisma`](../prisma/schema.prisma) — see the
comment block under the `User` model for the canonical allowed values.

---

## 3. Default behaviour at object creation

1. New `Dashboard` and `GlossaryTerm` rows are created with
   `classification = USZOOM_RESTRICTED`.
2. `dataOwnerId` defaults to the current authenticated user.
3. A user creating an object directly as `PUBLIC` is rejected unless they
   hold the `ADMIN` role (`HTTP 403`, helper
   `canSetClassification` in `src/lib/data/classification.ts`).
4. The creation `AuditLog` entry includes the chosen classification and
   data owner.

---

## 4. Changing classification (post-creation)

There are two routes that accept classification changes:

- `PUT /api/dashboards/[id]` — body fields `classification` and/or `dataOwnerId`.
- `PUT /api/glossary/[id]` — same fields.

Validation:

- The value must be one of the four allowed tiers; otherwise `HTTP 400`.
- Downgrade to `PUBLIC` requires `role === 'ADMIN'`; otherwise `HTTP 403`
  with a human-readable reason.
- All other transitions (raising sensitivity, sliding between internal
  tiers) are permitted to anyone with normal edit rights on the object.

Audit trail (Policy **3698 DC-02**):

- The route emits the existing `DASHBOARD_UPDATE` / `GLOSSARY_UPDATE` log.
- **In addition**, classification changes emit a dedicated
  `data.classification_change` log with `from`, `to`, and an `isDowngrade`
  boolean so forensic queries don't have to swim through unrelated update
  noise.
- Data-owner changes emit a separate `data.owner_change` log with
  `from`/`to` user ids.

---

## 5. UI surface

- **Dashboard cards (gallery):** compact badge in the top-left corner of
  the thumbnail, **only** for non-default tiers. The default
  (`USZOOM_RESTRICTED`) is suppressed deliberately to avoid cluttering
  the gallery with a single repeated badge — the absence of a badge
  therefore *signals* the default. See `src/components/classification/ClassificationBadge.tsx`.
- **Editor & admin views:** full-size badge with label visible at all
  times, regardless of tier.
- **Audit Log viewer:** can filter by `data.classification_change` or
  `data.owner_change` action codes.
- **GDPR export (`GET /api/user/export`):** the classification and
  data-owner of each owned dashboard is included in the JSON payload,
  satisfying GDPR Art. 15 transparency.

---

## 6. Compatibility notes

- **Existing rows pre-G-01** have been backfilled to `USZOOM_RESTRICTED`
  by SQLite's `DEFAULT` clause when `prisma db push` ran the migration.
  No manual data migration was required.
- **`dataOwnerId`** is nullable for those existing rows because we did
  not have a record of stewardship before this gap was closed. New
  classification or data-owner edits will populate it; in the meantime
  `dataOwnerId IS NULL` is read by the UI as "owner is the same as the
  primary `ownerId`."

---

## 7. Cross-references

- **Risk Register:** R-001 (closed) — see `docs/RISK_REGISTER.md`.
- **Compliance Gap:** G-01 (closed) — see `docs/COMPLIANCE_GAPS.md`.
- **Compliance Matrix:** controls DC-01..03 mapped to this file and
  `src/lib/data/classification.ts` — see `docs/COMPLIANCE_MATRIX.md`.
- **Statement of Applicability:** Annex A.5.12 *Classification of
  information* and A.5.13 *Labelling of information* now ✅ Implemented
  — see `docs/STATEMENT_OF_APPLICABILITY.md`.
- **Phase 3 follow-on:** when Snowflake-sourced widgets land, source
  metadata gains its own classification field; the badge component
  is already built and reusable.
