import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, type SessionUser } from '@/lib/auth/session';
import {
  canAccessDataSourceWithMetrics,
  resolveUserPermissions,
} from '@/lib/auth/permissions';
import { withRateLimit, chatRateLimiter } from '@/lib/rate-limiter';
import { createAuditLog, AuditAction, ResourceType } from '@/lib/audit';
import { visualToSQL, validateVisualQuery } from '@/lib/data/visual-to-sql';
import { queryData as querySampleData } from '@/lib/data/sample-data';
import { evaluateVisualQueryOnSample } from '@/lib/data/visual-query-evaluator';
import { isSnowflakeConfigured } from '@/lib/snowflake/config';
import { applyRowLevelSecurity } from '@/lib/snowflake/row-level-security';
import { executeSecureQuery } from '@/lib/snowflake/query-executor';
import {
  applyDataSecurity,
  getDataSecurityManager,
} from '@/lib/snowflake/data-security';
import type {
  VisualQueryConfig,
  QueryExecutionResult,
  QueryAuditReport,
  AppliedPolicyInfo,
  MaskedColumnInfo,
} from '@/types/visual-query';

// Upper bound row limit — matches the query executor's hard cap.
const MAX_ROW_LIMIT = 10_000;
const DEFAULT_ROW_LIMIT = 1_000;

/**
 * POST /api/data/visual-query/execute
 *
 * Execute a Visual Query Builder query through the full InsightHub security
 * pipeline and return a rich audit report. This is the only endpoint the VQB
 * should call — never trust client-generated SQL.
 *
 * Pipeline:
 *   1. AuthN (getCurrentUser)
 *   2. AuthZ (canAccessDataSourceWithMetrics on primary table)
 *   3. Validate VisualQueryConfig (visualToSQL's validators)
 *   4. Regenerate SQL server-side from the config (never accept client SQL)
 *   5. Apply RLS policies → executedSql
 *   6. Execute (Snowflake OR sample data fallback)
 *   7. Apply column masking
 *   8. Build audit report + log to audit trail
 */
export async function POST(request: NextRequest) {
  return withRateLimit(
    request,
    chatRateLimiter,
    'visual-query:execute',
    async () => {
      try {
        const user = await getCurrentUser();

        const body = (await request.json()) as { config?: Partial<VisualQueryConfig> };
        if (!body.config || typeof body.config !== 'object') {
          return NextResponse.json(
            { error: 'Invalid request: `config` (VisualQueryConfig) is required' },
            { status: 400 }
          );
        }

        // Normalize the incoming config so downstream validators/generators
        // never NPE on missing optional arrays. Clients sometimes omit empty
        // arrays; defend against it rather than 500ing.
        const normalized: VisualQueryConfig = {
          id: body.config.id || '',
          name: body.config.name,
          tables: Array.isArray(body.config.tables) ? body.config.tables : [],
          joins: Array.isArray(body.config.joins) ? body.config.joins : [],
          columns: Array.isArray(body.config.columns) ? body.config.columns : [],
          filters: Array.isArray(body.config.filters) ? body.config.filters : [],
          groupBy: Array.isArray(body.config.groupBy) ? body.config.groupBy : [],
          aggregations: Array.isArray(body.config.aggregations)
            ? body.config.aggregations
            : [],
          orderBy: Array.isArray(body.config.orderBy) ? body.config.orderBy : [],
          formulas: Array.isArray(body.config.formulas)
            ? body.config.formulas
            : [],
          limit: body.config.limit,
        };

        // ── 1. Validate the visual config ─────────────────────────────
        const validationErrors = validateVisualQuery(normalized);
        if (validationErrors.length > 0) {
          return NextResponse.json(
            { error: 'Invalid query configuration', details: validationErrors },
            { status: 400 }
          );
        }

        // Primary table = the source this query runs against.
        const primaryTable = normalized.tables[0];
        const source = primaryTable.name;

        // ── 2. Permission check on the source ─────────────────────────
        const metricCheck = await canAccessDataSourceWithMetrics(user, source);
        if (!metricCheck.hasAccess) {
          return NextResponse.json(
            {
              error: 'Access denied',
              message:
                metricCheck.deniedReason ||
                `You don't have permission to query '${source}'. Contact your administrator to request access.`,
              source,
              category: metricCheck.category,
            },
            { status: 403 }
          );
        }

        // Clamp row limit before generating SQL.
        const requestedLimit = normalized.limit ?? DEFAULT_ROW_LIMIT;
        const rowLimit = Math.min(
          Math.max(1, Math.floor(requestedLimit)),
          MAX_ROW_LIMIT
        );
        const safeConfig: VisualQueryConfig = { ...normalized, limit: rowLimit };

        // ── 3. Generate SQL server-side ───────────────────────────────
        // We regenerate even if the client sent SQL. Client SQL is never trusted.
        let userSql: string;
        try {
          userSql = visualToSQL(safeConfig, {
            prettyFormat: true,
            includeComments: false,
          });
        } catch (err) {
          return NextResponse.json(
            {
              error: 'Failed to generate SQL from visual query config',
              details: err instanceof Error ? err.message : 'Unknown error',
            },
            { status: 400 }
          );
        }

        // ── 4. Build security context for RLS reporting ───────────────
        const permissions = await resolveUserPermissions(user);
        const securityContext = {
          userId: user.id,
          userRole: user.role,
          department: user.department || undefined,
          region: undefined as string | undefined,
          hasFinancialAccess: permissions.data.Financial !== 'NONE',
          hasPiiAccess: permissions.data.CustomerPII !== 'NONE',
        };

        // ── 5. Execute against the right backend ──────────────────────
        const executedAt = new Date().toISOString();
        const start = Date.now();
        const useSnowflake = isSnowflakeConfigured();

        let rows: Record<string, unknown>[];
        let columns: string[];
        let executedSql: string;
        let fromCache = false;
        let appliedPolicies: AppliedPolicyInfo[] = [];
        let dataSource: 'snowflake' | 'sample';
        let skippedFeatures: string[] = [];

        if (useSnowflake) {
          dataSource = 'snowflake';

          // Inject RLS before execution.
          const rls = await applyRowLevelSecurity(user, userSql, source);
          executedSql = rls.modifiedQuery;
          appliedPolicies = rls.appliedPolicies.map((p) => ({
            id: p.id,
            name: p.name,
            description: p.description,
            // The RLS manager doesn't expose the substituted condition directly.
            // Fallback to the template condition; the resolved version is
            // already baked into modifiedQuery.
            resolvedCondition: p.condition,
            priority: p.priority,
          }));

          const result = await executeSecureQuery(executedSql, undefined, {
            userId: user.id,
            useCache: true,
          });

          rows = result.rows;
          columns = result.columns.map((c) => c.name);
          fromCache = result.fromCache;
        } else {
          // Sample-data mode: evaluate the visual config against the raw
          // generated rows in JS so the returned data actually matches the
          // SQL shown in the audit panel. Without this, users saw raw
          // generator output regardless of their WHERE/GROUP BY/aggregations.
          dataSource = 'sample';
          executedSql = userSql; // No server-side RLS rewrite in sample mode

          const sample = await querySampleData(source, undefined, user);
          if (sample.accessDenied) {
            return NextResponse.json(
              {
                error: 'Access denied',
                message: sample.deniedReason || 'Access denied',
                source,
              },
              { status: 403 }
            );
          }

          const evaluated = evaluateVisualQueryOnSample(safeConfig, sample.data);
          rows = evaluated.rows;
          columns = evaluated.columns;
          skippedFeatures = evaluated.skippedFeatures;
        }

        // ── 6. Column masking + detect which columns got masked ───────
        const maskedColumns = detectMaskedColumns(columns, rows, securityContext);
        const columnMetadataForMasking = columns.map((name) => ({
          name,
          type: rows[0] ? typeof rows[0][name] : 'string',
          sampleValues: rows.slice(0, 10).map((row) => row[name]),
        }));
        const securedRows =
          rows.length > 0
            ? await applyDataSecurity(
                user as SessionUser,
                rows,
                columnMetadataForMasking
              )
            : rows;

        const executionTimeMs = Date.now() - start;

        // ── 7. Build the audit report ─────────────────────────────────
        const audit: QueryAuditReport = {
          userSql,
          executedSql,
          wasModified: userSql.trim() !== executedSql.trim(),
          appliedPolicies,
          maskedColumns,
          accessLevel: metricCheck.accessLevel || 'FULL',
          securityContext,
          dataSource,
          fromCache,
          executionTimeMs,
          rowCount: securedRows.length,
          source,
          rowLimit,
          executedAt,
          skippedFeatures: skippedFeatures.length > 0 ? skippedFeatures : undefined,
        };

        // ── 8. Audit log (non-blocking) ───────────────────────────────
        void createAuditLog({
          userId: user.id,
          action: AuditAction.DASHBOARD_UPDATE, // Closest existing action; see note below
          resourceType: ResourceType.DASHBOARD,
          resourceId: `visual-query:${source}`,
          metadata: {
            event: 'visual_query_execute',
            source,
            rowCount: audit.rowCount,
            executionTimeMs,
            dataSource,
            fromCache,
            policiesApplied: appliedPolicies.map((p) => p.id),
            maskedColumns: maskedColumns.map((m) => m.column),
            accessLevel: audit.accessLevel,
          },
        });

        const response: QueryExecutionResult = {
          data: securedRows,
          columns,
          totalRows: securedRows.length,
          executionTime: executionTimeMs,
          sql: userSql,
          audit,
        };

        return NextResponse.json(response);
      } catch (error) {
        if (
          error instanceof Error &&
          error.message.toLowerCase().includes('unauthorized')
        ) {
          return NextResponse.json(
            { error: 'Authentication required' },
            { status: 401 }
          );
        }
        console.error('[visual-query/execute] Error:', error);
        return NextResponse.json(
          {
            error: 'Query execution failed',
            details:
              error instanceof Error ? error.message : 'Unknown server error',
          },
          { status: 500 }
        );
      }
    }
  );
}

/**
 * Predict which columns will be masked based on auto-detected sensitivity
 * tags + the user's access to each sensitivity category. This is advisory
 * metadata for the audit panel — actual masking is still done by
 * applyDataSecurity which is the source of truth.
 */
function detectMaskedColumns(
  columns: string[],
  rows: Record<string, unknown>[],
  ctx: {
    hasFinancialAccess: boolean;
    hasPiiAccess: boolean;
    userRole: string;
  }
): MaskedColumnInfo[] {
  const securityManager = getDataSecurityManager();
  const out: MaskedColumnInfo[] = [];

  for (const col of columns) {
    const samples = rows.slice(0, 10).map((r) => r[col]);
    const inferredType = samples[0] !== undefined ? typeof samples[0] : 'string';
    const tags = securityManager.autoDetectSensitivity(
      col,
      String(inferredType),
      samples
    );

    for (const tag of tags) {
      // Skip tags that don't restrict this user.
      if (tag.level === 'PII' && (ctx.hasPiiAccess || ctx.userRole === 'ADMIN')) continue;
      if (tag.level === 'FINANCIAL' && (ctx.hasFinancialAccess || ctx.userRole === 'ADMIN')) continue;
      if (tag.level === 'PUBLIC' || tag.level === 'INTERNAL') continue;

      const rule = tag.maskingRules?.[0];
      out.push({
        column: col,
        sensitivityLevel: tag.level,
        maskingType: rule?.maskingType || 'REDACT',
      });
      break; // One mask reason per column is enough for the audit view.
    }
  }

  return out;
}
