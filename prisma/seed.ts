/**
 * Database seed script — populates the DB with sample data for local
 * development and demo purposes.
 *
 * Usage: npm run db:seed  (or: npx tsx prisma/seed.ts)
 *
 * Creates:
 * - 1 admin user (dev user)
 * - 4 template dashboards with initial versions
 * - Glossary terms (from YAML)
 * - 5,000 sample customers across 5 regions and 3 plans ($9.99/$14.99/$39.99)
 * - ~50,000 support tickets with seasonal patterns
 * - 200 sales pipeline deals
 * - Product usage data with weekday-heavy patterns
 * - Monthly revenue events with ~20% annual churn rate
 * - 18 months of historical data
 */

import { PrismaClient } from '@prisma/client';
import { faker } from '@faker-js/faker';
import fs from 'fs';
import path from 'path';
import YAML from 'yaml';
import { initializeDefaultPermissionGroups } from '../src/lib/auth/permissions';

const prisma = new PrismaClient();

// Constants for data generation
const PLANS = ['starter', 'professional', 'enterprise'];
const REGIONS = ['Northeast', 'Southeast', 'Midwest', 'West', 'International'];
const TICKET_CATEGORIES = ['billing', 'technical', 'onboarding', 'feature_request', 'cancellation'];
const TICKET_PRIORITIES = ['low', 'medium', 'high', 'urgent'];
const TICKET_STATUSES = ['open', 'pending', 'resolved', 'closed'];
const TICKET_CHANNELS = ['email', 'chat', 'phone', 'portal'];
const SUPPORT_TEAMS = ['Recipient Support', 'Form 1583', 'Sales', 'Mail Centers', 'Partner AI'];
const DEAL_STAGES = ['prospect', 'qualified', 'proposal', 'negotiation', 'closed_won', 'closed_lost'];
const DEAL_SOURCES = ['inbound', 'outbound', 'referral', 'partner'];
const FEATURES = ['mail_scan', 'package_forward', 'check_deposit', 'address_use'];
const REVENUE_EVENTS = ['new', 'expansion', 'contraction', 'churn', 'reactivation'];

const DEV_USER = {
  id: 'dev-admin-user',
  email: 'jeff.coy@uszoom.com',
  name: 'Jeff Coy',
  role: 'ADMIN',
  department: 'Engineering',
  hasOnboarded: true,
};

const TEMPLATE_DASHBOARDS = [
  {
    id: 'executive-summary',
    title: 'Executive Summary',
    description: 'High-level KPIs and trends across revenue, churn, support, and product usage.',
    tags: 'executive,overview,kpi',
    isTemplate: true,
    isPublic: true,
  },
  {
    id: 'support-operations',
    title: 'Support Operations',
    description: 'Ticket volume, resolution times, CSAT, and team performance metrics.',
    tags: 'support,tickets,csat',
    isTemplate: true,
    isPublic: true,
  },
  {
    id: 'churn-analysis',
    title: 'Churn Analysis',
    description: 'Churn rate breakdown by region, plan, and time period with retention cohorts.',
    tags: 'churn,retention,revenue',
    isTemplate: true,
    isPublic: true,
  },
  {
    id: 'sales-pipeline',
    title: 'Sales Pipeline',
    description: 'Pipeline value, deal stages, win rates, and source attribution.',
    tags: 'sales,pipeline,deals',
    isTemplate: true,
    isPublic: true,
  },
  {
    id: 'customer-health',
    title: 'Customer Health',
    description: 'Usage analytics, feature adoption, regional distribution, and churn risk indicators.',
    tags: 'customer,retention,satisfaction',
    isTemplate: true,
    isPublic: true,
  },
  {
    id: 'financial-overview',
    title: 'Financial Overview',
    description: 'Revenue deep-dive, MRR/ARR tracking, retention metrics, and revenue composition.',
    tags: 'finance,revenue,accounting',
    isTemplate: true,
    isPublic: true,
  },
  {
    id: 'cs-automation',
    title: 'CS Automation',
    description: 'AI deflection rates across chat, voice, and ticket channels — bot performance, cost savings, and topic accuracy.',
    tags: 'automation,chatbot,deflection,ai',
    isTemplate: true,
    isPublic: true,
  },
];

// Helper functions
function randomDate(start: Date, end: Date): Date {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

function getWeightedRandom<T>(items: T[], weights: number[]): T {
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  let random = Math.random() * totalWeight;

  for (let i = 0; i < items.length; i++) {
    random -= weights[i];
    if (random <= 0) {
      return items[i];
    }
  }
  return items[items.length - 1];
}

function addWeekdays(date: Date, days: number): Date {
  const result = new Date(date);
  while (days > 0) {
    result.setDate(result.getDate() + 1);
    if (result.getDay() !== 0 && result.getDay() !== 6) { // Skip weekends
      days--;
    }
  }
  return result;
}

function getSeasonalMultiplier(date: Date): number {
  const month = date.getMonth();
  // Higher ticket volumes in Q4 (holiday season) and Q1 (new year issues)
  if (month >= 10 || month <= 1) return 1.3;
  // Lower volumes in summer months
  if (month >= 5 && month <= 7) return 0.8;
  return 1.0;
}

interface YamlGlossaryEntry {
  term: string;
  category: string;
  definition: string;
  formula?: string;
  data_source?: string;
  related_terms?: string[];
  approved_by?: string;
  last_reviewed?: string;
  exclusions?: string[];
}

async function seedGlossaryTerms() {
  console.log('📖 Seeding glossary terms from glossary/terms.yaml...');

  const filePath = path.join(process.cwd(), 'glossary', 'terms.yaml');
  if (!fs.existsSync(filePath)) {
    console.warn('  ⚠ glossary/terms.yaml not found — skipping glossary seed');
    return;
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const entries = YAML.parse(content) as YamlGlossaryEntry[];
  if (!Array.isArray(entries) || entries.length === 0) {
    console.warn('  ⚠ glossary/terms.yaml is empty or invalid — skipping');
    return;
  }

  let created = 0;
  let updated = 0;

  for (const entry of entries) {
    const relatedTerms = Array.isArray(entry.related_terms) ? entry.related_terms.join(',') : '';
    const lastReviewedAt = entry.last_reviewed ? new Date(entry.last_reviewed) : null;

    await prisma.glossaryTerm.upsert({
      where: { term: entry.term },
      update: {
        definition: entry.definition.trim(),
        formula: entry.formula || null,
        category: entry.category,
        relatedTerms,
        dataSource: entry.data_source || null,
        approvedBy: entry.approved_by || null,
        lastReviewedAt,
      },
      create: {
        term: entry.term,
        definition: entry.definition.trim(),
        formula: entry.formula || null,
        category: entry.category,
        relatedTerms,
        dataSource: entry.data_source || null,
        approvedBy: entry.approved_by || null,
        lastReviewedAt,
      },
    });

    const existing = await prisma.glossaryTerm.findUnique({ where: { term: entry.term } });
    if (existing?.createdAt.getTime() === existing?.updatedAt.getTime()) {
      created++;
    } else {
      updated++;
    }
  }

  console.log(`✅ Glossary: ${entries.length} terms seeded (${created} new, ${updated} updated)`);
}

async function generateSampleCustomers() {
  console.log('🏢 Generating 5,000 sample customers...');

  const customers = [];
  const eighteenMonthsAgo = new Date();
  eighteenMonthsAgo.setMonth(eighteenMonthsAgo.getMonth() - 18);

  for (let i = 0; i < 5000; i++) {
    const signupDate = randomDate(eighteenMonthsAgo, new Date());
    const plan = getWeightedRandom(PLANS, [50, 35, 15]); // More starter plans
    const region = getWeightedRandom(REGIONS, [25, 20, 20, 20, 15]); // Slight US bias

    let monthlyRevenue;
    if (plan === 'starter') monthlyRevenue = 9.99;
    else if (plan === 'professional') monthlyRevenue = 14.99;
    else monthlyRevenue = 39.99;

    // ~20% annual churn rate ≈ ~1.85% monthly
    const isChurned = Math.random() < 0.0185;
    const cancelledDate = isChurned ? randomDate(signupDate, new Date()) : null;

    customers.push({
      name: faker.person.fullName(),
      email: faker.internet.email(),
      company: faker.company.name(),
      plan,
      region,
      signupDate,
      cancelledDate,
      monthlyRevenue,
      accountManager: faker.person.fullName(),
    });

    if ((i + 1) % 1000 === 0) {
      console.log(`  ✓ Generated ${i + 1}/5000 customers`);
    }
  }

  await prisma.sampleCustomer.createMany({ data: customers });
  console.log('✅ Created 5,000 sample customers');

  return customers.length;
}

async function generateSampleSubscriptions(customerCount: number) {
  console.log('📋 Generating sample subscriptions...');

  const customers = await prisma.sampleCustomer.findMany();
  const subscriptions = [];

  for (const customer of customers) {
    const addOns = [];
    if (customer.plan === 'professional' && Math.random() < 0.3) {
      addOns.push({ name: 'Premium Support', amount: 49.99 });
    }
    if (customer.plan === 'enterprise' && Math.random() < 0.5) {
      addOns.push({ name: 'Dedicated Account Manager', amount: 199.99 });
    }

    subscriptions.push({
      customerId: customer.id,
      plan: customer.plan,
      status: customer.cancelledDate ? 'cancelled' : 'active',
      startDate: customer.signupDate,
      endDate: customer.cancelledDate,
      monthlyAmount: customer.monthlyRevenue,
      addOns: addOns.length > 0 ? JSON.stringify(addOns) : null,
    });
  }

  await prisma.sampleSubscription.createMany({ data: subscriptions });
  console.log(`✅ Created ${subscriptions.length} sample subscriptions`);
}

async function generateSampleTickets() {
  console.log('🎫 Generating ~50,000 support tickets with seasonal patterns...');

  const customers = await prisma.sampleCustomer.findMany();
  const tickets = [];
  const eighteenMonthsAgo = new Date();
  eighteenMonthsAgo.setMonth(eighteenMonthsAgo.getMonth() - 18);

  const targetTickets = 50000;
  let generatedTickets = 0;

  while (generatedTickets < targetTickets) {
    const customer = customers[Math.floor(Math.random() * customers.length)];
    const createdAt = randomDate(
      new Date(Math.max(customer.signupDate.getTime(), eighteenMonthsAgo.getTime())),
      customer.cancelledDate || new Date()
    );

    // Apply seasonal multiplier
    const seasonalChance = getSeasonalMultiplier(createdAt);
    if (Math.random() > seasonalChance * 0.3) continue; // Skip some tickets based on season

    const category = getWeightedRandom(TICKET_CATEGORIES, [30, 35, 15, 15, 5]);
    const priority = getWeightedRandom(TICKET_PRIORITIES, [40, 35, 20, 5]);
    const status = getWeightedRandom(TICKET_STATUSES, [5, 10, 70, 15]);
    const channel = getWeightedRandom(TICKET_CHANNELS, [50, 30, 15, 5]);

    let resolvedAt = null;
    let firstResponseMinutes = null;
    let satisfactionScore = null;

    if (status === 'resolved' || status === 'closed') {
      const resolutionHours = faker.number.int({ min: 1, max: 168 }); // 1 hour to 1 week
      resolvedAt = new Date(createdAt.getTime() + resolutionHours * 60 * 60 * 1000);
      firstResponseMinutes = faker.number.int({ min: 5, max: 480 }); // 5 min to 8 hours
      satisfactionScore = faker.number.int({ min: 1, max: 5 });
    }

    tickets.push({
      customerId: customer.id,
      subject: `${category.charAt(0).toUpperCase() + category.slice(1)} issue: ${faker.lorem.sentence()}`,
      category,
      priority,
      status,
      channel,
      createdAt,
      resolvedAt,
      firstResponseMinutes,
      satisfactionScore,
      agent: faker.person.fullName(),
      team: getWeightedRandom(SUPPORT_TEAMS, [25, 20, 20, 20, 15]),
    });

    generatedTickets++;

    if (generatedTickets % 5000 === 0) {
      console.log(`  ✓ Generated ${generatedTickets}/${targetTickets} tickets`);
    }
  }

  // Batch insert for performance
  const batchSize = 1000;
  for (let i = 0; i < tickets.length; i += batchSize) {
    const batch = tickets.slice(i, i + batchSize);
    await prisma.sampleTicket.createMany({ data: batch });
  }

  console.log(`✅ Created ${tickets.length} sample tickets`);
}

async function generateSampleDeals() {
  console.log('💰 Generating 200 sales pipeline deals...');

  const deals = [];
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

  for (let i = 0; i < 200; i++) {
    const stage = getWeightedRandom(DEAL_STAGES, [15, 20, 20, 15, 15, 15]);
    const source = getWeightedRandom(DEAL_SOURCES, [40, 30, 20, 10]);
    const region = getWeightedRandom(REGIONS, [25, 20, 20, 20, 15]);

    let amount;
    if (stage === 'prospect') amount = faker.number.float({ min: 1000, max: 50000, multipleOf: 100 });
    else if (stage === 'qualified') amount = faker.number.float({ min: 5000, max: 100000, multipleOf: 100 });
    else amount = faker.number.float({ min: 10000, max: 500000, multipleOf: 100 });

    const probability = stage === 'closed_won' ? 100 :
      stage === 'closed_lost' ? 0 :
      stage === 'negotiation' ? faker.number.int({ min: 70, max: 90 }) :
      stage === 'proposal' ? faker.number.int({ min: 40, max: 70 }) :
      stage === 'qualified' ? faker.number.int({ min: 20, max: 50 }) :
      faker.number.int({ min: 5, max: 25 });

    const createdAt = randomDate(threeMonthsAgo, new Date());
    const closedAt = (stage === 'closed_won' || stage === 'closed_lost') ?
      randomDate(createdAt, new Date()) : null;

    deals.push({
      company: faker.company.name(),
      contact: faker.person.fullName(),
      stage,
      amount,
      probability,
      source,
      region,
      createdAt,
      closedAt,
      owner: faker.person.fullName(),
    });
  }

  await prisma.sampleDeal.createMany({ data: deals });
  console.log('✅ Created 200 sample deals');
}

async function generateSampleUsage() {
  console.log('📊 Generating product usage data with weekday-heavy patterns...');

  const customers = await prisma.sampleCustomer.findMany();
  const usage = [];
  const eighteenMonthsAgo = new Date();
  eighteenMonthsAgo.setMonth(eighteenMonthsAgo.getMonth() - 18);

  for (const customer of customers) {
    const startDate = new Date(Math.max(customer.signupDate.getTime(), eighteenMonthsAgo.getTime()));
    const endDate = customer.cancelledDate || new Date();

    // Generate usage data for active period
    const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const avgUsagePerWeek = customer.plan === 'enterprise' ? 15 :
                           customer.plan === 'professional' ? 8 : 3;

    for (let day = 0; day < daysDiff; day++) {
      const currentDate = new Date(startDate.getTime() + day * 24 * 60 * 60 * 1000);
      const isWeekday = currentDate.getDay() >= 1 && currentDate.getDay() <= 5;

      // 70% of usage happens on weekdays
      const usageChance = isWeekday ? 0.7 : 0.3;

      if (Math.random() < usageChance * (avgUsagePerWeek / 7)) {
        const feature = getWeightedRandom(FEATURES, [40, 30, 20, 10]);
        const usageCount = faker.number.int({ min: 1, max: isWeekday ? 5 : 2 });

        usage.push({
          customerId: customer.id,
          feature,
          usageCount,
          usageDate: currentDate,
        });
      }
    }
  }

  console.log(`  ✓ Generated ${usage.length} usage records`);

  // Batch insert for performance
  const batchSize = 2000;
  for (let i = 0; i < usage.length; i += batchSize) {
    const batch = usage.slice(i, i + batchSize);
    await prisma.sampleUsage.createMany({ data: batch });

    if ((i + batchSize) % 10000 === 0 || i + batchSize >= usage.length) {
      console.log(`  ✓ Inserted ${Math.min(i + batchSize, usage.length)}/${usage.length} usage records`);
    }
  }

  console.log('✅ Created product usage data');
}

async function generateSampleRevenue() {
  console.log('💸 Generating monthly revenue events with ~20% annual churn...');

  const customers = await prisma.sampleCustomer.findMany();
  const revenue = [];

  for (const customer of customers) {
    // New customer event
    revenue.push({
      customerId: customer.id,
      eventType: 'new',
      amount: customer.monthlyRevenue,
      eventDate: customer.signupDate,
      planFrom: null,
      planTo: customer.plan,
    });

    // Generate expansion/contraction events (10% of customers)
    if (Math.random() < 0.1) {
      const changeDate = randomDate(customer.signupDate, customer.cancelledDate || new Date());
      const isExpansion = Math.random() < 0.6; // 60% expansions, 40% contractions

      const oldPlan = customer.plan;
      let newPlan = customer.plan;
      let amountChange = 0;

      if (isExpansion) {
        if (oldPlan === 'starter') {
          newPlan = 'professional';
          amountChange = faker.number.float({ min: 50, max: 200, multipleOf: 0.01 });
        } else if (oldPlan === 'professional') {
          newPlan = 'enterprise';
          amountChange = faker.number.float({ min: 100, max: 500, multipleOf: 0.01 });
        }
      } else {
        if (oldPlan === 'enterprise') {
          newPlan = 'professional';
          amountChange = -faker.number.float({ min: 100, max: 300, multipleOf: 0.01 });
        } else if (oldPlan === 'professional') {
          newPlan = 'starter';
          amountChange = -faker.number.float({ min: 30, max: 150, multipleOf: 0.01 });
        }
      }

      if (newPlan !== oldPlan) {
        revenue.push({
          customerId: customer.id,
          eventType: isExpansion ? 'expansion' : 'contraction',
          amount: amountChange,
          eventDate: changeDate,
          planFrom: oldPlan,
          planTo: newPlan,
        });
      }
    }

    // Churn event
    if (customer.cancelledDate) {
      revenue.push({
        customerId: customer.id,
        eventType: 'churn',
        amount: -customer.monthlyRevenue,
        eventDate: customer.cancelledDate,
        planFrom: customer.plan,
        planTo: null,
      });
    }
  }

  await prisma.sampleRevenue.createMany({ data: revenue });
  console.log(`✅ Created ${revenue.length} revenue events`);
}

async function main() {
  console.log('🌱 Seeding database with comprehensive sample data...\n');

  // 1. Create dev user (upsert to avoid duplicates)
  const user = await prisma.user.upsert({
    where: { id: DEV_USER.id },
    update: { name: DEV_USER.name, role: DEV_USER.role, department: DEV_USER.department },
    create: DEV_USER,
  });
  console.log(`✅ User: ${user.name} (${user.email}) — ${user.role}`);

  // 2. Initialize permission groups
  console.log('🔐 Initializing default permission groups...');
  await initializeDefaultPermissionGroups();
  console.log('✅ Permission groups initialized');

  // 3. Seed glossary terms from YAML → DB
  await seedGlossaryTerms();

  // 4. Create template dashboards
  for (const tmpl of TEMPLATE_DASHBOARDS) {
    const existing = await prisma.dashboard.findUnique({ where: { id: tmpl.id } });
    if (existing) {
      console.log(`  ✓ Dashboard already exists: ${tmpl.title}`);
      continue;
    }

    await prisma.dashboard.create({
      data: {
        id: tmpl.id,
        title: tmpl.title,
        description: tmpl.description,
        tags: tmpl.tags,
        isTemplate: tmpl.isTemplate,
        isPublic: tmpl.isPublic,
        ownerId: user.id,
        currentVersion: 1,
        versions: {
          create: {
            version: 1,
            schema: JSON.stringify({ layout: { columns: 12, rowHeight: 80, gap: 16 }, globalFilters: [], widgets: [] }),
            changeNote: 'Template seed',
            createdBy: user.id,
          },
        },
      },
    });
    console.log(`  ✨ Created dashboard: ${tmpl.title}`);
  }

  // 4. Create sample users for demo
  const sampleUsers = [
    { id: 'user-sarah', email: 'sarah.chen@uszoom.com', name: 'Sarah Chen', role: 'CREATOR', department: 'Analytics' },
    { id: 'user-mike', email: 'mike.johnson@uszoom.com', name: 'Mike Johnson', role: 'POWER_USER', department: 'Revenue Ops' },
    { id: 'user-lisa', email: 'lisa.park@uszoom.com', name: 'Lisa Park', role: 'VIEWER', department: 'Product' },
    { id: 'user-tom', email: 'tom.rivera@uszoom.com', name: 'Tom Rivera', role: 'CREATOR', department: 'Sales' },
  ];

  for (const su of sampleUsers) {
    await prisma.user.upsert({
      where: { id: su.id },
      update: {},
      create: su,
    });
  }
  console.log(`✅ ${sampleUsers.length} sample users created`);

  // 5. Create sample shared dashboards
  const dashboards = await prisma.dashboard.findMany({ where: { isTemplate: true } });
  for (const d of dashboards) {
    for (const su of sampleUsers.slice(0, 2)) {
      await prisma.dashboardShare.upsert({
        where: { dashboardId_userId: { dashboardId: d.id, userId: su.id } },
        update: {},
        create: { dashboardId: d.id, userId: su.id, permission: 'VIEW' },
      });
    }
  }
  console.log(`✅ Shared template dashboards with sample users`);

  // 6. Create sample audit log entries
  const auditActions = [
    { action: 'dashboard.create', resourceType: 'dashboard', resourceId: 'executive-summary' },
    { action: 'dashboard.create', resourceType: 'dashboard', resourceId: 'support-operations' },
    { action: 'user.login', resourceType: 'user', resourceId: user.id },
    { action: 'glossary.create', resourceType: 'glossary', resourceId: 'batch' },
  ];
  for (const a of auditActions) {
    await prisma.auditLog.create({
      data: { userId: user.id, ...a },
    });
  }
  console.log(`✅ ${auditActions.length} audit log entries`);

  // 7. Create folders
  const folder = await prisma.folder.upsert({
    where: { id: 'folder-templates' },
    update: {},
    create: {
      id: 'folder-templates',
      name: 'Templates',
      ownerId: user.id,
      visibility: 'PUBLIC',
    },
  });
  console.log(`✅ Folder: ${folder.name}`);

  console.log('\n🎯 Now generating comprehensive sample data (18 months)...\n');

  // 8. Generate comprehensive sample data
  await generateSampleCustomers();
  await generateSampleSubscriptions(5000);
  await generateSampleTickets();
  await generateSampleDeals();
  await generateSampleUsage();
  await generateSampleRevenue();

  console.log('\n🎉 Seed complete! Generated:');
  console.log('  • 5,000 customers across 5 regions and 3 plans');
  console.log('  • ~50,000 support tickets with seasonal patterns');
  console.log('  • 200 sales pipeline deals');
  console.log('  • Product usage data with weekday-heavy patterns');
  console.log('  • Revenue events with ~20% annual churn');
  console.log('  • 18 months of historical data');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());