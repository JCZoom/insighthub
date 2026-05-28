import prisma from '@/lib/db/prisma';

// Audit actions enum for type safety
export enum AuditAction {
  // User actions
  USER_LOGIN = 'user.login',
  USER_ROLE_CHANGE = 'user.role_change',
  USER_DATA_EXPORT = 'user.data_export',
  USER_ACCOUNT_DELETION = 'user.account_deletion',

  // Glossary actions
  GLOSSARY_CREATE = 'glossary.create',
  GLOSSARY_UPDATE = 'glossary.update',
  GLOSSARY_DELETE = 'glossary.delete',

  // Dashboard actions
  DASHBOARD_CREATE = 'dashboard.create',
  DASHBOARD_UPDATE = 'dashboard.update',
  DASHBOARD_DELETE = 'dashboard.delete',
  DASHBOARD_SHARE = 'dashboard.share',
  DASHBOARD_UNSHARE = 'dashboard.unshare',
  DASHBOARD_DUPLICATE = 'dashboard.duplicate',
  DASHBOARD_MOVE = 'dashboard.move',
  DASHBOARD_ALIAS_ADD = 'dashboard.alias_add',
  DASHBOARD_ALIAS_REMOVE = 'dashboard.alias_remove',

  // Folder actions
  FOLDER_CREATE = 'folder.create',
  FOLDER_UPDATE = 'folder.update',
  FOLDER_DELETE = 'folder.delete',
  FOLDER_REORDER = 'folder.reorder',

  // Settings actions
  SETTINGS_UPDATE = 'settings.update',

  // Version actions
  VERSION_SAVE = 'version.save',
  VERSION_REVERT = 'version.revert',

  // Data classification actions (G-01 / Policy 3698 DC-02)
  DATA_CLASSIFICATION_CHANGE = 'data.classification_change',
  DATA_OWNER_CHANGE = 'data.owner_change',

  // Retention / disposal actions (G-05, G-06 / Policy 3700 DR-01, 3699 DD-04)
  // Emitted by purge jobs themselves so the audit log records its own grooming.
  RETENTION_PURGE_CHAT = 'retention.purge_chat',
  RETENTION_PURGE_AUDIT = 'retention.purge_audit',
  RETENTION_PURGE_INACTIVE_USERS = 'retention.purge_inactive_users',
  RETENTION_PURGE_FRESHWORKS_CACHE = 'retention.purge_freshworks_cache',
  RETENTION_ANONYMIZE_CUSTOMER = 'retention.anonymize_customer',

  // Freshworks / Freshsales CRM integration (V-01, R-041, R-042)
  // Read-time audit, admin overrides, and operational diagnostics.
  FRESHWORKS_READ = 'integration.freshworks.read',
  FRESHWORKS_UNMASK_OVERRIDE = 'integration.freshworks.unmask_override',
  FRESHWORKS_CACHE_HIT = 'integration.freshworks.cache_hit',
  FRESHWORKS_RATE_LIMITED = 'integration.freshworks.rate_limited',
}

// Resource types enum for type safety
export enum ResourceType {
  USER = 'user',
  GLOSSARY = 'glossary',
  DASHBOARD = 'dashboard',
  VERSION = 'version',
  FOLDER = 'folder',
  SETTINGS = 'settings',
  SYSTEM = 'system',
}

export interface AuditLogData {
  userId: string;
  action: AuditAction;
  resourceType: ResourceType;
  resourceId: string;
  metadata?: Record<string, any>;
  // G-20 / Policy 3715 OS-12, OS-13 — request context.
  // Both fields are optional. Pass them when the call site has access to a
  // Request object (use `extractRequestContext(request)` below). Cron jobs,
  // retention purges, and other non-HTTP emitters omit them.
  ipAddress?: string | null;
  userAgent?: string | null;
}

/**
 * Sensitive-key matcher used by `sanitizeAuditMetadata`. Any object key
 * whose name matches this regex (case-insensitive) is replaced with the
 * literal string `[REDACTED]` before persistence. The match is on the
 * KEY name, not the value — so `{ secretToken: 'abc' }` is redacted but
 * `{ note: 'this is the secret token' }` is preserved. Compliance gap
 * G-20 / Policy 3715 OS-13.
 */
const SENSITIVE_KEY_PATTERN = /password|token|secret|ssn|credit|cvv|api[_-]?key|authorization|bearer/i;

/**
 * Recursively walk a metadata object and redact any value whose KEY name
 * matches `SENSITIVE_KEY_PATTERN`. Returns a new object — does not mutate.
 * Arrays are walked element-wise (their indices aren't keys-with-names).
 * Non-plain values pass through.
 */
export function sanitizeAuditMetadata<T = unknown>(input: T): T {
  if (input === null || input === undefined) return input;
  if (Array.isArray(input)) {
    return input.map((v) => sanitizeAuditMetadata(v)) as unknown as T;
  }
  if (typeof input !== 'object') return input;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    if (SENSITIVE_KEY_PATTERN.test(k)) {
      out[k] = '[REDACTED]';
    } else if (v !== null && typeof v === 'object') {
      out[k] = sanitizeAuditMetadata(v);
    } else {
      out[k] = v;
    }
  }
  return out as T;
}

/**
 * Pull request context (ipAddress + userAgent) from a Fetch-API `Request`,
 * `Headers`, or anything with a `.get()` method that returns header values.
 * Behind nginx, the real client IP is the FIRST hop in `x-forwarded-for`
 * (subsequent hops are upstream proxies). Falls back to `x-real-ip`. Both
 * fields are clamped to 256 chars to bound metadata storage.
 *
 * Usage in a Next.js route handler:
 *   const ctx = extractRequestContext(request);
 *   await createAuditLog({ ...auditFields, ...ctx });
 *
 * Returns `{ ipAddress: undefined, userAgent: undefined }` when nothing
 * is parseable — leaves the columns null in the DB.
 */
export function extractRequestContext(
  source: Request | Headers | { get: (name: string) => string | null } | null | undefined
): { ipAddress?: string; userAgent?: string } {
  if (!source) return {};
  // Normalize to a callable getter regardless of input shape.
  const headers: { get: (name: string) => string | null } =
    source instanceof Request ? source.headers : (source as Headers);
  if (typeof headers?.get !== 'function') return {};

  const fwd = headers.get('x-forwarded-for');
  const real = headers.get('x-real-ip');
  const ua = headers.get('user-agent');

  let ipAddress: string | undefined;
  if (fwd && fwd.trim()) {
    // First hop is the original client; trim spaces.
    ipAddress = fwd.split(',')[0]?.trim() || undefined;
  } else if (real && real.trim()) {
    ipAddress = real.trim();
  }

  return {
    ipAddress: ipAddress ? ipAddress.slice(0, 256) : undefined,
    userAgent: ua ? ua.slice(0, 256) : undefined,
  };
}

/**
 * Build the Prisma `data` object for a single audit row, applying
 * sanitization + JSON-encoding consistently. Internal helper shared by
 * the best-effort and strict creators so they cannot drift apart.
 */
function buildAuditRow(input: AuditLogData) {
  const { userId, action, resourceType, resourceId, metadata, ipAddress, userAgent } = input;
  const cleaned = metadata ? sanitizeAuditMetadata(metadata) : null;
  return {
    userId,
    action,
    resourceType,
    resourceId,
    metadata: cleaned ? JSON.stringify(cleaned) : null,
    ipAddress: ipAddress ?? null,
    userAgent: userAgent ?? null,
  };
}

/**
 * Creates an audit log entry. **Best-effort semantics** — swallows errors and
 * logs them to stderr. Use for audit calls that are nice-to-have but must
 * never break the main operation (e.g. logging successful reads).
 *
 * If audit-before-delete (G-08) semantics are required, use `auditedDelete()`
 * or `createAuditLogStrict()` instead.
 *
 * Metadata is automatically passed through `sanitizeAuditMetadata` (G-20 /
 * Policy 3715 OS-13) so call sites do not need to remember to redact
 * sensitive keys. Pass `ipAddress` + `userAgent` (or use
 * `extractRequestContext(request)`) when you have a Request to read from.
 */
export async function createAuditLog(input: AuditLogData): Promise<void> {
  try {
    await prisma.auditLog.create({ data: buildAuditRow(input) });
  } catch (error) {
    // Log audit failures but don't throw to avoid breaking the main operation
    console.error('Failed to create audit log:', {
      error,
      userId: input.userId,
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      // Don't log sanitized metadata back to stderr — it could still be
      // verbose. Operators who need it can re-query Prisma directly.
    });
  }
}

/**
 * Like `createAuditLog`, but **throws on failure**. Use when a missing audit
 * entry would itself be a compliance violation — e.g. when wrapping a
 * destructive operation that must not proceed if audit fails (G-08 / policy
 * 3699 DD-05).
 *
 * If you find yourself catching the error and continuing anyway, you should
 * be using `createAuditLog` (best-effort) instead.
 */
export async function createAuditLogStrict(input: AuditLogData): Promise<void> {
  await prisma.auditLog.create({ data: buildAuditRow(input) });
}

/**
 * Audit-before-delete wrapper (G-08 / policy 3699 DD-05).
 *
 * Writes the audit log entry BEFORE invoking the supplied delete function.
 * If the audit write fails the delete is never attempted — the caller's
 * promise rejects and the destructive operation is preserved for retry.
 * If the audit succeeds but the delete fails, we have an audit entry for an
 * operation that never happened; that is preferable to the inverse (silent
 * deletion with no audit trail) and is detectable by reconciling audit logs
 * against actual table state.
 *
 * Usage:
 *   await auditedDelete({
 *     audit: {
 *       userId: user.id,
 *       action: AuditAction.DASHBOARD_UNSHARE,
 *       resourceType: ResourceType.DASHBOARD,
 *       resourceId: id,
 *       metadata: { ... },
 *     },
 *     execute: () => prisma.dashboardShare.deleteMany({ where: {...} }),
 *   });
 *
 * **All new destructive code paths SHOULD use this wrapper.** Existing
 * audit-after-delete sites are tolerated but should be migrated opportunistically.
 */
export async function auditedDelete<T>({
  audit,
  execute,
}: {
  audit: AuditLogData;
  execute: () => Promise<T>;
}): Promise<T> {
  await createAuditLogStrict(audit);
  return execute();
}

/**
 * Helper function to log user actions
 */
export async function logUserAction(
  userId: string,
  action: AuditAction.USER_LOGIN | AuditAction.USER_ROLE_CHANGE,
  targetUserId: string,
  metadata?: Record<string, any>
): Promise<void> {
  await createAuditLog({
    userId,
    action,
    resourceType: ResourceType.USER,
    resourceId: targetUserId,
    metadata,
  });
}

/**
 * Helper function to log glossary actions
 */
export async function logGlossaryAction(
  userId: string,
  action: AuditAction.GLOSSARY_CREATE | AuditAction.GLOSSARY_UPDATE | AuditAction.GLOSSARY_DELETE,
  glossaryId: string,
  metadata?: Record<string, any>
): Promise<void> {
  await createAuditLog({
    userId,
    action,
    resourceType: ResourceType.GLOSSARY,
    resourceId: glossaryId,
    metadata,
  });
}

/**
 * Helper function to log dashboard actions
 */
export async function logDashboardAction(
  userId: string,
  action:
    | AuditAction.DASHBOARD_CREATE
    | AuditAction.DASHBOARD_UPDATE
    | AuditAction.DASHBOARD_DELETE
    | AuditAction.DASHBOARD_SHARE
    | AuditAction.DASHBOARD_UNSHARE
    | AuditAction.DASHBOARD_DUPLICATE,
  dashboardId: string,
  metadata?: Record<string, any>
): Promise<void> {
  await createAuditLog({
    userId,
    action,
    resourceType: ResourceType.DASHBOARD,
    resourceId: dashboardId,
    metadata,
  });
}

/**
 * Helper function to log version actions
 */
export async function logVersionAction(
  userId: string,
  action: AuditAction.VERSION_SAVE | AuditAction.VERSION_REVERT,
  versionId: string,
  metadata?: Record<string, any>
): Promise<void> {
  await createAuditLog({
    userId,
    action,
    resourceType: ResourceType.VERSION,
    resourceId: versionId,
    metadata,
  });
}

/**
 * Retrieve audit logs with filtering and pagination
 */
export async function getAuditLogs({
  userId,
  action,
  resourceType,
  resourceId,
  startDate,
  endDate,
  limit = 50,
  offset = 0,
}: {
  userId?: string;
  action?: string;
  resourceType?: string;
  resourceId?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
} = {}) {
  const where: any = {};

  if (userId) where.userId = userId;
  if (action) where.action = action;
  if (resourceType) where.resourceType = resourceType;
  if (resourceId) where.resourceId = resourceId;
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = startDate;
    if (endDate) where.createdAt.lte = endDate;
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return { logs, total };
}