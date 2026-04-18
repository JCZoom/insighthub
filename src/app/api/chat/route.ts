import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import YAML from 'yaml';
import Anthropic from '@anthropic-ai/sdk';
import { buildSystemPrompt } from '@/lib/ai/prompts';
import type { DashboardSchema } from '@/types';
import { withRateLimit, chatRateLimiter } from '@/lib/rate-limiter';

interface YamlGlossaryEntry {
  term: string;
  category: string;
  definition: string;
  formula?: string;
}

/**
 * Load glossary from the canonical YAML file so the AI prompt and the
 * glossary page always agree. Falls back to an empty array on error
 * rather than crashing the chat endpoint.
 */
function loadGlossaryForPrompt(): { term: string; category: string; definition: string; formula: string | null }[] {
  try {
    const filePath = path.join(process.cwd(), 'glossary', 'terms.yaml');
    const content = fs.readFileSync(filePath, 'utf-8');
    const entries = YAML.parse(content) as YamlGlossaryEntry[];
    if (!Array.isArray(entries)) return [];
    return entries.map(e => ({
      term: e.term,
      category: e.category,
      definition: e.definition,
      formula: e.formula ?? null,
    }));
  } catch (error) {
    console.error('Failed to load glossary for AI prompt:', error);
    return [];
  }
}

export async function POST(request: NextRequest) {
  return withRateLimit(request, chatRateLimiter, 'chat', async () => {
    try {
      const body = await request.json();
      const { message, currentSchema, conversationHistory } = body as {
        message: string;
        currentSchema: DashboardSchema | null;
        conversationHistory?: { role: 'user' | 'assistant'; content: string }[];
      };

      if (!message?.trim()) {
        return NextResponse.json({ error: 'Message is required' }, { status: 400 });
      }

      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        return NextResponse.json(
          { error: 'ANTHROPIC_API_KEY not configured. Add it to .env.local' },
          { status: 500 },
        );
      }

      const anthropic = new Anthropic({ apiKey });
      const glossaryTerms = loadGlossaryForPrompt();
      const systemPrompt = buildSystemPrompt(glossaryTerms, currentSchema);

      // Build message array: use conversation history if available, otherwise just the current message
      const messages: { role: 'user' | 'assistant'; content: string }[] =
        conversationHistory && conversationHistory.length > 0
          ? conversationHistory
          : [{ role: 'user', content: message }];

      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: systemPrompt,
        messages,
      });

      const textBlock = response.content.find(b => b.type === 'text');
      const rawText = textBlock?.type === 'text' ? textBlock.text : '';

      // Parse the JSON response from Claude
      let parsed: { explanation: string; patches: unknown[]; quickActions: unknown[] };
      try {
        // Try to extract JSON from the response (Claude sometimes wraps in markdown code blocks)
        const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, rawText];
        const jsonStr = jsonMatch[1]?.trim() || rawText.trim();
        parsed = JSON.parse(jsonStr);
      } catch {
        // If JSON parsing fails, treat the whole response as an explanation with no patches
        parsed = {
          explanation: rawText || 'I understood your request but had trouble generating the schema. Could you try rephrasing?',
          patches: [],
          quickActions: [],
        };
      }

      return NextResponse.json({
        explanation: parsed.explanation,
        patches: parsed.patches || [],
        quickActions: parsed.quickActions || [],
      });
    } catch (error) {
      console.error('Chat API error:', error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Internal server error' },
        { status: 500 },
      );
    }
  });
}
