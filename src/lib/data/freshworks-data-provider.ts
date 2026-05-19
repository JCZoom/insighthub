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
  listFreshcallerUsers,
  type FreshcallerCall,
  isFreshchatConfigured,
  listConversations,
  listFreshchatUsers,
  type FreshchatConversation,
} from '@/lib/integrations/freshworks';
import type { SessionUser } from '@/lib/auth/session';
import type { UserRole } from '@/lib/integrations/freshworks';

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

const FRESHWORKS_SOURCES = [
  // Freshsales
  'freshsales_deals_by_stage',
  'freshsales_open_deal_count',
  'freshsales_pipeline_value',
  'freshsales_top_deals',
  'freshsales_contacts_recent',
  'freshsales_accounts_recent',
  // Freshdesk
  'freshdesk_tickets_by_status',
  'freshdesk_open_ticket_count',
  'freshdesk_overdue_ticket_count',
  'freshdesk_recent_tickets',
  'freshdesk_agents',
  // Freshcaller
  'freshcaller_calls_today',
  'freshcaller_calls_by_status',
  'freshcaller_recent_calls',
  // Freshchat
  'freshchat_active_conversations',
  'freshchat_conversations_by_status',
  'freshchat_recent_conversations',
] as const;

export type FreshworksSource = (typeof FRESHWORKS_SOURCES)[number];

export function isFreshworksSource(name: string): name is FreshworksSource {
  return (FRESHWORKS_SOURCES as readonly string[]).includes(name);
}

export function listFreshworksSources(): readonly FreshworksSource[] {
  return FRESHWORKS_SOURCES;
}

/** Which Freshworks product owns this source name (for routing + UI tabs). */
export function sourceProduct(name: FreshworksSource): 'freshsales' | 'freshdesk' | 'freshcaller' | 'freshchat' {
  if (name.startsWith('freshsales_')) return 'freshsales';
  if (name.startsWith('freshdesk_')) return 'freshdesk';
  if (name.startsWith('freshcaller_')) return 'freshcaller';
  if (name.startsWith('freshchat_')) return 'freshchat';
  // Unreachable given the literal-union type, but defensive.
  throw new Error(`Cannot determine product for source: ${name}`);
}

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
    // each deal object — we honor those when present, else fall back to name.
    const raw = d as unknown as Record<string, unknown>;
    if (raw.is_deal_won === true || raw.is_deal_lost === true) return false;
    const stage = String(raw.deal_stage_name ?? raw.stage ?? '').toLowerCase();
    return !(stage.includes('won') || stage.includes('lost') || stage.includes('closed'));
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
      const raw = d as unknown as Record<string, unknown>;
      const stage = String(raw.deal_stage_name ?? raw.stage ?? 'Unknown');
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

  private static async openDealCount(
    userId: string,
    role: UserRole,
    start: number
  ): Promise<FreshworksProviderResult> {
    const deals = await listDeals(userId, role, { limit: 100 });
    const open = deals.filter((d) => this.dealOpen(d));
    return this.finish(
      [{ value: open.length, label: 'Open deals' }],
      [
        { name: 'value', type: 'number' },
        { name: 'label', type: 'string' },
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
      .reduce((sum, d) => sum + (typeof d.amount === 'number' ? d.amount : 0), 0);
    return this.finish(
      [{ value: total, label: 'Pipeline ($, open)' }],
      [
        { name: 'value', type: 'number' },
        { name: 'label', type: 'string' },
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
      .sort((a, b) => (b.amount ?? 0) - (a.amount ?? 0))
      .slice(0, 10);
    const rows = top.map((d) => {
      const raw = d as unknown as Record<string, unknown>;
      return {
        id: d.id,
        name: d.name ?? '(no name)',
        amount: d.amount ?? 0,
        stage: raw.deal_stage_name ?? raw.stage ?? 'Unknown',
        primary_contact: d.primary_contact?.display_name ?? null,
        expected_close: d.expected_close ?? null,
      };
    });
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

  private static async openTicketCount(
    userId: string,
    role: UserRole,
    start: number
  ): Promise<FreshworksProviderResult> {
    const tickets = await this.fetchTickets(userId, role);
    const open = tickets.filter((t) => ticketIsOpen(t));
    return this.finish(
      [{ value: open.length, label: 'Open tickets' }],
      [
        { name: 'value', type: 'number' },
        { name: 'label', type: 'string' },
      ],
      start,
      role
    );
  }

  private static async overdueTicketCount(
    userId: string,
    role: UserRole,
    start: number
  ): Promise<FreshworksProviderResult> {
    const tickets = await this.fetchTickets(userId, role);
    const now = new Date();
    const overdue = tickets.filter((t) => ticketIsOverdue(t, now));
    return this.finish(
      [{ value: overdue.length, label: 'Overdue tickets' }],
      [
        { name: 'value', type: 'number' },
        { name: 'label', type: 'string' },
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

  private static async callsToday(
    userId: string,
    role: UserRole,
    start: number
  ): Promise<FreshworksProviderResult> {
    const calls = await this.fetchCalls(userId, role);
    const todayUtc = new Date().toISOString().slice(0, 10);
    const todays = calls.filter((c) => {
      if (!c.created_at) return false;
      return c.created_at.slice(0, 10) === todayUtc;
    });
    return this.finish(
      [{ value: todays.length, label: "Calls today (UTC)" }],
      [
        { name: 'value', type: 'number' },
        { name: 'label', type: 'string' },
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
      phone_number: c.phone_number ?? null,
      status: c.status ?? 'unknown',
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
      [{ value: active.length, label: 'Active conversations' }],
      [
        { name: 'value', type: 'number' },
        { name: 'label', type: 'string' },
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
