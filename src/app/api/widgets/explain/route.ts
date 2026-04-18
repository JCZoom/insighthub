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

      // Build explanation prompt
      const prompt = `You are a data analytics expert. Explain this dashboard widget's metric calculation in simple, business-friendly terms.

Widget Details:
- Title: ${widget.title}
- Type: ${widget.type}
- Data Source: ${widget.dataConfig.source}
${widget.dataConfig.aggregation ? `- Aggregation: ${widget.dataConfig.aggregation.function}(${widget.dataConfig.aggregation.field})` : ''}
${widget.dataConfig.groupBy?.length ? `- Grouped by: ${widget.dataConfig.groupBy.join(', ')}` : ''}
${widget.dataConfig.filters?.length ? `- Filters: ${JSON.stringify(widget.dataConfig.filters)}` : ''}
${widget.subtitle ? `- Subtitle: ${widget.subtitle}` : ''}

Please provide:
1. **What this metric measures** - A clear, concise explanation of what this widget shows
2. **How it's calculated** - The business logic behind the calculation
3. **Business insights** - What trends or patterns this metric helps identify
4. **Actionable takeaways** - How teams can use this information

Keep the explanation accessible to non-technical stakeholders. Use bullet points for clarity.`;

      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
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