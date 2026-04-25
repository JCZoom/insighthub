/**
 * Data Classification Framework — G-01 / USZoom Policy 3698
 *
 * Per Policy 3698 controls DC-01..03, every information asset that
 * InsightHub stores must carry a classification label. This module is the
 * single source of truth for:
 *
 *   • The four allowed classification values (no Prisma enums on SQLite —
 *     see the comment block in `prisma/schema.prisma` for the policy
 *     reference).
 *   • Validation of writes (only ADMIN may downgrade an object to PUBLIC).
 *   • Display metadata for UI badges (label, colour, description).
 *   • Retention guidance per classification — currently advisory; will be
 *     consumed by `src/lib/data/retention.ts` when sensitivity-scaled
 *     retention lands (G-05).
 *
 * Concrete mapping of *which* InsightHub objects fall into *which* tier is
 * documented in `docs/DATA_CLASSIFICATION_APPLIED.md`. Update both files
 * together if the policy changes.
 */

import type { SessionUser } from '@/lib/auth/session';

// ─────────────────────────────────────────────────────────────────────────────
// Allowed values
// ─────────────────────────────────────────────────────────────────────────────

export const DATA_CLASSIFICATIONS = [
  'PUBLIC',
  'USZOOM_CONFIDENTIAL',
  'USZOOM_RESTRICTED',
  'CUSTOMER_CONFIDENTIAL',
] as const;

export type DataClassification = (typeof DATA_CLASSIFICATIONS)[number];

/** Default classification applied to a newly-created object. */
export const DEFAULT_CLASSIFICATION: DataClassification = 'USZOOM_RESTRICTED';

/**
 * Sensitivity ordering, ascending. Used to decide whether a transition is a
 * downgrade (lower index) or an upgrade (higher index).
 *
 *   PUBLIC < USZOOM_CONFIDENTIAL < USZOOM_RESTRICTED < CUSTOMER_CONFIDENTIAL
 *
 * Per Policy 3698 the practical effect of "downgrade to PUBLIC" is that
 * the object becomes shareable outside USZoom — we only let ADMIN do that.
 */
const SENSITIVITY_RANK: Record<DataClassification, number> = {
  PUBLIC: 0,
  USZOOM_CONFIDENTIAL: 1,
  USZOOM_RESTRICTED: 2,
  CUSTOMER_CONFIDENTIAL: 3,
};

// ─────────────────────────────────────────────────────────────────────────────
// Validation
// ─────────────────────────────────────────────────────────────────────────────

export function isValidClassification(value: unknown): value is DataClassification {
  return typeof value === 'string' && (DATA_CLASSIFICATIONS as readonly string[]).includes(value);
}

/**
 * Coerce an arbitrary string into a valid `DataClassification` or fall back
 * to `DEFAULT_CLASSIFICATION`. Useful when reading legacy rows that
 * pre-date this framework.
 */
export function coerceClassification(value: unknown): DataClassification {
  return isValidClassification(value) ? value : DEFAULT_CLASSIFICATION;
}

export interface ClassificationCheckResult {
  ok: boolean;
  reason?: string;
}

/**
 * Decide whether `user` may transition an object's classification from
 * `current` to `target`.
 *
 * Rules (Policy 3698 DC-02 + DC-03):
 *   • Any value is OK if it equals `current` (no-op).
 *   • Setting target = PUBLIC requires `role === 'ADMIN'`. This is the
 *     only "downgrade-out-of-org" gate the policy specifies.
 *   • Any other transition (raising sensitivity, or moving between
 *     internal tiers) is allowed for any user with edit permission on
 *     the object — the route already enforces that prerequisite.
 *
 * The function never throws; callers should branch on `ok` and surface
 * `reason` to the user verbatim where appropriate.
 */
export function canSetClassification(
  user: Pick<SessionUser, 'role'>,
  current: DataClassification,
  target: DataClassification,
): ClassificationCheckResult {
  if (current === target) return { ok: true };
  if (target === 'PUBLIC' && user.role !== 'ADMIN') {
    return {
      ok: false,
      reason: 'Only an Administrator may downgrade an object to PUBLIC classification.',
    };
  }
  return { ok: true };
}

/**
 * Convenience: returns true when going from `from` -> `to` reduces
 * sensitivity. Used by the audit log to label downgrade events
 * distinctly from upgrades.
 */
export function isDowngrade(from: DataClassification, to: DataClassification): boolean {
  return SENSITIVITY_RANK[to] < SENSITIVITY_RANK[from];
}

// ─────────────────────────────────────────────────────────────────────────────
// UI metadata
// ─────────────────────────────────────────────────────────────────────────────

export interface ClassificationDisplay {
  label: string;
  shortLabel: string;
  description: string;
  /** Tailwind color tokens — chosen to be legible in both light and dark themes. */
  colorClasses: string;
  /**
   * Whether this classification should be shown as a badge in compact UI
   * surfaces (e.g. dashboard cards). The default tier (USZOOM_RESTRICTED)
   * is suppressed here to avoid badge clutter on every card; elevated and
   * deliberately-public tiers are always visible.
   */
  alwaysShowOnCard: boolean;
}

export const CLASSIFICATION_DISPLAY: Record<DataClassification, ClassificationDisplay> = {
  PUBLIC: {
    label: 'Public',
    shortLabel: 'Public',
    description:
      'Cleared for unrestricted distribution. Only an Administrator can move an object into this tier.',
    colorClasses: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-200 dark:ring-emerald-700',
    alwaysShowOnCard: true,
  },
  USZOOM_CONFIDENTIAL: {
    label: 'USZoom Confidential',
    shortLabel: 'Confidential',
    description: 'Internal USZoom data. Do not share outside the company without prior approval.',
    colorClasses: 'bg-sky-50 text-sky-700 ring-1 ring-sky-200 dark:bg-sky-900/30 dark:text-sky-200 dark:ring-sky-700',
    alwaysShowOnCard: false,
  },
  USZOOM_RESTRICTED: {
    label: 'USZoom Restricted',
    shortLabel: 'Restricted',
    description:
      'Default classification for new objects. Internal-only; access limited by role and need-to-know.',
    colorClasses: 'bg-amber-50 text-amber-800 ring-1 ring-amber-200 dark:bg-amber-900/30 dark:text-amber-200 dark:ring-amber-700',
    alwaysShowOnCard: false,
  },
  CUSTOMER_CONFIDENTIAL: {
    label: 'Customer Confidential',
    shortLabel: 'Customer-Conf',
    description:
      'Contains regulated customer data (PII / financial / health). Strictest handling: encrypted at rest, audited access, and short retention.',
    colorClasses: 'bg-rose-50 text-rose-700 ring-1 ring-rose-200 dark:bg-rose-900/30 dark:text-rose-200 dark:ring-rose-700',
    alwaysShowOnCard: true,
  },
};

export function getClassificationDisplay(value: unknown): ClassificationDisplay {
  return CLASSIFICATION_DISPLAY[coerceClassification(value)];
}

// ─────────────────────────────────────────────────────────────────────────────
// Retention guidance (advisory — wired by retention.ts under G-05)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Maximum recommended retention in days per classification, per
 * Policy 3700 DR-01..03 cross-referenced against Policy 3698 DC-03.
 *
 * `null` means "no policy maximum at the classification layer" — the
 * generic record-type retention still applies.
 *
 * These numbers are advisory at G-01 closure. `src/lib/data/retention.ts`
 * may consult them when sensitivity-scaled retention is implemented under
 * G-05; until then this just documents intent.
 */
export const CLASSIFICATION_RETENTION_DAYS: Record<DataClassification, number | null> = {
  PUBLIC: null,
  USZOOM_CONFIDENTIAL: 365 * 7, // 7 years — internal business records
  USZOOM_RESTRICTED: 365 * 5, // 5 years
  CUSTOMER_CONFIDENTIAL: 365 * 3, // 3 years — GDPR-aligned ceiling for customer PII
};

export function getRetentionDays(value: unknown): number | null {
  return CLASSIFICATION_RETENTION_DAYS[coerceClassification(value)];
}
