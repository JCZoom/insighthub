/**
 * Freshworks suite data provider.
 *
 * Mirrors the `SnowflakeDataProvider` interface so the widget query layer
 * treats Freshworks identically to Snowflake and sample data. The
 * architectural intent is: same shape in, same shape out, no Freshworks-
 * specific code in dashboards or widget renderers.
 *
 * Registered sources span all 4 Freshworks products:
 *   FRESHSALES (CRM):
 *     - `freshsales_deals_by_stage`    → bar chart
 *     - `freshsales_open_deal_count`   → KPI
 *     - `freshsales_pipeline_value`    → KPI
 *     - `freshsales_top_deals`         → table
 *     - `freshsales_contacts_recent`   → table
 *     - `freshsales_accounts_recent`   → table
 *   FRESHDESK (support tickets):
 *     - `freshdesk_tickets_by_status`  → bar chart
 *     - `freshdesk_open_ticket_count`  → KPI
 *     - `freshdesk_overdue_ticket_count` → KPI
 *     - `freshdesk_recent_tickets`     → table
 *     - `freshdesk_agents`             → table
 *   FRESHCALLER (voice):
 *     - `freshcaller_calls_today`      → KPI
 *     - `freshcaller_calls_by_status`  → bar chart
 *     - `freshcaller_recent_calls`     → table
 *   FRESHCHAT (messaging):
 *     - `freshchat_active_conversations` → KPI
 *     - `freshchat_conversations_by_status` → bar chart
 *     - `freshchat_recent_conversations` → table
 *
 * Compliance refs:
 *   - Policy 3698 DC-02 (CC-tier source, classification auto-applied)
 *   - Policy 3699 DD-05 (read audit via underlying clients)
 *   - Gap G-01 closure (classification flows through), G-05 (retention via cache)
 */

import {
  isFreshsalesConfigured,
  listDeals,
  listContacts,
  listAccounts,
  type FreshsalesDeal,
  isFreshdeskConfigured,
  listTickets,
  listAgents,
  ticketIsOpen,
  ticketIsOverdue,
  FRESHDESK_STATUS,
  type FreshdeskTicket,
  isFreshcallerConfigured,
  listCalls,
  freshcallerCallStatus,
  freshcallerCallPhone,
  type FreshcallerCall,
  isFreshchatConfigured,
  listConversations,
  type FreshchatConversation,
} from '@/lib/integrations/freshworks';
import type { SessionUser } from '@/lib/auth/session';
import type { UserRole } from '@/lib/integrations/freshworks';
import { FRESHWORKS_SOURCES } from './freshworks-sources';

// Same shape as SnowflakeDataProvider produces, for drop-in compatibility.
export interface FreshworksProviderResult {
  data: Record<string, unknown>[];
  columns: Array<{ name: string; type: string }>;
  executionTime: number;
  totalRows: number;
  fromCache: boolean;
  dataSource: 'freshworks';
  // Hint to the dashboard layer that this source is auto-classified CC.
  classification: 'CUSTOMER_CONFIDENTIAL';
  isFiltered: boolean;
}

// ── Registered demo sources ──────────────────────────────────────────────────
//
// The canonical list and the pure name-based helpers
// (`isFreshworksSource`, `listFreshworksSources`, `sourceProduct`,
// `FreshworksSource`) live in `freshworks-sources.ts` so they are
// safe to import from client components without dragging the
// integration clients (and their `ioredis` dependency) into the
// browser bundle. We re-export them here so all existing server-side
// imports (`@/lib/data/freshworks-data-provider`) keep working
// untouched.

export {
  FRESHWORKS_SOURCES,
  isFreshworksSource,
  listFreshworksSources,
  sourceProduct,
} from './freshworks-sources';
export type { FreshworksSource } from './freshworks-sources';

// ── Provider ─────────────────────────────────────────────────────────────────

export class FreshworksDataProvider {
  /** True if ANY of the 4 products is configured. */
  static isAvailable(): boolean {
    return (
      isFreshsalesConfigured() ||
      isFreshdeskConfigured() ||
      isFreshcallerConfigured() ||
      isFreshchatConfigured()
    );
  }

  /** Per-product availability for UI gating. */
  static productAvailability(): Record<'freshsales' | 'freshdesk' | 'freshcaller' | 'freshchat', boolean> {
    return {
      freshsales: isFreshsalesConfigured(),
      freshdesk: isFreshdeskConfigured(),
      freshcaller: isFreshcallerConfigured(),
      freshchat: isFreshchatConfigured(),
    };
  }

  /**
   * Query a registered Freshworks source.
   *
   * Throws if the source is unknown — caller should check `isFreshworksSource()`
   * first, or the dashboard layer should route by `dataSource` first.
   */
  static async queryData(
    source: string,
    user: SessionUser
  ): Promise<FreshworksProviderResult> {
    const start = Date.now();
    const role = user.role as UserRole;
    switch (source) {
      // ── Freshsales ──────────────────────────────────────────────────────
      case 'freshsales_deals_by_stage':
        return this.dealsByStage(user.id, role, start);
      case 'freshsales_open_deal_count':
        return this.openDealCount(user.id, role, start);
      case 'freshsales_pipeline_value':
        return this.pipelineValue(user.id, role, start);
      case 'freshsales_top_deals':
        return this.topDeals(user.id, role, start);
      case 'freshsales_contacts_recent':
        return this.contactsRecent(user.id, role, start);
      case 'freshsales_accounts_recent':
        return this.accountsRecent(user.id, role, start);
      // ── Freshdesk ───────────────────────────────────────────────────────
      case 'freshdesk_tickets_by_status':
        return this.ticketsByStatus(user.id, role, start);
      case 'freshdesk_open_ticket_count':
        return this.openTicketCount(user.id, role, start);
      case 'freshdesk_overdue_ticket_count':
        return this.overdueTicketCount(user.id, role, start);
      case 'freshdesk_recent_tickets':
        return this.recentTickets(user.id, role, start);
      case 'freshdesk_agents':
        return this.freshdeskAgents(user.id, role, start);
      // ── Freshcaller ─────────────────────────────────────────────────────
      case 'freshcaller_calls_today':
        return this.callsToday(user.id, role, start);
      case 'freshcaller_calls_by_status':
        return this.callsByStatus(user.id, role, start);
      case 'freshcaller_recent_calls':
        return this.recentCalls(user.id, role, start);
      // ── Freshchat ───────────────────────────────────────────────────────
      case 'freshchat_active_conversations':
        return this.activeConversations(user.id, role, start);
      case 'freshchat_conversations_by_status':
        return this.conversationsByStatus(user.id, role, start);
      case 'freshchat_recent_conversations':
        return this.recentConversations(user.id, role, start);
      default:
        throw new Error(
          `Unknown Freshworks source: "${source}". Known: ${FRESHWORKS_SOURCES.join(', ')}`
        );
    }
  }

  // ── Internal source implementations ────────────────────────────────────────
  // Each returns the standard FreshworksProviderResult shape. We fetch via the
  // connector (which handles cache + audit + redaction) then shape into rows.

  private static dealOpen(d: FreshsalesDeal): boolean {
    // Heuristic: any deal not explicitly named/staged 'won' or 'lost' is "open".
    // The real Freshsales API exposes a `is_deal_lost` / `is_deal_won` flag on
    // each deal object — we honor those when present, else fall back to the
    // enriched `_stage_name` (added by enrichDealWithStageName at fetch time).
    const raw = d as unknown as Record<string, unknown>;
    if (raw.is_deal_won === true || raw.is_deal_lost === true) return false;
    const stage = String(raw._stage_name ?? raw.deal_stage_name ?? raw.stage ?? '').toLowerCase();
    return !(stage.includes('won') || stage.includes('lost') || stage.includes('closed'));
  }

  /**
   * Read a Freshsales deal's amount from whichever field shape the tenant uses.
   *
   * Freshsales returns `amount` as either:
   *   - a plain number (older tenants)
   *   - a localized currency object: { value: '12345.00', currency: 'USD' }
   *   - undefined (open deals often have no amount estimate)
   */
  private static dealAmount(d: FreshsalesDeal): number {
    const raw = d as unknown as Record<string, unknown>;
    const a: unknown = raw.amount;
    if (typeof a === 'number' && Number.isFinite(a)) return a;
    if (typeof a === 'string') {
      const n = parseFloat(a);
      if (Number.isFinite(n)) return n;
    }
    if (a && typeof a === 'object' && 'value' in (a as Record<string, unknown>)) {
      const v = (a as Record<string, unknown>).value;
      if (typeof v === 'number') return v;
      if (typeof v === 'string') {
        const n = parseFloat(v);
        if (Number.isFinite(n)) return n;
      }
    }
    return 0;
  }

  /** Read the human-friendly stage name for a deal (post-enrichment). */
  private static dealStage(d: FreshsalesDeal): string {
    const raw = d as unknown as Record<string, unknown>;
    return String(raw._stage_name ?? raw.deal_stage_name ?? raw.stage ?? 'Unknown');
  }

  private static finish(
    data: Record<string, unknown>[],
    columns: Array<{ name: string; type: string }>,
    start: number,
    role: UserRole
  ): FreshworksProviderResult {
    return {
      data,
      columns,
      executionTime: Date.now() - start,
      totalRows: data.length,
      fromCache: false, // honest default; underlying client may have used cache
      dataSource: 'freshworks',
      classification: 'CUSTOMER_CONFIDENTIAL',
      // VIEWER/CREATOR get masked rows from the connector — surface that fact.
      isFiltered: role === 'VIEWER' || role === 'CREATOR',
    };
  }

  private static async dealsByStage(
    userId: string,
    role: UserRole,
    start: number
  ): Promise<FreshworksProviderResult> {
    const deals = await listDeals(userId, role, { limit: 100 });
    const counts = new Map<string, number>();
    for (const d of deals) {
      const stage = this.dealStage(d);
      counts.set(stage, (counts.get(stage) ?? 0) + 1);
    }
    const rows = Array.from(counts.entries())
      .map(([stage, count]) => ({ stage, count }))
      .sort((a, b) => b.count - a.count);
    return this.finish(
      rows,
      [
        { name: 'stage', type: 'string' },
        { name: 'count', type: 'number' },
      ],
      start,
      role
    );
  }

  // ── Period-over-period (PoP) policy ────────────────────────────────────────
  //
  // Each KPI source either computes a *real* `previous_value` from the
  // underlying API or returns `previous_value: null` with an explicit
  // `comparison_unavailable_reason`. We do NOT fabricate, interpolate, or
  // hash-derive comparison numbers — the KpiCard renderer (truth-by-default
  // since 2026-05-19) only displays a trend pill when `previous_value` is a
  // real finite number. Anything else surfaces as "no comparison available"
  // with the reason in a tooltip — transparency over fabrication.
  //
  // Capability summary (verified against vendor API docs 2026-05-19):
  //   - Freshcaller listCalls() supports `from=<ISO date>`        → IMPLEMENTED
  //     (callsToday)
  //   - Freshdesk   listTickets() supports `updated_since` +
  //                 `include=stats` for stats.resolved_at          → IMPLEMENTED
  //     via fetchTicketsForPoP / wasTicketOpenAt / wasTicketOverdueAt
  //     (openTicketCount, overdueTicketCount)
  //   - Freshchat   listConversations() has NO date filter         → NOT computable
  //   - Freshsales  listDeals() has NO date filter                 → NOT computable
  //
  // For sources where PoP is not computable from a single REST call, we set
  // `comparison_unavailable_reason` to a specific phrase. The long-term fix is
  // a snapshot-history table (cron-populated daily/weekly) — tracked as
  // G-FW-PoP-1 in docs/AI_DASHBOARD_BUILDER_FINDINGS_2026-05-19.md.
  private static readonly POP_REASON_NO_DATE_FILTER =
    'Source API has no date filter — historical snapshot table required for honest PoP.';

  private static async openDealCount(
    userId: string,
    role: UserRole,
    start: number
  ): Promise<FreshworksProviderResult> {
    const deals = await listDeals(userId, role, { limit: 100 });
    const open = deals.filter((d) => this.dealOpen(d));
    return this.finish(
      [{
        value: open.length,
        label: 'Open deals',
        previous_value: null,
        comparison_label: null,
        comparison_unavailable_reason: this.POP_REASON_NO_DATE_FILTER,
      }],
      [
        { name: 'value', type: 'number' },
        { name: 'label', type: 'string' },
        { name: 'previous_value', type: 'number' },
        { name: 'comparison_label', type: 'string' },
        { name: 'comparison_unavailable_reason', type: 'string' },
      ],
      start,
      role
    );
  }

  private static async pipelineValue(
    userId: string,
    role: UserRole,
    start: number
  ): Promise<FreshworksProviderResult> {
    const deals = await listDeals(userId, role, { limit: 100 });
    const total = deals
      .filter((d) => this.dealOpen(d))
      .reduce((sum, d) => sum + this.dealAmount(d), 0);
    return this.finish(
      [{
        value: total,
        label: 'Pipeline ($, open)',
        previous_value: null,
        comparison_label: null,
        comparison_unavailable_reason: this.POP_REASON_NO_DATE_FILTER,
      }],
      [
        { name: 'value', type: 'number' },
        { name: 'label', type: 'string' },
        { name: 'previous_value', type: 'number' },
        { name: 'comparison_label', type: 'string' },
        { name: 'comparison_unavailable_reason', type: 'string' },
      ],
      start,
      role
    );
  }

  private static async topDeals(
    userId: string,
    role: UserRole,
    start: number
  ): Promise<FreshworksProviderResult> {
    const deals = await listDeals(userId, role, { limit: 100 });
    const top = deals
      .filter((d) => this.dealOpen(d))
      .sort((a, b) => this.dealAmount(b) - this.dealAmount(a))
      .slice(0, 10);
    const rows = top.map((d) => ({
      id: d.id,
      name: d.name ?? '(no name)',
      amount: this.dealAmount(d),
      stage: this.dealStage(d),
      primary_contact: d.primary_contact?.display_name ?? null,
      expected_close: d.expected_close ?? null,
    }));
    return this.finish(
      rows,
      [
        { name: 'id', type: 'string' },
        { name: 'name', type: 'string' },
        { name: 'amount', type: 'number' },
        { name: 'stage', type: 'string' },
        { name: 'primary_contact', type: 'string' },
        { name: 'expected_close', type: 'string' },
      ],
      start,
      role
    );
  }

  private static async contactsRecent(
    userId: string,
    role: UserRole,
    start: number
  ): Promise<FreshworksProviderResult> {
    const contacts = await listContacts(userId, role, { limit: 25 });
    const rows = contacts.map((c) => ({
      id: c.id,
      name:
        c.display_name ??
        (`${c.first_name ?? ''} ${c.last_name ?? ''}`.trim() || '(no name)'),
      email: c.email ?? null,
      phone: c.mobile_number ?? c.work_number ?? null,
    }));
    return this.finish(
      rows,
      [
        { name: 'id', type: 'string' },
        { name: 'name', type: 'string' },
        { name: 'email', type: 'string' },
        { name: 'phone', type: 'string' },
      ],
      start,
      role
    );
  }

  private static async accountsRecent(
    userId: string,
    role: UserRole,
    start: number
  ): Promise<FreshworksProviderResult> {
    const accounts = await listAccounts(userId, role, { limit: 25 });
    const rows = accounts.map((a) => ({
      id: a.id,
      name: a.name ?? '(no name)',
      website: a.website ?? null,
      phone: a.phone ?? null,
    }));
    return this.finish(
      rows,
      [
        { name: 'id', type: 'string' },
        { name: 'name', type: 'string' },
        { name: 'website', type: 'string' },
        { name: 'phone', type: 'string' },
      ],
      start,
      role
    );
  }

  // ── Freshdesk source implementations ───────────────────────────────────────

  private static async fetchTickets(
    userId: string,
    role: UserRole
  ): Promise<FreshdeskTicket[]> {
    // Pull a generous window once and derive multiple sources from it. The
    // 60-s cache + per-product TTL keeps this efficient under demo load.
    return listTickets(userId, role, { limit: 100, include: 'requester' });
  }

  /**
   * Honest dataset for open/overdue ticket PoP.
   *
   * Returns the dedup-merge of two API calls:
   *   1. listTickets({ limit: 100, include: 'stats' }) — most-recently-updated
   *      window, gives us currently-open tickets that have any activity.
   *   2. listTickets({ limit: 100, include: 'stats', updated_since: T-PERIOD })
   *      — wider catch-net for tickets resolved within the comparison
   *      window (we need their `stats.resolved_at` to know whether they
   *      were still open at T-PERIOD).
   *
   * `include=stats` is the critical addition over `fetchTickets()` — it
   * gives us `stats.resolved_at` per ticket, which is the only honest way
   * to know "was this ticket open at T-PERIOD".
   *
   * Known approximation: a currently-open ticket that has had NO activity
   * in either window will not appear in the merged set (and therefore
   * undercounts the "open at T-PERIOD" tally). This is rare for live
   * support workflows but is recorded honestly via
   * `comparison_unavailable_reason` when the response hits the API row cap.
   *
   * Per-API-call cost: 2 round-trips, but each is a separate cache key
   * with the standard 60-s server TTL. A typical dashboard view triggers
   * 0 fetches after warm-up.
   */
  private static async fetchTicketsForPoP(
    userId: string,
    role: UserRole,
    periodMs: number
  ): Promise<{
    tickets: FreshdeskTicket[];
    /** True when either underlying call hit the 100-row cap (PoP may be incomplete). */
    possiblyTruncated: boolean;
    /** Cutoff used for "open at T-PERIOD" calculations. */
    cutoff: Date;
  }> {
    const cutoff = new Date(Date.now() - periodMs);
    const cutoffIso = cutoff.toISOString();
    const FW_LIMIT = 100;
    const [recentSlice, periodSlice] = await Promise.all([
      listTickets(userId, role, { limit: FW_LIMIT, include: 'stats' }),
      listTickets(userId, role, { limit: FW_LIMIT, include: 'stats', updatedSince: cutoffIso }),
    ]);
    const byId = new Map<number, FreshdeskTicket>();
    for (const t of [...recentSlice, ...periodSlice]) {
      if (typeof t.id === 'number') byId.set(t.id, t);
    }
    const possiblyTruncated = recentSlice.length >= FW_LIMIT || periodSlice.length >= FW_LIMIT;
    return { tickets: Array.from(byId.values()), possiblyTruncated, cutoff };
  }

  /**
   * Was this ticket open at the cutoff timestamp? Honest predicate:
   *   - Must have been created before the cutoff (ticket existed)
   *   - AND either currently open, OR resolved AFTER the cutoff
   *     (i.e. its resolved_at > cutoff implies it WAS still open at cutoff).
   *
   * Returns null if we don't have enough info to decide honestly (no
   * created_at, or resolved-status ticket without stats.resolved_at).
   * Callers should treat null as "exclude from count" rather than guess.
   */
  private static wasTicketOpenAt(t: FreshdeskTicket, cutoff: Date): boolean | null {
    if (!t.created_at) return null;
    const createdMs = new Date(t.created_at).getTime();
    if (!Number.isFinite(createdMs)) return null;
    if (createdMs >= cutoff.getTime()) return false; // didn't exist yet
    if (ticketIsOpen(t)) return true; // still open today, was created before cutoff
    // Currently resolved/closed: need resolved_at from stats.
    const stats = (t as { stats?: { resolved_at?: string | null } }).stats;
    const resolvedAtRaw = stats?.resolved_at;
    if (!resolvedAtRaw) return null; // can't decide honestly
    const resolvedMs = new Date(resolvedAtRaw).getTime();
    if (!Number.isFinite(resolvedMs)) return null;
    return resolvedMs > cutoff.getTime();
  }

  /**
   * Was this ticket overdue at the cutoff timestamp?
   *   = was open at cutoff AND its due_by was before the cutoff
   * Returns null when underlying open-state cannot be honestly determined.
   */
  private static wasTicketOverdueAt(t: FreshdeskTicket, cutoff: Date): boolean | null {
    const wasOpen = this.wasTicketOpenAt(t, cutoff);
    if (wasOpen !== true) return wasOpen; // false or null pass through
    if (!t.due_by) return false;
    const dueMs = new Date(t.due_by).getTime();
    if (!Number.isFinite(dueMs)) return null;
    return dueMs < cutoff.getTime();
  }

  private static async ticketsByStatus(
    userId: string,
    role: UserRole,
    start: number
  ): Promise<FreshworksProviderResult> {
    const tickets = await this.fetchTickets(userId, role);
    const counts = new Map<string, number>();
    for (const t of tickets) {
      const label = t.status != null ? (FRESHDESK_STATUS[t.status] ?? `Status ${t.status}`) : 'Unknown';
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
    const rows = Array.from(counts.entries())
      .map(([status, count]) => ({ status, count }))
      .sort((a, b) => b.count - a.count);
    return this.finish(
      rows,
      [
        { name: 'status', type: 'string' },
        { name: 'count', type: 'number' },
      ],
      start,
      role
    );
  }

  /**
   * Open ticket count — current value with HONEST 7-day-ago PoP.
   *
   * Uses fetchTicketsForPoP() to get the merged dataset (recent activity +
   * 7d window with stats). Computes:
   *   - value          = currently-open tickets in the merged set
   *   - previous_value = tickets that WERE open at cutoff = T-7d, derived
   *                      from wasTicketOpenAt() (uses stats.resolved_at)
   *
   * If either underlying API call hit the 100-row cap, the historical
   * count may be incomplete — we degrade to previous_value: null with a
   * specific reason rather than show a partially-correct number.
   */
  private static async openTicketCount(
    userId: string,
    role: UserRole,
    start: number
  ): Promise<FreshworksProviderResult> {
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
    const { tickets, possiblyTruncated, cutoff } = await this.fetchTicketsForPoP(
      userId,
      role,
      SEVEN_DAYS_MS
    );
    const currentlyOpen = tickets.filter((t) => ticketIsOpen(t)).length;
    let openAtCutoff = 0;
    let undecidable = 0;
    for (const t of tickets) {
      const verdict = this.wasTicketOpenAt(t, cutoff);
      if (verdict === true) openAtCutoff += 1;
      else if (verdict === null) undecidable += 1;
    }
    const popHonest = !possiblyTruncated && undecidable === 0;
    const reason = possiblyTruncated
      ? 'API window at 100-row cap on at least one underlying call — historical open count may be incomplete; paginate before trusting PoP.'
      : undecidable > 0
        ? `${undecidable} ticket(s) lacked stats.resolved_at — historical open count cannot be derived honestly without complete stats.`
        : null;

    return this.finish(
      [{
        value: currentlyOpen,
        label: 'Open tickets',
        previous_value: popHonest ? openAtCutoff : null,
        comparison_label: popHonest ? 'vs 7 days ago' : null,
        comparison_unavailable_reason: reason,
      }],
      [
        { name: 'value', type: 'number' },
        { name: 'label', type: 'string' },
        { name: 'previous_value', type: 'number' },
        { name: 'comparison_label', type: 'string' },
        { name: 'comparison_unavailable_reason', type: 'string' },
      ],
      start,
      role
    );
  }

  /**
   * Overdue ticket count — current value with HONEST 7-day-ago PoP.
   *
   * Same merged dataset as openTicketCount(). "Overdue at T-7d" requires
   * the ticket was both OPEN at T-7d (wasTicketOpenAt) AND its due_by was
   * already in the past at T-7d (wasTicketOverdueAt). When either
   * predicate is undecidable for a row, we exclude it from the count and
   * surface the underlying limitation through `comparison_unavailable_reason`.
   */
  private static async overdueTicketCount(
    userId: string,
    role: UserRole,
    start: number
  ): Promise<FreshworksProviderResult> {
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
    const { tickets, possiblyTruncated, cutoff } = await this.fetchTicketsForPoP(
      userId,
      role,
      SEVEN_DAYS_MS
    );
    const now = new Date();
    const currentlyOverdue = tickets.filter((t) => ticketIsOverdue(t, now)).length;
    let overdueAtCutoff = 0;
    let undecidable = 0;
    for (const t of tickets) {
      const verdict = this.wasTicketOverdueAt(t, cutoff);
      if (verdict === true) overdueAtCutoff += 1;
      else if (verdict === null) undecidable += 1;
    }
    const popHonest = !possiblyTruncated && undecidable === 0;
    const reason = possiblyTruncated
      ? 'API window at 100-row cap on at least one underlying call — historical overdue count may be incomplete; paginate before trusting PoP.'
      : undecidable > 0
        ? `${undecidable} ticket(s) lacked stats.resolved_at or a parseable due_by — historical overdue count cannot be derived honestly.`
        : null;

    return this.finish(
      [{
        value: currentlyOverdue,
        label: 'Overdue tickets',
        previous_value: popHonest ? overdueAtCutoff : null,
        comparison_label: popHonest ? 'vs 7 days ago' : null,
        comparison_unavailable_reason: reason,
      }],
      [
        { name: 'value', type: 'number' },
        { name: 'label', type: 'string' },
        { name: 'previous_value', type: 'number' },
        { name: 'comparison_label', type: 'string' },
        { name: 'comparison_unavailable_reason', type: 'string' },
      ],
      start,
      role
    );
  }

  private static async recentTickets(
    userId: string,
    role: UserRole,
    start: number
  ): Promise<FreshworksProviderResult> {
    const tickets = await this.fetchTickets(userId, role);
    const top = tickets
      .slice()
      .sort((a, b) => {
        const at = a.updated_at ? new Date(a.updated_at).getTime() : 0;
        const bt = b.updated_at ? new Date(b.updated_at).getTime() : 0;
        return bt - at;
      })
      .slice(0, 10);
    const rows = top.map((t) => ({
      id: t.id,
      subject: t.subject ?? '(no subject)',
      status: t.status != null ? (FRESHDESK_STATUS[t.status] ?? `Status ${t.status}`) : 'Unknown',
      requester_email: t.requester?.email ?? null,
      due_by: t.due_by ?? null,
      updated_at: t.updated_at ?? null,
    }));
    return this.finish(
      rows,
      [
        { name: 'id', type: 'number' },
        { name: 'subject', type: 'string' },
        { name: 'status', type: 'string' },
        { name: 'requester_email', type: 'string' },
        { name: 'due_by', type: 'string' },
        { name: 'updated_at', type: 'string' },
      ],
      start,
      role
    );
  }

  private static async freshdeskAgents(
    userId: string,
    role: UserRole,
    start: number
  ): Promise<FreshworksProviderResult> {
    const agents = await listAgents(userId, role, { limit: 50 });
    const rows = agents.map((a) => ({
      id: a.id,
      name: a.contact?.name ?? '(unnamed)',
      email: a.contact?.email ?? null,
      available: a.available ?? null,
    }));
    return this.finish(
      rows,
      [
        { name: 'id', type: 'number' },
        { name: 'name', type: 'string' },
        { name: 'email', type: 'string' },
        { name: 'available', type: 'string' },
      ],
      start,
      role
    );
  }

  // ── Freshcaller source implementations ─────────────────────────────────────

  private static async fetchCalls(
    userId: string,
    role: UserRole
  ): Promise<FreshcallerCall[]> {
    return listCalls(userId, role, { limit: 100 });
  }

  /**
   * Today's Freshcaller call count, with HONEST yesterday-vs-today PoP.
   *
   * Implementation:
   *   - Fetch up to 200 calls with `from=<yesterday UTC>` so the response
   *     window spans both yesterday and today.
   *   - Bucket by UTC date string. value = today's count, previous_value =
   *     yesterday's count.
   *   - If the response is at the 200-row cap we cannot guarantee the
   *     yesterday bucket is complete, so we set previous_value: null with
   *     an honest reason. (At low/moderate call volume the bucket is
   *     complete and the comparison is real.)
   *
   * This is the reference implementation of the truth-by-default PoP
   * pattern. Other KPI sources either follow this pattern (when their API
   * supports date filters) or explicitly return previous_value: null with
   * a `comparison_unavailable_reason` — never a fabricated number.
   */
  private static async callsToday(
    userId: string,
    role: UserRole,
    start: number
  ): Promise<FreshworksProviderResult> {
    const now = new Date();
    const todayUtc = now.toISOString().slice(0, 10);
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const yesterdayUtc = yesterday.toISOString().slice(0, 10);

    const WINDOW_LIMIT = 200;
    // Single API call covers both buckets. `from` is inclusive on yesterday.
    const calls = await listCalls(userId, role, { limit: WINDOW_LIMIT, from: yesterdayUtc });

    const isToday = (c: FreshcallerCall) =>
      typeof c.created_at === 'string' && c.created_at.slice(0, 10) === todayUtc;
    const isYesterday = (c: FreshcallerCall) =>
      typeof c.created_at === 'string' && c.created_at.slice(0, 10) === yesterdayUtc;

    const todayCount = calls.filter(isToday).length;
    const yesterdayCount = calls.filter(isYesterday).length;

    // If the API returned exactly WINDOW_LIMIT rows we may have truncated
    // either bucket — in that case we cannot honestly claim a complete
    // yesterday count, so we degrade the comparison transparently.
    const possiblyTruncated = calls.length >= WINDOW_LIMIT;
    const popHonest = !possiblyTruncated;

    return this.finish(
      [{
        value: todayCount,
        label: 'Calls today (UTC)',
        previous_value: popHonest ? yesterdayCount : null,
        comparison_label: popHonest ? 'vs yesterday (UTC)' : null,
        comparison_unavailable_reason: popHonest
          ? null
          : `API returned ${WINDOW_LIMIT}-row cap — yesterday's count may be incomplete; raise limit or paginate before trusting PoP.`,
      }],
      [
        { name: 'value', type: 'number' },
        { name: 'label', type: 'string' },
        { name: 'previous_value', type: 'number' },
        { name: 'comparison_label', type: 'string' },
        { name: 'comparison_unavailable_reason', type: 'string' },
      ],
      start,
      role
    );
  }

  private static async callsByStatus(
    userId: string,
    role: UserRole,
    start: number
  ): Promise<FreshworksProviderResult> {
    const calls = await this.fetchCalls(userId, role);
    const counts = new Map<string, number>();
    for (const c of calls) {
      // Use the resolver that tolerates Freshcaller's varying field names.
      const label = freshcallerCallStatus(c);
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
    const rows = Array.from(counts.entries())
      .map(([status, count]) => ({ status, count }))
      .sort((a, b) => b.count - a.count);
    return this.finish(
      rows,
      [
        { name: 'status', type: 'string' },
        { name: 'count', type: 'number' },
      ],
      start,
      role
    );
  }

  private static async recentCalls(
    userId: string,
    role: UserRole,
    start: number
  ): Promise<FreshworksProviderResult> {
    const calls = await this.fetchCalls(userId, role);
    const top = calls
      .slice()
      .sort((a, b) => {
        const at = a.created_at ? new Date(a.created_at).getTime() : 0;
        const bt = b.created_at ? new Date(b.created_at).getTime() : 0;
        return bt - at;
      })
      .slice(0, 10);
    const rows = top.map((c) => ({
      id: c.id,
      phone_number: freshcallerCallPhone(c),
      status: freshcallerCallStatus(c),
      duration_s: c.call_duration ?? c.bill_duration ?? null,
      created_at: c.created_at ?? null,
    }));
    return this.finish(
      rows,
      [
        { name: 'id', type: 'string' },
        { name: 'phone_number', type: 'string' },
        { name: 'status', type: 'string' },
        { name: 'duration_s', type: 'number' },
        { name: 'created_at', type: 'string' },
      ],
      start,
      role
    );
  }

  // ── Freshchat source implementations ───────────────────────────────────────

  private static async fetchConversations(
    userId: string,
    role: UserRole
  ): Promise<FreshchatConversation[]> {
    return listConversations(userId, role, { limit: 100 });
  }

  private static async activeConversations(
    userId: string,
    role: UserRole,
    start: number
  ): Promise<FreshworksProviderResult> {
    const convos = await this.fetchConversations(userId, role);
    const active = convos.filter((c) => c.status === 'new' || c.status === 'assigned');
    return this.finish(
      [{
        value: active.length,
        label: 'Active conversations',
        previous_value: null,
        comparison_label: null,
        comparison_unavailable_reason: this.POP_REASON_NO_DATE_FILTER,
      }],
      [
        { name: 'value', type: 'number' },
        { name: 'label', type: 'string' },
        { name: 'previous_value', type: 'number' },
        { name: 'comparison_label', type: 'string' },
        { name: 'comparison_unavailable_reason', type: 'string' },
      ],
      start,
      role
    );
  }

  private static async conversationsByStatus(
    userId: string,
    role: UserRole,
    start: number
  ): Promise<FreshworksProviderResult> {
    const convos = await this.fetchConversations(userId, role);
    const counts = new Map<string, number>();
    for (const c of convos) {
      const label = c.status ?? 'unknown';
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
    const rows = Array.from(counts.entries())
      .map(([status, count]) => ({ status, count }))
      .sort((a, b) => b.count - a.count);
    return this.finish(
      rows,
      [
        { name: 'status', type: 'string' },
        { name: 'count', type: 'number' },
      ],
      start,
      role
    );
  }

  private static async recentConversations(
    userId: string,
    role: UserRole,
    start: number
  ): Promise<FreshworksProviderResult> {
    const convos = await this.fetchConversations(userId, role);
    const top = convos
      .slice()
      .sort((a, b) => {
        const at = a.updated_time ? new Date(a.updated_time).getTime() : 0;
        const bt = b.updated_time ? new Date(b.updated_time).getTime() : 0;
        return bt - at;
      })
      .slice(0, 10);
    const rows = top.map((c) => ({
      conversation_id: c.conversation_id,
      status: c.status ?? 'unknown',
      channel_id: c.channel_id ?? null,
      assigned_agent_id: c.assigned_agent_id ?? null,
      updated_time: c.updated_time ?? null,
    }));
    return this.finish(
      rows,
      [
        { name: 'conversation_id', type: 'string' },
        { name: 'status', type: 'string' },
        { name: 'channel_id', type: 'string' },
        { name: 'assigned_agent_id', type: 'string' },
        { name: 'updated_time', type: 'string' },
      ],
      start,
      role
    );
  }
}
