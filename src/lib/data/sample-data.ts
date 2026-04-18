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
  let mrr = 380000;
  return MONTHS.map(month => {
    mrr = mrr * (1 + randBetween(-0.01, 0.04));
    return { month, mrr: Math.round(mrr), growth: +(randBetween(-1, 4)).toFixed(1) };
  });
}

function generateChurnByRegion(): Record<string, unknown>[] {
  return REGIONS.map(region => ({
    region,
    churn_rate: +(randBetween(2, 7)).toFixed(1),
    churned_customers: randInt(10, 80),
    total_customers: randInt(500, 1500),
  }));
}

function generateChurnByMonth(): Record<string, unknown>[] {
  return MONTHS.map(month => ({
    month,
    churn_rate: +(randBetween(2.5, 5.5)).toFixed(1),
    churned: randInt(15, 60),
    active_start: randInt(3000, 5000),
  }));
}

function generateChurnByPlan(): Record<string, unknown>[] {
  return PLANS.map(plan => ({
    plan,
    churn_rate: plan === 'enterprise' ? +(randBetween(1, 3)).toFixed(1)
      : plan === 'professional' ? +(randBetween(3, 5)).toFixed(1)
      : +(randBetween(5, 8)).toFixed(1),
    customers: plan === 'enterprise' ? randInt(200, 400)
      : plan === 'professional' ? randInt(800, 1500)
      : randInt(2000, 3500),
  }));
}

function generateTicketsByCategory(): Record<string, unknown>[] {
  return TICKET_CATEGORIES.map(category => ({
    category,
    count: randInt(200, 3000),
    avg_resolution_hours: +(randBetween(2, 48)).toFixed(1),
    csat: +(randBetween(3.2, 4.8)).toFixed(1),
  }));
}

function generateTicketsByMonth(): Record<string, unknown>[] {
  return MONTHS.map(month => ({
    month,
    total: randInt(2500, 4500),
    resolved: randInt(2200, 4200),
    avg_frt_minutes: randInt(8, 45),
    csat: +(randBetween(3.5, 4.7)).toFixed(1),
  }));
}

function generateTicketsByTeam(): Record<string, unknown>[] {
  return TEAMS.map(team => ({
    team,
    open: randInt(10, 80),
    pending: randInt(5, 40),
    resolved: randInt(200, 1200),
    avg_resolution_hours: +(randBetween(4, 36)).toFixed(1),
    csat: +(randBetween(3.5, 4.8)).toFixed(1),
  }));
}

function generateRevenueByType(): Record<string, unknown>[] {
  return ['new', 'expansion', 'contraction', 'churn', 'reactivation'].map(type => ({
    event_type: type,
    amount: type === 'new' ? randInt(80000, 150000)
      : type === 'expansion' ? randInt(30000, 80000)
      : type === 'contraction' ? -randInt(10000, 40000)
      : type === 'churn' ? -randInt(20000, 60000)
      : randInt(5000, 20000),
    count: randInt(10, 200),
  }));
}

function generateRevenueByMonth(): Record<string, unknown>[] {
  let total = 380000;
  return MONTHS.map(month => {
    const newRev = randInt(60000, 120000);
    const expansion = randInt(20000, 60000);
    const contraction = -randInt(5000, 25000);
    const churn = -randInt(15000, 45000);
    total = total + newRev + expansion + contraction + churn;
    return { month, total: Math.round(total), new: newRev, expansion, contraction: Math.abs(contraction), churn: Math.abs(churn) };
  });
}

function generateDealsPipeline(): Record<string, unknown>[] {
  return DEAL_STAGES.filter(s => !s.startsWith('closed')).map(stage => ({
    stage,
    count: randInt(5, 40),
    value: randInt(50000, 500000),
    avg_days: randInt(5, 60),
  }));
}

function generateDealsBySource(): Record<string, unknown>[] {
  return ['inbound', 'outbound', 'referral', 'partner'].map(source => ({
    source,
    count: randInt(10, 80),
    value: randInt(100000, 800000),
    win_rate: +(randBetween(15, 55)).toFixed(1),
  }));
}

function generateUsageByFeature(): Record<string, unknown>[] {
  return FEATURES.map(feature => ({
    feature,
    daily_users: randInt(500, 3500),
    total_usage: randInt(10000, 100000),
    adoption_rate: +(randBetween(20, 85)).toFixed(1),
  }));
}

function generateUsageByMonth(): Record<string, unknown>[] {
  return MONTHS.map(month => ({
    month,
    mail_scan: randInt(20000, 50000),
    package_forward: randInt(5000, 15000),
    check_deposit: randInt(3000, 10000),
    address_use: randInt(30000, 80000),
  }));
}

function generateCustomersByPlan(): Record<string, unknown>[] {
  return [
    { plan: 'starter', count: randInt(2500, 3500), revenue: randInt(60000, 100000) },
    { plan: 'professional', count: randInt(1000, 1800), revenue: randInt(150000, 250000) },
    { plan: 'enterprise', count: randInt(200, 500), revenue: randInt(200000, 400000) },
  ];
}

function generateCustomersByRegion(): Record<string, unknown>[] {
  return REGIONS.map(region => ({
    region,
    count: randInt(400, 1500),
    mrr: randInt(50000, 150000),
    churn_rate: +(randBetween(2, 7)).toFixed(1),
  }));
}

function generateKpiSummary(): Record<string, unknown>[] {
  return [{
    total_customers: randInt(4200, 5200),
    active_customers: randInt(3800, 4800),
    mrr: randInt(380000, 480000),
    arr: randInt(4500000, 5800000),
    churn_rate: +(randBetween(3, 5)).toFixed(1),
    nrr: +(randBetween(102, 115)).toFixed(1),
    avg_csat: +(randBetween(4.1, 4.6)).toFixed(1),
    open_tickets: randInt(80, 200),
    avg_frt_minutes: randInt(12, 30),
    pipeline_value: randInt(800000, 2000000),
    win_rate: +(randBetween(25, 45)).toFixed(1),
    avg_deal_size: randInt(8000, 25000),
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
