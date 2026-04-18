import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import type { WidgetConfig } from '@/types';
import { withRateLimit, chatRateLimiter } from '@/lib/rate-limiter';
import { getCurrentUser } from '@/lib/auth/session';

export async function POST(request: NextRequest) {
  return withRateLimit(request, chatRateLimiter, 'explain', async () => {
    try {
      const body = await request.json();
      const { widget } = body as { widget: WidgetConfig };

      if (!widget) {
        return NextResponse.json({ error: 'Widget configuration is required' }, { status: 400 });
      }

      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        return NextResponse.json(
          { error: 'ANTHROPIC_API_KEY not configured. Add it to .env.local' },
          { status: 500 },
        );
      }

      // Get current user for context
      let currentUser;
      try {
        currentUser = await getCurrentUser();
      } catch (error) {
        console.warn('Failed to retrieve user session for explain API:', error);
        currentUser = undefined;
      }

      const anthropic = new Anthropic({ apiKey });

      // Build a concise explanation prompt (Haiku for speed)
      const prompt = `Briefly explain this dashboard widget for a business user. Be concise — 3-4 short bullet points max.

Widget: "${widget.title}" (${widget.type.replace(/_/g, ' ')})
Source: ${widget.dataConfig.source}${widget.dataConfig.aggregation ? ` | ${widget.dataConfig.aggregation.function}(${widget.dataConfig.aggregation.field})` : ''}${widget.dataConfig.groupBy?.length ? ` | grouped by ${widget.dataConfig.groupBy.join(', ')}` : ''}

Reply with:
• **What it shows** (one sentence)
• **How it's calculated** (one sentence)
• **Why it matters** (one sentence)`;

      const response = await anthropic.messages.create({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 250,
        messages: [{ role: 'user', content: prompt }],
      });

      const textBlock = response.content.find(b => b.type === 'text');
      const explanation = textBlock?.type === 'text' ? textBlock.text : 'Unable to generate explanation.';

      return NextResponse.json({
        explanation,
        widget: {
          title: widget.title,
          type: widget.type,
          source: widget.dataConfig.source,
        }
      });
    } catch (error) {
      console.error('Explain API error:', error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Internal server error' },
        { status: 500 },
      );
    }
  });
}