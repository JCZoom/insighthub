import prisma from '@/lib/db/prisma';
import { type SessionUser } from '@/lib/auth/session';

// Data categories that map from glossary + data sources
export const DATA_CATEGORIES = {
  Revenue: ['sample_revenue', 'mrr_by_month', 'revenue_by_month', 'revenue_by_type', 'revenue', 'mrr'],
  Retention: ['churn_by_region', 'churn_by_month', 'churn_by_plan', 'churn_rate', 'churn'],
  Support: ['sample_tickets', 'tickets_by_category', 'tickets_by_month', 'tickets_by_team', 'tickets'],
  Sales: ['sample_deals', 'deals_pipeline', 'deals_by_source', 'deals', 'sales', 'pipeline'],
  Product: ['sample_usage', 'usage_by_feature', 'usage_by_month', 'usage', 'feature_usage'],
  Operations: ['kpi_summary', 'overall_kpi', 'metrics', 'kpis'],
  CustomerPII: ['sample_customers', 'customers', 'customer_growth', 'customers_by_plan', 'customers_by_region']
} as const;

export type DataCategory = keyof typeof DATA_CATEGORIES;
export type AccessLevel = 'FULL' | 'NONE' | 'FILTERED';

// Feature permissions that control what actions users can perform
export interface FeaturePermissions {
  canCreateDashboard: boolean;
  canEditGlossary: boolean;
  canAccessSensitiveData: boolean;
  canPublishWidgets: boolean;
  canManageUsers: boolean;
  canManagePermissions: boolean;
  canViewAuditLog: boolean;
  canExportData: boolean;
  canShareDashboards: boolean;
  canCreateFilters: boolean;
}

// Data permissions define what data categories a user can access
export interface DataPermissions {
  Revenue: AccessLevel;
  Retention: AccessLevel;
  Support: AccessLevel;
  Sales: AccessLevel;
  Product: AccessLevel;
  Operations: AccessLevel;
  CustomerPII: AccessLevel;
}

// Combined user permissions resolved from their permission groups
export interface ResolvedPermissions {
  features: FeaturePermissions;
  data: DataPermissions;
  allowedDataSources: string[];
  deniedDataSources: string[];
  user: SessionUser;
}

// Default permission templates for different roles
const DEFAULT_PERMISSION_TEMPLATES = {
  VIEWER: {
    features: {
      canCreateDashboard: false,
      canEditGlossary: false,
      canAccessSensitiveData: false,
      canPublishWidgets: false,
      canManageUsers: false,
      canManagePermissions: false,
      canViewAuditLog: false,
      canExportData: false,
      canShareDashboards: false,
      canCreateFilters: false,
    },
    data: {
      Revenue: 'NONE' as AccessLevel,
      Retention: 'NONE' as AccessLevel,
      Support: 'FULL' as AccessLevel,
      Sales: 'NONE' as AccessLevel,
      Product: 'NONE' as AccessLevel,
      Operations: 'NONE' as AccessLevel,
      CustomerPII: 'NONE' as AccessLevel,
    }
  },
  CREATOR: {
    features: {
      canCreateDashboard: true,
      canEditGlossary: false,
      canAccessSensitiveData: false,
      canPublishWidgets: false,
      canManageUsers: false,
      canManagePermissions: false,
      canViewAuditLog: false,
      canExportData: true,
      canShareDashboards: true,
      canCreateFilters: true,
    },
    data: {
      Revenue: 'NONE' as AccessLevel,
      Retention: 'FULL' as AccessLevel,
      Support: 'FULL' as AccessLevel,
      Sales: 'NONE' as AccessLevel,
      Product: 'FULL' as AccessLevel,
      Operations: 'NONE' as AccessLevel,
      CustomerPII: 'NONE' as AccessLevel,
    }
  },
  POWER_USER: {
    features: {
      canCreateDashboard: true,
      canEditGlossary: false,
      canAccessSensitiveData: true,
      canPublishWidgets: true,
      canManageUsers: false,
      canManagePermissions: false,
      canViewAuditLog: false,
      canExportData: true,
      canShareDashboards: true,
      canCreateFilters: true,
    },
    data: {
      Revenue: 'FULL' as AccessLevel,
      Retention: 'FULL' as AccessLevel,
      Support: 'FULL' as AccessLevel,
      Sales: 'FULL' as AccessLevel,
      Product: 'FULL' as AccessLevel,
      Operations: 'FULL' as AccessLevel,
      CustomerPII: 'NONE' as AccessLevel,
    }
  },
  ADMIN: {
    features: {
      canCreateDashboard: true,
      canEditGlossary: true,
      canAccessSensitiveData: true,
      canPublishWidgets: true,
      canManageUsers: true,
      canManagePermissions: true,
      canViewAuditLog: true,
      canExportData: true,
      canShareDashboards: true,
      canCreateFilters: true,
    },
    data: {
      Revenue: 'FULL' as AccessLevel,
      Retention: 'FULL' as AccessLevel,
      Support: 'FULL' as AccessLevel,
      Sales: 'FULL' as AccessLevel,
      Product: 'FULL' as AccessLevel,
      Operations: 'FULL' as AccessLevel,
      CustomerPII: 'FULL' as AccessLevel,
    }
  }
};

/**
 * Get the data category for a given data source name
 */
export function getDataCategoryForSource(source: string): DataCategory | null {
  for (const [category, sources] of Object.entries(DATA_CATEGORIES)) {
    if (sources.some(s => source.toLowerCase().includes(s.toLowerCase()))) {
      return category as DataCategory;
    }
  }
  return null;
}

/**
 * Resolve effective permissions for a user by combining their permission groups
 * and applying any custom overrides.
 *
 * NOTE: PermissionGroup / UserPermissionAssignment Prisma models are not yet in
 * schema.prisma. Until the RBAC migration is complete, this function uses
 * role-based defaults only. See Asana task GID 1214125662501105.
 */
export async function resolveUserPermissions(user: SessionUser): Promise<ResolvedPermissions> {
  // Use role-based defaults until RBAC Prisma models exist
  const roleTemplate =
    DEFAULT_PERMISSION_TEMPLATES[user.role as keyof typeof DEFAULT_PERMISSION_TEMPLATES] ||
    DEFAULT_PERMISSION_TEMPLATES.VIEWER;

  const effectiveFeatures = { ...roleTemplate.features };
  const effectiveData = { ...roleTemplate.data };

  // Build allowed and denied data sources lists
  const allowedDataSources: string[] = [];
  const deniedDataSources: string[] = [];

  for (const [category, accessLevel] of Object.entries(effectiveData) as [DataCategory, AccessLevel][]) {
    const sources: readonly string[] = DATA_CATEGORIES[category];
    if (accessLevel === 'FULL' || accessLevel === 'FILTERED') {
      allowedDataSources.push(...sources);
    } else {
      deniedDataSources.push(...sources);
    }
  }

  return {
    features: effectiveFeatures,
    data: effectiveData,
    allowedDataSources,
    deniedDataSources,
    user
  };
}

/**
 * Check if user has permission to access a specific data source
 */
export async function canAccessDataSource(user: SessionUser, source: string): Promise<boolean> {
  const permissions = await resolveUserPermissions(user);
  return permissions.allowedDataSources.some(s =>
    source.toLowerCase().includes(s.toLowerCase()) || s.toLowerCase().includes(source.toLowerCase())
  );
}

/**
 * Check if user has a specific feature permission
 */
export async function hasFeaturePermission(user: SessionUser, permission: keyof FeaturePermissions): Promise<boolean> {
  const permissions = await resolveUserPermissions(user);
  return permissions.features[permission];
}

/**
 * Get data sources that a user is NOT allowed to access (for AI prompt)
 */
export async function getRestrictedDataSources(user: SessionUser): Promise<string[]> {
  const permissions = await resolveUserPermissions(user);
  return permissions.deniedDataSources;
}

/**
 * Get data categories that a user is NOT allowed to access (for AI prompt)
 */
export async function getRestrictedDataCategories(user: SessionUser): Promise<DataCategory[]> {
  const permissions = await resolveUserPermissions(user);
  const restricted: DataCategory[] = [];

  for (const [category, accessLevel] of Object.entries(permissions.data) as [DataCategory, AccessLevel][]) {
    if (accessLevel === 'NONE') {
      restricted.push(category);
    }
  }

  return restricted;
}

/**
 * Log permission changes for audit trail
 */
export async function logPermissionChange(
  actionUserId: string,
  action: string,
  resourceType: 'USER_PERMISSION' | 'PERMISSION_GROUP',
  resourceId: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: actionUserId,
        action,
        resourceType,
        resourceId,
        metadata: metadata ? JSON.stringify(metadata) : undefined,
      }
    });
  } catch (error) {
    console.error('Failed to log permission change:', error);
  }
}

// --- Stubs: require PermissionGroup / UserPermissionAssignment models ---
// See Asana task GID 1214125662501105 for RBAC implementation plan.

/** Initialize default permission groups — no-op until schema migration */
export async function initializeDefaultPermissionGroups(): Promise<void> {
  console.warn('initializeDefaultPermissionGroups: no-op — RBAC Prisma models not yet added');
}

/** Assign a permission group to a user — no-op until schema migration */
export async function assignPermissionGroup(
  _userId: string,
  _permissionGroupId: string,
  _assignedBy: string,
  _customOverrides?: Record<string, unknown>
): Promise<void> {
  throw new Error('assignPermissionGroup: RBAC Prisma models not yet added to schema');
}

/** Remove a permission group from a user — no-op until schema migration */
export async function removePermissionGroup(
  _userId: string,
  _permissionGroupId: string,
  _removedBy: string
): Promise<void> {
  throw new Error('removePermissionGroup: RBAC Prisma models not yet added to schema');
}