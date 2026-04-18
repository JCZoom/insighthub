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
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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
];

async function main() {
  console.log('🌱 Seeding database...\n');

  // 1. Create dev user (upsert to avoid duplicates)
  const user = await prisma.user.upsert({
    where: { id: DEV_USER.id },
    update: { name: DEV_USER.name, role: DEV_USER.role, department: DEV_USER.department },
    create: DEV_USER,
  });
  console.log(`✅ User: ${user.name} (${user.email}) — ${user.role}`);

  // 2. Create template dashboards
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

  // 3. Create sample users for demo
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

  // 4. Create sample shared dashboards
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

  // 5. Create sample audit log entries
  const auditActions = [
    { action: 'dashboard.create', resourceType: 'Dashboard', resourceId: 'executive-summary' },
    { action: 'dashboard.create', resourceType: 'Dashboard', resourceId: 'support-operations' },
    { action: 'user.login', resourceType: 'User', resourceId: user.id },
    { action: 'glossary.sync', resourceType: 'GlossaryTerm', resourceId: 'batch' },
  ];
  for (const a of auditActions) {
    await prisma.auditLog.create({
      data: { userId: user.id, ...a },
    });
  }
  console.log(`✅ ${auditActions.length} audit log entries`);

  // 6. Create folders
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

  console.log('\n🎉 Seed complete!');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
