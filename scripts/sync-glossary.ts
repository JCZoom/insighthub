/**
 * Glossary YAML → DB sync script.
 *
 * Reads glossary/terms.yaml (canonical source) and upserts every entry into
 * the GlossaryTerm table. Matches by term name — inserts new, updates
 * existing definitions/formulas, leaves DB-only terms untouched.
 *
 * Usage: npm run glossary:sync   (or: npx tsx scripts/sync-glossary.ts)
 */

import fs from 'fs';
import path from 'path';
import YAML from 'yaml';
import { PrismaClient } from '@prisma/client';

interface YamlEntry {
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

async function main() {
  const prisma = new PrismaClient();

  // 1. Load YAML
  const yamlPath = path.join(process.cwd(), 'glossary', 'terms.yaml');
  if (!fs.existsSync(yamlPath)) {
    console.error(`❌ YAML file not found: ${yamlPath}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(yamlPath, 'utf-8');
  let entries: YamlEntry[];
  try {
    entries = YAML.parse(raw) as YamlEntry[];
    if (!Array.isArray(entries)) throw new Error('Expected an array of glossary entries');
  } catch (err) {
    console.error('❌ Invalid YAML schema:', err);
    process.exit(1);
  }

  console.log(`📖 Found ${entries.length} terms in glossary/terms.yaml\n`);

  // 2. Upsert each entry
  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const entry of entries) {
    if (!entry.term || !entry.definition || !entry.category) {
      console.warn(`  ⚠️  Skipping entry with missing required fields: ${JSON.stringify(entry).slice(0, 80)}`);
      skipped++;
      continue;
    }

    const data = {
      definition: entry.definition.trim(),
      formula: entry.formula || null,
      category: entry.category,
      examples: null as string | null,
      relatedTerms: (entry.related_terms || []).join(','),
      dataSource: entry.data_source || null,
      approvedBy: entry.approved_by || null,
      lastReviewedAt: entry.last_reviewed ? new Date(entry.last_reviewed) : null,
    };

    const existing = await prisma.glossaryTerm.findUnique({
      where: { term: entry.term },
    });

    if (existing) {
      // Check if anything actually changed
      const changed =
        existing.definition !== data.definition ||
        existing.formula !== data.formula ||
        existing.category !== data.category ||
        JSON.stringify(existing.relatedTerms) !== JSON.stringify(data.relatedTerms) ||
        existing.dataSource !== data.dataSource;

      if (changed) {
        await prisma.glossaryTerm.update({
          where: { term: entry.term },
          data,
        });
        console.log(`  🔄 Updated: ${entry.term}`);
        updated++;
      } else {
        console.log(`  ✓  Unchanged: ${entry.term}`);
      }
    } else {
      await prisma.glossaryTerm.create({
        data: {
          term: entry.term,
          ...data,
        },
      });
      console.log(`  ✨ Created: ${entry.term}`);
      created++;
    }
  }

  console.log(`\n✅ Sync complete: ${created} created, ${updated} updated, ${skipped} skipped`);
  console.log(`   Total terms in DB: ${await prisma.glossaryTerm.count()}`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
