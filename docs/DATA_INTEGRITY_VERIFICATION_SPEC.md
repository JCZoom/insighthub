# Data Integrity Verification Pipeline — Technical Specification

> **Version:** 1.0  
> **Date:** 2026-04-19  
> **Status:** Implementation Ready  
> **Priority:** Critical — users act on dashboard data; incorrect data = incorrect decisions

---

## 1. Problem Statement

InsightHub dashboards are AI-generated. When a user says "show me churn by region," Claude produces schema patches that configure widgets with data sources, aggregations, filters, and chart types. If the AI misinterprets the user's intent, selects the wrong data source, applies the wrong aggregation function, or maps fields incorrectly, the dashboard displays **wrong data** — and users make real business decisions based on it.

Currently, the pipeline is: `User prompt → AI generates patches → patches applied → dashboard rendered`. There is **zero verification** between AI output and what the user sees.

---

## 2. Architecture Overview

A 3-layer verification pipeline inserted between patch generation and patch application:

```
User prompt → AI generates patches
                    ↓
          ┌─────────────────────────┐
          │  LAYER 1: Deterministic │  (free, <5ms)
          │  Structural & schema    │
          │  validation checks      │
          └──────────┬──────────────┘
                     ↓
          ┌─────────────────────────┐
          │  LAYER 2: AI Verify     │  (1 API call, ~2-4s)
          │  Semantic intent match  │
          │  via Claude Haiku       │
          └──────────┬──────────────┘
                     ↓ (if confidence < threshold)
          ┌─────────────────────────┐
          │  LAYER 2.5: Escalation  │  (conditional, ~3-6s)
          │  Deep review via Claude │
          │  Sonnet on low-conf     │
          └──────────┬──────────────┘
                     ↓
          Verification Report attached to patches
                     ↓
          Patches applied → Dashboard rendered with confidence indicators
```

---

## 3. Integration Points (Exact File Locations)

### 3.1 Server-Side: `/src/app/api/chat/route.ts`

**Streaming mode** (primary path): Insert verification after `processRealStream()` collects all patches and before the `complete` SSE event is sent (around line 374-404).

**Non-streaming mode** (fallback): Insert verification after `parseAIResponse()` and before the JSON response (around line 438-474).

### 3.2 Verification Module: `/src/lib/ai/verify-integrity.ts` (NEW)

All verification logic lives in a single module with clear exports:
- `verifyDashboardIntegrity()` — main entry point
- `runDeterministicChecks()` — Layer 1
- `runAIVerification()` — Layer 2
- `runEscalationReview()` — Layer 2.5

### 3.3 Client-Side: `/src/components/chat/ChatPanel.tsx`

Receive verification results via a new `verification` SSE event type. Display confidence badges on the assistant message.

### 3.4 Dashboard Store: `/src/stores/dashboard-store.ts`

Store per-widget verification scores in transient state (not persisted to DB). The `applyPatch` action receives optional verification metadata.

### 3.5 Types: `/src/types/index.ts`

New interfaces for verification results.

---

## 4. Layer 1: Deterministic Checks

**Cost:** Zero (pure computation)  
**Latency:** <5ms  
**Location:** `verify-integrity.ts → runDeterministicChecks()`

### 4.1 Checks to Implement

| Check ID | Check Name | Description | Severity |
|----------|-----------|-------------|----------|
| D-01 | Valid data source | `dataConfig.source` exists in the known sources list | FAIL |
| D-02 | Valid widget type | `type` is a recognized WidgetType | FAIL |
| D-03 | Required fields present | `id`, `type`, `title`, `position`, `dataConfig` all present | FAIL |
| D-04 | Position bounds | `x >= 0`, `y >= 0`, `w > 0`, `w <= 12`, `h > 0` | FAIL |
| D-05 | Grid alignment | Widget positions don't exceed 12-column grid (`x + w <= 12`) | WARN |
| D-06 | Valid aggregation | If `aggregation` specified, `function` is a known type and `field` exists in source schema | FAIL |
| D-07 | Valid groupBy | If `groupBy` specified, all fields exist in the source schema | WARN |
| D-08 | Source-field mapping | Fields referenced in `dataConfig` actually exist in the data source | FAIL |
| D-09 | Glossary term alignment | If widget title matches a glossary term, check that the data source and formula align with the glossary definition | WARN |
| D-10 | Duplicate widget IDs | No two widgets in the schema share the same ID | FAIL |
| D-11 | Chart-data compatibility | Chart type is appropriate for the data shape (e.g., pie chart needs categorical + numeric, not time series) | WARN |
| D-12 | Non-empty schema | `replace_all` patches contain at least 1 widget | WARN |
| D-13 | KPI aggregation sanity | KPI cards use aggregation functions that produce single values (sum, avg, count, min, max) not groupBy | WARN |

### 4.2 Source-Field Registry

Build a static registry of known data sources and their fields, derived from the pre-aggregated data sources defined in `prompts.ts` (lines 182-227):

```typescript
const SOURCE_FIELD_REGISTRY: Record<string, string[]> = {
  kpi_summary: ['total_customers', 'active_customers', 'mrr', 'arr', 'churn_rate', 'nrr', 'grr', 'gross_revenue_retention', 'avg_csat', 'open_tickets', 'avg_frt_minutes', 'pipeline_value', 'win_rate', 'avg_deal_size'],
  churn_by_month: ['month', 'churn_rate', 'churned', 'active_start'],
  churn_by_region: ['region', 'churn_rate', 'churned_customers', 'total_customers'],
  churn_by_plan: ['plan', 'churn_rate', 'customers'],
  revenue_by_month: ['month', 'total', 'new', 'expansion', 'contraction', 'churn'],
  mrr_by_month: ['month', 'mrr', 'growth'],
  tickets_by_month: ['month', 'total', 'resolved', 'avg_frt_minutes', 'csat'],
  tickets_by_category: ['category', 'count', 'avg_resolution_hours', 'csat'],
  tickets_by_team: ['team', 'open', 'pending', 'resolved', 'avg_resolution_hours', 'csat'],
  deals_pipeline: ['stage', 'count', 'value', 'avg_days'],
  deals_by_source: ['source', 'count', 'value', 'win_rate'],
  customers_by_plan: ['plan', 'count', 'revenue'],
  customers_by_region: ['region', 'count', 'mrr', 'churn_rate'],
  usage_by_feature: ['feature', 'daily_users', 'total_usage', 'adoption_rate'],
  usage_by_month: ['month', 'mail_scan', 'package_forward', 'check_deposit', 'address_use'],
};
```

### 4.3 Output Format

```typescript
interface DeterministicCheckResult {
  checkId: string;         // e.g., "D-01"
  passed: boolean;
  severity: 'FAIL' | 'WARN';
  message: string;         // Human-readable description
  widgetId?: string;       // Which widget failed (if applicable)
  field?: string;          // Which field was problematic
}
```

---

## 5. Layer 2: AI Verification

**Cost:** ~$0.002 per verification (Haiku-class model)  
**Latency:** ~2-4 seconds  
**Location:** `verify-integrity.ts → runAIVerification()`

### 5.1 Verification Prompt

Send a focused verification request to a fast model (Claude Haiku) with:

**Input context:**
1. The user's original message (intent)
2. The generated patches (what the AI produced)
3. The resulting schema (post-patch)
4. The glossary terms relevant to any referenced metrics
5. The source-field registry (so the verifier knows what fields exist)

**Verification prompt structure:**

```
You are a data integrity verifier for a BI dashboard builder. Your job is to check whether the AI-generated dashboard configuration correctly reflects the user's intent.

## User's Request
"{original_message}"

## Generated Schema (post-patch)
{schema_json}

## Glossary Terms
{relevant_glossary_terms}

## Available Data Sources & Fields
{source_field_registry}

## Verification Checklist
For each widget in the schema, verify:
1. INTENT MATCH: Does this widget address what the user asked for?
2. DATA SOURCE: Is the data source correct for this metric?
3. AGGREGATION: Is the aggregation function appropriate? (e.g., churn_rate should use avg not sum)
4. FIELD MAPPING: Are the referenced fields valid for this source?
5. GLOSSARY COMPLIANCE: Does the metric calculation match the glossary definition?
6. CHART TYPE: Is the visualization appropriate for this data?

## Response Format (JSON only)
{
  "overallConfidence": 0.0-1.0,
  "overallVerdict": "PASS" | "WARN" | "FAIL",
  "summary": "One-sentence summary of verification result",
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
}
```

### 5.2 Model Selection

- **Primary verifier:** `claude-haiku-3-20250414` — fast, cheap, good enough for structural checks
- **Escalation model:** `claude-sonnet-4-20250514` — same model that built the dashboard, used only when Haiku confidence < threshold

### 5.3 Confidence Thresholds

| Overall Confidence | Action | UX Treatment |
|---|---|---|
| ≥ 0.90 | PASS — apply patches normally | Green checkmark badge |
| 0.70–0.89 | WARN — apply patches with advisory | Yellow warning badge + tooltip |
| < 0.70 | ESCALATE → Layer 2.5 | Show "Verifying..." then result |

### 5.4 Cost Control

- Skip Layer 2 entirely for text_block-only patches (no data to verify)
- Skip Layer 2 for `remove_widget` and `update_layout` patches (no data integrity risk)
- Cache verification results keyed by `hash(user_message + patches_json)` for 5 minutes
- Only verify patches that touch `dataConfig` — pure visual changes are exempt

---

## 6. Layer 2.5: Escalation Review

**Cost:** ~$0.01 per escalation (same model as builder)  
**Latency:** ~3-6 seconds  
**Triggered:** Only when Layer 2 confidence < 0.70  
**Location:** `verify-integrity.ts → runEscalationReview()`

### 6.1 Escalation Prompt

Same structure as Layer 2, but with additional context:

```
The initial verification flagged concerns. Please perform a deep review.

## Initial Verification Issues
{layer2_issues}

## Additional Context
- The builder model used was claude-sonnet-4-20250514
- The user's conversation history: {conversation_history}
- Previous dashboard state: {previous_schema}

Please re-evaluate with extra scrutiny. If the initial concerns are valid, suggest specific corrections. If they are false positives, explain why.
```

### 6.2 Escalation Output

Same format as Layer 2, plus:
```typescript
interface EscalationResult extends AIVerificationResult {
  corrections?: SchemaPatch[];  // Optional corrective patches
  escalationReason: string;
}
```

If the escalation produces corrections, those patches replace the original ones.

---

## 7. Type Definitions

Add to `/src/types/index.ts`:

```typescript
// ── Data Integrity Verification ────────────────────────────

export type VerificationVerdict = 'PASS' | 'WARN' | 'FAIL';
export type VerificationSeverity = 'error' | 'warning';
export type VerificationIssueType =
  | 'intent_mismatch'
  | 'wrong_source'
  | 'wrong_aggregation'
  | 'invalid_field'
  | 'glossary_mismatch'
  | 'wrong_chart_type'
  | 'structural_error'
  | 'duplicate_id'
  | 'grid_overflow'
  | 'empty_schema';

export interface VerificationIssue {
  type: VerificationIssueType;
  severity: VerificationSeverity;
  message: string;
  checkId?: string;        // D-01 through D-13 for deterministic
  widgetId?: string;
  field?: string;
  suggestion?: string;     // What to fix
}

export interface WidgetVerification {
  widgetId: string;
  widgetTitle: string;
  confidence: number;      // 0.0–1.0
  verdict: VerificationVerdict;
  issues: VerificationIssue[];
}

export interface VerificationReport {
  // Timing
  startedAt: number;
  completedAt: number;
  durationMs: number;

  // Results
  overallConfidence: number;
  overallVerdict: VerificationVerdict;
  summary: string;

  // Per-widget
  widgets: WidgetVerification[];

  // Layer metadata
  layers: {
    deterministic: { ran: true; passCount: number; warnCount: number; failCount: number };
    aiVerification: { ran: boolean; model?: string; confidence?: number; skippedReason?: string };
    escalation: { ran: boolean; model?: string; previousConfidence?: number; newConfidence?: number; corrections?: number };
  };

  // Deterministic check details
  deterministicChecks: DeterministicCheckResult[];
}

export interface DeterministicCheckResult {
  checkId: string;
  passed: boolean;
  severity: 'FAIL' | 'WARN';
  message: string;
  widgetId?: string;
  field?: string;
}
```

---

## 8. SSE Event Integration

### 8.1 New SSE Event: `verification`

Sent after all `patch` events and before `explanation`:

```typescript
// In processRealStream() or post-stream processing
yield {
  event: 'verification',
  data: {
    overallConfidence: 0.95,
    overallVerdict: 'PASS',
    summary: 'All widgets verified — data sources, aggregations, and glossary terms match.',
    widgets: [...],
    durationMs: 2340,
  }
};
```

### 8.2 Client-Side Handling in ChatPanel.tsx

Add a new case in the SSE event switch:

```typescript
case 'verification':
  verificationReport = data;
  setStreamingState(prev => ({
    ...prev,
    verification: data,
    message: data.overallVerdict === 'PASS'
      ? '✓ Data integrity verified'
      : data.overallVerdict === 'WARN'
      ? '⚠ Verified with warnings'
      : '✗ Verification found issues',
  }));
  break;
```

---

## 9. UX: Confidence Indicators

### 9.1 Chat Message Badge

On the assistant message bubble, show a small badge:

| Verdict | Badge | Tooltip |
|---------|-------|---------|
| PASS (≥0.90) | 🟢 `Verified` | "All widgets passed data integrity checks" |
| WARN (0.70–0.89) | 🟡 `Review suggested` | "Some widgets have minor concerns — click to see details" |
| FAIL (<0.70) | 🔴 `Issues found` | "Data accuracy concerns detected — review before sharing" |

### 9.2 Per-Widget Indicators (Future Enhancement)

Small shield icon on each widget in the canvas:
- 🛡️ Green = verified
- 🛡️ Yellow = warning
- 🛡️ Red = issue

This is **deferred** to a follow-up pass — the chat badge is sufficient for V1.

---

## 10. Performance Budget

| Layer | Target Latency | Max Latency | Cost per Call |
|-------|---------------|-------------|---------------|
| L1: Deterministic | <5ms | 10ms | $0.00 |
| L2: AI Verify (Haiku) | <3s | 5s | ~$0.002 |
| L2.5: Escalation (Sonnet) | <5s | 8s | ~$0.01 |
| **Total (no escalation)** | **<3s** | **5s** | **~$0.002** |
| **Total (with escalation)** | **<8s** | **13s** | **~$0.012** |

### 10.1 Optimization Rules

1. **Skip verification for non-data patches**: `remove_widget`, `update_layout`, `update_filters`, text_block-only `add_widget`
2. **Parallel execution**: Run Layer 1 and Layer 2 concurrently (L1 is instant, so start L2 immediately)
3. **Hash-based cache**: Cache verification results for identical `(message, patches)` pairs for 5 minutes
4. **Timeout**: If Layer 2 takes >5s, return Layer 1 results only with `aiVerification.skippedReason: 'timeout'`
5. **Graceful degradation**: If AI verification fails entirely, patches still apply — just without verification badge

---

## 11. Configuration

### 11.1 Environment Variables

Add to `.env.local` and `/src/lib/env.ts`:

```
# Data Integrity Verification
VERIFY_INTEGRITY_ENABLED=true          # Master toggle
VERIFY_INTEGRITY_AI_ENABLED=true       # Toggle AI layer (Layer 2/2.5)
VERIFY_INTEGRITY_CONFIDENCE_THRESHOLD=0.70  # Below this triggers escalation
VERIFY_INTEGRITY_TIMEOUT_MS=5000       # Max wait for AI verification
```

### 11.2 Admin Toggle

The verification pipeline respects the existing admin settings system. Add a toggle in system settings to enable/disable verification globally or per-user-role.

---

## 12. Files to Create/Modify

### New Files
| File | Purpose |
|------|---------|
| `src/lib/ai/verify-integrity.ts` | Core verification module (Layers 1, 2, 2.5) |
| `src/lib/ai/source-field-registry.ts` | Static registry of data sources and their fields |

### Modified Files
| File | Changes |
|------|---------|
| `src/types/index.ts` | Add verification type definitions |
| `src/app/api/chat/route.ts` | Integrate verification into streaming and non-streaming flows |
| `src/components/chat/ChatPanel.tsx` | Handle `verification` SSE event, display confidence badge |
| `src/lib/env.ts` | Add verification environment variables |
| `.env.example` | Add verification env var examples |

---

## 13. Testing Strategy

### 13.1 Unit Tests for Deterministic Checks

Test each D-01 through D-13 check with:
- Valid widget configs (should pass)
- Invalid widget configs (should fail with correct check ID)
- Edge cases (empty strings, missing fields, boundary values)

### 13.2 Integration Tests

- Mock Anthropic API responses for Layer 2/2.5
- Test the full pipeline: valid patches → PASS
- Test with intentionally wrong data sources → FAIL
- Test escalation trigger (low confidence from Layer 2)
- Test timeout handling (slow AI response)
- Test skip logic (text_block only patches bypass AI)

### 13.3 Manual QA Scenarios

1. "Show me MRR trend" → verify `mrr_by_month` source is used, not `revenue_by_month`
2. "Show churn rate" → verify aggregation is `avg` not `sum` (churn_rate is a percentage)
3. "Show pipeline value" → verify `deals_pipeline` source with correct stage/value fields
4. Build a complex 10-widget dashboard → verify all widgets independently

---

## 14. Implementation Order

1. **Create `source-field-registry.ts`** — static data, no dependencies
2. **Add type definitions to `types/index.ts`** — types needed by everything
3. **Implement `verify-integrity.ts`** — core verification logic
   - 3a. `runDeterministicChecks()` first
   - 3b. `runAIVerification()` second
   - 3c. `runEscalationReview()` third
   - 3d. `verifyDashboardIntegrity()` orchestrator
4. **Update `env.ts`** — add configuration variables
5. **Integrate into `chat/route.ts`** — wire into streaming and non-streaming paths
6. **Update `ChatPanel.tsx`** — handle verification SSE event + display badge
7. **Update `.env.example`** — document new variables

---

## 15. Rollback Plan

The entire feature is behind `VERIFY_INTEGRITY_ENABLED`. If any issues arise:
1. Set `VERIFY_INTEGRITY_ENABLED=false` → pipeline skipped entirely
2. Set `VERIFY_INTEGRITY_AI_ENABLED=false` → only deterministic checks run (zero cost, zero latency)
3. The verification is **advisory only** — patches always apply regardless of verdict. The only difference is the UX badge.

---

## 16. Future Enhancements (Out of Scope for V1)

- **Per-widget shield icons** on the dashboard canvas
- **Historical verification reports** stored in DB for audit trail
- **Auto-correction**: When escalation produces corrections, optionally auto-apply them
- **User feedback loop**: "Was this data correct?" button to improve verification accuracy
- **Statistical anomaly detection**: Compare widget values against historical baselines
- **Snowflake cross-validation**: When Snowflake is connected, run the actual query and compare results
