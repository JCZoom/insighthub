import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { getCurrentUser, canEditGlossary } from '@/lib/auth/session';
import { logGlossaryAction, AuditAction } from '@/lib/audit';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET /api/glossary/[id] — get a single glossary term
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const term = await prisma.glossaryTerm.findUnique({ where: { id } });
    if (!term) {
      return NextResponse.json({ error: 'Term not found' }, { status: 404 });
    }
    return NextResponse.json({ term });
  } catch (error) {
    console.error('Get glossary term error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/glossary/[id] — update a glossary term (Admin only)
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const user = await getCurrentUser();
    if (!canEditGlossary(user)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { term, definition, formula, category, examples, relatedTerms, dataSource } = body as {
      term?: string;
      definition?: string;
      formula?: string;
      category?: string;
      examples?: string;
      relatedTerms?: string[] | string;
      dataSource?: string;
    };
    const relatedTermsStr = relatedTerms !== undefined
      ? (Array.isArray(relatedTerms) ? relatedTerms.join(',') : relatedTerms)
      : undefined;

    const updated = await prisma.glossaryTerm.update({
      where: { id },
      data: {
        ...(term !== undefined && { term }),
        ...(definition !== undefined && { definition }),
        ...(formula !== undefined && { formula }),
        ...(category !== undefined && { category }),
        ...(examples !== undefined && { examples }),
        ...(relatedTermsStr !== undefined && { relatedTerms: relatedTermsStr }),
        ...(dataSource !== undefined && { dataSource }),
        lastReviewedAt: new Date(),
        approvedBy: user.name,
      },
    });

    // Log glossary update for audit
    const changedFields = [];
    if (term !== undefined) changedFields.push('term');
    if (definition !== undefined) changedFields.push('definition');
    if (formula !== undefined) changedFields.push('formula');
    if (category !== undefined) changedFields.push('category');
    if (examples !== undefined) changedFields.push('examples');
    if (relatedTermsStr !== undefined) changedFields.push('relatedTerms');
    if (dataSource !== undefined) changedFields.push('dataSource');

    await logGlossaryAction(
      user.id,
      AuditAction.GLOSSARY_UPDATE,
      id,
      {
        term: updated.term,
        category: updated.category,
        changedFields,
      }
    );

    return NextResponse.json({ term: updated });
  } catch (error) {
    console.error('Update glossary term error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/glossary/[id] — delete a glossary term (Admin only)
export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const user = await getCurrentUser();
    if (!canEditGlossary(user)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Get the term data before deleting for audit purposes
    const termToDelete = await prisma.glossaryTerm.findUnique({ where: { id } });
    if (!termToDelete) {
      return NextResponse.json({ error: 'Term not found' }, { status: 404 });
    }

    await prisma.glossaryTerm.delete({ where: { id } });

    // Log glossary deletion for audit
    await logGlossaryAction(
      user.id,
      AuditAction.GLOSSARY_DELETE,
      id,
      {
        term: termToDelete.term,
        category: termToDelete.category,
        definition: termToDelete.definition.substring(0, 100) + (termToDelete.definition.length > 100 ? '...' : ''),
      }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete glossary term error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
