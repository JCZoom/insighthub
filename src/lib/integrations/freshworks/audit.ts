/**
 * Freshsales connector — read-time audit logging.
 *
 * Every Freshsales API read that returns customer-confidential data must
 * leave a record in the audit log:
 *   - WHO made the request (userId)
 *   - WHAT resource type (contacts | deals | accounts)
 *   - HOW MANY rows returned (no row contents — never log PII)
 *   - WHEN (createdAt auto)
 *
 * Per the Game Plan §3.2 contract: **no PII in the log**. We capture row
 * counts and resource identifiers only. The audit log itself is also
 * subject to retention policy (G-06, 365d default).
 *
 * Compliance refs:
 *   - Policy 3698 DC-02 (every access to CC data is logged)
 *   - Policy 3699 DD-05 (every destructive op is logged)
 *   - Gap G-08 (audit consistency)
 */

import { createAuditLog, AuditAction, ResourceType } from '@/lib/audit';

export interface FreshworksReadAuditPayload {
  userId: string;
  resource: 'contacts' | 'deals' | 'accounts';
  /** Row count returned (NOT contents). */
  count: number;
  /** Cache hit/miss for telemetry. */
  cacheHit: boolean;
  /** Optional filter description for diagnostics — must be PII-free. */
  filter?: string;
}

/**
 * Log a Freshsales read operation.
 *
 * Best-effort: a failed audit write is logged to stderr but does NOT raise.
 * The downstream caller's response is already in flight by the time this
 * runs; we don't want to crash a successful read because of an audit hiccup.
 */
export async function auditFreshworksRead(p: FreshworksReadAuditPayload): Promise<void> {
  await createAuditLog({
    userId: p.userId,
    action: AuditAction.FRESHWORKS_READ,
    resourceType: ResourceType.SYSTEM,
    resourceId: `freshworks:${p.resource}`,
    metadata: {
      count: p.count,
      cacheHit: p.cacheHit,
      filter: p.filter ?? null,
    },
  });
}

/**
 * Log an admin override that unmasked PII for a VIEWER-role user on a
 * specific widget. This is a high-signal compliance event.
 */
export async function auditFreshworksUnmaskOverride(args: {
  adminUserId: string;
  targetUserId: string;
  widgetId: string;
  reason: string;
}): Promise<void> {
  await createAuditLog({
    userId: args.adminUserId,
    action: AuditAction.FRESHWORKS_UNMASK_OVERRIDE,
    resourceType: ResourceType.SYSTEM,
    resourceId: `widget:${args.widgetId}`,
    metadata: {
      targetUserId: args.targetUserId,
      reason: args.reason,
    },
  });
}

/**
 * Log a rate-limit rejection. We expect this to be rare under the 60/min
 * ceiling but the signal is useful when tuning the limiter or detecting
 * runaway dashboards.
 */
export async function auditFreshworksRateLimited(args: {
  userId: string;
  resource: string;
}): Promise<void> {
  await createAuditLog({
    userId: args.userId,
    action: AuditAction.FRESHWORKS_RATE_LIMITED,
    resourceType: ResourceType.SYSTEM,
    resourceId: `freshworks:${args.resource}`,
    metadata: {},
  });
}
