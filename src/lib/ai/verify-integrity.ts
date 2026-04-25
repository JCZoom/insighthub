/**
 * Data Integrity Verification Pipeline
 *
 * 3-layer verification for AI-generated dashboard schemas:
 *   Layer 1  — Deterministic structural checks (free, <5ms)
 *   Layer 2  — AI semantic verification via Haiku (~$0.002, ~2-4s)
 *   Layer 2.5 — Escalation review via Sonnet (conditional)
 *
 * Spec: docs/DATA_INTEGRITY_VERIFICATION_SPEC.md
 */

import Anthropic from '@anthropic-ai/sdk';
import type {
  DashboardSchema,
  SchemaPatch,
  WidgetConfig,
  VerificationReport,
  VerificationVerdict,
  VerificationIssue,
  WidgetVerification,
  DeterministicCheckResult,
} from '@/types';
import {
  SOURCE_FIELD_REGISTRY,
  VALID_WIDGET_TYPES,
  VALID_AGGREGATION_FUNCTIONS,
  NON_DATA_WIDGET_TYPES,
  CATEGORICAL_CHART_TYPES,
  TIME_SERIES_CHART_TYPES,
  isValidSource,
  isValidField,
  isNonDataWidget,
  isTimeSeriesSource,
  isCategoricalSource,
  getFieldsForSource,
} from './source-field-registry';

// ── Configuration ──────────────────────────────────────────

const CONFIDENCE_ESCALATION_THRESHOLD = parseFloat(
  process.env.VERIFY_INTEGRITY_CONFIDENCE_THRESHOLD || '0.70'
);
const AI_TIMEOUT_MS = parseInt(
  process.env.VERIFY_INTEGRITY_TIMEOUT_MS || '5000', 10
);
const HAIKU_MODEL = 'claude-haiku-3-20250414';
const SONNET_MODEL = 'claude-sonnet-4-20250514';

// Simple in-memory cache for verification results (hash → {result, expiry})
const verificationCache = new Map<string, { result: VerificationReport; expiry: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// ── Types (internal) ───────────────────────────────────────

interface GlossaryTerm {
  term: string;
  category: string;
  definition: string;
  formula: string | null;
}

interface AIVerificationResult {
  overallConfidence: number;
  overallVerdict: VerificationVerdict;
  summary: string;
  widgets: WidgetVerification[];
}

interface VerifyOptions {
  /** Skip AI verification layers (only run deterministic) */
  deterministicOnly?: boolean;
  /** Conversation history for escalation context */
  conversationHistory?: { role: string; content: string }[];
  /** Previous schema (pre-patch) for escalation context */
  previousSchema?: DashboardSchema;
}

// ── Main Entry Point ───────────────────────────────────────

/**
 * Run the full verification pipeline on AI-generated patches.
 * Returns a VerificationReport with per-widget confidence scores.
 */
export async function verifyDashboardIntegrity(
  userMessage: string,
  patches: SchemaPatch[],
  resultSchema: DashboardSchema,
  glossaryTerms: GlossaryTerm[],
  options: VerifyOptions = {},
): Promise<VerificationReport> {
  const startedAt = Date.now();

  // Check feature flags
  const enabled = process.env.VERIFY_INTEGRITY_ENABLED !== 'false';
  if (!enabled) {
    return buildSkippedReport(startedAt, 'Verification disabled via VERIFY_INTEGRITY_ENABLED');
  }

  // Check cache
  const cacheKey = buildCacheKey(userMessage, patches);
  const cached = verificationCache.get(cacheKey);
  if (cached && cached.expiry > Date.now()) {
    return { ...cached.result, startedAt, completedAt: Date.now(), durationMs: Date.now() - startedAt };
  }

  // Should we skip data verification entirely?
  // Skip if patches only affect non-data elements
  if (shouldSkipVerification(patches)) {
    return buildSkippedReport(startedAt, 'Patches only affect non-data elements (text_block, layout, filters)');
  }

  // ── Layer 1: Deterministic Checks ──────────────────────
  const deterministicChecks = runDeterministicChecks(resultSchema, patches, glossaryTerms);

  const failCount = deterministicChecks.filter(c => !c.passed && c.severity === 'FAIL').length;
  const warnCount = deterministicChecks.filter(c => !c.passed && c.severity === 'WARN').length;
  const passCount = deterministicChecks.filter(c => c.passed).length;

  // ── Layer 2: AI Verification ───────────────────────────
  const aiEnabled = process.env.VERIFY_INTEGRITY_AI_ENABLED !== 'false' && !options.deterministicOnly;
  let aiResult: AIVerificationResult | null = null;
  let aiModel: string | undefined;
  let aiSkippedReason: string | undefined;

  if (aiEnabled) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      aiSkippedReason = 'ANTHROPIC_API_KEY not configured';
    } else {
      try {
        aiResult = await runAIVerification(apiKey, userMessage, patches, resultSchema, glossaryTerms);
        aiModel = HAIKU_MODEL;
      } catch (error) {
        console.error('[verify-integrity] AI verification failed:', error);
        aiSkippedReason = error instanceof Error ? error.message : 'Unknown error';
      }
    }
  } else {
    aiSkippedReason = options.deterministicOnly ? 'deterministicOnly option set' : 'AI verification disabled via VERIFY_INTEGRITY_AI_ENABLED';
  }

  // ── Layer 2.5: Escalation ──────────────────────────────
  let escalationRan = false;
  let escalationModel: string | undefined;
  let previousConfidence: number | undefined;
  let newConfidence: number | undefined;
  let escalationCorrections = 0;

  if (aiResult && aiResult.overallConfidence < CONFIDENCE_ESCALATION_THRESHOLD && aiEnabled) {
    const apiKey = process.env.ANTHROPIC_API_KEY!;
    previousConfidence = aiResult.overallConfidence;

    try {
      const escalationResult = await runEscalationReview(
        apiKey, userMessage, patches, resultSchema, glossaryTerms, aiResult, options,
      );
      escalationRan = true;
      escalationModel = SONNET_MODEL;
      newConfidence = escalationResult.overallConfidence;
      escalationCorrections = escalationResult.corrections?.length ?? 0;

      // Use escalation result as the final AI result
      aiResult = escalationResult;
    } catch (error) {
      console.error('[verify-integrity] Escalation failed:', error);
      // Keep the original Layer 2 result
    }
  }

  // ── Combine Results ────────────────────────────────────
  const report = buildReport({
    startedAt,
    deterministicChecks,
    passCount,
    warnCount,
    failCount,
    aiResult,
    aiModel,
    aiSkippedReason,
    escalationRan,
    escalationModel,
    previousConfidence,
    newConfidence,
    escalationCorrections,
    resultSchema,
  });

  // Cache the result
  verificationCache.set(cacheKey, { result: report, expiry: Date.now() + CACHE_TTL_MS });

  // Prune old cache entries periodically
  if (verificationCache.size > 100) {
    const now = Date.now();
    for (const [key, entry] of verificationCache) {
      if (entry.expiry < now) verificationCache.delete(key);
    }
  }

  return report;
}

// ── Layer 1: Deterministic Checks ──────────────────────────

export function runDeterministicChecks(
  schema: DashboardSchema,
  patches: SchemaPatch[],
  glossaryTerms: GlossaryTerm[],
): DeterministicCheckResult[] {
  const results: DeterministicCheckResult[] = [];
  const widgets = schema.widgets || [];

  // D-10: Duplicate widget IDs (schema-level check)
  const idCounts = new Map<string, number>();
  for (const w of widgets) {
    idCounts.set(w.id, (idCounts.get(w.id) || 0) + 1);
  }
  for (const [id, count] of idCounts) {
    if (count > 1) {
      results.push({
        checkId: 'D-10',
        passed: false,
        severity: 'FAIL',
        message: `Duplicate widget ID "${id}" appears ${count} times`,
        widgetId: id,
      });
    }
  }
  if (![...idCounts.values()].some(c => c > 1)) {
    results.push({ checkId: 'D-10', passed: true, severity: 'FAIL', message: 'No duplicate widget IDs' });
  }

  // D-12: Non-empty schema for replace_all
  const hasReplaceAll = patches.some(p => p.type === 'replace_all');
  if (hasReplaceAll) {
    if (widgets.length === 0) {
      results.push({
        checkId: 'D-12',
        passed: false,
        severity: 'WARN',
        message: 'replace_all patch resulted in an empty schema (0 widgets)',
      });
    } else {
      results.push({ checkId: 'D-12', passed: true, severity: 'WARN', message: `replace_all schema has ${widgets.length} widgets` });
    }
  }

  // Per-widget checks
  for (const widget of widgets) {
    // Skip non-data widgets for data-specific checks
    const isNonData = isNonDataWidget(widget.type);

    // D-02: Valid widget type
    if ((VALID_WIDGET_TYPES as readonly string[]).includes(widget.type)) {
      results.push({ checkId: 'D-02', passed: true, severity: 'FAIL', message: `Widget type "${widget.type}" is valid`, widgetId: widget.id });
    } else {
      results.push({
        checkId: 'D-02',
        passed: false,
        severity: 'FAIL',
        message: `Unknown widget type "${widget.type}"`,
        widgetId: widget.id,
      });
    }

    // D-03: Required fields present
    const missingFields: string[] = [];
    if (!widget.id) missingFields.push('id');
    if (!widget.type) missingFields.push('type');
    if (!widget.title) missingFields.push('title');
    if (!widget.position) missingFields.push('position');
    if (!widget.dataConfig) missingFields.push('dataConfig');
    if (missingFields.length > 0) {
      results.push({
        checkId: 'D-03',
        passed: false,
        severity: 'FAIL',
        message: `Widget "${widget.id || '?'}" missing required fields: ${missingFields.join(', ')}`,
        widgetId: widget.id,
      });
    } else {
      results.push({ checkId: 'D-03', passed: true, severity: 'FAIL', message: 'All required fields present', widgetId: widget.id });
    }

    // D-04: Position bounds
    if (widget.position) {
      const { x, y, w, h } = widget.position;
      const posIssues: string[] = [];
      if (x < 0) posIssues.push('x < 0');
      if (y < 0) posIssues.push('y < 0');
      if (w <= 0) posIssues.push('w <= 0');
      if (w > 12) posIssues.push('w > 12');
      if (h <= 0) posIssues.push('h <= 0');
      if (posIssues.length > 0) {
        results.push({
          checkId: 'D-04',
          passed: false,
          severity: 'FAIL',
          message: `Widget "${widget.id}" has invalid position: ${posIssues.join(', ')}`,
          widgetId: widget.id,
        });
      } else {
        results.push({ checkId: 'D-04', passed: true, severity: 'FAIL', message: 'Position bounds valid', widgetId: widget.id });
      }

      // D-05: Grid alignment
      if (x + w > 12) {
        results.push({
          checkId: 'D-05',
          passed: false,
          severity: 'WARN',
          message: `Widget "${widget.id}" overflows grid: x(${x}) + w(${w}) = ${x + w} > 12`,
          widgetId: widget.id,
        });
      }
    }

    // Skip data checks for non-data widgets
    if (isNonData) continue;

    const source = widget.dataConfig?.source;
    let sourceKnown = false;

    // D-01: Valid data source
    if (source) {
      sourceKnown = isValidSource(source);
      if (sourceKnown) {
        results.push({ checkId: 'D-01', passed: true, severity: 'FAIL', message: `Data source "${source}" is valid`, widgetId: widget.id });
      } else {
        // Downgrade to WARN — source may be valid in Snowflake but not in the sample registry
        results.push({
          checkId: 'D-01',
          passed: false,
          severity: 'WARN',
          message: `Data source "${source}" is not in the sample registry — field-level checks skipped`,
          widgetId: widget.id,
          field: source,
        });
      }
    }

    // D-06: Valid aggregation (function name always checked; field check skipped if source unknown)
    if (widget.dataConfig?.aggregation) {
      const agg = widget.dataConfig.aggregation;
      if (!(VALID_AGGREGATION_FUNCTIONS as readonly string[]).includes(agg.function)) {
        results.push({
          checkId: 'D-06',
          passed: false,
          severity: 'FAIL',
          message: `Unknown aggregation function "${agg.function}" on widget "${widget.id}"`,
          widgetId: widget.id,
          field: agg.function,
        });
      } else if (sourceKnown && source && !isValidField(source, agg.field)) {
        results.push({
          checkId: 'D-06',
          passed: false,
          severity: 'FAIL',
          message: `Aggregation field "${agg.field}" does not exist in source "${source}" — available: ${getFieldsForSource(source).join(', ')}`,
          widgetId: widget.id,
          field: agg.field,
        });
      } else {
        results.push({ checkId: 'D-06', passed: true, severity: 'FAIL', message: 'Aggregation valid', widgetId: widget.id });
      }
    }

    // D-07: Valid groupBy (skip if source unknown)
    if (widget.dataConfig?.groupBy && source && sourceKnown) {
      const sourceFields = getFieldsForSource(source);
      for (const field of widget.dataConfig.groupBy) {
        if (!sourceFields.includes(field)) {
          results.push({
            checkId: 'D-07',
            passed: false,
            severity: 'WARN',
            message: `groupBy field "${field}" does not exist in source "${source}"`,
            widgetId: widget.id,
            field,
          });
        }
      }
    }

    // D-08: Source-field mapping (skip if source unknown)
    if (source && sourceKnown) {
      const sourceFields = getFieldsForSource(source);
      const referencedFields: string[] = [];
      if (widget.dataConfig?.aggregation?.field) referencedFields.push(widget.dataConfig.aggregation.field);
      if (widget.dataConfig?.groupBy) referencedFields.push(...widget.dataConfig.groupBy);
      if (widget.dataConfig?.orderBy) referencedFields.push(...widget.dataConfig.orderBy.map(o => o.field));

      const invalidFields = referencedFields.filter(f => !sourceFields.includes(f));
      if (invalidFields.length > 0) {
        for (const f of invalidFields) {
          results.push({
            checkId: 'D-08',
            passed: false,
            severity: 'FAIL',
            message: `Field "${f}" referenced in widget "${widget.id}" does not exist in source "${source}"`,
            widgetId: widget.id,
            field: f,
          });
        }
      }
    }

    // D-09: Glossary term alignment
    if (glossaryTerms.length > 0 && widget.title) {
      const titleLower = widget.title.toLowerCase();
      for (const term of glossaryTerms) {
        const termLower = term.term.toLowerCase();
        if (titleLower.includes(termLower) || termLower.includes(titleLower)) {
          // Found a matching glossary term — check source alignment
          if (term.category && source) {
            // Basic heuristic: check if the source name relates to the category
            const categorySourceMap: Record<string, string[]> = {
              'Revenue': ['revenue_by_month', 'mrr_by_month', 'kpi_summary'],
              'Retention': ['churn_by_month', 'churn_by_region', 'churn_by_plan', 'kpi_summary'],
              'Support': ['tickets_by_month', 'tickets_by_category', 'tickets_by_team', 'kpi_summary'],
              'Sales': ['deals_pipeline', 'deals_by_source', 'kpi_summary'],
              'Product': ['usage_by_feature', 'usage_by_month', 'kpi_summary'],
              'Operations': ['kpi_summary'],
            };
            const expectedSources = categorySourceMap[term.category] || [];
            if (expectedSources.length > 0 && !expectedSources.includes(source)) {
              results.push({
                checkId: 'D-09',
                passed: false,
                severity: 'WARN',
                message: `Widget "${widget.title}" matches glossary term "${term.term}" (${term.category}) but uses source "${source}" — expected one of: ${expectedSources.join(', ')}`,
                widgetId: widget.id,
              });
            }
          }
          break; // Only check first matching term
        }
      }
    }

    // D-11: Chart-data compatibility (skip if source unknown)
    if (source && sourceKnown) {
      const isCategoricalChart = (CATEGORICAL_CHART_TYPES as readonly string[]).includes(widget.type);
      const isTimeSeriesChart = (TIME_SERIES_CHART_TYPES as readonly string[]).includes(widget.type);

      if (isCategoricalChart && isTimeSeriesSource(source) && !isCategoricalSource(source)) {
        results.push({
          checkId: 'D-11',
          passed: false,
          severity: 'WARN',
          message: `Widget "${widget.id}" uses ${widget.type} (categorical) with time-series source "${source}" — consider a line_chart or area_chart instead`,
          widgetId: widget.id,
        });
      }

      if (isTimeSeriesChart && isCategoricalSource(source) && !isTimeSeriesSource(source)) {
        results.push({
          checkId: 'D-11',
          passed: false,
          severity: 'WARN',
          message: `Widget "${widget.id}" uses ${widget.type} (time-series) with categorical source "${source}" — consider a bar_chart or pie_chart instead`,
          widgetId: widget.id,
        });
      }
    }

    // D-13: KPI aggregation sanity
    if (widget.type === 'kpi_card') {
      if (widget.dataConfig?.groupBy && widget.dataConfig.groupBy.length > 0) {
        results.push({
          checkId: 'D-13',
          passed: false,
          severity: 'WARN',
          message: `KPI card "${widget.title}" has groupBy — KPIs should display a single aggregated value, not grouped data`,
          widgetId: widget.id,
        });
      }
    }
  }

  return results;
}

// ── Layer 2: AI Verification ───────────────────────────────

async function runAIVerification(
  apiKey: string,
  userMessage: string,
  patches: SchemaPatch[],
  schema: DashboardSchema,
  glossaryTerms: GlossaryTerm[],
): Promise<AIVerificationResult> {
  const anthropic = new Anthropic({ apiKey });

  // Build focused verification prompt
  const dataWidgets = schema.widgets.filter(w => !isNonDataWidget(w.type));
  if (dataWidgets.length === 0) {
    return {
      overallConfidence: 1.0,
      overallVerdict: 'PASS',
      summary: 'No data widgets to verify.',
      widgets: [],
    };
  }

  const glossarySection = glossaryTerms.length > 0
    ? glossaryTerms.map(t => `- ${t.term} [${t.category}]: ${t.definition}${t.formula ? ` Formula: ${t.formula}` : ''}`).join('\n')
    : 'No glossary terms available.';

  const sourceRegistrySection = Object.entries(SOURCE_FIELD_REGISTRY)
    .map(([src, fields]) => `- ${src}: ${fields.join(', ')}`)
    .join('\n');

  const schemaWidgetsOnly = dataWidgets.map(w => ({
    id: w.id,
    type: w.type,
    title: w.title,
    subtitle: w.subtitle,
    dataConfig: w.dataConfig,
  }));

  const prompt = `You are a data integrity verifier for a BI dashboard builder. Your job is to check whether the AI-generated dashboard configuration correctly reflects the user's intent.

## User's Request
"${userMessage}"

## Generated Widgets
${JSON.stringify(schemaWidgetsOnly, null, 2)}

## Company Glossary
${glossarySection}

## Available Data Sources & Fields
${sourceRegistrySection}

## Verification Checklist
For each data widget, verify:
1. INTENT MATCH: Does this widget address what the user asked for?
2. DATA SOURCE: Is the data source correct for this metric?
3. AGGREGATION: Is the aggregation function appropriate? (e.g., churn_rate should use avg not sum)
4. FIELD MAPPING: Are the referenced fields valid for this source?
5. GLOSSARY COMPLIANCE: Does the metric calculation match the glossary definition?
6. CHART TYPE: Is the visualization appropriate for this data?

Respond with ONLY valid JSON in this exact format:
{
  "overallConfidence": 0.0-1.0,
  "overallVerdict": "PASS" | "WARN" | "FAIL",
  "summary": "One-sentence summary",
  "widgets": [
    {
      "widgetId": "...",
      "widgetTitle": "...",
      "confidence": 0.0-1.0,
      "verdict": "PASS" | "WARN" | "FAIL",
      "issues": [
        {
          "type": "intent_mismatch" | "wrong_source" | "wrong_aggregation" | "invalid_field" | "glossary_mismatch" | "wrong_chart_type",
          "severity": "error" | "warning",
          "message": "Human-readable explanation"
        }
      ]
    }
  ]
}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

  try {
    const response = await anthropic.messages.create({
      model: HAIKU_MODEL,
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    });

    clearTimeout(timeout);

    const textBlock = response.content.find(b => b.type === 'text');
    const rawText = textBlock?.type === 'text' ? textBlock.text : '';

    return parseAIVerificationResponse(rawText, dataWidgets);
  } catch (error) {
    clearTimeout(timeout);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`AI verification timed out after ${AI_TIMEOUT_MS}ms`);
    }
    throw error;
  }
}

function parseAIVerificationResponse(
  rawText: string,
  widgets: WidgetConfig[],
): AIVerificationResult {
  try {
    // Try to extract JSON from potential markdown wrapping
    const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, rawText];
    const jsonStr = (jsonMatch[1] || rawText).trim();
    const parsed = JSON.parse(jsonStr);

    // Validate and normalize
    return {
      overallConfidence: clamp(parsed.overallConfidence ?? 0.5, 0, 1),
      overallVerdict: validateVerdict(parsed.overallVerdict),
      summary: parsed.summary || 'Verification complete.',
      widgets: Array.isArray(parsed.widgets)
        ? parsed.widgets.map((w: any) => ({
            widgetId: w.widgetId || '',
            widgetTitle: w.widgetTitle || '',
            confidence: clamp(w.confidence ?? 0.5, 0, 1),
            verdict: validateVerdict(w.verdict),
            issues: Array.isArray(w.issues)
              ? w.issues.map((i: any) => ({
                  type: i.type || 'intent_mismatch',
                  severity: i.severity === 'error' ? 'error' : 'warning',
                  message: i.message || 'Unknown issue',
                }))
              : [],
          }))
        : widgets.map(w => ({
            widgetId: w.id,
            widgetTitle: w.title,
            confidence: clamp(parsed.overallConfidence ?? 0.5, 0, 1),
            verdict: validateVerdict(parsed.overallVerdict),
            issues: [],
          })),
    };
  } catch {
    // If parsing fails, return a neutral result
    console.warn('[verify-integrity] Failed to parse AI verification response');
    return {
      overallConfidence: 0.5,
      overallVerdict: 'WARN',
      summary: 'Could not parse verification response — manual review recommended.',
      widgets: widgets.map(w => ({
        widgetId: w.id,
        widgetTitle: w.title,
        confidence: 0.5,
        verdict: 'WARN' as VerificationVerdict,
        issues: [{
          type: 'intent_mismatch' as const,
          severity: 'warning' as const,
          message: 'AI verification response could not be parsed',
        }],
      })),
    };
  }
}

// ── Layer 2.5: Escalation Review ───────────────────────────

interface EscalationResult extends AIVerificationResult {
  corrections?: SchemaPatch[];
  escalationReason: string;
}

async function runEscalationReview(
  apiKey: string,
  userMessage: string,
  patches: SchemaPatch[],
  schema: DashboardSchema,
  glossaryTerms: GlossaryTerm[],
  layer2Result: AIVerificationResult,
  options: VerifyOptions,
): Promise<EscalationResult> {
  const anthropic = new Anthropic({ apiKey });

  const issuesSummary = layer2Result.widgets
    .filter(w => w.issues.length > 0)
    .map(w => `Widget "${w.widgetTitle}" (${w.verdict}, ${(w.confidence * 100).toFixed(0)}% confidence):\n${w.issues.map(i => `  - [${i.severity}] ${i.message}`).join('\n')}`)
    .join('\n\n');

  const glossarySection = glossaryTerms.length > 0
    ? glossaryTerms.map(t => `- ${t.term}: ${t.definition}${t.formula ? ` Formula: ${t.formula}` : ''}`).join('\n')
    : 'No glossary terms available.';

  const prompt = `You are performing a deep data integrity review of an AI-generated dashboard. The initial verification flagged concerns (confidence: ${(layer2Result.overallConfidence * 100).toFixed(0)}%).

## User's Original Request
"${userMessage}"

## Initial Verification Issues
${issuesSummary || 'No specific issues flagged, but overall confidence was low.'}

## Current Schema Widgets
${JSON.stringify(schema.widgets.filter(w => !isNonDataWidget(w.type)).map(w => ({ id: w.id, type: w.type, title: w.title, dataConfig: w.dataConfig })), null, 2)}

## Glossary Terms
${glossarySection}

## Available Data Sources
${Object.entries(SOURCE_FIELD_REGISTRY).map(([src, fields]) => `- ${src}: ${fields.join(', ')}`).join('\n')}

Re-evaluate with extra scrutiny. For each widget, determine if the initial concerns are valid or false positives. If the concerns are valid, explain specifically what is wrong and what the correct configuration should be.

Respond with ONLY valid JSON:
{
  "overallConfidence": 0.0-1.0,
  "overallVerdict": "PASS" | "WARN" | "FAIL",
  "summary": "One-sentence summary of deep review findings",
  "escalationReason": "Why escalation was needed",
  "widgets": [
    {
      "widgetId": "...",
      "widgetTitle": "...",
      "confidence": 0.0-1.0,
      "verdict": "PASS" | "WARN" | "FAIL",
      "issues": [
        {
          "type": "intent_mismatch" | "wrong_source" | "wrong_aggregation" | "invalid_field" | "glossary_mismatch" | "wrong_chart_type",
          "severity": "error" | "warning",
          "message": "Explanation"
        }
      ]
    }
  ]
}`;

  const response = await anthropic.messages.create({
    model: SONNET_MODEL,
    max_tokens: 2048,
    messages: [{ role: 'user', content: prompt }],
  });

  const textBlock = response.content.find(b => b.type === 'text');
  const rawText = textBlock?.type === 'text' ? textBlock.text : '';

  try {
    const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, rawText];
    const jsonStr = (jsonMatch[1] || rawText).trim();
    const parsed = JSON.parse(jsonStr);

    return {
      overallConfidence: clamp(parsed.overallConfidence ?? 0.5, 0, 1),
      overallVerdict: validateVerdict(parsed.overallVerdict),
      summary: parsed.summary || 'Escalation review complete.',
      escalationReason: parsed.escalationReason || `Initial confidence was ${(layer2Result.overallConfidence * 100).toFixed(0)}%`,
      widgets: Array.isArray(parsed.widgets)
        ? parsed.widgets.map((w: any) => ({
            widgetId: w.widgetId || '',
            widgetTitle: w.widgetTitle || '',
            confidence: clamp(w.confidence ?? 0.5, 0, 1),
            verdict: validateVerdict(w.verdict),
            issues: Array.isArray(w.issues)
              ? w.issues.map((i: any) => ({
                  type: i.type || 'intent_mismatch',
                  severity: i.severity === 'error' ? 'error' : 'warning',
                  message: i.message || 'Unknown issue',
                }))
              : [],
          }))
        : [],
    };
  } catch {
    // If parsing fails, return modified layer2 result
    return {
      ...layer2Result,
      escalationReason: 'Escalation response could not be parsed',
    };
  }
}

// ── Helpers ────────────────────────────────────────────────

function shouldSkipVerification(patches: SchemaPatch[]): boolean {
  if (patches.length === 0) return true;

  return patches.every(p => {
    switch (p.type) {
      case 'remove_widget':
      case 'update_layout':
      case 'update_filters':
        return true;
      case 'add_widget':
      case 'use_widget':
        // Skip if the widget is non-data (text_block, divider, image)
        return p.widget ? isNonDataWidget(p.widget.type) : false;
      case 'update_widget':
        // Skip if only visual changes (no dataConfig changes)
        return p.changes ? !p.changes.dataConfig : true;
      case 'replace_all':
        // Never skip replace_all — always verify
        return false;
      default:
        return false;
    }
  });
}

function buildCacheKey(userMessage: string, patches: SchemaPatch[]): string {
  const content = `${userMessage}|${JSON.stringify(patches)}`;
  // Simple hash for cache key
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return `verify_${hash}`;
}

function buildSkippedReport(startedAt: number, reason: string): VerificationReport {
  return {
    startedAt,
    completedAt: Date.now(),
    durationMs: Date.now() - startedAt,
    overallConfidence: 1.0,
    overallVerdict: 'PASS',
    summary: reason,
    widgets: [],
    layers: {
      deterministic: { ran: true, passCount: 0, warnCount: 0, failCount: 0 },
      aiVerification: { ran: false, skippedReason: reason },
      escalation: { ran: false },
    },
    deterministicChecks: [],
  };
}

function buildReport(params: {
  startedAt: number;
  deterministicChecks: DeterministicCheckResult[];
  passCount: number;
  warnCount: number;
  failCount: number;
  aiResult: AIVerificationResult | null;
  aiModel?: string;
  aiSkippedReason?: string;
  escalationRan: boolean;
  escalationModel?: string;
  previousConfidence?: number;
  newConfidence?: number;
  escalationCorrections: number;
  resultSchema: DashboardSchema;
}): VerificationReport {
  const completedAt = Date.now();

  // Compute overall confidence from deterministic + AI results
  let overallConfidence: number;
  let overallVerdict: VerificationVerdict;

  if (params.aiResult) {
    // Combine: deterministic failures reduce AI confidence
    const deterministicPenalty = params.failCount * 0.15 + params.warnCount * 0.05;
    overallConfidence = clamp(params.aiResult.overallConfidence - deterministicPenalty, 0, 1);
  } else {
    // Deterministic only: base confidence on pass rate
    const totalChecks = params.passCount + params.warnCount + params.failCount;
    if (totalChecks === 0) {
      overallConfidence = 1.0;
    } else {
      overallConfidence = clamp(
        (params.passCount / totalChecks) - (params.failCount * 0.2),
        0, 1,
      );
    }
  }

  if (overallConfidence >= 0.90) overallVerdict = 'PASS';
  else if (overallConfidence >= 0.70) overallVerdict = 'WARN';
  else overallVerdict = 'FAIL';

  // Build summary
  const parts: string[] = [];
  if (params.failCount > 0) parts.push(`${params.failCount} critical issue${params.failCount > 1 ? 's' : ''}`);
  if (params.warnCount > 0) parts.push(`${params.warnCount} warning${params.warnCount > 1 ? 's' : ''}`);
  if (params.aiResult) parts.push(`AI confidence: ${(params.aiResult.overallConfidence * 100).toFixed(0)}%`);

  const summary = parts.length > 0
    ? `Verification ${overallVerdict}: ${parts.join(', ')}`
    : 'All checks passed — data integrity verified.';

  // Merge widget-level results
  const widgets: WidgetVerification[] = params.aiResult?.widgets || [];

  // Add deterministic-only widgets (not covered by AI) 
  const aiWidgetIds = new Set(widgets.map(w => w.widgetId));
  const dataWidgets = params.resultSchema.widgets.filter(w => !isNonDataWidget(w.type));
  for (const w of dataWidgets) {
    if (!aiWidgetIds.has(w.id)) {
      const widgetDChecks = params.deterministicChecks.filter(c => c.widgetId === w.id);
      const widgetFails = widgetDChecks.filter(c => !c.passed && c.severity === 'FAIL');
      const widgetWarns = widgetDChecks.filter(c => !c.passed && c.severity === 'WARN');

      let confidence = 1.0;
      confidence -= widgetFails.length * 0.2;
      confidence -= widgetWarns.length * 0.05;
      confidence = clamp(confidence, 0, 1);

      let verdict: VerificationVerdict = 'PASS';
      if (confidence < 0.70) verdict = 'FAIL';
      else if (confidence < 0.90) verdict = 'WARN';

      widgets.push({
        widgetId: w.id,
        widgetTitle: w.title,
        confidence,
        verdict,
        issues: [...widgetFails, ...widgetWarns].map(c => ({
          type: 'structural_error' as const,
          severity: c.severity === 'FAIL' ? 'error' as const : 'warning' as const,
          message: c.message,
          checkId: c.checkId,
        })),
      });
    }
  }

  return {
    startedAt: params.startedAt,
    completedAt,
    durationMs: completedAt - params.startedAt,
    overallConfidence,
    overallVerdict,
    summary,
    widgets,
    layers: {
      deterministic: {
        ran: true,
        passCount: params.passCount,
        warnCount: params.warnCount,
        failCount: params.failCount,
      },
      aiVerification: {
        ran: !!params.aiResult,
        model: params.aiModel,
        confidence: params.aiResult?.overallConfidence,
        skippedReason: params.aiSkippedReason,
      },
      escalation: {
        ran: params.escalationRan,
        model: params.escalationModel,
        previousConfidence: params.previousConfidence,
        newConfidence: params.newConfidence,
        corrections: params.escalationCorrections,
      },
    },
    deterministicChecks: params.deterministicChecks,
  };
}

function clamp(val: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, val));
}

function validateVerdict(v: unknown): VerificationVerdict {
  if (v === 'PASS' || v === 'WARN' || v === 'FAIL') return v;
  return 'WARN';
}
