import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { canAccessDataSourceWithMetrics } from '@/lib/auth/permissions';
import { getAvailableSources } from '@/lib/data/sample-data';
import { getDataSourcesWithProvider } from '@/lib/data/snowflake-data-provider';
import { isSnowflakeConfigured } from '@/lib/snowflake/config';
import { isSampleSource, demoSourcesEnabled } from '@/lib/data/sample-sources';
import {
  REAL_SOURCE_SCHEMAS,
  type RealSourceSchema,
} from '@/lib/data/real-source-schemas';
import { listFreshworksSources } from '@/lib/data/freshworks-sources';
import { listPlatformHealthSources } from '@/lib/data/platform-health-sources';
import type {
  DataSource,
  DataTable,
  DataColumn,
  SchemaResponse,
} from '@/types/data-explorer';

// Mock schema data extracted from sample data generators
// In Phase 3, this would come from Snowflake INFORMATION_SCHEMA
function generateSchemaFromSampleData(): Record<string, { columns: Record<string, string>; description: string }> {
  return {
    'kpi_summary': {
      description: 'Key performance indicators overview',
      columns: {
        'total_customers': 'integer',
        'active_customers': 'integer',
        'mrr': 'integer',
        'arr': 'integer',
        'churn_rate': 'number',
        'nrr': 'number',
        'grr': 'number',
        'gross_revenue_retention': 'number',
        'avg_csat': 'number',
        'open_tickets': 'integer',
        'avg_frt_minutes': 'integer',
        'pipeline_value': 'integer',
        'win_rate': 'number',
        'avg_deal_size': 'integer'
      }
    },
    'mrr_by_month': {
      description: 'Monthly recurring revenue trends',
      columns: {
        'month': 'string',
        'mrr': 'integer',
        'growth': 'number'
      }
    },
    'churn_by_region': {
      description: 'Customer churn rates by geographic region',
      columns: {
        'region': 'string',
        'churn_rate': 'number',
        'churned_customers': 'integer',
        'total_customers': 'integer'
      }
    },
    'churn_by_month': {
      description: 'Monthly customer churn trends',
      columns: {
        'month': 'string',
        'churn_rate': 'number',
        'churned': 'integer',
        'active_start': 'integer'
      }
    },
    'churn_by_plan': {
      description: 'Customer churn rates by subscription plan',
      columns: {
        'plan': 'string',
        'churn_rate': 'number',
        'customers': 'integer'
      }
    },
    'tickets_by_category': {
      description: 'Support tickets grouped by category',
      columns: {
        'category': 'string',
        'count': 'integer',
        'avg_resolution_hours': 'number',
        'csat': 'number'
      }
    },
    'tickets_by_month': {
      description: 'Monthly support ticket volume and metrics',
      columns: {
        'month': 'string',
        'total': 'integer',
        'resolved': 'integer',
        'avg_frt_minutes': 'integer',
        'csat': 'number'
      }
    },
    'tickets_by_team': {
      description: 'Support tickets by team ownership',
      columns: {
        'team': 'string',
        'open': 'integer',
        'pending': 'integer',
        'resolved': 'integer',
        'avg_resolution_hours': 'number',
        'csat': 'number'
      }
    },
    'revenue_by_type': {
      description: 'Revenue breakdown by event type',
      columns: {
        'event_type': 'string',
        'amount': 'integer',
        'count': 'integer'
      }
    },
    'revenue_by_month': {
      description: 'Monthly revenue trends with breakdown',
      columns: {
        'month': 'string',
        'total': 'integer',
        'new': 'integer',
        'expansion': 'integer',
        'contraction': 'integer',
        'churn': 'integer'
      }
    },
    'deals_pipeline': {
      description: 'Sales pipeline by stage',
      columns: {
        'stage': 'string',
        'count': 'integer',
        'value': 'integer',
        'avg_days': 'integer'
      }
    },
    'deals_by_source': {
      description: 'Sales deals by acquisition source',
      columns: {
        'source': 'string',
        'count': 'integer',
        'value': 'integer',
        'win_rate': 'number'
      }
    },
    'usage_by_feature': {
      description: 'Product feature usage analytics',
      columns: {
        'feature': 'string',
        'daily_users': 'integer',
        'total_usage': 'integer',
        'adoption_rate': 'number'
      }
    },
    'usage_by_month': {
      description: 'Monthly feature usage trends',
      columns: {
        'month': 'string',
        'mail_scan': 'integer',
        'package_forward': 'integer',
        'check_deposit': 'integer',
        'address_use': 'integer'
      }
    },
    'customers_by_plan': {
      description: 'Customer distribution by subscription plan',
      columns: {
        'plan': 'string',
        'count': 'integer',
        'revenue': 'integer'
      }
    },
    'customers_by_region': {
      description: 'Customer distribution by geographic region',
      columns: {
        'region': 'string',
        'count': 'integer',
        'mrr': 'integer',
        'churn_rate': 'number'
      }
    }
  };
}

// Mock glossary terms that link to columns
function getMockGlossaryTerms(): Record<string, { id: string; term: string; definition: string }> {
  return {
    'mrr': {
      id: 'term_mrr_001',
      term: 'Monthly Recurring Revenue (MRR)',
      definition: 'The predictable revenue that a company can expect to receive every month from active subscriptions.'
    },
    'churn_rate': {
      id: 'term_churn_001',
      term: 'Churn Rate',
      definition: 'The percentage of customers who cancel their subscriptions during a given time period.'
    },
    'csat': {
      id: 'term_csat_001',
      term: 'Customer Satisfaction Score (CSAT)',
      definition: 'The percentage of support interactions rated 4 or 5 on a 1-5 scale. Higher values indicate better customer satisfaction.'
    },
    'nrr': {
      id: 'term_nrr_001',
      term: 'Net Revenue Retention (NRR)',
      definition: 'The percentage of recurring revenue retained from existing customers, including expansions and contractions.'
    },
    'arr': {
      id: 'term_arr_001',
      term: 'Annual Recurring Revenue (ARR)',
      definition: 'The value of the recurring revenue of a business annually.'
    },
    'avg_frt_minutes': {
      id: 'term_frt_001',
      term: 'Average First Response Time',
      definition: 'The average time it takes for support to provide the first response to a customer ticket.'
    }
  };
}

// Generate sample values for columns based on type
function generateSampleValues(columnName: string, dataType: string): unknown[] {
  const name = columnName.toLowerCase();

  if (dataType === 'string') {
    if (name.includes('plan')) return ['starter', 'professional', 'enterprise'];
    if (name.includes('region')) return ['Northeast', 'Southeast', 'Midwest', 'West', 'International'];
    if (name.includes('category')) return ['billing', 'technical', 'onboarding', 'feature_request'];
    if (name.includes('stage')) return ['prospect', 'qualified', 'proposal', 'negotiation'];
    if (name.includes('source')) return ['inbound', 'outbound', 'referral', 'partner'];
    if (name.includes('feature')) return ['mail_scan', 'package_forward', 'check_deposit'];
    if (name.includes('team')) return ['Recipient Support', 'Form 1583', 'Sales'];
    if (name.includes('month')) return ['2025-01', '2025-02', '2025-03', '2025-04'];
    if (name.includes('type')) return ['new', 'expansion', 'contraction', 'churn'];
    return ['Sample A', 'Sample B', 'Sample C'];
  }

  if (dataType === 'integer') {
    if (name.includes('customers') || name.includes('count')) return [1250, 2340, 890];
    if (name.includes('revenue') || name.includes('value') || name.includes('mrr')) return [45000, 78000, 123000];
    if (name.includes('minutes') || name.includes('hours') || name.includes('days')) return [15, 32, 8];
    return [100, 250, 500];
  }

  if (dataType === 'number') {
    if (name.includes('rate') || name.includes('percentage')) return [3.2, 5.8, 2.1];
    if (name.includes('csat')) return [82.5, 91.3, 76.8];
    if (name.includes('growth')) return [2.3, -1.2, 4.7];
    return [1.5, 3.2, 2.8];
  }

  return ['N/A'];
}

/**
 * Categorize a demo (sample) source by naming pattern so it falls into
 * the same buckets the Data Explorer historically rendered.
 *
 * Demo sources don't have a registered category the way real sources
 * do (real ones declare a category in `REAL_SOURCE_SCHEMAS`), so this
 * keeps their grouping behavior identical to the pre-Phase-B layout.
 */
function categorizeDemoSource(source: string): string {
  const s = source.toLowerCase();
  if (s.includes('revenue') || s.includes('mrr') || s.includes('deal')) return 'Financial';
  if (s.includes('churn') || s.includes('customer')) return 'Retention';
  if (s.includes('ticket') || s.includes('support')) return 'Support';
  if (s.includes('usage') || s.includes('feature')) return 'Product';
  return 'Operations';
}

async function buildSchemaWithPermissions(
  user: Parameters<typeof canAccessDataSourceWithMetrics>[0]
): Promise<DataSource[]> {
  const demoSchemaMap = generateSchemaFromSampleData();
  const glossaryTerms = getMockGlossaryTerms();
  const demoEnabled = demoSourcesEnabled();

  // Build the unified source list. Real sources (Freshworks +
  // Platform Health) are ALWAYS exposed — they're the canonical
  // discovery surface post-2026-05-19. Demo (sample) sources are
  // exposed only when FEATURE_DEMO_SOURCES is on; otherwise they
  // remain queryable via POST /api/data/query for saved widgets but
  // are hidden from this discovery API. See
  // docs/REAL_DATA_MIGRATION_PLAN_2026-05-19.md Phase B.
  //
  // Order matters for stable UX: real sources first (sales →
  // support → voice → messaging → platform), demo sources after.
  const realSources = [
    ...listFreshworksSources(),
    ...listPlatformHealthSources(),
  ];
  const demoSources = demoEnabled
    ? getAvailableSources().filter(isSampleSource)
    : [];
  const allSources = [...realSources, ...demoSources];

  // Group by category. Real sources use the registered category from
  // REAL_SOURCE_SCHEMAS; demo sources fall back to the legacy
  // name-pattern heuristic for parity with prior UX.
  const categorizedSources = new Map<string, string[]>();
  for (const source of allSources) {
    const realSchema = REAL_SOURCE_SCHEMAS[source];
    const category = realSchema?.category ?? categorizeDemoSource(source);
    if (!categorizedSources.has(category)) categorizedSources.set(category, []);
    categorizedSources.get(category)!.push(source);
  }

  const dataSources: DataSource[] = [];

  for (const [category, sources] of categorizedSources) {
    const tables: DataTable[] = [];

    for (const source of sources) {
      // Check source-level permission
      const sourceAccess = await canAccessDataSourceWithMetrics(user, source);
      const realSchema: RealSourceSchema | undefined = REAL_SOURCE_SCHEMAS[source];
      const demoSchema = demoSchemaMap[source];

      if (realSchema) {
        // Real-data source — column metadata declared statically in
        // src/lib/data/real-source-schemas.ts. No mock row count and no
        // random sample values; tables come from live providers at
        // query time, so we deliberately don't fabricate counts here.
        const columns: DataColumn[] = realSchema.columns.map(col => ({
          name: col.name,
          displayName: col.name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          type: col.type,
          nullable: col.name !== 'id' && col.name !== 'value' && col.name !== 'count',
          description: col.description,
          isAccessible: sourceAccess.hasAccess,
          accessLevel: sourceAccess.accessLevel,
          deniedReason: sourceAccess.deniedReason,
          isPrimaryKey: col.name === 'id',
          isForeignKey: col.name.endsWith('_id'),
          glossaryTermId: glossaryTerms[col.name]?.id,
          glossaryTerm: glossaryTerms[col.name],
        }));

        tables.push({
          name: source,
          displayName: source.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          description: realSchema.description,
          columns,
          isAccessible: sourceAccess.hasAccess,
          accessLevel: sourceAccess.accessLevel,
          deniedReason: sourceAccess.deniedReason,
          lastUpdated: new Date(),
        });
      } else if (demoSchema) {
        // Demo source — preserved legacy behavior (mock row count +
        // sample values). Only reachable when demoEnabled is true,
        // since the source list is filtered above.
        const columns: DataColumn[] = [];

        for (const [columnName, dataType] of Object.entries(demoSchema.columns)) {
          const glossaryTerm = glossaryTerms[columnName];
          const sampleValues = generateSampleValues(columnName, dataType);

          columns.push({
            name: columnName,
            displayName: columnName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
            type: dataType,
            nullable: !['id', 'month'].includes(columnName),
            isAccessible: sourceAccess.hasAccess,
            accessLevel: sourceAccess.accessLevel,
            deniedReason: sourceAccess.deniedReason,
            sampleValues,
            isPrimaryKey: columnName === 'id',
            isForeignKey: columnName.endsWith('_id'),
            glossaryTermId: glossaryTerm?.id,
            glossaryTerm,
          });
        }

        tables.push({
          name: source,
          displayName: source.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          description: demoSchema.description,
          columns,
          isAccessible: sourceAccess.hasAccess,
          accessLevel: sourceAccess.accessLevel,
          deniedReason: sourceAccess.deniedReason,
          rowCount: Math.floor(Math.random() * 10000) + 100,
          lastUpdated: new Date(),
        });
      }
      // Sources with neither real nor demo schema (e.g. an
      // unregistered Snowflake passthrough) are silently skipped from
      // the Data Explorer — they're still queryable, but the explorer
      // doesn't know how to describe their shape.
    }

    if (tables.length > 0) {
      dataSources.push({
        name: category,
        displayName: category,
        description: `${category} data tables and metrics`,
        category,
        isAccessible: tables.some(t => t.isAccessible),
        tables,
        lastUpdated: new Date(),
      });
    }
  }

  return dataSources;
}

export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const user = await getCurrentUser();

    const { searchParams } = new URL(request.url);
    const filterByCategory = searchParams.get('category');

    // Build schema with permissions.
    //
    // When Snowflake is configured, use the real provider which introspects
    // INFORMATION_SCHEMA. When running on sample data, use the in-file
    // builder which has proper column-level metadata (types, glossary links,
    // sample values, PK/FK flags). The generic provider's sample fallback
    // returns columns: [] — unusable for the Visual Query Builder.
    let schema = isSnowflakeConfigured()
      ? await getDataSourcesWithProvider(user)
      : await buildSchemaWithPermissions(user);

    // Apply category filter if provided
    if (filterByCategory) {
      schema = schema.filter(source =>
        source.category?.toLowerCase() === filterByCategory.toLowerCase()
      );
    }

    // Calculate totals
    const totalSources = schema.length;
    const totalTables = schema.reduce((sum, source) => sum + source.tables.length, 0);
    const totalColumns = schema.reduce((sum, source) =>
      sum + source.tables.reduce((tableSum, table) => tableSum + table.columns.length, 0), 0
    );

    const response: SchemaResponse = {
      sources: schema,
      totalSources,
      totalTables,
      totalColumns,
      lastUpdated: new Date()
    };

    return NextResponse.json(response);
  } catch (error) {
    // Handle authentication errors
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    console.error('Schema API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}