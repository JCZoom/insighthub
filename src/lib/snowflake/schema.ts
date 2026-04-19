import { executeSecureQuery, type SnowflakeQueryResult } from './query-executor';
import { getSnowflakeConfig } from './config';
import type { DataSource, DataTable, DataColumn } from '@/types/data-explorer';
import type { SessionUser } from '@/lib/auth/session';
import { canAccessDataSourceWithMetrics, getCategoryForSource } from '@/lib/auth/permissions';

export interface SnowflakeTableInfo {
  table_catalog: string;
  table_schema: string;
  table_name: string;
  table_type: string;
  row_count?: number;
  bytes?: number;
  created: string;
  last_altered: string;
  comment?: string;
}

export interface SnowflakeColumnInfo {
  table_catalog: string;
  table_schema: string;
  table_name: string;
  column_name: string;
  ordinal_position: number;
  column_default?: string;
  is_nullable: string;
  data_type: string;
  character_maximum_length?: number;
  numeric_precision?: number;
  numeric_scale?: number;
  comment?: string;
}

export interface SnowflakeDatabaseInfo {
  database_name: string;
  database_owner: string;
  is_transient: string;
  comment?: string;
  created: string;
  last_altered: string;
  retention_time: number;
}

export interface SnowflakeSchemaInfo {
  catalog_name: string;
  schema_name: string;
  schema_owner: string;
  is_transient: string;
  is_managed_access: string;
  comment?: string;
  created: string;
  last_altered: string;
  retention_time: number;
}

export class SnowflakeSchemaIntrospector {
  private config = getSnowflakeConfig();

  /**
   * Check if schema introspection is available
   */
  isAvailable(): boolean {
    return this.config !== null;
  }

  /**
   * Get all databases in the Snowflake account
   */
  async getDatabases(): Promise<SnowflakeDatabaseInfo[]> {
    if (!this.isAvailable()) {
      throw new Error('Snowflake is not configured');
    }

    const result = await executeSecureQuery<SnowflakeDatabaseInfo>(`
      SHOW DATABASES
    `, {}, { useCache: true, cacheTTL: 3600 }); // Cache for 1 hour

    return result.rows;
  }

  /**
   * Get all schemas in a database
   */
  async getSchemas(database?: string): Promise<SnowflakeSchemaInfo[]> {
    if (!this.isAvailable()) {
      throw new Error('Snowflake is not configured');
    }

    const targetDatabase = database || this.config!.database;

    const result = await executeSecureQuery<SnowflakeSchemaInfo>(`
      SELECT
        catalog_name,
        schema_name,
        schema_owner,
        is_transient,
        is_managed_access,
        comment,
        created,
        last_altered,
        retention_time
      FROM :database.information_schema.schemata
      WHERE catalog_name = :database
      ORDER BY schema_name
    `, {
      database: targetDatabase
    }, { useCache: true, cacheTTL: 3600 });

    return result.rows;
  }

  /**
   * Get all tables in a schema
   */
  async getTables(database?: string, schema?: string): Promise<SnowflakeTableInfo[]> {
    if (!this.isAvailable()) {
      throw new Error('Snowflake is not configured');
    }

    const targetDatabase = database || this.config!.database;
    const targetSchema = schema || this.config!.schema;

    const result = await executeSecureQuery<SnowflakeTableInfo>(`
      SELECT
        t.table_catalog,
        t.table_schema,
        t.table_name,
        t.table_type,
        t.comment,
        t.created,
        t.last_altered,
        ts.row_count,
        ts.bytes
      FROM :database.information_schema.tables t
      LEFT JOIN :database.information_schema.table_storage_metrics ts
        ON t.table_catalog = ts.table_catalog
        AND t.table_schema = ts.table_schema
        AND t.table_name = ts.table_name
      WHERE t.table_catalog = :database
        AND t.table_schema = :schema
        AND t.table_type IN ('BASE TABLE', 'VIEW')
      ORDER BY t.table_name
    `, {
      database: targetDatabase,
      schema: targetSchema
    }, { useCache: true, cacheTTL: 1800 }); // Cache for 30 minutes

    return result.rows;
  }

  /**
   * Get all columns for a table
   */
  async getColumns(table: string, database?: string, schema?: string): Promise<SnowflakeColumnInfo[]> {
    if (!this.isAvailable()) {
      throw new Error('Snowflake is not configured');
    }

    const targetDatabase = database || this.config!.database;
    const targetSchema = schema || this.config!.schema;

    const result = await executeSecureQuery<SnowflakeColumnInfo>(`
      SELECT
        table_catalog,
        table_schema,
        table_name,
        column_name,
        ordinal_position,
        column_default,
        is_nullable,
        data_type,
        character_maximum_length,
        numeric_precision,
        numeric_scale,
        comment
      FROM :database.information_schema.columns
      WHERE table_catalog = :database
        AND table_schema = :schema
        AND table_name = :table
      ORDER BY ordinal_position
    `, {
      database: targetDatabase,
      schema: targetSchema,
      table: table.toUpperCase()
    }, { useCache: true, cacheTTL: 1800 });

    return result.rows;
  }

  /**
   * Get sample data from a table
   */
  async getSampleData(table: string, limit = 10, database?: string, schema?: string): Promise<SnowflakeQueryResult<any>> {
    if (!this.isAvailable()) {
      throw new Error('Snowflake is not configured');
    }

    const targetDatabase = database || this.config!.database;
    const targetSchema = schema || this.config!.schema;

    return executeSecureQuery(`
      SELECT * FROM :database.:schema.:table
      LIMIT :limit
    `, {
      database: targetDatabase,
      schema: targetSchema,
      table: table.toUpperCase(),
      limit
    }, { useCache: true, cacheTTL: 300 }); // Cache for 5 minutes
  }

  /**
   * Get column statistics and profiling information
   */
  async getColumnProfile(table: string, column: string, database?: string, schema?: string) {
    if (!this.isAvailable()) {
      throw new Error('Snowflake is not configured');
    }

    const targetDatabase = database || this.config!.database;
    const targetSchema = schema || this.config!.schema;

    // Build dynamic SQL based on column type
    const columnInfo = await this.getColumns(table, database, schema);
    const targetColumn = columnInfo.find(c => c.column_name.toLowerCase() === column.toLowerCase());

    if (!targetColumn) {
      throw new Error(`Column ${column} not found in table ${table}`);
    }

    const isNumeric = ['NUMBER', 'DECIMAL', 'NUMERIC', 'INT', 'INTEGER', 'BIGINT', 'SMALLINT', 'TINYINT', 'BYTEINT', 'FLOAT', 'FLOAT4', 'FLOAT8', 'DOUBLE', 'DOUBLE PRECISION', 'REAL'].some(type =>
      targetColumn.data_type.toUpperCase().includes(type)
    );

    const isText = ['VARCHAR', 'CHAR', 'CHARACTER', 'STRING', 'TEXT'].some(type =>
      targetColumn.data_type.toUpperCase().includes(type)
    );

    let profileQuery = `
      SELECT
        COUNT(*) as total_rows,
        COUNT(:column) as non_null_count,
        COUNT(*) - COUNT(:column) as null_count,
        COUNT(DISTINCT :column) as unique_count
    `;

    if (isNumeric) {
      profileQuery += `,
        MIN(:column) as min_value,
        MAX(:column) as max_value,
        AVG(:column) as avg_value,
        STDDEV(:column) as std_dev,
        PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY :column) as p25,
        PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY :column) as p50,
        PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY :column) as p75,
        PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY :column) as p95
      `;
    }

    if (isText) {
      profileQuery += `,
        MIN(LENGTH(:column)) as min_length,
        MAX(LENGTH(:column)) as max_length,
        AVG(LENGTH(:column)) as avg_length
      `;
    }

    profileQuery += ` FROM :database.:schema.:table WHERE :column IS NOT NULL`;

    const result = await executeSecureQuery(profileQuery, {
      database: targetDatabase,
      schema: targetSchema,
      table: table.toUpperCase(),
      column: column.toUpperCase()
    }, { useCache: true, cacheTTL: 900 }); // Cache for 15 minutes

    // Get top values
    const topValuesResult = await executeSecureQuery(`
      SELECT
        :column as value,
        COUNT(*) as count,
        COUNT(*) * 100.0 / (SELECT COUNT(*) FROM :database.:schema.:table) as percentage
      FROM :database.:schema.:table
      WHERE :column IS NOT NULL
      GROUP BY :column
      ORDER BY count DESC
      LIMIT 10
    `, {
      database: targetDatabase,
      schema: targetSchema,
      table: table.toUpperCase(),
      column: column.toUpperCase()
    }, { useCache: true, cacheTTL: 900 });

    return {
      profile: result.rows[0] || {},
      topValues: topValuesResult.rows || []
    };
  }

  /**
   * Build DataSource structure with permissions for a specific user
   */
  async buildDataSourcesWithPermissions(user: SessionUser, database?: string, schema?: string): Promise<DataSource[]> {
    if (!this.isAvailable()) {
      return [];
    }

    const targetDatabase = database || this.config!.database;
    const targetSchema = schema || this.config!.schema;

    try {
      // Get all tables in the schema
      const tables = await this.getTables(targetDatabase, targetSchema);

      const dataTables: DataTable[] = [];

      for (const table of tables) {
        // Check table-level permissions
        const tableAccess = await canAccessDataSourceWithMetrics(user, table.table_name);

        // Get column information
        const columns = await this.getColumns(table.table_name, targetDatabase, targetSchema);

        const dataColumns: DataColumn[] = columns.map(col => ({
          name: col.column_name,
          displayName: col.column_name.toLowerCase().replace(/_/g, ' '),
          type: col.data_type,
          nullable: col.is_nullable === 'YES',
          description: col.comment || undefined,
          isAccessible: tableAccess.hasAccess,
          accessLevel: tableAccess.accessLevel,
          deniedReason: tableAccess.deniedReason,
          isPrimaryKey: false, // Would need additional query to determine this
          isForeignKey: false, // Would need additional query to determine this
          sampleValues: [] // Could be populated with actual sample data
        }));

        dataTables.push({
          name: table.table_name,
          displayName: table.table_name.toLowerCase().replace(/_/g, ' '),
          description: table.comment || `${table.table_type} in ${targetSchema}`,
          rowCount: table.row_count || undefined,
          columns: dataColumns,
          isAccessible: tableAccess.hasAccess,
          accessLevel: tableAccess.accessLevel,
          deniedReason: tableAccess.deniedReason,
          lastUpdated: new Date(table.last_altered)
        });
      }

      // Group tables by category based on naming patterns or metadata
      const categoryMapping: Record<string, DataTable[]> = {
        'Financial': [],
        'Customer': [],
        'Product': [],
        'Operations': [],
        'Other': []
      };

      for (const table of dataTables) {
        const category = getCategoryForSource(table.name) || 'Other';

        if (category === 'Financial') {
          categoryMapping['Financial'].push(table);
        } else if (table.name.toLowerCase().includes('customer') || table.name.toLowerCase().includes('user')) {
          categoryMapping['Customer'].push(table);
        } else if (table.name.toLowerCase().includes('product') || table.name.toLowerCase().includes('feature')) {
          categoryMapping['Product'].push(table);
        } else if (table.name.toLowerCase().includes('operation') || table.name.toLowerCase().includes('process')) {
          categoryMapping['Operations'].push(table);
        } else {
          categoryMapping['Other'].push(table);
        }
      }

      const dataSources: DataSource[] = [];

      for (const [categoryName, categoryTables] of Object.entries(categoryMapping)) {
        if (categoryTables.length > 0) {
          dataSources.push({
            name: `${targetDatabase}.${targetSchema}.${categoryName}`,
            displayName: `${categoryName} (${targetDatabase}.${targetSchema})`,
            description: `${categoryName} tables from Snowflake database ${targetDatabase}, schema ${targetSchema}`,
            category: categoryName,
            isAccessible: categoryTables.some(t => t.isAccessible),
            tables: categoryTables,
            lastUpdated: new Date()
          });
        }
      }

      return dataSources;
    } catch (error) {
      console.error('Error building data sources from Snowflake:', error);
      throw new Error(`Failed to introspect Snowflake schema: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Search tables and columns
   */
  async search(query: string, database?: string, schema?: string): Promise<{
    tables: SnowflakeTableInfo[];
    columns: Array<SnowflakeColumnInfo & { table_name: string }>;
  }> {
    if (!this.isAvailable()) {
      throw new Error('Snowflake is not configured');
    }

    const targetDatabase = database || this.config!.database;
    const targetSchema = schema || this.config!.schema;

    const searchPattern = `%${query.toUpperCase()}%`;

    // Search tables
    const tablesResult = await executeSecureQuery<SnowflakeTableInfo>(`
      SELECT
        table_catalog,
        table_schema,
        table_name,
        table_type,
        comment,
        created,
        last_altered
      FROM :database.information_schema.tables
      WHERE table_catalog = :database
        AND table_schema = :schema
        AND (UPPER(table_name) LIKE :pattern OR UPPER(comment) LIKE :pattern)
        AND table_type IN ('BASE TABLE', 'VIEW')
      ORDER BY table_name
    `, {
      database: targetDatabase,
      schema: targetSchema,
      pattern: searchPattern
    }, { useCache: true, cacheTTL: 600 });

    // Search columns
    const columnsResult = await executeSecureQuery<SnowflakeColumnInfo & { table_name: string }>(`
      SELECT
        table_catalog,
        table_schema,
        table_name,
        column_name,
        data_type,
        comment
      FROM :database.information_schema.columns
      WHERE table_catalog = :database
        AND table_schema = :schema
        AND (UPPER(column_name) LIKE :pattern OR UPPER(comment) LIKE :pattern)
      ORDER BY table_name, ordinal_position
    `, {
      database: targetDatabase,
      schema: targetSchema,
      pattern: searchPattern
    }, { useCache: true, cacheTTL: 600 });

    return {
      tables: tablesResult.rows,
      columns: columnsResult.rows
    };
  }
}

// Global schema introspector instance
let schemaIntrospector: SnowflakeSchemaIntrospector | null = null;

/**
 * Get the global Snowflake schema introspector
 */
export function getSnowflakeSchemaIntrospector(): SnowflakeSchemaIntrospector {
  if (!schemaIntrospector) {
    schemaIntrospector = new SnowflakeSchemaIntrospector();
  }
  return schemaIntrospector;
}

/**
 * Get Snowflake data sources with user permissions applied
 */
export async function getSnowflakeDataSources(user: SessionUser, database?: string, schema?: string): Promise<DataSource[]> {
  const introspector = getSnowflakeSchemaIntrospector();
  return introspector.buildDataSourcesWithPermissions(user, database, schema);
}

/**
 * Search Snowflake schema for tables and columns
 */
export async function searchSnowflakeSchema(query: string, database?: string, schema?: string) {
  const introspector = getSnowflakeSchemaIntrospector();
  return introspector.search(query, database, schema);
}