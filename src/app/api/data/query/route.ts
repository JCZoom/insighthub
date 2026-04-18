import { NextRequest, NextResponse } from 'next/server';
import { queryData, getAvailableSources } from '@/lib/data/sample-data';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { source, groupBy } = body as { source: string; groupBy?: string[] };

    if (!source) {
      return NextResponse.json({ error: 'Source is required' }, { status: 400 });
    }

    const result = queryData(source, groupBy);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Data query error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ sources: getAvailableSources() });
}
