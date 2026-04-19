import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { buildSystemPrompt } from '@/lib/ai/prompts';
import { getPromptOverrides, savePromptOverrides } from '@/lib/ai/prompt-overrides';

/**
 * GET /api/admin/prompts
 * Returns the fully assembled system prompt and the editable custom instructions.
 */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Build the full prompt as the AI would see it (with empty schema for preview)
    const fullPrompt = await buildSystemPrompt([], null, [], user);
    const overrides = await getPromptOverrides();

    return NextResponse.json({
      fullPrompt,
      customInstructions: overrides.customInstructions,
      lastModified: overrides.lastModified,
      lastModifiedBy: overrides.lastModifiedBy,
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    console.error('Error fetching prompts:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PUT /api/admin/prompts
 * Updates the custom instructions that get appended to the system prompt.
 */
export async function PUT(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const body = await request.json();
    const { customInstructions } = body as { customInstructions: string };

    if (typeof customInstructions !== 'string') {
      return NextResponse.json({ error: 'customInstructions must be a string' }, { status: 400 });
    }

    const saved = await savePromptOverrides({
      customInstructions,
      lastModified: new Date().toISOString(),
      lastModifiedBy: user.name,
    });

    // Rebuild the full prompt to return updated version
    const fullPrompt = await buildSystemPrompt([], null, [], user);

    return NextResponse.json({
      fullPrompt,
      customInstructions: saved.customInstructions,
      lastModified: saved.lastModified,
      lastModifiedBy: saved.lastModifiedBy,
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    console.error('Error saving prompts:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
