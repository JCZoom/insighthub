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

// Meta-categories that group related data categories for unified access control
export const DATA_META_CATEGORIES = {
  Financial: {
    description: 'All financial and revenue-related data including sales metrics',
    includedCategories: ['Revenue', 'Sales'] as const,
    financialMetrics: [
      'mrr', 'mrr_by_month', 'revenue', 'revenue_by_month', 'revenue_by_type',
      'deals', 'deals_pipeline', 'deals_by_source', 'sales', 'pipeline',
      'sample_revenue', 'sample_deals'
    ] as const
  }
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
  Financial: AccessLevel;
}

// Metric-level access restrictions within a data category
export interface MetricAccessRule {
  metricName: string;
  accessLevel: AccessLevel;
  deniedReason?: string;
}

// Enhanced permission result with metric-level granularity
export interface MetricPermissionCheck {
  hasAccess: boolean;
  accessLevel: AccessLevel;
  isRestricted: boolean;
  deniedReason?: string;
  category?: DataCategory | 'Financial';
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
      Financial: 'NONE' as AccessLevel,
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
      Financial: 'NONE' as AccessLevel, // Creators blocked from financial data by default
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
      Financial: 'FULL' as AccessLevel, // Power users get full financial access
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
      Financial: 'FULL' as AccessLevel,
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
 * Check if a data source belongs to the Financial meta-category
 */
export function isFinancialDataSource(source: string): boolean {
  return DATA_META_CATEGORIES.Financial.financialMetrics.some(metric =>
    source.toLowerCase().includes(metric.toLowerCase()) || metric.toLowerCase().includes(source.toLowerCase())
  );
}

/**
 * Get the appropriate category or meta-category for a data source
 */
export function getCategoryForSource(source: string): DataCategory | 'Financial' | null {
  // Check if it's a financial data source first (meta-category takes precedence)
  if (isFinancialDataSource(source)) {
    return 'Financial';
  }

  // Fall back to regular data category
  return getDataCategoryForSource(source);
}

/**
 * Enhanced permission check for metric-level access
 */
export async function checkMetricAccess(user: SessionUser, source: string): Promise<MetricPermissionCheck> {
  const permissions = await resolveUserPermissions(user);
  const category = getCategoryForSource(source);

  if (!category) {
    return {
      hasAccess: false,
      accessLevel: 'NONE',
      isRestricted: true,
      deniedReason: `Data source '${source}' is not recognized.`,
    };
  }

  // Check if this is a Financial meta-category source
  if (category === 'Financial') {
    const accessLevel = permissions.data.Financial;
    const hasAccess = accessLevel !== 'NONE';

    return {
      hasAccess,
      accessLevel,
      isRestricted: !hasAccess,
      deniedReason: hasAccess ? undefined : `Access denied to Financial data. Contact your administrator to request permissions.`,
      category: 'Financial'
    };
  }

  // Regular data category check
  const accessLevel = permissions.data[category];
  const hasAccess = accessLevel !== 'NONE';

  return {
    hasAccess,
    accessLevel,
    isRestricted: !hasAccess,
    deniedReason: hasAccess ? undefined : `Access denied to ${category} data. Contact your administrator to request permissions.`,
    category
  };
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
        acc[key as keyof DataPermissions] = 'NONE';
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
        for (const [category, level] of Object.entries(groupData) as [keyof DataPermissions, AccessLevel][]) {
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

    for (const [category, accessLevel] of Object.entries(effectiveData) as [keyof DataPermissions, AccessLevel][]) {
      // Handle Financial meta-category specially
      if (category === 'Financial') {
        const financialSources = DATA_META_CATEGORIES.Financial.financialMetrics;
        if (accessLevel === 'FULL' || accessLevel === 'FILTERED') {
          allowedDataSources.push(...financialSources);
        } else {
          deniedDataSources.push(...financialSources);
        }
      } else {
        // Regular data category
        const sources: readonly string[] = DATA_CATEGORIES[category as DataCategory];
        if (sources) {
          if (accessLevel === 'FULL' || accessLevel === 'FILTERED') {
            allowedDataSources.push(...sources);
          } else {
            deniedDataSources.push(...sources);
          }
        }
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

    for (const [category, accessLevel] of Object.entries(effectiveData) as [keyof DataPermissions, AccessLevel][]) {
      // Handle Financial meta-category specially
      if (category === 'Financial') {
        const financialSources = DATA_META_CATEGORIES.Financial.financialMetrics;
        if (accessLevel === 'FULL' || accessLevel === 'FILTERED') {
          allowedDataSources.push(...financialSources);
        } else {
          deniedDataSources.push(...financialSources);
        }
      } else {
        // Regular data category
        const sources: readonly string[] = DATA_CATEGORIES[category as DataCategory];
        if (sources) {
          if (accessLevel === 'FULL' || accessLevel === 'FILTERED') {
            allowedDataSources.push(...sources);
          } else {
            deniedDataSources.push(...sources);
          }
        }
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
 * Check if user has permission to access a specific data source (legacy function for backward compatibility)
 */
export async function canAccessDataSource(user: SessionUser, source: string): Promise<boolean> {
  const metricCheck = await canAccessDataSourceWithMetrics(user, source);
  return metricCheck.hasAccess;
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
export async function getRestrictedDataCategories(user: SessionUser): Promise<(DataCategory | 'Financial')[]> {
  const permissions = await resolveUserPermissions(user);
  const restricted: (DataCategory | 'Financial')[] = [];

  for (const [category, accessLevel] of Object.entries(permissions.data) as [keyof DataPermissions, AccessLevel][]) {
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

/**
 * Get metric-level access rules for a permission group and data category
 */
export async function getMetricAccessRules(permissionGroupId: string, dataCategory: DataCategory | 'Financial'): Promise<MetricAccessRule[]> {
  try {
    const dataAccessRule = await prisma.dataAccessRule.findUnique({
      where: {
        permissionGroupId_dataCategory: {
          permissionGroupId,
          dataCategory,
        }
      },
      include: {
        metricAccessRules: true
      }
    });

    if (!dataAccessRule?.metricAccessRules) {
      return [];
    }

    return dataAccessRule.metricAccessRules.map(rule => ({
      metricName: rule.metricName,
      accessLevel: rule.accessLevel as AccessLevel,
      deniedReason: rule.deniedReason || undefined
    }));
  } catch (error) {
    console.error('Failed to get metric access rules:', error);
    return [];
  }
}

/**
 * Set metric-level access rule for a specific metric within a data category
 */
export async function setMetricAccessRule(
  permissionGroupId: string,
  dataCategory: DataCategory | 'Financial',
  metricName: string,
  accessLevel: AccessLevel,
  deniedReason?: string,
  updatedBy?: string
): Promise<void> {
  try {
    // Ensure DataAccessRule exists
    const dataAccessRule = await prisma.dataAccessRule.upsert({
      where: {
        permissionGroupId_dataCategory: {
          permissionGroupId,
          dataCategory,
        }
      },
      update: {},
      create: {
        permissionGroupId,
        dataCategory,
        accessLevel: 'NONE', // Default to NONE, specific metrics can have different levels
      }
    });

    // Upsert the metric access rule
    await prisma.metricAccessRule.upsert({
      where: {
        dataAccessRuleId_metricName: {
          dataAccessRuleId: dataAccessRule.id,
          metricName,
        }
      },
      update: {
        accessLevel,
        deniedReason,
      },
      create: {
        dataAccessRuleId: dataAccessRule.id,
        metricName,
        accessLevel,
        deniedReason,
      }
    });

    // Log the change
    if (updatedBy) {
      await logPermissionChange(
        updatedBy,
        'metric_permission.update',
        'USER_PERMISSION',
        `${permissionGroupId}:${dataCategory}:${metricName}`,
        { permissionGroupId, dataCategory, metricName, accessLevel, deniedReason }
      );
    }
  } catch (error) {
    console.error('Failed to set metric access rule:', error);
    throw new Error('Failed to set metric access rule');
  }
}

/**
 * Enhanced data source access check with metric-level granularity
 */
export async function canAccessDataSourceWithMetrics(user: SessionUser, source: string): Promise<MetricPermissionCheck> {
  try {
    const metricCheck = await checkMetricAccess(user, source);
    if (!metricCheck.hasAccess) {
      return metricCheck;
    }

    // If user has category-level access, check for metric-level restrictions
    const assignments = await prisma.userPermissionAssignment.findMany({
      where: { userId: user.id },
      include: {
        permissionGroup: {
          include: {
            dataAccessRules: {
              where: {
                dataCategory: metricCheck.category || 'Operations'
              },
              include: {
                metricAccessRules: {
                  where: {
                    metricName: source
                  }
                }
              }
            }
          }
        }
      }
    });

    // Check if any permission group has a specific metric restriction
    for (const assignment of assignments) {
      for (const dataRule of assignment.permissionGroup.dataAccessRules) {
        for (const metricRule of dataRule.metricAccessRules) {
          if (metricRule.accessLevel === 'NONE') {
            return {
              hasAccess: false,
              accessLevel: 'NONE',
              isRestricted: true,
              deniedReason: metricRule.deniedReason || `Access denied to specific metric '${source}'. Contact your administrator.`,
              category: metricCheck.category
            };
          }
          if (metricRule.accessLevel === 'FILTERED') {
            return {
              hasAccess: true,
              accessLevel: 'FILTERED',
              isRestricted: true,
              deniedReason: undefined,
              category: metricCheck.category
            };
          }
        }
      }
    }

    return metricCheck;
  } catch (error) {
    console.error('Error checking metric-level access:', error);
    return {
      hasAccess: false,
      accessLevel: 'NONE',
      isRestricted: true,
      deniedReason: 'Error checking permissions. Contact your administrator.',
    };
  }
}

/**
 * Validate widget configuration for data access compliance
 */
export interface WidgetValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export async function validateWidgetDataAccess(
  user: SessionUser,
  dataSource: string
): Promise<WidgetValidationResult> {
  const result: WidgetValidationResult = {
    isValid: true,
    errors: [],
    warnings: []
  };

  if (!dataSource || dataSource.trim() === '') {
    return result; // Empty data source is valid (can be set later)
  }

  try {
    const metricCheck = await canAccessDataSourceWithMetrics(user, dataSource);

    if (!metricCheck.hasAccess) {
      result.isValid = false;
      result.errors.push(
        metricCheck.deniedReason ||
        `Access denied to data source '${dataSource}'. Contact your administrator to request access.`
      );
    } else if (metricCheck.accessLevel === 'FILTERED') {
      result.warnings.push(
        `Data source '${dataSource}' has filtered access - only aggregate data will be available.`
      );
    }

    return result;
  } catch (error) {
    result.isValid = false;
    result.errors.push('Error validating data access permissions. Please try again.');
    return result;
  }
}

/**
 * Get user-friendly restriction explanation for a data source
 */
export async function getDataSourceRestrictionExplanation(
  user: SessionUser,
  dataSource: string
): Promise<string | null> {
  const metricCheck = await canAccessDataSourceWithMetrics(user, dataSource);

  if (metricCheck.hasAccess) {
    return null; // No restrictions
  }

  if (metricCheck.category === 'Financial') {
    return 'This financial data is restricted. Contact your administrator to request access to Financial data category.';
  }

  if (metricCheck.category) {
    return `This data is part of the ${metricCheck.category} category, which is restricted for your role. Contact your administrator to request access.`;
  }

  return metricCheck.deniedReason || 'Access to this data source is restricted. Contact your administrator.';
}