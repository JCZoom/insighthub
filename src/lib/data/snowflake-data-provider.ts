import { isSnowflakeConfigured } from '../snowflake/config';
import { executeQueryWithRLS } from '../snowflake/row-level-security';
import { applyDataSecurity } from '../snowflake/data-security';
import { getSnowflakeDataSources } from '../snowflake/schema';
import { queryData as querySampleData, getAvailableSources } from './sample-data';
import type { SessionUser } from '@/lib/auth/session';
import type { SampleDataResult } from './sample-data';
import type { DataSource } from '@/types/data-explorer';

export interface DataQueryOptions {
  useCache?: boolean;
  cacheTTL?: number;
  applyRLS?: boolean;
  applySecurity?: boolean;
  limit?: number;
}

export interface DataProviderResult {
  data: Record<string, unknown>[];
  columns: Array<{ name: string; type: string }>;
  executionTime: number;
  totalRows: number;
  fromCache: boolean;
  dataSource: 'snowflake' | 'sample';
  accessLevel?: 'FULL' | 'FILTERED' | 'NONE';
  isFiltered?: boolean;
  appliedPolicies?: string[];
}

export class SnowflakeDataProvider {
  /**
   * Check if Snowflake is available
   */
  static isSnowflakeAvailable(): boolean {
    return isSnowflakeConfigured();
  }

  /**
   * Query data from either Snowflake or sample data based on availability
   */
  static async queryData(
    source: string,
    user: SessionUser,
    groupBy?: string[],
    options: DataQueryOptions = {}
  ): Promise<DataProviderResult> {
    const startTime = Date.now();

    if (this.isSnowflakeAvailable()) {
      return this.querySnowflake(source, user, groupBy, options);
    } else {
      return this.querySampleData(source, user, groupBy, options);
    }
  }

  /**
   * Query Snowflake with all security features
   */
  private static async querySnowflake(
    source: string,
    user: SessionUser,
    groupBy?: string[],
    options: DataQueryOptions = {}
  ): Promise<DataProviderResult> {
    try {
      // Build SQL query based on source and groupBy parameters
      let sql = this.buildSnowflakeQuery(source, groupBy, options);

      // Execute the query with or without RLS
      let result;
      if (options.applyRLS !== false) {
        // Apply RLS and execute
        result = await executeQueryWithRLS(user, sql, undefined, source);
      } else {
        // Use the secure query executor directly without RLS
        const { executeSecureQuery } = await import('../snowflake/query-executor');
        result = await executeSecureQuery(sql, undefined, {
          userId: user.id,
          useCache: options.useCache,
          cacheTTL: options.cacheTTL
        });
      }

      // Apply data-level security (column masking) if enabled
      let securedData = result.rows;
      if (options.applySecurity !== false && result.rows.length > 0) {
        const columnMetadata = result.columns.map(col => ({
          name: col.name,
          type: col.type,
          sampleValues: result.rows.slice(0, 10).map(row => row[col.name])
        }));

        securedData = await applyDataSecurity(user, result.rows, columnMetadata);
      }

      return {
        data: securedData,
        columns: result.columns.map(col => ({ name: col.name, type: col.type })),
        executionTime: result.executionTime,
        totalRows: result.totalRows,
        fromCache: result.fromCache,
        dataSource: 'snowflake',
        accessLevel: 'FULL', // Would be determined by security checks
        isFiltered: false,
        appliedPolicies: [] // Would include RLS policy names
      };

    } catch (error) {
      console.error('Snowflake query failed, falling back to sample data:', error);
      return this.querySampleData(source, user, groupBy, options);
    }
  }

  /**
   * Query sample data as fallback
   */
  private static async querySampleData(
    source: string,
    user: SessionUser,
    groupBy?: string[],
    options: DataQueryOptions = {}
  ): Promise<DataProviderResult> {
    const startTime = Date.now();

    const result = await querySampleData(source, groupBy, user);

    const executionTime = Date.now() - startTime;

    // Convert SampleDataResult to DataProviderResult
    return {
      data: result.data,
      columns: result.columns.map(name => ({ name, type: 'string' })), // Sample data doesn't have type info
      executionTime,
      totalRows: result.data.length,
      fromCache: false,
      dataSource: 'sample',
      accessLevel: result.accessDenied ? 'NONE' : 'FULL',
      isFiltered: result.accessDenied || false
    };
  }

  /**
   * Build Snowflake SQL query from source and parameters
   */
  private static buildSnowflakeQuery(
    source: string,
    groupBy?: string[],
    options: DataQueryOptions = {}
  ): string {
    // Map source names to actual Snowflake tables
    const tableMapping: Record<string, string> = {
      'kpi_summary': 'analytics.kpi_summary',
      'mrr_by_month': 'analytics.monthly_revenue',
      'churn_by_region': 'analytics.customer_churn',
      'tickets_by_category': 'support.ticket_summary',
      'customers_by_plan': 'customers.subscription_summary',
      // Add more mappings as needed
    };

    const tableName = tableMapping[source] || source;
    const limit = options.limit || 10000;

    let sql = `SELECT * FROM ${tableName}`;

    if (groupBy && groupBy.length > 0) {
      // Add GROUP BY clause if specified
      const groupColumns = groupBy.join(', ');
      sql = `SELECT ${groupColumns}, COUNT(*) as count FROM ${tableName} GROUP BY ${groupColumns}`;
    }

    sql += ` LIMIT ${limit}`;

    return sql;
  }

  /**
   * Get available data sources from either Snowflake or sample data
   */
  static async getDataSources(user: SessionUser): Promise<DataSource[]> {
    if (this.isSnowflakeAvailable()) {
      try {
        return await getSnowflakeDataSources(user);
      } catch (error) {
        console.error('Failed to get Snowflake data sources:', error);
        // Fallback to sample data sources
        return this.getSampleDataSources(user);
      }
    } else {
      return this.getSampleDataSources(user);
    }
  }

  /**
   * Convert sample data sources to DataSource format
   */
  private static async getSampleDataSources(user: SessionUser): Promise<DataSource[]> {
    const sources = getAvailableSources();

    // Group sources by category
    const categories: Record<string, string[]> = {
      'Analytics': sources.filter(s => s.includes('kpi') || s.includes('summary')),
      'Revenue': sources.filter(s => s.includes('revenue') || s.includes('mrr')),
      'Customers': sources.filter(s => s.includes('customer') || s.includes('churn')),
      'Support': sources.filter(s => s.includes('ticket')),
      'Sales': sources.filter(s => s.includes('deal') || s.includes('sales')),
      'Product': sources.filter(s => s.includes('usage') || s.includes('feature'))
    };

    const dataSources: DataSource[] = [];

    for (const [category, categorySources] of Object.entries(categories)) {
      if (categorySources.length > 0) {
        const tables = categorySources.map(source => ({
          name: source,
          displayName: source.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          description: `Sample ${source} data`,
          columns: [], // Would need to be populated from sample data structure
          isAccessible: true,
          rowCount: 1000 // Mock row count
        }));

        dataSources.push({
          name: `Sample_${category}`,
          displayName: `${category} (Sample Data)`,
          description: `Sample ${category.toLowerCase()} data for demonstration`,
          category,
          isAccessible: true,
          tables,
          lastUpdated: new Date()
        });
      }
    }

    return dataSources;
  }

  /**
   * Get health status of data providers
   */
  static async getHealthStatus(): Promise<{
    snowflake: {
      available: boolean;
      healthy?: boolean;
      error?: string;
      stats?: any;
    };
    sampleData: {
      available: boolean;
      sourceCount: number;
    };
    activeProvider: 'snowflake' | 'sample';
  }> {
    const snowflakeStatus = {
      available: this.isSnowflakeAvailable(),
      healthy: undefined as boolean | undefined,
      error: undefined as string | undefined,
      stats: undefined as any
    };

    if (snowflakeStatus.available) {
      try {
        // Test Snowflake connection
        const health = await import('../snowflake/connection').then(m => m.checkSnowflakeHealth());
        snowflakeStatus.healthy = health.isHealthy;
        snowflakeStatus.error = health.error;
        snowflakeStatus.stats = health.stats;
      } catch (error) {
        snowflakeStatus.healthy = false;
        snowflakeStatus.error = error instanceof Error ? error.message : 'Unknown error';
      }
    }

    return {
      snowflake: snowflakeStatus,
      sampleData: {
        available: true,
        sourceCount: getAvailableSources().length
      },
      activeProvider: snowflakeStatus.available && snowflakeStatus.healthy ? 'snowflake' : 'sample'
    };
  }
}

/**
 * Main function to query data with automatic provider selection
 */
export async function queryDataWithProvider(
  source: string,
  user: SessionUser,
  groupBy?: string[],
  options?: DataQueryOptions
): Promise<DataProviderResult> {
  return SnowflakeDataProvider.queryData(source, user, groupBy, options);
}

/**
 * Get available data sources with automatic provider selection
 */
export async function getDataSourcesWithProvider(user: SessionUser): Promise<DataSource[]> {
  return SnowflakeDataProvider.getDataSources(user);
}

/**
 * Get data provider health status
 */
export async function getDataProviderHealth() {
  return SnowflakeDataProvider.getHealthStatus();
}