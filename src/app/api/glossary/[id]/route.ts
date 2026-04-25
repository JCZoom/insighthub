import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { getCurrentUser, canEditGlossary } from '@/lib/auth/session';
import { logGlossaryAction, createAuditLog, AuditAction, ResourceType } from '@/lib/audit';
import {
  canSetClassification,
  coerceClassification,
  isDowngrade,
  isValidClassification,
  type DataClassification,
} from '@/lib/data/classification';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET /api/glossary/[id] — get a single glossary term
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    // Authentication required - prevents data enumeration
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const term = await prisma.glossaryTerm.findUnique({ where: { id } });
    if (!term) {
      return NextResponse.json({ error: 'Term not found' }, { status: 404 });
    }
    return NextResponse.json({ term });
  } catch (error) {
    console.error('Get glossary term error:', error);

    // Handle auth errors specifically
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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
    const { term, definition, formula, category, examples, relatedTerms, dataSource, classification, dataOwnerId } = body as {
      term?: string;
      definition?: string;
      formula?: string;
      category?: string;
      examples?: string;
      relatedTerms?: string[] | string;
      dataSource?: string;
      // G-01 — optional classification + data-owner updates.
      classification?: string;
      dataOwnerId?: string | null;
    };
    const relatedTermsStr = relatedTerms !== undefined
      ? (Array.isArray(relatedTerms) ? relatedTerms.join(',') : relatedTerms)
      : undefined;

    // G-01: validate classification value if supplied.
    if (classification !== undefined && !isValidClassification(classification)) {
      return NextResponse.json(
        { error: 'Invalid classification value. Allowed: PUBLIC, USZOOM_CONFIDENTIAL, USZOOM_RESTRICTED, CUSTOMER_CONFIDENTIAL.' },
        { status: 400 },
      );
    }

    // Need the existing row to enforce the transition rule and to compute
    // change-deltas for the audit log.
    const existing = await prisma.glossaryTerm.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Term not found' }, { status: 404 });
    }

    let nextClassification: DataClassification | undefined;
    if (classification !== undefined) {
      nextClassification = classification as DataClassification;
      const currentClassification = coerceClassification(existing.classification);
      const check = canSetClassification(user, currentClassification, nextClassification);
      if (!check.ok) {
        return NextResponse.json({ error: check.reason }, { status: 403 });
      }
    }

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
        ...(nextClassification !== undefined && { classification: nextClassification }),
        ...(dataOwnerId !== undefined && { dataOwnerId }),
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
    if (nextClassification !== undefined) changedFields.push('classification');
    if (dataOwnerId !== undefined) changedFields.push('dataOwnerId');

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

    // G-01 / Policy 3698 DC-02: dedicated audit entry for classification
    // changes so they can be queried independently from the noisy stream
    // of regular glossary updates.
    if (
      nextClassification !== undefined &&
      coerceClassification(existing.classification) !== nextClassification
    ) {
      await createAuditLog({
        userId: user.id,
        action: AuditAction.DATA_CLASSIFICATION_CHANGE,
        resourceType: ResourceType.GLOSSARY,
        resourceId: id,
        metadata: {
          from: existing.classification,
          to: nextClassification,
          isDowngrade: isDowngrade(
            coerceClassification(existing.classification),
            nextClassification,
          ),
          term: updated.term,
        },
      });
    }
    if (dataOwnerId !== undefined && existing.dataOwnerId !== dataOwnerId) {
      await createAuditLog({
        userId: user.id,
        action: AuditAction.DATA_OWNER_CHANGE,
        resourceType: ResourceType.GLOSSARY,
        resourceId: id,
        metadata: {
          from: existing.dataOwnerId,
          to: dataOwnerId,
          term: updated.term,
        },
      });
    }

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
