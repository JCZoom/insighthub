const MONTHS = [
  '2025-01', '2025-02', '2025-03', '2025-04', '2025-05', '2025-06',
  '2025-07', '2025-08', '2025-09', '2025-10', '2025-11', '2025-12',
  '2026-01', '2026-02', '2026-03', '2026-04',
];

const REGIONS = ['Northeast', 'Southeast', 'Midwest', 'West', 'International'];
const PLANS = ['starter', 'professional', 'enterprise'];
const TICKET_CATEGORIES = ['billing', 'technical', 'onboarding', 'feature_request', 'cancellation'];
const DEAL_STAGES = ['prospect', 'qualified', 'proposal', 'negotiation', 'closed_won', 'closed_lost'];
const FEATURES = ['mail_scan', 'package_forward', 'check_deposit', 'address_use'];
const TEAMS = ['Recipient Support', 'Form 1583', 'Sales', 'Mail Centers', 'Partner AI'];

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

let rand = seededRandom(42);

function pick<T>(arr: T[]): T {
  return arr[Math.floor(rand() * arr.length)];
}

function randBetween(min: number, max: number): number {
  return min + rand() * (max - min);
}

function randInt(min: number, max: number): number {
  return Math.floor(randBetween(min, max + 1));
}

import { type SessionUser } from '@/lib/auth/session';
import { canAccessDataSource, getDataCategoryForSource } from '@/lib/auth/permissions';

export interface SampleDataResult {
  data: Record<string, unknown>[];
  columns: string[];
  accessDenied?: boolean;
  deniedReason?: string;
}

// Pre-generated data sets for different widget queries
function generateMrrByMonth(): Record<string, unknown>[] {
  let mrr = 4200000;
  return MONTHS.map(month => {
    mrr = mrr * (1 + randBetween(-0.005, 0.025));
    return { month, mrr: Math.round(mrr), growth: +(randBetween(-0.5, 2.5)).toFixed(1) };
  });
}

function generateChurnByRegion(): Record<string, unknown>[] {
  return REGIONS.map(region => ({
    region,
    churn_rate: +(randBetween(4, 6)).toFixed(1),
    churned_customers: randInt(3500, 5500),
    total_customers: randInt(80000, 110000),
  }));
}

function generateChurnByMonth(): Record<string, unknown>[] {
  return MONTHS.map(month => ({
    month,
    churn_rate: +(randBetween(4.5, 5.5)).toFixed(1),
    churned: randInt(18000, 22000),
    active_start: randInt(395000, 405000),
  }));
}

function generateChurnByPlan(): Record<string, unknown>[] {
  return PLANS.map(plan => ({
    plan,
    churn_rate: plan === 'enterprise' ? +(randBetween(2, 4)).toFixed(1)
      : plan === 'professional' ? +(randBetween(4, 6)).toFixed(1)
      : +(randBetween(6, 8)).toFixed(1),
    customers: plan === 'enterprise' ? randInt(35000, 45000)
      : plan === 'professional' ? randInt(90000, 110000)
      : randInt(250000, 270000),
  }));
}

function generateTicketsByCategory(): Record<string, unknown>[] {
  return TICKET_CATEGORIES.map(category => ({
    category,
    count: randInt(8000, 35000),
    avg_resolution_hours: +(randBetween(2, 48)).toFixed(1),
    csat: +(randBetween(65, 96)).toFixed(1),
  }));
}

function generateTicketsByMonth(): Record<string, unknown>[] {
  return MONTHS.map(month => ({
    month,
    total: randInt(85000, 95000),
    resolved: randInt(78000, 90000),
    avg_frt_minutes: randInt(8, 45),
    csat: +(randBetween(70, 94)).toFixed(1),
  }));
}

function generateTicketsByTeam(): Record<string, unknown>[] {
  return TEAMS.map(team => ({
    team,
    open: randInt(300, 900),
    pending: randInt(150, 500),
    resolved: randInt(12000, 25000),
    avg_resolution_hours: +(randBetween(4, 36)).toFixed(1),
    csat: +(randBetween(70, 96)).toFixed(1),
  }));
}

function generateRevenueByType(): Record<string, unknown>[] {
  return ['new', 'expansion', 'contraction', 'churn', 'reactivation'].map(type => ({
    event_type: type,
    amount: type === 'new' ? randInt(350000, 600000)
      : type === 'expansion' ? randInt(120000, 250000)
      : type === 'contraction' ? -randInt(30000, 80000)
      : type === 'churn' ? -randInt(70000, 120000)
      : randInt(20000, 60000),
    count: type === 'new' ? randInt(3000, 6000)
      : type === 'churn' ? randInt(4500, 6500)
      : randInt(500, 3000),
  }));
}

function generateRevenueByMonth(): Record<string, unknown>[] {
  let total = 4200000;
  return MONTHS.map(month => {
    const newRev = randInt(350000, 600000);
    const expansion = randInt(120000, 250000);
    const contraction = -randInt(30000, 80000);
    const churn = -randInt(70000, 120000);
    total = total + newRev + expansion + contraction + churn;
    return { month, total: Math.round(total), new: newRev, expansion, contraction: Math.abs(contraction), churn: Math.abs(churn) };
  });
}

function generateDealsPipeline(): Record<string, unknown>[] {
  return DEAL_STAGES.filter(s => !s.startsWith('closed')).map(stage => ({
    stage,
    count: randInt(20, 120),
    value: randInt(200000, 2000000),
    avg_days: randInt(5, 60),
  }));
}

function generateDealsBySource(): Record<string, unknown>[] {
  return ['inbound', 'outbound', 'referral', 'partner'].map(source => ({
    source,
    count: randInt(40, 200),
    value: randInt(500000, 4000000),
    win_rate: +(randBetween(15, 55)).toFixed(1),
  }));
}

function generateUsageByFeature(): Record<string, unknown>[] {
  return FEATURES.map(feature => ({
    feature,
    daily_users: randInt(50000, 200000),
    total_usage: randInt(1000000, 8000000),
    adoption_rate: +(randBetween(20, 85)).toFixed(1),
  }));
}

function generateUsageByMonth(): Record<string, unknown>[] {
  return MONTHS.map(month => ({
    month,
    mail_scan: randInt(2000000, 4500000),
    package_forward: randInt(500000, 1500000),
    check_deposit: randInt(300000, 900000),
    address_use: randInt(3000000, 7000000),
  }));
}

function generateCustomersByPlan(): Record<string, unknown>[] {
  return [
    { plan: 'starter', count: randInt(258000, 262000), revenue: randInt(2450000, 2650000) },
    { plan: 'professional', count: randInt(98000, 102000), revenue: randInt(1450000, 1550000) },
    { plan: 'enterprise', count: randInt(39000, 41000), revenue: randInt(1500000, 1700000) },
  ];
}

function generateCustomersByRegion(): Record<string, unknown>[] {
  return REGIONS.map(region => ({
    region,
    count: randInt(78000, 82000),
    mrr: randInt(950000, 1050000),
    churn_rate: +(randBetween(4, 6)).toFixed(1),
  }));
}

function generateKpiSummary(): Record<string, unknown>[] {
  const total_customers = randInt(395000, 405000);
  const active_customers = total_customers - randInt(2000, 8000);
  const mrr = randInt(4800000, 5200000);
  const arr = mrr * 12;
  const grr = +(randBetween(85, 92)).toFixed(1);
  return [{
    total_customers,
    active_customers,
    mrr,
    arr,
    churn_rate: +(randBetween(4.5, 5.5)).toFixed(1),
    nrr: +(randBetween(94, 100)).toFixed(1),
    grr,
    gross_revenue_retention: grr,
    avg_csat: +(randBetween(78, 92)).toFixed(1),
    open_tickets: randInt(3000, 5000),
    avg_frt_minutes: randInt(12, 30),
    pipeline_value: randInt(4000000, 8000000),
    win_rate: +(randBetween(25, 45)).toFixed(1),
    avg_deal_size: randInt(15000, 40000),
  }];
}

const DATA_GENERATORS: Record<string, () => Record<string, unknown>[]> = {
  'kpi_summary': generateKpiSummary,
  'mrr_by_month': generateMrrByMonth,
  'churn_by_region': generateChurnByRegion,
  'churn_by_month': generateChurnByMonth,
  'churn_by_plan': generateChurnByPlan,
  'tickets_by_category': generateTicketsByCategory,
  'tickets_by_month': generateTicketsByMonth,
  'tickets_by_team': generateTicketsByTeam,
  'revenue_by_type': generateRevenueByType,
  'revenue_by_month': generateRevenueByMonth,
  'deals_pipeline': generateDealsPipeline,
  'deals_by_source': generateDealsBySource,
  'usage_by_feature': generateUsageByFeature,
  'usage_by_month': generateUsageByMonth,
  'customers_by_plan': generateCustomersByPlan,
  'customers_by_region': generateCustomersByRegion,
  // Table aliases from AI-generated queries
  'sample_customers': generateCustomersByRegion,
  'sample_subscriptions': generateMrrByMonth,
  'sample_tickets': generateTicketsByMonth,
  'sample_revenue': generateRevenueByMonth,
  'sample_usage': generateUsageByMonth,
  'sample_deals': generateDealsPipeline,
  // Common AI-generated source name variations
  'churn_rate_by_month': generateChurnByMonth,
  'churn_rate_by_region': generateChurnByRegion,
  'churn_rate_by_plan': generateChurnByPlan,
  'monthly_churn': generateChurnByMonth,
  'monthly_revenue': generateRevenueByMonth,
  'monthly_mrr': generateMrrByMonth,
  'ticket_volume': generateTicketsByMonth,
  'ticket_volume_by_month': generateTicketsByMonth,
  'tickets_by_status': generateTicketsByCategory,
  'pipeline': generateDealsPipeline,
  'pipeline_by_stage': generateDealsPipeline,
  'customer_distribution': generateCustomersByPlan,
  'overall_kpi': generateKpiSummary,
  'summary': generateKpiSummary,
  // Additional aliases for common AI-generated source names
  'customers': generateCustomersByRegion,
  'customer_growth': generateCustomersByRegion,
  'customer_growth_trend': generateCustomersByRegion,
  'total_customers': generateKpiSummary,
  'customer_count': generateKpiSummary,
  'customer_metrics': generateKpiSummary,
  'kpi': generateKpiSummary,
  'kpis': generateKpiSummary,
  'metrics': generateKpiSummary,
  'overview': generateKpiSummary,
  'revenue': generateRevenueByMonth,
  'revenue_trend': generateRevenueByMonth,
  'mrr': generateMrrByMonth,
  'mrr_trend': generateMrrByMonth,
  'churn': generateChurnByMonth,
  'churn_rate': generateChurnByMonth,
  'tickets': generateTicketsByMonth,
  'support_tickets': generateTicketsByMonth,
  'deals': generateDealsPipeline,
  'sales': generateDealsBySource,
  'sales_pipeline': generateDealsPipeline,
  'usage': generateUsageByMonth,
  'feature_usage': generateUsageByFeature,
  // Churn-specific aliases (AI often generates these for churn dashboards)
  'customer_churn': generateChurnByMonth,
  'churn_metrics': generateKpiSummary,
  'churn_data': generateChurnByMonth,
  'churn_analysis': generateKpiSummary,
  'churn_summary': generateKpiSummary,
  'retention': generateKpiSummary,
  'retention_metrics': generateKpiSummary,
  'retention_rate': generateKpiSummary,
  'active_customers': generateKpiSummary,
  'customer_retention': generateKpiSummary,
  'customer_churn_rate': generateChurnByMonth,
  'churn_overview': generateKpiSummary,
};

// Cache generated data so values stay stable across re-renders.
// The seeded RNG is stateful — calling a generator twice yields different
// numbers.  By caching per source key we guarantee consistent widget values.
const _dataCache = new Map<string, Record<string, unknown>[]>();

function getCachedData(key: string, generator: () => Record<string, unknown>[]): Record<string, unknown>[] {
  if (!_dataCache.has(key)) {
    // Reset RNG with a source-specific seed so data is deterministic
    // regardless of call order (prevents SSR/hydration mismatches)
    const seed = key.split('').reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0);
    rand = seededRandom(Math.abs(seed) || 42);
    _dataCache.set(key, generator());
  }
  return _dataCache.get(key)!;
}

export async function queryData(source: string, _groupBy?: string[], user?: SessionUser): Promise<SampleDataResult> {
  if (!source || typeof source !== 'string') {
    return { data: [], columns: [] };
  }

  // Check permissions if user is provided
  if (user) {
    const hasAccess = await canAccessDataSource(user, source);
    if (!hasAccess) {
      const dataCategory = getDataCategoryForSource(source);
      return {
        data: [],
        columns: [],
        accessDenied: true,
        deniedReason: dataCategory
          ? `Access denied to ${dataCategory} data. Contact your administrator to request permissions.`
          : `Access denied to data source '${source}'. Contact your administrator to request permissions.`
      };
    }
  }

  const generator = DATA_GENERATORS[source];
  if (!generator) {
    // Fallback: try to match partial source names
    const key = Object.keys(DATA_GENERATORS).find(k => source.toLowerCase().includes(k));
    if (key) {
      // Check permissions for the matched key too
      if (user) {
        const hasAccess = await canAccessDataSource(user, key);
        if (!hasAccess) {
          const dataCategory = getDataCategoryForSource(key);
          return {
            data: [],
            columns: [],
            accessDenied: true,
            deniedReason: dataCategory
              ? `Access denied to ${dataCategory} data. Contact your administrator to request permissions.`
              : `Access denied to data source '${key}'. Contact your administrator to request permissions.`
          };
        }
      }

      const data = getCachedData(key, DATA_GENERATORS[key]);
      return { data, columns: data.length > 0 ? Object.keys(data[0]) : [] };
    }
    return { data: [], columns: [] };
  }
  const data = getCachedData(source, generator);
  return { data, columns: data.length > 0 ? Object.keys(data[0]) : [] };
}

// Backwards compatible sync version for existing code that doesn't need permission checks
export function queryDataSync(source: string, _groupBy?: string[]): SampleDataResult {
  if (!source || typeof source !== 'string') {
    return { data: [], columns: [] };
  }
  const generator = DATA_GENERATORS[source];
  if (!generator) {
    // Fallback: try to match partial source names
    const key = Object.keys(DATA_GENERATORS).find(k => source.toLowerCase().includes(k));
    if (key) {
      const data = getCachedData(key, DATA_GENERATORS[key]);
      return { data, columns: data.length > 0 ? Object.keys(data[0]) : [] };
    }
    return { data: [], columns: [] };
  }
  const data = getCachedData(source, generator);
  return { data, columns: data.length > 0 ? Object.keys(data[0]) : [] };
}

export function getAvailableSources(): string[] {
  return Object.keys(DATA_GENERATORS);
}
