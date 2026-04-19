import { NextRequest, NextResponse } from 'next/server';
import { queryData, getAvailableSources } from '@/lib/data/sample-data';
import { getCurrentUser } from '@/lib/auth/session';
import { canAccessDataSource, getDataCategoryForSource, resolveUserPermissions } from '@/lib/auth/permissions';
import type { SessionUser } from '@/lib/auth/session';

// PII fields that must be stripped from responses for users without FULL CustomerPII access
const PII_FIELDS = ['name', 'email', 'company', 'account_manager', 'contact', 'owner'];

/**
 * Server-side PII field stripping.
 * Removes PII-containing fields from query results when the user does not
 * have FULL access to the CustomerPII data category. This is a hard control
 * that operates regardless of what the AI generates.
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

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const user = await getCurrentUser();

    const body = await request.json();
    const { source, groupBy } = body as { source: string; groupBy?: string[] };

    if (!source) {
      return NextResponse.json({ error: 'Source is required' }, { status: 400 });
    }

    // Check if user has permission to access this data source
    const hasAccess = await canAccessDataSource(user, source);
    if (!hasAccess) {
      const category = getDataCategoryForSource(source);
      return NextResponse.json(
        {
          error: 'Access denied',
          message: `You don't have permission to access ${category ? category + ' data' : 'this data source'}. Please contact your administrator to request access.`,
          dataSource: source,
          category: category
        },
        { status: 403 }
      );
    }

    const result = await queryData(source, groupBy);

    // Server-side PII stripping — hard control regardless of AI-generated queries
    result.data = await stripPiiFields(result.data, user);

    return NextResponse.json(result);
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

    // Filter sources based on user permissions
    const allowedSources = [];
    for (const source of allSources) {
      const hasAccess = await canAccessDataSource(user, source);
      if (hasAccess) {
        allowedSources.push(source);
      }
    }

    return NextResponse.json({ sources: allowedSources });
  } catch (error) {
    // Handle authentication errors
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    console.error('Error getting available sources:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
