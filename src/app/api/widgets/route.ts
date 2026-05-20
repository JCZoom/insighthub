import { NextRequest, NextResponse } from 'next/server';
import {
  searchWidgets,
  listVisibleWidgets,
  type WidgetTemplate,
} from '@/lib/data/widget-library';
import { demoSourcesEnabled } from '@/lib/data/sample-sources';

/**
 * GET /api/widgets?q=churn&limit=10
 *
 * Search the widget library. In Phase 1 this queries the static library.
 * In Phase 2 it will also query the WidgetTemplate table in Postgres.
 *
 * Honors the FEATURE_DEMO_SOURCES quarantine: when the flag is off,
 * widgets bound to sample/demo sources (kpi_summary, mrr_by_month, etc.)
 * are excluded from results, mirroring the gating on the LLM source
 * catalog and the data-query catalog. See
 * docs/REAL_DATA_MIGRATION_PLAN_2026-05-19.md Phase A.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 50);
    const type = searchParams.get('type') || '';
    const demoEnabled = demoSourcesEnabled();

    let results: WidgetTemplate[];

    if (query || type) {
      results = searchWidgets(query, limit, { demoEnabled });
      if (type) {
        results = results.filter(w => w.type === type);
      }
    } else {
      results = listVisibleWidgets({ demoEnabled }).slice(0, limit);
    }

    return NextResponse.json({
      widgets: results,
      total: listVisibleWidgets({ demoEnabled }).length,
    });
  } catch (error) {
    console.error('Widget search error:', error);
    return NextResponse.json({ error: 'Failed to search widgets' }, { status: 500 });
  }
}
