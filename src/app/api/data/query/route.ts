import { NextRequest, NextResponse } from 'next/server';
import { queryData, getAvailableSources } from '@/lib/data/sample-data';
import { queryDataWithProvider } from '@/lib/data/snowflake-data-provider';
import { getCurrentUser } from '@/lib/auth/session';
import { canAccessDataSourceWithMetrics, getCategoryForSource, resolveUserPermissions } from '@/lib/auth/permissions';
import type { SessionUser } from '@/lib/auth/session';

// PII fields that must be stripped from responses for users without FULL CustomerPII access
const PII_FIELDS = ['name', 'email', 'company', 'account_manager', 'contact', 'owner'];

/**
 * Server-side PII field stripping and FILTERED access enforcement.
 * Removes PII-containing fields from query results when the user does not
 * have FULL access to the CustomerPII data category. Also enforces FILTERED
 * access by providing only aggregated data without customer-level details.
 */
async function stripPiiFields(
  data: Record<string, unknown>[],
  user: SessionUser
): Promise<Record<string, unknown>[]> {
  const permissions = await resolveUserPermissions(user);
  if (permissions.data.CustomerPII === 'FULL') {
    return data; // Admin — no stripping
  }

  return data.map(row => {
    const cleaned = { ...row };
    for (const field of PII_FIELDS) {
      if (field in cleaned) {
        cleaned[field] = '[REDACTED]';
      }
    }
    return cleaned;
  });
}

/**
 * Apply FILTERED access restrictions by aggregating data and removing customer-level details.
 * FILTERED access provides aggregate-only views without granular breakdowns.
 */
async function applyFilteredAccess(
  data: Record<string, unknown>[],
  source: string,
  user: SessionUser
): Promise<Record<string, unknown>[]> {
  const metricCheck = await canAccessDataSourceWithMetrics(user, source);

  if (metricCheck.accessLevel !== 'FILTERED') {
    return data; // No filtering needed for FULL access
  }

  // For FILTERED access, aggregate data to remove granular details
  if (data.length === 0) return data;

  // Get numeric fields that can be aggregated
  const firstRow = data[0];
  const numericFields = Object.keys(firstRow).filter(key =>
    typeof firstRow[key] === 'number' &&
    !['year', 'month', 'quarter'].includes(key.toLowerCase()) // Keep time dimensions
  );

  // Group by time periods if available, otherwise create a single aggregate
  const timeFields = Object.keys(firstRow).filter(key =>
    ['month', 'quarter', 'year', 'date', 'period'].some(timeKey =>
      key.toLowerCase().includes(timeKey)
    )
  );

  if (timeFields.length > 0) {
    // Group by time dimension and aggregate
    const grouped = new Map<string, Record<string, unknown>>();

    for (const row of data) {
      const timeKey = timeFields.map(field => row[field]).join('|');

      if (!grouped.has(timeKey)) {
        const aggregateRow: Record<string, unknown> = {};
        // Copy time dimensions
        timeFields.forEach(field => aggregateRow[field] = row[field]);
        // Initialize numeric fields
        numericFields.forEach(field => aggregateRow[field] = 0);
        aggregateRow._count = 0;
        grouped.set(timeKey, aggregateRow);
      }

      const aggregateRow = grouped.get(timeKey)!;
      // Sum numeric fields
      numericFields.forEach(field => {
        const currentVal = aggregateRow[field] as number;
        const newVal = row[field] as number;
        if (typeof newVal === 'number') {
          aggregateRow[field] = currentVal + newVal;
        }
      });
      aggregateRow._count = (aggregateRow._count as number) + 1;
    }

    return Array.from(grouped.values());
  } else {
    // Create a single aggregate row
    const aggregate: Record<string, unknown> = {};
    numericFields.forEach(field => aggregate[field] = 0);
    aggregate._count = data.length;

    for (const row of data) {
      numericFields.forEach(field => {
        const currentVal = aggregate[field] as number;
        const newVal = row[field] as number;
        if (typeof newVal === 'number') {
          aggregate[field] = currentVal + newVal;
        }
      });
    }

    // Add aggregated totals description
    aggregate.description = 'Aggregated view - individual records not available';
    return [aggregate];
  }
}

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const user = await getCurrentUser();

    const body = await request.json();
    const { source, groupBy } = body as { source: string; groupBy?: string[] };

    if (!source) {
      return NextResponse.json({ error: 'Source is required' }, { status: 400 });
    }

    // Check if user has permission to access this data source with metric-level granularity
    const metricCheck = await canAccessDataSourceWithMetrics(user, source);
    if (!metricCheck.hasAccess) {
      return NextResponse.json(
        {
          error: 'Access denied',
          message: metricCheck.deniedReason || 'You don\'t have permission to access this data source. Please contact your administrator to request access.',
          dataSource: source,
          category: metricCheck.category,
          isRestricted: metricCheck.isRestricted
        },
        { status: 403 }
      );
    }

    // Use the new Snowflake data provider with automatic fallback to sample data
    const result = await queryDataWithProvider(source, user, groupBy, {
      useCache: true,
      cacheTTL: 300, // 5 minutes
      applyRLS: true,
      applySecurity: true
    });

    // Apply PII stripping and FILTERED access enforcement to ALL data sources
    result.data = await applyFilteredAccess(result.data, source, user);
    result.data = await stripPiiFields(result.data, user);

    // Include access level information in response for frontend awareness
    const response = {
      data: result.data,
      columns: result.columns.map(col => col.name), // Legacy compatibility
      accessLevel: result.accessLevel || metricCheck.accessLevel,
      isFiltered: result.isFiltered || metricCheck.accessLevel === 'FILTERED',
      executionTime: result.executionTime,
      fromCache: result.fromCache,
      dataSource: result.dataSource,
      totalRows: result.totalRows,
      appliedPolicies: result.appliedPolicies
    };

    return NextResponse.json(response);
  } catch (error) {
    // Handle authentication errors
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    console.error('Data query error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET() {
  try {
    // Authenticate user
    const user = await getCurrentUser();

    // Get all available sources
    const allSources = getAvailableSources();

    // Filter sources based on user permissions with access level details
    const sourcesWithAccess = [];
    for (const source of allSources) {
      const metricCheck = await canAccessDataSourceWithMetrics(user, source);
      if (metricCheck.hasAccess) {
        sourcesWithAccess.push({
          name: source,
          accessLevel: metricCheck.accessLevel,
          category: metricCheck.category,
          isRestricted: metricCheck.isRestricted
        });
      }
    }

    return NextResponse.json({
      sources: sourcesWithAccess.map(s => s.name), // Backward compatibility
      sourcesWithAccess // Enhanced information for new UI
    });
  } catch (error) {
    // Handle authentication errors
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    console.error('Error getting available sources:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
