import prisma from '@/lib/db/prisma';

// Audit actions enum for type safety
export enum AuditAction {
  // User actions
  USER_LOGIN = 'user.login',
  USER_ROLE_CHANGE = 'user.role_change',

  // Glossary actions
  GLOSSARY_CREATE = 'glossary.create',
  GLOSSARY_UPDATE = 'glossary.update',
  GLOSSARY_DELETE = 'glossary.delete',

  // Dashboard actions
  DASHBOARD_CREATE = 'dashboard.create',
  DASHBOARD_UPDATE = 'dashboard.update',
  DASHBOARD_DELETE = 'dashboard.delete',
  DASHBOARD_SHARE = 'dashboard.share',
  DASHBOARD_DUPLICATE = 'dashboard.duplicate',

  // Version actions
  VERSION_SAVE = 'version.save',
  VERSION_REVERT = 'version.revert',
}

// Resource types enum for type safety
export enum ResourceType {
  USER = 'user',
  GLOSSARY = 'glossary',
  DASHBOARD = 'dashboard',
  VERSION = 'version',
}

interface AuditLogData {
  userId: string;
  action: AuditAction;
  resourceType: ResourceType;
  resourceId: string;
  metadata?: Record<string, any>;
}

/**
 * Creates an audit log entry
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
  action: AuditAction.DASHBOARD_CREATE | AuditAction.DASHBOARD_UPDATE | AuditAction.DASHBOARD_DELETE | AuditAction.DASHBOARD_SHARE | AuditAction.DASHBOARD_DUPLICATE,
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