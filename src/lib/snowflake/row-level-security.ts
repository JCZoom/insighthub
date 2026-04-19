import { executeSecureQuery } from './query-executor';
import { type SessionUser } from '@/lib/auth/session';
import { resolveUserPermissions } from '@/lib/auth/permissions';

export interface RowLevelSecurityPolicy {
  id: string;
  name: string;
  description: string;
  targetTable: string;
  targetDatabase?: string;
  targetSchema?: string;
  condition: string; // SQL WHERE condition
  userGroups: string[]; // Which user groups this policy applies to
  userRoles: string[]; // Which user roles this policy applies to
  departments: string[]; // Which departments this policy applies to
  isActive: boolean;
  priority: number; // Higher priority policies override lower ones
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

export interface RowLevelSecurityContext {
  userId: string;
  userRole: string;
  department?: string;
  permissionGroups: string[];
  region?: string;
  customAttributes?: Record<string, any>;
}

export interface QueryWithRLS {
  originalQuery: string;
  modifiedQuery: string;
  appliedPolicies: RowLevelSecurityPolicy[];
  securityContext: RowLevelSecurityContext;
}

/**
 * Default RLS policies for common scenarios
 */
export const DEFAULT_RLS_POLICIES: RowLevelSecurityPolicy[] = [
  {
    id: 'pii_department_isolation',
    name: 'PII Department Isolation',
    description: 'Users can only access PII data for their own department',
    targetTable: '*', // Applies to all tables with department column
    condition: 'department = :user_department OR :user_role = \'ADMIN\'',
    userGroups: ['VIEWER', 'CREATOR'],
    userRoles: ['VIEWER', 'CREATOR', 'POWER_USER'],
    departments: ['*'],
    isActive: true,
    priority: 100,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: 'system'
  },
  {
    id: 'financial_data_regional',
    name: 'Financial Data Regional Restriction',
    description: 'Users can only access financial data for their region unless they have financial permissions',
    targetTable: '*revenue*,*financial*,*payment*,*billing*',
    condition: 'region = :user_region OR :has_financial_access = true',
    userGroups: ['VIEWER', 'CREATOR'],
    userRoles: ['VIEWER', 'CREATOR'],
    departments: ['*'],
    isActive: true,
    priority: 90,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: 'system'
  },
  {
    id: 'customer_data_assigned_only',
    name: 'Customer Data - Assigned Only',
    description: 'Customer service reps can only see customers assigned to them',
    targetTable: '*customer*',
    condition: 'assigned_to = :user_id OR account_manager = :user_email OR :user_role IN (\'ADMIN\', \'POWER_USER\')',
    userGroups: ['VIEWER'],
    userRoles: ['VIEWER'],
    departments: ['Support', 'Customer Success'],
    isActive: true,
    priority: 80,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: 'system'
  },
  {
    id: 'time_based_data_access',
    name: 'Time-based Data Access',
    description: 'Non-admin users can only access data from the last 2 years',
    targetTable: '*',
    condition: ':user_role = \'ADMIN\' OR created_at >= DATEADD(year, -2, CURRENT_DATE()) OR updated_at >= DATEADD(year, -2, CURRENT_DATE())',
    userGroups: ['VIEWER', 'CREATOR'],
    userRoles: ['VIEWER', 'CREATOR'],
    departments: ['*'],
    isActive: true,
    priority: 10, // Low priority, applies broadly
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: 'system'
  }
];

export class RowLevelSecurityManager {
  private policies: Map<string, RowLevelSecurityPolicy> = new Map();

  constructor() {
    // Initialize with default policies
    for (const policy of DEFAULT_RLS_POLICIES) {
      this.policies.set(policy.id, policy);
    }
  }

  /**
   * Build security context for a user
   */
  async buildSecurityContext(user: SessionUser): Promise<RowLevelSecurityContext> {
    const permissions = await resolveUserPermissions(user);

    return {
      userId: user.id,
      userRole: user.role,
      department: user.department || undefined,
      permissionGroups: [], // Would be derived from user assignments
      region: undefined, // Would be derived from user profile
      customAttributes: {
        email: user.email,
        hasFinancialAccess: permissions.data.Financial !== 'NONE',
        hasPiiAccess: permissions.data.CustomerPII !== 'NONE',
        canAccessSensitiveData: permissions.features.canAccessSensitiveData
      }
    };
  }

  /**
   * Check if a policy applies to a table
   */
  private doesPolicyApplyToTable(policy: RowLevelSecurityPolicy, tableName: string): boolean {
    if (policy.targetTable === '*') return true;

    const patterns = policy.targetTable.split(',').map(p => p.trim());

    return patterns.some(pattern => {
      if (pattern === '*') return true;

      // Convert wildcard pattern to regex
      const regexPattern = pattern
        .replace(/\*/g, '.*')
        .replace(/\?/g, '.');

      const regex = new RegExp(`^${regexPattern}$`, 'i');
      return regex.test(tableName);
    });
  }

  /**
   * Check if a policy applies to a user
   */
  private doesPolicyApplyToUser(
    policy: RowLevelSecurityPolicy,
    context: RowLevelSecurityContext
  ): boolean {
    // Check user roles
    if (policy.userRoles.length > 0 && !policy.userRoles.includes(context.userRole)) {
      return false;
    }

    // Check departments
    if (policy.departments.length > 0 && !policy.departments.includes('*')) {
      if (!context.department || !policy.departments.includes(context.department)) {
        return false;
      }
    }

    // Check permission groups
    if (policy.userGroups.length > 0) {
      const hasMatchingGroup = policy.userGroups.some(group =>
        context.permissionGroups.includes(group)
      );
      if (!hasMatchingGroup && !policy.userGroups.includes(context.userRole)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get applicable policies for a table and user context
   */
  getApplicablePolicies(
    tableName: string,
    context: RowLevelSecurityContext
  ): RowLevelSecurityPolicy[] {
    const applicablePolicies: RowLevelSecurityPolicy[] = [];

    for (const policy of this.policies.values()) {
      if (!policy.isActive) continue;

      if (this.doesPolicyApplyToTable(policy, tableName) &&
          this.doesPolicyApplyToUser(policy, context)) {
        applicablePolicies.push(policy);
      }
    }

    // Sort by priority (higher first)
    return applicablePolicies.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Substitute parameters in a policy condition
   */
  private substituteParameters(
    condition: string,
    context: RowLevelSecurityContext
  ): string {
    let substituted = condition;

    // Basic parameter substitutions
    const substitutions: Record<string, any> = {
      ':user_id': `'${context.userId}'`,
      ':user_role': `'${context.userRole}'`,
      ':user_department': context.department ? `'${context.department}'` : 'NULL',
      ':user_region': context.region ? `'${context.region}'` : 'NULL',
      ':user_email': context.customAttributes?.email ? `'${context.customAttributes.email}'` : 'NULL',
      ':has_financial_access': context.customAttributes?.hasFinancialAccess ? 'true' : 'false',
      ':has_pii_access': context.customAttributes?.hasPiiAccess ? 'true' : 'false',
      ':can_access_sensitive_data': context.customAttributes?.canAccessSensitiveData ? 'true' : 'false'
    };

    for (const [param, value] of Object.entries(substitutions)) {
      substituted = substituted.replace(new RegExp(param.replace(':', '\\:'), 'g'), String(value));
    }

    return substituted;
  }

  /**
   * Apply row-level security to a SQL query
   */
  applyRLSToQuery(
    originalQuery: string,
    tableName: string,
    context: RowLevelSecurityContext
  ): QueryWithRLS {
    const policies = this.getApplicablePolicies(tableName, context);

    if (policies.length === 0) {
      return {
        originalQuery,
        modifiedQuery: originalQuery,
        appliedPolicies: [],
        securityContext: context
      };
    }

    // Build combined WHERE conditions from all applicable policies
    const rlsConditions = policies.map(policy => {
      const substitutedCondition = this.substituteParameters(policy.condition, context);
      return `(${substitutedCondition})`;
    });

    // Combine all conditions with AND
    const combinedRLSCondition = rlsConditions.join(' AND ');

    // Parse and modify the query
    let modifiedQuery = originalQuery.trim();

    // Basic query parsing - in a production system, you'd use a proper SQL parser
    const selectMatch = modifiedQuery.match(/^(SELECT\s+.*?\s+FROM\s+[\w.`"]+)(\s+WHERE\s+.*)?$/i);

    if (!selectMatch) {
      // If we can't parse it safely, wrap the entire query
      modifiedQuery = `
        SELECT * FROM (
          ${originalQuery}
        ) AS rls_subquery
        WHERE ${combinedRLSCondition}
      `;
    } else {
      const [, selectPart, wherePart] = selectMatch;

      if (wherePart) {
        // Query already has WHERE clause - add RLS conditions with AND
        modifiedQuery = `${selectPart}${wherePart} AND (${combinedRLSCondition})`;
      } else {
        // No WHERE clause - add one with RLS conditions
        modifiedQuery = `${selectPart} WHERE ${combinedRLSCondition}`;
      }
    }

    return {
      originalQuery,
      modifiedQuery,
      appliedPolicies: policies,
      securityContext: context
    };
  }

  /**
   * Apply RLS to a query for a specific user
   */
  async applyUserRLS(
    user: SessionUser,
    query: string,
    tableName: string
  ): Promise<QueryWithRLS> {
    const context = await this.buildSecurityContext(user);
    return this.applyRLSToQuery(query, tableName, context);
  }

  /**
   * Extract table name from a query (basic implementation)
   */
  extractTableName(query: string): string | null {
    const trimmed = query.trim().toLowerCase();

    // Basic FROM clause extraction
    const fromMatch = trimmed.match(/\bfrom\s+([\w.`"]+)/i);
    if (fromMatch) {
      return fromMatch[1].replace(/[`"]/g, '');
    }

    return null;
  }

  /**
   * Apply RLS to query with automatic table detection
   */
  async applyAutoRLS(user: SessionUser, query: string): Promise<QueryWithRLS> {
    const tableName = this.extractTableName(query);

    if (!tableName) {
      // Can't determine table, return query as-is
      const context = await this.buildSecurityContext(user);
      return {
        originalQuery: query,
        modifiedQuery: query,
        appliedPolicies: [],
        securityContext: context
      };
    }

    return this.applyUserRLS(user, query, tableName);
  }

  /**
   * Add a new RLS policy
   */
  addPolicy(policy: RowLevelSecurityPolicy): void {
    this.policies.set(policy.id, policy);
  }

  /**
   * Remove an RLS policy
   */
  removePolicy(policyId: string): boolean {
    return this.policies.delete(policyId);
  }

  /**
   * Update an RLS policy
   */
  updatePolicy(policyId: string, updates: Partial<RowLevelSecurityPolicy>): boolean {
    const existing = this.policies.get(policyId);
    if (!existing) return false;

    const updated = { ...existing, ...updates, updatedAt: new Date() };
    this.policies.set(policyId, updated);
    return true;
  }

  /**
   * Get all policies
   */
  getAllPolicies(): RowLevelSecurityPolicy[] {
    return Array.from(this.policies.values());
  }

  /**
   * Get policies for a specific table
   */
  getPoliciesForTable(tableName: string): RowLevelSecurityPolicy[] {
    return Array.from(this.policies.values()).filter(policy =>
      this.doesPolicyApplyToTable(policy, tableName)
    );
  }

  /**
   * Test if a user would have access to specific data
   */
  async testUserAccess(
    user: SessionUser,
    tableName: string,
    sampleRowData: Record<string, any>
  ): Promise<{
    hasAccess: boolean;
    deniedByPolicies: RowLevelSecurityPolicy[];
    allowedByPolicies: RowLevelSecurityPolicy[];
  }> {
    const context = await this.buildSecurityContext(user);
    const policies = this.getApplicablePolicies(tableName, context);

    const deniedByPolicies: RowLevelSecurityPolicy[] = [];
    const allowedByPolicies: RowLevelSecurityPolicy[] = [];

    for (const policy of policies) {
      const condition = this.substituteParameters(policy.condition, context);

      // This is a simplified test - in practice, you'd need to evaluate the SQL condition
      // against the sample data. This would require a SQL expression evaluator.
      // For now, we'll make basic checks based on common patterns.

      let conditionMet = false;

      if (condition.includes('department =') && sampleRowData.department) {
        conditionMet = condition.includes(`'${sampleRowData.department}'`);
      } else if (condition.includes('assigned_to =') && sampleRowData.assigned_to) {
        conditionMet = condition.includes(`'${user.id}'`) || condition.includes(`'${user.email}'`);
      } else if (condition.includes('region =') && sampleRowData.region) {
        conditionMet = context.region === sampleRowData.region;
      } else {
        // For complex conditions, assume access is allowed unless we can prove otherwise
        conditionMet = true;
      }

      if (conditionMet) {
        allowedByPolicies.push(policy);
      } else {
        deniedByPolicies.push(policy);
      }
    }

    // Access is granted if all applicable policies allow it
    const hasAccess = deniedByPolicies.length === 0;

    return {
      hasAccess,
      deniedByPolicies,
      allowedByPolicies
    };
  }
}

// Global RLS manager instance
let rlsManager: RowLevelSecurityManager | null = null;

/**
 * Get the global row-level security manager
 */
export function getRLSManager(): RowLevelSecurityManager {
  if (!rlsManager) {
    rlsManager = new RowLevelSecurityManager();
  }
  return rlsManager;
}

/**
 * Apply row-level security to a Snowflake query
 */
export async function applyRowLevelSecurity(
  user: SessionUser,
  query: string,
  tableName?: string
): Promise<QueryWithRLS> {
  const manager = getRLSManager();

  if (tableName) {
    return manager.applyUserRLS(user, query, tableName);
  }

  return manager.applyAutoRLS(user, query);
}

/**
 * Execute a Snowflake query with automatic RLS applied
 */
export async function executeQueryWithRLS<T = any>(
  user: SessionUser,
  query: string,
  parameters?: Record<string, any>,
  tableName?: string
) {
  const rlsResult = await applyRowLevelSecurity(user, query, tableName);

  console.log('Applied RLS policies:', rlsResult.appliedPolicies.map(p => p.name));

  return executeSecureQuery<T>(rlsResult.modifiedQuery, parameters, {
    userId: user.id,
    useCache: true
  });
}