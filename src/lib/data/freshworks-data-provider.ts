/**
 * Freshsales / Freshworks data provider.
 *
 * Mirrors the `SnowflakeDataProvider` interface so the widget query layer
 * treats Freshsales identically to Snowflake and sample data. The
 * architectural intent is: same shape in, same shape out, no Freshsales-
 * specific code in dashboards or widget renderers.
 *
 * Today's demo sources (registered below):
 *   - `freshsales_deals_by_stage`    → bar chart of count(deals) by stage
 *   - `freshsales_open_deal_count`   → KPI: open deal count
 *   - `freshsales_pipeline_value`    → KPI: sum(amount) over open deals
 *   - `freshsales_top_deals`         → table of top-N deals by amount
 *
 * Compliance refs:
 *   - Policy 3698 DC-02 (CC-tier source, classification auto-applied)
 *   - Policy 3699 DD-05 (read audit via underlying client)
 *   - Gap G-01 closure (classification flows through), G-05 (retention via cache)
 */

import {
  isFreshsalesConfigured,
  listDeals,
  listContacts,
  listAccounts,
  type FreshsalesDeal,
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
  'freshsales_deals_by_stage',
  'freshsales_open_deal_count',
  'freshsales_pipeline_value',
  'freshsales_top_deals',
  'freshsales_contacts_recent',
  'freshsales_accounts_recent',
] as const;

export type FreshworksSource = (typeof FRESHWORKS_SOURCES)[number];

export function isFreshworksSource(name: string): name is FreshworksSource {
  return (FRESHWORKS_SOURCES as readonly string[]).includes(name);
}

export function listFreshworksSources(): readonly FreshworksSource[] {
  return FRESHWORKS_SOURCES;
}

// ── Provider ─────────────────────────────────────────────────────────────────

export class FreshworksDataProvider {
  static isAvailable(): boolean {
    return isFreshsalesConfigured();
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
    if (!this.isAvailable()) {
      throw new Error(
        'Freshworks connector is not configured. Set FRESHSALES_API_KEY / FRESHSALES_DOMAIN to enable.'
      );
    }

    const role = user.role as UserRole;
    switch (source) {
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
}
