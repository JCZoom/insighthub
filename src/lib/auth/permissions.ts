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
 */
export async function resolveUserPermissions(user: SessionUser): Promise<ResolvedPermissions> {
  try {
    // Fetch user's permission assignments from database
    const assignments = await prisma.userPermissionAssignment.findMany({
      where: { userId: user.id },
      include: {
        permissionGroup: true,
      }
    });

    // Start with role-based defaults as fallback
    const roleTemplate =
      DEFAULT_PERMISSION_TEMPLATES[user.role as keyof typeof DEFAULT_PERMISSION_TEMPLATES] ||
      DEFAULT_PERMISSION_TEMPLATES.VIEWER;

    let effectiveFeatures = { ...roleTemplate.features };
    let effectiveData = { ...roleTemplate.data };

    // If user has permission group assignments, use those instead
    if (assignments.length > 0) {
      // Reset to empty permissions (deny-by-default)
      effectiveFeatures = Object.keys(effectiveFeatures).reduce((acc, key) => {
        acc[key as keyof FeaturePermissions] = false;
        return acc;
      }, {} as FeaturePermissions);

      effectiveData = Object.keys(effectiveData).reduce((acc, key) => {
        acc[key as DataCategory] = 'NONE';
        return acc;
      }, {} as DataPermissions);

      // Merge permissions from all assigned groups (grant union)
      for (const assignment of assignments) {
        const groupFeatures = JSON.parse(assignment.permissionGroup.featurePermissions) as FeaturePermissions;
        const groupData = JSON.parse(assignment.permissionGroup.dataPermissions) as DataPermissions;

        // Apply custom overrides if they exist
        const overrides = JSON.parse(assignment.customOverrides || '{}') as Partial<{
          features: Partial<FeaturePermissions>;
          data: Partial<DataPermissions>;
        }>;

        // Merge feature permissions (OR operation - any group grants access)
        for (const [feature, granted] of Object.entries(groupFeatures)) {
          const override = overrides.features?.[feature as keyof FeaturePermissions];
          if (override !== undefined) {
            effectiveFeatures[feature as keyof FeaturePermissions] = override;
          } else if (granted) {
            effectiveFeatures[feature as keyof FeaturePermissions] = true;
          }
        }

        // Merge data permissions (highest access level wins)
        for (const [category, level] of Object.entries(groupData) as [DataCategory, AccessLevel][]) {
          const override = overrides.data?.[category];
          const currentLevel = effectiveData[category];

          if (override) {
            effectiveData[category] = override;
          } else {
            // Use the highest access level: FULL > FILTERED > NONE
            if (level === 'FULL' || (level === 'FILTERED' && currentLevel === 'NONE')) {
              effectiveData[category] = level;
            }
          }
        }
      }
    }

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
  } catch (error) {
    console.error('Error resolving user permissions:', error);
    // Fallback to role-based permissions on error
    const roleTemplate =
      DEFAULT_PERMISSION_TEMPLATES[user.role as keyof typeof DEFAULT_PERMISSION_TEMPLATES] ||
      DEFAULT_PERMISSION_TEMPLATES.VIEWER;

    const effectiveFeatures = { ...roleTemplate.features };
    const effectiveData = { ...roleTemplate.data };

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

/** Initialize default permission groups based on the role templates */
export async function initializeDefaultPermissionGroups(): Promise<void> {
  try {
    console.log('Initializing default permission groups...');

    for (const [roleName, template] of Object.entries(DEFAULT_PERMISSION_TEMPLATES)) {
      // Check if this system group already exists
      const existingGroup = await prisma.permissionGroup.findUnique({
        where: { name: roleName }
      });

      if (!existingGroup) {
        await prisma.permissionGroup.create({
          data: {
            name: roleName,
            description: getDefaultGroupDescription(roleName),
            isSystem: true,
            featurePermissions: JSON.stringify(template.features),
            dataPermissions: JSON.stringify(template.data),
          }
        });

        console.log(`Created default permission group: ${roleName}`);
      } else {
        console.log(`Permission group already exists: ${roleName}`);
      }
    }

    console.log('Default permission groups initialization complete');
  } catch (error) {
    console.error('Error initializing default permission groups:', error);
    throw new Error('Failed to initialize default permission groups');
  }
}

/** Get description for default permission groups */
function getDefaultGroupDescription(roleName: string): string {
  switch (roleName) {
    case 'VIEWER':
      return 'Read-only access to shared dashboards and basic support data.';
    case 'CREATOR':
      return 'Can create dashboards and access retention, support, and product data.';
    case 'POWER_USER':
      return 'Full access to most data categories and advanced features like publishing widgets.';
    case 'ADMIN':
      return 'Full system access including user management, permissions, and all data categories.';
    default:
      return `Default ${roleName.toLowerCase()} permission group.`;
  }
}

/** Assign a permission group to a user */
export async function assignPermissionGroup(
  userId: string,
  permissionGroupId: string,
  assignedBy: string,
  customOverrides?: Record<string, unknown>
): Promise<void> {
  try {
    await prisma.userPermissionAssignment.create({
      data: {
        userId,
        permissionGroupId,
        assignedBy,
        customOverrides: customOverrides ? JSON.stringify(customOverrides) : '{}',
      }
    });

    // Log the assignment
    await logPermissionChange(
      assignedBy,
      'user_permission.assign',
      'USER_PERMISSION',
      `${userId}:${permissionGroupId}`,
      { userId, permissionGroupId, customOverrides }
    );
  } catch (error) {
    console.error('Failed to assign permission group:', error);
    throw new Error('Failed to assign permission group');
  }
}

/** Remove a permission group from a user */
export async function removePermissionGroup(
  userId: string,
  permissionGroupId: string,
  removedBy: string
): Promise<void> {
  try {
    await prisma.userPermissionAssignment.delete({
      where: {
        userId_permissionGroupId: {
          userId,
          permissionGroupId,
        }
      }
    });

    // Log the removal
    await logPermissionChange(
      removedBy,
      'user_permission.remove',
      'USER_PERMISSION',
      `${userId}:${permissionGroupId}`,
      { userId, permissionGroupId }
    );
  } catch (error) {
    console.error('Failed to remove permission group:', error);
    throw new Error('Failed to remove permission group');
  }
}