/**
 * Real (live) data source schemas — CLIENT-SAFE.
 *
 * Column metadata for every Freshworks + Platform Health source served
 * by `FreshworksDataProvider` and `PlatformHealthDataProvider`. Pure
 * constants; zero runtime dependencies and zero imports of server-only
 * modules. Safe to import from React Client Components.
 *
 * ── Why this file exists ──────────────────────────────────────────────
 *
 * The Data Explorer (`/api/data/schema`) historically inlined column
 * metadata for only the 16 sample/demo sources (`kpi_summary`,
 * `mrr_by_month`, etc.) in `generateSchemaFromSampleData()`. With the
 * post-2026-05-19 demo-source quarantine (FEATURE_DEMO_SOURCES), those
 * 16 sources are correctly hidden from discovery — but the schema
 * generator had no entries for the 17 Freshworks sources or the 12
 * Platform Health sources. Net effect: with the flag off, the Data
 * Explorer rendered real source NAMES with empty column tables.
 *
 * This module is the canonical schema for the real-data sources. It is
 * the source of truth that:
 *   - `/api/data/schema` reads to populate column metadata for the Data
 *     Explorer / Visual Query Builder.
 *   - Future automation can read to verify provider output shape
 *     against advertised columns.
 *
 * If a provider method changes its row shape (e.g. adds a new column),
 * update the entry here in the same commit so the Data Explorer doesn't
 * lie about what columns are available.
 *
 * ── Truth-by-default row shapes ───────────────────────────────────────
 *
 * Every KPI source uses the same 5-column contract established in the
 * 2026-05-19 PoP rebuild (commit ce1535e):
 *
 *   { value, label, previous_value, comparison_label,
 *     comparison_unavailable_reason }
 *
 * Lifted into the `KPI_5_FIELD_SHAPE` constant below so a future
 * addition to the contract (e.g. `comparison_window_seconds`) is a
 * one-line change.
 *
 * Architectural justification: docs/REAL_DATA_MIGRATION_PLAN_2026-05-19.md
 * Phase B.
 */

export interface RealSourceColumn {
  name: string;
  /** TypeScript-leaning type label: 'string' | 'number' | 'boolean'. */
  type: string;
  /** Plain-English column description for the Data Explorer tooltip. */
  description?: string;
}

export interface RealSourceSchema {
  description: string;
  /** Which RBAC category this source is exposed under (for grouping). */
  category: 'Operations' | 'Sales' | 'Support' | 'Voice' | 'Messaging' | 'Platform' | 'Diagnostics';
  columns: RealSourceColumn[];
}

/**
 * Canonical 5-column row shape for single-row KPI sources with honest
 * period-over-period. Hoisted into a constant so additions to the
 * contract land in one place.
 */
const KPI_5_FIELD_SHAPE: RealSourceColumn[] = [
  { name: 'value', type: 'number', description: 'Current observed value.' },
  { name: 'label', type: 'string', description: 'Human-readable label for the KPI.' },
  { name: 'previous_value', type: 'number', description: 'Honest comparison baseline; null when no comparison is computable.' },
  { name: 'comparison_label', type: 'string', description: 'Human-readable label for the comparison window (e.g. "vs 7 days ago"); null when unavailable.' },
  { name: 'comparison_unavailable_reason', type: 'string', description: 'Why no comparison is available (vendor API has no date filter, no history yet, etc.); null when a comparison IS available.' },
];

export const REAL_SOURCE_SCHEMAS: Record<string, RealSourceSchema> = {
  // ── Freshsales (CRM) ───────────────────────────────────────────────
  freshsales_pipeline_value: {
    description: 'Total weighted pipeline value across all open deals.',
    category: 'Sales',
    columns: KPI_5_FIELD_SHAPE,
  },
  freshsales_open_deal_count: {
    description: 'Number of deals currently in open stages.',
    category: 'Sales',
    columns: KPI_5_FIELD_SHAPE,
  },
  freshsales_deals_by_stage: {
    description: 'Deal counts grouped by pipeline stage.',
    category: 'Sales',
    columns: [
      { name: 'stage', type: 'string', description: 'Pipeline stage name from the Freshsales sales-cycle configuration.' },
      { name: 'count', type: 'number', description: 'Number of open deals currently in this stage.' },
    ],
  },
  freshsales_top_deals: {
    description: 'Top open deals by expected amount.',
    category: 'Sales',
    columns: [
      { name: 'id', type: 'string', description: 'Freshsales deal ID.' },
      { name: 'name', type: 'string', description: 'Deal name.' },
      { name: 'amount', type: 'number', description: 'Expected deal value in tenant currency.' },
      { name: 'stage', type: 'string', description: 'Current pipeline stage.' },
      { name: 'primary_contact', type: 'string', description: 'Primary contact display name (redacted for VIEWER role).' },
      { name: 'expected_close', type: 'string', description: 'Expected close date (ISO 8601).' },
    ],
  },
  freshsales_contacts_recent: {
    description: 'Most recently created Freshsales contacts.',
    category: 'Sales',
    columns: [
      { name: 'id', type: 'string', description: 'Freshsales contact ID.' },
      { name: 'name', type: 'string', description: 'Contact name (redacted for VIEWER role).' },
      { name: 'email', type: 'string', description: 'Contact email (redacted for VIEWER role).' },
      { name: 'phone', type: 'string', description: 'Contact phone (redacted for VIEWER role).' },
    ],
  },
  freshsales_accounts_recent: {
    description: 'Most recently created Freshsales accounts.',
    category: 'Sales',
    columns: [
      { name: 'id', type: 'string', description: 'Freshsales account ID.' },
      { name: 'name', type: 'string', description: 'Account name.' },
      { name: 'website', type: 'string', description: 'Account website URL.' },
      { name: 'phone', type: 'string', description: 'Account phone (redacted for VIEWER role).' },
    ],
  },
  // ── Freshdesk (support tickets) ─────────────────────────────────────
  freshdesk_tickets_by_status: {
    description: 'Ticket counts grouped by current status.',
    category: 'Support',
    columns: [
      { name: 'status', type: 'string', description: 'Freshdesk status label (Open, Pending, Resolved, Closed).' },
      { name: 'count', type: 'number', description: 'Number of tickets currently in this status.' },
    ],
  },
  freshdesk_open_ticket_count: {
    description: 'Number of currently open tickets (honest 7d PoP).',
    category: 'Support',
    columns: KPI_5_FIELD_SHAPE,
  },
  freshdesk_overdue_ticket_count: {
    description: 'Open tickets past their due-by timestamp (honest 7d PoP).',
    category: 'Support',
    columns: KPI_5_FIELD_SHAPE,
  },
  freshdesk_recent_tickets: {
    description: 'Most recently updated Freshdesk tickets.',
    category: 'Support',
    columns: [
      { name: 'id', type: 'number', description: 'Freshdesk ticket ID.' },
      { name: 'subject', type: 'string', description: 'Ticket subject line.' },
      { name: 'status', type: 'string', description: 'Current status label.' },
      { name: 'requester_email', type: 'string', description: 'Requester email (redacted for VIEWER role).' },
      { name: 'due_by', type: 'string', description: 'SLA due timestamp (ISO 8601).' },
      { name: 'updated_at', type: 'string', description: 'Last update timestamp (ISO 8601).' },
    ],
  },
  freshdesk_agents: {
    description: 'Configured Freshdesk agent roster.',
    category: 'Support',
    columns: [
      { name: 'id', type: 'number', description: 'Freshdesk agent ID.' },
      { name: 'name', type: 'string', description: 'Agent display name.' },
      { name: 'email', type: 'string', description: 'Agent email.' },
      { name: 'available', type: 'string', description: 'Whether the agent is marked available for assignment.' },
    ],
  },
  // ── Freshcaller (voice) ─────────────────────────────────────────────
  freshcaller_calls_today: {
    description: "Today's call volume (honest yesterday-vs-today PoP).",
    category: 'Voice',
    columns: KPI_5_FIELD_SHAPE,
  },
  freshcaller_calls_by_status: {
    description: 'Call counts grouped by resolved call status.',
    category: 'Voice',
    columns: [
      { name: 'status', type: 'string', description: 'Resolved call status (completed/missed/ended). Integer codes from Freshcaller v1 are translated; unmapped codes appear as code-<n>.' },
      { name: 'count', type: 'number', description: 'Number of calls in this status.' },
    ],
  },
  freshcaller_recent_calls: {
    description: 'Most recently created Freshcaller calls.',
    category: 'Voice',
    columns: [
      { name: 'id', type: 'string', description: 'Freshcaller call ID.' },
      { name: 'phone_number', type: 'string', description: 'Customer phone number (redacted for VIEWER/CREATOR roles).' },
      { name: 'status', type: 'string', description: 'Resolved call status.' },
      { name: 'duration_s', type: 'number', description: 'Call duration in seconds; null when unavailable on list-view responses.' },
      { name: 'created_at', type: 'string', description: 'Call creation timestamp (ISO 8601); resolved from created_time/created_at.' },
    ],
  },
  // ── Freshchat (messaging) ───────────────────────────────────────────
  freshchat_active_conversations: {
    description: 'Number of currently-active Freshchat conversations.',
    category: 'Messaging',
    columns: KPI_5_FIELD_SHAPE,
  },
  freshchat_conversations_by_status: {
    description: 'Conversation counts grouped by current status.',
    category: 'Messaging',
    columns: [
      { name: 'status', type: 'string', description: 'Conversation status (new, assigned, resolved, etc.).' },
      { name: 'count', type: 'number', description: 'Number of conversations in this status.' },
    ],
  },
  freshchat_recent_conversations: {
    description: 'Most recently updated Freshchat conversations.',
    category: 'Messaging',
    columns: [
      { name: 'conversation_id', type: 'string', description: 'Freshchat conversation ID.' },
      { name: 'status', type: 'string', description: 'Current conversation status.' },
      { name: 'channel_id', type: 'string', description: 'Channel the conversation arrived on.' },
      { name: 'assigned_agent_id', type: 'string', description: 'Agent currently assigned, or null.' },
      { name: 'updated_time', type: 'string', description: 'Last update timestamp (ISO 8601).' },
    ],
  },
  // ── Platform Health (Prisma-backed) ────────────────────────────────
  platform_user_count: {
    description: 'Total InsightHub user count with honest 7-day PoP.',
    category: 'Platform',
    columns: KPI_5_FIELD_SHAPE,
  },
  platform_users_by_role: {
    description: 'User counts grouped by role. Current-state only; role is mutable and not history-tracked.',
    category: 'Platform',
    columns: [
      { name: 'role', type: 'string', description: 'User role (ADMIN, CREATOR, VIEWER).' },
      { name: 'count', type: 'number', description: 'Number of users currently holding this role.' },
    ],
  },
  platform_active_users_7d: {
    description: 'Distinct users with audit-log activity in the last 7d (vs prior 7d).',
    category: 'Platform',
    columns: KPI_5_FIELD_SHAPE,
  },
  platform_dashboards_total: {
    description: 'Active (non-archived) dashboards with honest 7-day PoP.',
    category: 'Platform',
    columns: KPI_5_FIELD_SHAPE,
  },
  platform_dashboards_created_30d: {
    description: 'Dashboards created in the last 30 days (vs prior 30 days).',
    category: 'Platform',
    columns: KPI_5_FIELD_SHAPE,
  },
  platform_dashboards_created_by_month: {
    description: 'Monthly dashboard-creation counts for the last 12 months (UTC).',
    category: 'Platform',
    columns: [
      { name: 'month', type: 'string', description: 'Calendar month bucket as YYYY-MM (UTC).' },
      { name: 'count', type: 'number', description: 'Number of dashboards created in this month.' },
    ],
  },
  platform_classification_distribution: {
    description: 'Dashboards grouped by current classification. Current-state only; classification is mutable.',
    category: 'Platform',
    columns: [
      { name: 'classification', type: 'string', description: 'Data classification label (PUBLIC, USZOOM_RESTRICTED, etc.).' },
      { name: 'count', type: 'number', description: 'Number of dashboards currently at this classification.' },
    ],
  },
  platform_glossary_term_count: {
    description: 'Total glossary terms with honest 7-day PoP.',
    category: 'Platform',
    columns: KPI_5_FIELD_SHAPE,
  },
  platform_glossary_by_category: {
    description: 'Glossary terms grouped by category.',
    category: 'Platform',
    columns: [
      { name: 'category', type: 'string', description: 'Glossary category label.' },
      { name: 'count', type: 'number', description: 'Number of terms currently in this category.' },
    ],
  },
  platform_audit_events_today: {
    description: 'Audit events recorded today with honest yesterday-vs-today PoP (UTC).',
    category: 'Platform',
    columns: KPI_5_FIELD_SHAPE,
  },
  platform_audit_events_by_type_30d: {
    description: 'Audit events grouped by action type over the last 30 days.',
    category: 'Platform',
    columns: [
      { name: 'action', type: 'string', description: 'AuditLog action identifier.' },
      { name: 'count', type: 'number', description: 'Number of events with this action in the last 30 days.' },
    ],
  },
  // ── Freshworks Health (connector diagnostics) ──────────────────────
  // Wraps probeFreshworksHealth() — see
  // src/lib/data/freshworks-health-data-provider.ts. Health is a
  // current-state signal; KPI sources here always render an honest
  // "no comparison available" pill (previous_value=null + reason set).
  freshworks_health_ok_count: {
    description: 'Number of Freshworks sources currently healthy (status="ok"). Honest absence pill — health probes are not history-tracked.',
    category: 'Diagnostics',
    columns: KPI_5_FIELD_SHAPE,
  },
  freshworks_health_suspicious_count: {
    description: 'Freshworks sources with at least one integrity-smell flag raised (STATUS_ALL_UNKNOWN, ALL_NULL_TIMESTAMPS, SINGLE_BUCKET, etc.). Investigate before trusting downstream dashboards.',
    category: 'Diagnostics',
    columns: KPI_5_FIELD_SHAPE,
  },
  freshworks_health_error_count: {
    description: 'Freshworks sources whose probe threw an error (vendor 4xx/5xx, network issue, parser failure).',
    category: 'Diagnostics',
    columns: KPI_5_FIELD_SHAPE,
  },
  freshworks_health_summary: {
    description: 'Per-status counts across all registered Freshworks sources. Status vocabulary: ok / suspicious / empty / error / not_configured. All five buckets always present, even if zero, so the chart shape is stable.',
    category: 'Diagnostics',
    columns: [
      { name: 'status', type: 'string', description: 'Probe-resolved status label.' },
      { name: 'count', type: 'number', description: 'Number of registered Freshworks sources currently in this status.' },
    ],
  },
  freshworks_health_per_source: {
    description: 'One row per registered Freshworks source with its current probe state, latency, integrity flags, and any error message. Sample rows and field-shape diagnostics are intentionally not included here — the operator-microscope view at /admin/freshworks/health surfaces those.',
    category: 'Diagnostics',
    columns: [
      { name: 'source', type: 'string', description: 'Registered Freshworks source name.' },
      { name: 'product', type: 'string', description: 'Owning product brand (freshsales / freshdesk / freshcaller / freshchat).' },
      { name: 'status', type: 'string', description: 'Resolved probe status (ok / suspicious / empty / error / not_configured).' },
      { name: 'row_count', type: 'number', description: 'Rows returned by the probe call.' },
      { name: 'latency_ms', type: 'number', description: 'End-to-end probe latency for this source in milliseconds.' },
      { name: 'flags', type: 'string', description: 'Comma-separated integrity flags (ZERO_ROWS, STATUS_ALL_UNKNOWN, ALL_NULL_TIMESTAMPS, ALL_NULL_DURATIONS, SINGLE_BUCKET, NOT_CONFIGURED, ERROR).' },
      { name: 'from_cache', type: 'boolean', description: 'Whether the probe served this row from the integration-client cache.' },
      { name: 'error', type: 'string', description: 'Error message when status is "error"; null otherwise.' },
    ],
  },
  platform_recent_audit_events: {
    description: '25 most recent audit events joined to actor names.',
    category: 'Platform',
    columns: [
      { name: 'id', type: 'string', description: 'AuditLog row ID.' },
      { name: 'action', type: 'string', description: 'Action identifier.' },
      { name: 'resource_type', type: 'string', description: 'Type of resource the action applied to.' },
      { name: 'resource_id', type: 'string', description: 'ID of the affected resource.' },
      { name: 'name', type: 'string', description: 'Actor display name (redacted for VIEWER/CREATOR roles).' },
      { name: 'user_id', type: 'string', description: 'Actor user ID.' },
      { name: 'created_at', type: 'string', description: 'Event timestamp (ISO 8601, UTC).' },
    ],
  },
};

/** True when the given name has a registered real-source schema. */
export function hasRealSourceSchema(name: string): boolean {
  return Object.prototype.hasOwnProperty.call(REAL_SOURCE_SCHEMAS, name);
}

/** Get the schema for a real source, or undefined if not registered. */
export function getRealSourceSchema(name: string): RealSourceSchema | undefined {
  return REAL_SOURCE_SCHEMAS[name];
}

/** List every registered real-source name. */
export function listRealSourceNames(): readonly string[] {
  return Object.keys(REAL_SOURCE_SCHEMAS);
}
