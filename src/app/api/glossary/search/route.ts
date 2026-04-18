import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';

// GET /api/glossary/search?q=...&category=... — search glossary terms in DB
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q') || '';
    const category = searchParams.get('category') || '';

    const where = {
      ...(q
        ? {
            OR: [
              { term: { contains: q } },
              { definition: { contains: q } },
              { category: { contains: q } },
            ],
          }
        : {}),
      ...(category ? { category } : {}),
    };

    const terms = await prisma.glossaryTerm.findMany({
      where,
      orderBy: { term: 'asc' },
    });

    return NextResponse.json({ terms });
  } catch (error) {
    console.error('Search glossary error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
