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
}

/**
 * Creates an audit log entry. **Best-effort semantics** — swallows errors and
 * logs them to stderr. Use for audit calls that are nice-to-have but must
 * never break the main operation (e.g. logging successful reads).
 *
 * If audit-before-delete (G-08) semantics are required, use `auditedDelete()`
 * or `createAuditLogStrict()` instead.
 */
export async function createAuditLog({
  userId,
  action,
  resourceType,
  resourceId,
  metadata
}: AuditLogData): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        action,
        resourceType,
        resourceId,
        metadata: metadata ? JSON.stringify(metadata) : null,
      },
    });
  } catch (error) {
    // Log audit failures but don't throw to avoid breaking the main operation
    console.error('Failed to create audit log:', {
      error,
      userId,
      action,
      resourceType,
      resourceId,
      metadata
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
export async function createAuditLogStrict({
  userId,
  action,
  resourceType,
  resourceId,
  metadata
}: AuditLogData): Promise<void> {
  await prisma.auditLog.create({
    data: {
      userId,
      action,
      resourceType,
      resourceId,
      metadata: metadata ? JSON.stringify(metadata) : null,
    },
  });
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