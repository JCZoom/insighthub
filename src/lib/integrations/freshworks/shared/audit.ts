/**
 * Freshworks suite — shared audit emitters.
 *
 * Every product's read/override/rate-limit events flow through these
 * helpers. The product name is captured in the audit resourceId so
 * compliance queries can filter "show me every Freshdesk read by VIEWER X
 * in the last 30 days."
 *
 * Compliance refs:
 *   - Policy 3698 DC-02 (every CC read logged)
 *   - Policy 3699 DD-05 (every destructive op logged)
 *   - Gap G-08 (audit consistency)
 */

import { createAuditLog, AuditAction, ResourceType } from '@/lib/audit';
import type { FreshworksProduct } from './errors';

export interface FreshworksReadAuditPayload {
  userId: string;
  product: FreshworksProduct;
  resource: string;
  /** Row count returned (NOT contents). */
  count: number;
  /** Cache hit/miss for telemetry. */
  cacheHit: boolean;
  /** Optional filter description for diagnostics — must be PII-free. */
  filter?: string;
}

/**
 * Log a read operation against any Freshworks product.
 *
 * Best-effort: a failed audit write is logged to stderr but does NOT raise.
 */
export async function auditFreshworksRead(p: FreshworksReadAuditPayload): Promise<void> {
  await createAuditLog({
    userId: p.userId,
    action: AuditAction.FRESHWORKS_READ,
    resourceType: ResourceType.SYSTEM,
    resourceId: `${p.product}:${p.resource}`,
    metadata: {
      product: p.product,
      count: p.count,
      cacheHit: p.cacheHit,
      filter: p.filter ?? null,
    },
  });
}

/**
 * Log an admin override that unmasked PII for a VIEWER-role user on a
 * specific widget. High-signal compliance event.
 */
export async function auditFreshworksUnmaskOverride(args: {
  adminUserId: string;
  targetUserId: string;
  product: FreshworksProduct;
  widgetId: string;
  reason: string;
}): Promise<void> {
  await createAuditLog({
    userId: args.adminUserId,
    action: AuditAction.FRESHWORKS_UNMASK_OVERRIDE,
    resourceType: ResourceType.SYSTEM,
    resourceId: `widget:${args.widgetId}`,
    metadata: {
      product: args.product,
      targetUserId: args.targetUserId,
      reason: args.reason,
    },
  });
}

/**
 * Log a rate-limit rejection. The product name flows through so we can
 * tune per-product caps.
 */
export async function auditFreshworksRateLimited(args: {
  userId: string;
  product: FreshworksProduct;
  resource: string;
}): Promise<void> {
  await createAuditLog({
    userId: args.userId,
    action: AuditAction.FRESHWORKS_RATE_LIMITED,
    resourceType: ResourceType.SYSTEM,
    resourceId: `${args.product}:${args.resource}`,
    metadata: { product: args.product },
  });
}
