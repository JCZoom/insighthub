import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import YAML from 'yaml';
import prisma from '@/lib/db/prisma';
import { getCurrentUser, canEditGlossary } from '@/lib/auth/session';

interface GlossaryEntry {
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

function loadGlossaryFromYaml(): GlossaryEntry[] {
  try {
    const filePath = path.join(process.cwd(), 'glossary', 'terms.yaml');
    const content = fs.readFileSync(filePath, 'utf-8');
    return YAML.parse(content) as GlossaryEntry[];
  } catch (error) {
    console.error('Failed to load glossary YAML:', error);
    return [];
  }
}

// GET /api/glossary — list all terms (YAML + DB)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const source = searchParams.get('source') || 'yaml';

  if (source === 'db') {
    try {
      const terms = await prisma.glossaryTerm.findMany({ orderBy: { term: 'asc' } });
      return NextResponse.json({ terms, source: 'db' });
    } catch {
      // DB not available — fall through to YAML
    }
  }

  const terms = loadGlossaryFromYaml();
  return NextResponse.json({ terms, source: 'yaml' });
}

// POST /api/glossary — create a new glossary term (Admin only)
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!canEditGlossary(user)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { term, definition, formula, category, examples, relatedTerms, dataSource } = body as {
      term: string;
      definition: string;
      formula?: string;
      category: string;
      examples?: string;
      relatedTerms?: string[];
      dataSource?: string;
    };

    if (!term || !definition || !category) {
      return NextResponse.json({ error: 'term, definition, and category are required' }, { status: 400 });
    }

    const created = await prisma.glossaryTerm.create({
      data: {
        term,
        definition,
        formula: formula || null,
        category,
        examples: examples || null,
        relatedTerms: Array.isArray(relatedTerms) ? relatedTerms.join(',') : (relatedTerms || ''),
        dataSource: dataSource || null,
        approvedBy: user.name,
        lastReviewedAt: new Date(),
      },
    });

    return NextResponse.json({ term: created }, { status: 201 });
  } catch (error) {
    console.error('Create glossary term error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
