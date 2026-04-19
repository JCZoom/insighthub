import { executeSecureQuery, type SnowflakeQueryExecutor } from './query-executor';
import { type SessionUser } from '@/lib/auth/session';
import { canAccessDataSourceWithMetrics, resolveUserPermissions, type AccessLevel, type DataCategory } from '@/lib/auth/permissions';

export type DataSensitivityLevel = 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED' | 'PII' | 'FINANCIAL';

export interface DataTag {
  id: string;
  name: string;
  level: DataSensitivityLevel;
  description: string;
  color: string;
  requiresApproval: boolean;
  maskingRules?: DataMaskingRule[];
  createdAt: Date;
  updatedAt: Date;
}

export interface DataMaskingRule {
  id: string;
  tagId: string;
  columnPattern: string; // Regex pattern for column names
  maskingType: 'FULL_MASK' | 'PARTIAL_MASK' | 'HASH' | 'REDACT' | 'NULL';
  maskingChar?: string; // For PARTIAL_MASK and FULL_MASK
  preserveLength?: boolean;
  preserveFormat?: boolean; // For email, phone, etc.
  showLastN?: number; // For PARTIAL_MASK - show last N characters
  showFirstN?: number; // For PARTIAL_MASK - show first N characters
}

export interface ColumnSecurityMetadata {
  database: string;
  schema: string;
  table: string;
  column: string;
  tags: DataTag[];
  accessLevel: AccessLevel;
  maskingRules: DataMaskingRule[];
  deniedReason?: string;
  lastUpdated: Date;
}

export interface TableSecurityMetadata {
  database: string;
  schema: string;
  table: string;
  tags: DataTag[];
  accessLevel: AccessLevel;
  rowLevelSecurity: RowLevelSecurityRule[];
  deniedReason?: string;
  lastUpdated: Date;
}

export interface RowLevelSecurityRule {
  id: string;
  name: string;
  condition: string; // SQL condition
  userGroups: string[]; // Which user groups this rule applies to
  description?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Default data tags for common sensitivity levels
 */
export const DEFAULT_DATA_TAGS: DataTag[] = [
  {
    id: 'public',
    name: 'Public',
    level: 'PUBLIC',
    description: 'Data that can be freely shared externally',
    color: '#10B981',
    requiresApproval: false,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 'internal',
    name: 'Internal',
    level: 'INTERNAL',
    description: 'Data for internal company use only',
    color: '#3B82F6',
    requiresApproval: false,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 'confidential',
    name: 'Confidential',
    level: 'CONFIDENTIAL',
    description: 'Sensitive business data requiring authorized access',
    color: '#F59E0B',
    requiresApproval: true,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 'pii',
    name: 'Personal Information',
    level: 'PII',
    description: 'Personally identifiable information',
    color: '#EF4444',
    requiresApproval: true,
    maskingRules: [
      {
        id: 'pii_email_mask',
        tagId: 'pii',
        columnPattern: '.*email.*',
        maskingType: 'PARTIAL_MASK',
        maskingChar: '*',
        preserveFormat: true,
        showLastN: 3
      },
      {
        id: 'pii_phone_mask',
        tagId: 'pii',
        columnPattern: '.*phone.*|.*tel.*',
        maskingType: 'PARTIAL_MASK',
        maskingChar: '*',
        showLastN: 4
      },
      {
        id: 'pii_name_mask',
        tagId: 'pii',
        columnPattern: '.*name.*|.*first.*|.*last.*',
        maskingType: 'PARTIAL_MASK',
        maskingChar: '*',
        showFirstN: 1,
        showLastN: 1
      }
    ],
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 'financial',
    name: 'Financial Data',
    level: 'FINANCIAL',
    description: 'Financial information and revenue data',
    color: '#DC2626',
    requiresApproval: true,
    maskingRules: [
      {
        id: 'financial_amount_mask',
        tagId: 'financial',
        columnPattern: '.*amount.*|.*revenue.*|.*salary.*|.*price.*',
        maskingType: 'PARTIAL_MASK',
        maskingChar: '*',
        showLastN: 2
      }
    ],
    createdAt: new Date(),
    updatedAt: new Date()
  }
];

export class DataSecurityManager {
  private tags: Map<string, DataTag> = new Map();

  constructor() {
    // Initialize with default tags
    for (const tag of DEFAULT_DATA_TAGS) {
      this.tags.set(tag.id, tag);
    }
  }

  /**
   * Auto-detect data sensitivity based on column names and data patterns
   */
  autoDetectSensitivity(columnName: string, dataType: string, sampleValues?: any[]): DataTag[] {
    const detectedTags: DataTag[] = [];
    const columnLower = columnName.toLowerCase();

    // PII detection patterns
    const piiPatterns = [
      /email/,
      /phone|tel/,
      /ssn|social/,
      /first_?name|fname/,
      /last_?name|lname/,
      /full_?name/,
      /address/,
      /birth|dob/,
      /passport/,
      /license/
    ];

    // Financial data patterns
    const financialPatterns = [
      /amount|revenue|income|salary|wage|payment|price|cost|fee/,
      /balance|credit|debit|account/,
      /mrr|arr/,
      /commission|bonus/
    ];

    // Check for PII patterns
    if (piiPatterns.some(pattern => pattern.test(columnLower))) {
      const piiTag = this.tags.get('pii');
      if (piiTag) detectedTags.push(piiTag);
    }

    // Check for financial patterns
    if (financialPatterns.some(pattern => pattern.test(columnLower))) {
      const financialTag = this.tags.get('financial');
      if (financialTag) detectedTags.push(financialTag);
    }

    // Sample value analysis
    if (sampleValues && sampleValues.length > 0) {
      const stringValues = sampleValues.filter(v => typeof v === 'string');

      // Email pattern detection
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const hasEmails = stringValues.some(v => emailRegex.test(v));
      if (hasEmails) {
        const piiTag = this.tags.get('pii');
        if (piiTag && !detectedTags.includes(piiTag)) detectedTags.push(piiTag);
      }

      // Phone number pattern detection
      const phoneRegex = /^\+?[\d\s\-\(\)]{10,}$/;
      const hasPhones = stringValues.some(v => phoneRegex.test(v));
      if (hasPhones) {
        const piiTag = this.tags.get('pii');
        if (piiTag && !detectedTags.includes(piiTag)) detectedTags.push(piiTag);
      }
    }

    // Default to internal if no specific tags detected
    if (detectedTags.length === 0) {
      const internalTag = this.tags.get('internal');
      if (internalTag) detectedTags.push(internalTag);
    }

    return detectedTags;
  }

  /**
   * Get appropriate masking rule for a column
   */
  getMaskingRuleForColumn(columnName: string, tags: DataTag[]): DataMaskingRule | null {
    for (const tag of tags) {
      if (tag.maskingRules) {
        for (const rule of tag.maskingRules) {
          const pattern = new RegExp(rule.columnPattern, 'i');
          if (pattern.test(columnName)) {
            return rule;
          }
        }
      }
    }
    return null;
  }

  /**
   * Apply data masking to a value based on masking rules
   */
  applyMasking(value: any, maskingRule: DataMaskingRule): any {
    if (value === null || value === undefined) {
      return value;
    }

    const stringValue = String(value);

    switch (maskingRule.maskingType) {
      case 'NULL':
        return null;

      case 'REDACT':
        return '[REDACTED]';

      case 'HASH':
        // In a real implementation, you'd use a proper hashing function
        const crypto = require('crypto');
        return crypto.createHash('sha256').update(stringValue).digest('hex').substring(0, 8);

      case 'FULL_MASK':
        return (maskingRule.maskingChar || '*').repeat(
          maskingRule.preserveLength ? stringValue.length : 8
        );

      case 'PARTIAL_MASK':
        const maskChar = maskingRule.maskingChar || '*';
        const showFirst = maskingRule.showFirstN || 0;
        const showLast = maskingRule.showLastN || 0;

        if (stringValue.length <= showFirst + showLast) {
          return maskChar.repeat(stringValue.length);
        }

        const firstPart = stringValue.substring(0, showFirst);
        const lastPart = stringValue.substring(stringValue.length - showLast);
        const middleLength = stringValue.length - showFirst - showLast;

        let maskedMiddle = maskChar.repeat(middleLength);

        // Preserve format for emails and similar patterns
        if (maskingRule.preserveFormat) {
          const emailMatch = stringValue.match(/^(.*)@(.*)$/);
          if (emailMatch) {
            const [, localPart, domain] = emailMatch;
            const maskedLocal = this.applyMasking(localPart, {
              ...maskingRule,
              preserveFormat: false
            });
            return `${maskedLocal}@${domain}`;
          }
        }

        return firstPart + maskedMiddle + lastPart;

      default:
        return value;
    }
  }

  /**
   * Check if a user can access data with specific tags
   */
  async checkTagAccess(user: SessionUser, tags: DataTag[]): Promise<{
    hasAccess: boolean;
    accessLevel: AccessLevel;
    deniedReason?: string;
    requiredMasking: DataMaskingRule[];
  }> {
    const permissions = await resolveUserPermissions(user);
    const requiredMasking: DataMaskingRule[] = [];

    // Find the highest sensitivity level
    const sensitivityHierarchy: DataSensitivityLevel[] = [
      'PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED', 'PII', 'FINANCIAL'
    ];

    const maxSensitivityLevel = tags.reduce((max, tag) => {
      const currentIndex = sensitivityHierarchy.indexOf(tag.level);
      const maxIndex = sensitivityHierarchy.indexOf(max);
      return currentIndex > maxIndex ? tag.level : max;
    }, 'PUBLIC' as DataSensitivityLevel);

    // Check permissions based on sensitivity level and data category
    let hasAccess = true;
    let accessLevel: AccessLevel = 'FULL';
    let deniedReason: string | undefined;

    if (maxSensitivityLevel === 'PII') {
      if (permissions.data.CustomerPII === 'NONE') {
        hasAccess = false;
        deniedReason = 'Access denied to personally identifiable information (PII)';
      } else if (permissions.data.CustomerPII === 'FILTERED') {
        accessLevel = 'FILTERED';
        // Add masking rules for PII
        for (const tag of tags) {
          if (tag.level === 'PII' && tag.maskingRules) {
            requiredMasking.push(...tag.maskingRules);
          }
        }
      }
    } else if (maxSensitivityLevel === 'FINANCIAL') {
      if (permissions.data.Financial === 'NONE') {
        hasAccess = false;
        deniedReason = 'Access denied to financial data';
      } else if (permissions.data.Financial === 'FILTERED') {
        accessLevel = 'FILTERED';
        // Add masking rules for financial data
        for (const tag of tags) {
          if (tag.level === 'FINANCIAL' && tag.maskingRules) {
            requiredMasking.push(...tag.maskingRules);
          }
        }
      }
    } else if (maxSensitivityLevel === 'CONFIDENTIAL' || maxSensitivityLevel === 'RESTRICTED') {
      if (!permissions.features.canAccessSensitiveData) {
        hasAccess = false;
        deniedReason = 'Access denied to confidential/restricted data';
      }
    }

    return {
      hasAccess,
      accessLevel,
      deniedReason,
      requiredMasking
    };
  }

  /**
   * Apply data security rules to query results
   */
  async applySecurityToResults(
    user: SessionUser,
    results: any[],
    columnMetadata: Array<{ name: string; tags: DataTag[] }>
  ): Promise<any[]> {
    if (results.length === 0) return results;

    const securedResults = [];

    for (const row of results) {
      const securedRow: any = {};

      for (const [columnName, value] of Object.entries(row)) {
        const metadata = columnMetadata.find(m => m.name.toLowerCase() === columnName.toLowerCase());

        if (!metadata || metadata.tags.length === 0) {
          // No tags, allow access
          securedRow[columnName] = value;
          continue;
        }

        const tagAccess = await this.checkTagAccess(user, metadata.tags);

        if (!tagAccess.hasAccess) {
          securedRow[columnName] = '[REDACTED]';
          continue;
        }

        if (tagAccess.requiredMasking.length > 0) {
          // Apply masking
          const maskingRule = this.getMaskingRuleForColumn(columnName, metadata.tags);
          if (maskingRule) {
            securedRow[columnName] = this.applyMasking(value, maskingRule);
          } else {
            securedRow[columnName] = value;
          }
        } else {
          securedRow[columnName] = value;
        }
      }

      securedResults.push(securedRow);
    }

    return securedResults;
  }

  /**
   * Get security metadata for a table
   */
  async getTableSecurityMetadata(
    user: SessionUser,
    database: string,
    schema: string,
    table: string
  ): Promise<TableSecurityMetadata> {
    // In a real implementation, this would fetch from a metadata store
    // For now, we'll auto-detect based on column patterns

    const autoDetectedTags = this.autoDetectSensitivity(table, 'table');
    const tagAccess = await this.checkTagAccess(user, autoDetectedTags);

    return {
      database,
      schema,
      table,
      tags: autoDetectedTags,
      accessLevel: tagAccess.accessLevel,
      rowLevelSecurity: [], // Would be fetched from metadata store
      deniedReason: tagAccess.deniedReason,
      lastUpdated: new Date()
    };
  }

  /**
   * Get security metadata for columns
   */
  async getColumnSecurityMetadata(
    user: SessionUser,
    database: string,
    schema: string,
    table: string,
    columns: Array<{ name: string; dataType: string; sampleValues?: any[] }>
  ): Promise<ColumnSecurityMetadata[]> {
    const columnMetadata: ColumnSecurityMetadata[] = [];

    for (const column of columns) {
      const autoDetectedTags = this.autoDetectSensitivity(
        column.name,
        column.dataType,
        column.sampleValues
      );
      const tagAccess = await this.checkTagAccess(user, autoDetectedTags);

      columnMetadata.push({
        database,
        schema,
        table,
        column: column.name,
        tags: autoDetectedTags,
        accessLevel: tagAccess.accessLevel,
        maskingRules: tagAccess.requiredMasking,
        deniedReason: tagAccess.deniedReason,
        lastUpdated: new Date()
      });
    }

    return columnMetadata;
  }
}

// Global data security manager instance
let dataSecurityManager: DataSecurityManager | null = null;

/**
 * Get the global data security manager
 */
export function getDataSecurityManager(): DataSecurityManager {
  if (!dataSecurityManager) {
    dataSecurityManager = new DataSecurityManager();
  }
  return dataSecurityManager;
}

/**
 * Apply data security to Snowflake query results
 */
export async function applyDataSecurity(
  user: SessionUser,
  results: any[],
  columnMetadata: Array<{ name: string; type: string; sampleValues?: any[] }>
): Promise<any[]> {
  const securityManager = getDataSecurityManager();

  // Convert column metadata to include tags
  const columnsWithTags = columnMetadata.map(col => ({
    name: col.name,
    tags: securityManager.autoDetectSensitivity(col.name, col.type, col.sampleValues)
  }));

  return securityManager.applySecurityToResults(user, results, columnsWithTags);
}