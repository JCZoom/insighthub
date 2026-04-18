import { NextRequest, NextResponse } from 'next/server';
import { searchWidgets, WIDGET_LIBRARY, type WidgetTemplate } from '@/lib/data/widget-library';

/**
 * GET /api/widgets?q=churn&limit=10
 *
 * Search the widget library. In Phase 1 this queries the static library.
 * In Phase 2 it will also query the WidgetTemplate table in Postgres.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 50);
    const type = searchParams.get('type') || '';

    let results: WidgetTemplate[];

    if (query || type) {
      results = searchWidgets(query, limit);
      if (type) {
        results = results.filter(w => w.type === type);
      }
    } else {
      results = WIDGET_LIBRARY.slice(0, limit);
    }

    return NextResponse.json({
      widgets: results,
      total: WIDGET_LIBRARY.length,
    });
  } catch (error) {
    console.error('Widget search error:', error);
    return NextResponse.json({ error: 'Failed to search widgets' }, { status: 500 });
  }
}
