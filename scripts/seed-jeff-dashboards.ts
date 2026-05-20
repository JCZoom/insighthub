/**
 * Seed Jeff's pre-populated real-data dashboards.
 *
 * Usage:
 *   npx tsx scripts/seed-jeff-dashboards.ts
 *
 * Behaviour:
 *   1. Upserts the production user (jeffreycoy@jeffcoy.net, role
 *      ADMIN) by stable id `jeff-prod-user`. Re-running updates name +
 *      role + onboarded flag in place.
 *   2. For each registered dashboard config (one per file under
 *      scripts/dashboards/), upserts the Dashboard row by stable id.
 *      When the schema JSON differs from the latest DashboardVersion,
 *      a NEW DashboardVersion is appended and currentVersion is
 *      incremented — so re-seeding after editing a widget is honest
 *      version history, not a destructive clobber.
 *   3. All dashboards are owned, private (isPublic=false), and
 *      classified USZOOM_RESTRICTED. They are NOT templates.
 *
 * Idempotency: safe to run repeatedly. The "is the schema different"
 * check compares the JSON-stringified payload, so reformatting changes
 * still trigger a version bump — keep that in mind when editing the
 * dashboard files: prettier/whitespace changes will create a new
 * version row.
 *
 * Author: Jeff Coy + Cascade, 2026-05-19
 * Ref:    docs/REAL_DATA_MIGRATION_PLAN_2026-05-19.md §5
 */

import { PrismaClient } from '@prisma/client';
import type { DashboardSchema } from '@/types';
import { JEFF_SUPPORT_OPS_DASHBOARD } from './dashboards/jeff-support-ops';
import { JEFF_SALES_PIPELINE_DASHBOARD } from './dashboards/jeff-sales-pipeline';
import { JEFF_PLATFORM_HEALTH_DASHBOARD } from './dashboards/jeff-platform-health';
import { JEFF_TODAY_DASHBOARD } from './dashboards/jeff-today';

const prisma = new PrismaClient();

const JEFF_USER = {
  id: 'jeff-prod-user',
  email: 'jeffreycoy@jeffcoy.net',
  name: 'Jeff Coy',
  role: 'ADMIN',
  department: 'Engineering',
  hasOnboarded: true,
};

interface SeedDashboard {
  id: string;
  title: string;
  description: string;
  tags: string;
  schema: DashboardSchema;
}

const DASHBOARDS: readonly SeedDashboard[] = [
  JEFF_SUPPORT_OPS_DASHBOARD,
  JEFF_SALES_PIPELINE_DASHBOARD,
  JEFF_PLATFORM_HEALTH_DASHBOARD,
  JEFF_TODAY_DASHBOARD,
];

async function ensureUser() {
  const user = await prisma.user.upsert({
    where: { id: JEFF_USER.id },
    update: {
      name: JEFF_USER.name,
      role: JEFF_USER.role,
      department: JEFF_USER.department,
      hasOnboarded: JEFF_USER.hasOnboarded,
    },
    create: JEFF_USER,
  });
  console.log(`✅ User: ${user.name} <${user.email}> — ${user.role}`);
  return user;
}

async function upsertDashboard(ownerId: string, d: SeedDashboard): Promise<void> {
  const newSchemaJson = JSON.stringify(d.schema);
  const existing = await prisma.dashboard.findUnique({
    where: { id: d.id },
    include: {
      versions: {
        orderBy: { version: 'desc' },
        take: 1,
      },
    },
  });

  if (!existing) {
    await prisma.dashboard.create({
      data: {
        id: d.id,
        title: d.title,
        description: d.description,
        tags: d.tags,
        isTemplate: false,
        isPublic: false,
        classification: 'USZOOM_RESTRICTED',
        ownerId,
        dataOwnerId: ownerId,
        currentVersion: 1,
        versions: {
          create: {
            version: 1,
            schema: newSchemaJson,
            changeNote: 'Initial seed (real-data dashboard)',
            createdBy: ownerId,
          },
        },
      },
    });
    console.log(`  ✨ Created dashboard: ${d.title} (${d.id})`);
    return;
  }

  // Metadata refresh (title / description / tags) is always safe.
  await prisma.dashboard.update({
    where: { id: d.id },
    data: {
      title: d.title,
      description: d.description,
      tags: d.tags,
      isTemplate: false,
      isPublic: false,
      classification: 'USZOOM_RESTRICTED',
      ownerId,
      dataOwnerId: ownerId,
    },
  });

  // Append a new version row only if the schema actually changed. This
  // preserves honest version history without spurious bumps on
  // idempotent re-runs.
  const latest = existing.versions[0];
  if (latest && latest.schema === newSchemaJson) {
    console.log(`  ✓ Dashboard up-to-date (v${latest.version}): ${d.title}`);
    return;
  }
  const nextVersion = (latest?.version ?? 0) + 1;
  await prisma.dashboardVersion.create({
    data: {
      dashboardId: d.id,
      version: nextVersion,
      schema: newSchemaJson,
      changeNote: 'Seed script update (real-data dashboard)',
      createdBy: ownerId,
    },
  });
  await prisma.dashboard.update({
    where: { id: d.id },
    data: { currentVersion: nextVersion },
  });
  console.log(`  🔄 Bumped dashboard to v${nextVersion}: ${d.title}`);
}

async function main() {
  console.log("🌱 Seeding Jeff's real-data dashboards...\n");
  const user = await ensureUser();
  for (const d of DASHBOARDS) {
    await upsertDashboard(user.id, d);
  }
  console.log(`\n🎉 Done. ${DASHBOARDS.length} dashboard(s) seeded.`);
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
