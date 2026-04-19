import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { canAccessDataSourceWithMetrics } from '@/lib/auth/permissions';
import { queryDataSync } from '@/lib/data/sample-data';
import type {
  ColumnProfile,
  NumericStats,
  TextStats,
  DateStats,
  ValueCount,
  HistogramBucket,
  ProfileResponse
} from '@/types/data-explorer';

function isNumeric(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value);
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isDate(value: unknown): boolean {
  if (typeof value === 'string') {
    const date = new Date(value);
    return !isNaN(date.getTime());
  }
  return value instanceof Date && !isNaN(value.getTime());
}

function generateNumericStats(values: number[]): NumericStats {
  if (values.length === 0) {
    return {
      min: 0,
      max: 0,
      mean: 0,
      median: 0,
      standardDeviation: 0,
      percentiles: { p25: 0, p50: 0, p75: 0, p90: 0, p95: 0, p99: 0 }
    };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const sum = values.reduce((a, b) => a + b, 0);
  const mean = sum / values.length;

  // Standard deviation
  const variance = values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / values.length;
  const standardDeviation = Math.sqrt(variance);

  // Percentiles
  const getPercentile = (p: number) => {
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  };

  return {
    min: sorted[0],
    max: sorted[sorted.length - 1],
    mean: Number(mean.toFixed(2)),
    median: getPercentile(50),
    standardDeviation: Number(standardDeviation.toFixed(2)),
    percentiles: {
      p25: getPercentile(25),
      p50: getPercentile(50),
      p75: getPercentile(75),
      p90: getPercentile(90),
      p95: getPercentile(95),
      p99: getPercentile(99)
    }
  };
}

function generateTextStats(values: string[]): TextStats {
  if (values.length === 0) {
    return {
      avgLength: 0,
      minLength: 0,
      maxLength: 0,
      mostCommonWords: [],
      patterns: { email: 0, url: 0, phone: 0, numeric: 0 }
    };
  }

  const lengths = values.map(v => v.length);
  const avgLength = lengths.reduce((a, b) => a + b, 0) / lengths.length;
  const minLength = Math.min(...lengths);
  const maxLength = Math.max(...lengths);

  // Pattern detection
  const emailPattern = /@.*\./;
  const urlPattern = /https?:\/\//;
  const phonePattern = /\d{3}-\d{3}-\d{4}|\(\d{3}\)\s?\d{3}-\d{4}/;
  const numericPattern = /^\d+(\.\d+)?$/;

  let emailCount = 0, urlCount = 0, phoneCount = 0, numericCount = 0;

  for (const value of values) {
    if (emailPattern.test(value)) emailCount++;
    if (urlPattern.test(value)) urlCount++;
    if (phonePattern.test(value)) phoneCount++;
    if (numericPattern.test(value)) numericCount++;
  }

  // Most common words (simplified)
  const wordCounts = new Map<string, number>();
  for (const value of values) {
    const words = value.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    for (const word of words) {
      wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
    }
  }

  const mostCommonWords = Array.from(wordCounts.entries())
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5)
    .map(([word]) => word);

  return {
    avgLength: Number(avgLength.toFixed(1)),
    minLength,
    maxLength,
    mostCommonWords,
    patterns: {
      email: emailCount,
      url: urlCount,
      phone: phoneCount,
      numeric: numericCount
    }
  };
}

function generateDateStats(values: Date[]): DateStats {
  if (values.length === 0) {
    const now = new Date();
    return {
      earliestDate: now,
      latestDate: now,
      dateRange: '0 days',
      gaps: [],
      distribution: { byYear: {}, byMonth: {}, byDayOfWeek: {} }
    };
  }

  const sorted = [...values].sort((a, b) => a.getTime() - b.getTime());
  const earliest = sorted[0];
  const latest = sorted[sorted.length - 1];
  const rangeDays = Math.ceil((latest.getTime() - earliest.getTime()) / (1000 * 60 * 60 * 24));

  // Distribution by year, month, day of week
  const byYear: Record<string, number> = {};
  const byMonth: Record<string, number> = {};
  const byDayOfWeek: Record<string, number> = {};

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  for (const date of values) {
    const year = date.getFullYear().toString();
    const month = date.toLocaleString('default', { month: 'long' });
    const dayOfWeek = dayNames[date.getDay()];

    byYear[year] = (byYear[year] || 0) + 1;
    byMonth[month] = (byMonth[month] || 0) + 1;
    byDayOfWeek[dayOfWeek] = (byDayOfWeek[dayOfWeek] || 0) + 1;
  }

  return {
    earliestDate: earliest,
    latestDate: latest,
    dateRange: `${rangeDays} days`,
    gaps: [], // Simplified for now
    distribution: {
      byYear,
      byMonth,
      byDayOfWeek
    }
  };
}

function generateTopValues(values: unknown[], limit: number = 10): ValueCount[] {
  const counts = new Map<unknown, number>();
  const total = values.length;

  for (const value of values) {
    const key = value === null || value === undefined ? 'NULL' : value;
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  return Array.from(counts.entries())
    .sort(([,a], [,b]) => b - a)
    .slice(0, limit)
    .map(([value, count]) => ({
      value,
      count,
      percentage: Number(((count / total) * 100).toFixed(1))
    }));
}

function generateHistogram(values: number[], buckets: number = 20): HistogramBucket[] {
  if (values.length === 0) return [];

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;
  const bucketSize = range / buckets;

  const histogram: HistogramBucket[] = [];
  for (let i = 0; i < buckets; i++) {
    const bucketMin = min + (i * bucketSize);
    const bucketMax = i === buckets - 1 ? max : bucketMin + bucketSize;

    const count = values.filter(v => v >= bucketMin && (i === buckets - 1 ? v <= bucketMax : v < bucketMax)).length;

    histogram.push({
      min: Number(bucketMin.toFixed(2)),
      max: Number(bucketMax.toFixed(2)),
      count,
      percentage: Number(((count / values.length) * 100).toFixed(1))
    });
  }

  return histogram;
}

async function generateColumnProfile(
  source: string,
  table: string,
  columnName: string,
  includeHistogram: boolean = false,
  includeTopValues: boolean = true,
  topValuesLimit: number = 10
): Promise<ColumnProfile> {
  // Get sample data for the source/table
  const result = queryDataSync(source);

  if (!result.data || result.data.length === 0) {
    throw new Error(`No data found for source: ${source}`);
  }

  if (!result.columns.includes(columnName)) {
    throw new Error(`Column '${columnName}' not found in source '${source}'`);
  }

  // Extract column values
  const columnValues = result.data.map(row => row[columnName]).filter(v => v !== null && v !== undefined);
  const totalRows = result.data.length;
  const nullCount = totalRows - columnValues.length;
  const uniqueValues = new Set(columnValues);
  const uniqueCount = uniqueValues.size;

  const nullPercentage = Number(((nullCount / totalRows) * 100).toFixed(1));
  const uniquePercentage = Number(((uniqueCount / totalRows) * 100).toFixed(1));

  // Determine data type and generate appropriate statistics
  let dataType = 'unknown';
  let statistics: NumericStats | TextStats | DateStats | undefined;
  let histogram: HistogramBucket[] | undefined;

  if (columnValues.length > 0) {
    const firstValue = columnValues[0];

    if (isNumeric(firstValue)) {
      dataType = 'numeric';
      const numericValues = columnValues.filter(isNumeric);
      statistics = generateNumericStats(numericValues);

      if (includeHistogram && numericValues.length > 0) {
        histogram = generateHistogram(numericValues);
      }
    } else if (isDate(firstValue)) {
      dataType = 'date';
      const dateValues = columnValues
        .map(v => typeof v === 'string' ? new Date(v) : v)
        .filter(d => d instanceof Date && !isNaN(d.getTime())) as Date[];

      if (dateValues.length > 0) {
        statistics = generateDateStats(dateValues);
      }
    } else if (isString(firstValue)) {
      dataType = 'text';
      const stringValues = columnValues.filter(isString);
      statistics = generateTextStats(stringValues);
    }
  }

  // Generate top values
  let topValues: ValueCount[] | undefined;
  if (includeTopValues) {
    topValues = generateTopValues(columnValues, topValuesLimit);
  }

  return {
    columnName,
    dataType,
    totalRows,
    nullCount,
    uniqueCount,
    nullPercentage,
    uniquePercentage,
    statistics,
    topValues,
    histogram
  };
}

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const user = await getCurrentUser();

    const body = await request.json();
    const {
      source,
      table,
      column,
      includeHistogram = false,
      includeTopValues = true,
      topValuesLimit = 10
    } = body;

    if (!source || !column) {
      return NextResponse.json(
        { error: 'Source and column are required' },
        { status: 400 }
      );
    }

    // Check permissions for the data source
    const accessCheck = await canAccessDataSourceWithMetrics(user, source);
    if (!accessCheck.hasAccess) {
      return NextResponse.json(
        {
          error: 'Access denied',
          message: accessCheck.deniedReason || 'You don\'t have permission to access this data source.'
        },
        { status: 403 }
      );
    }

    const startTime = Date.now();

    // Generate column profile
    const profile = await generateColumnProfile(
      source,
      table,
      column,
      includeHistogram,
      includeTopValues,
      Math.min(topValuesLimit, 100) // Cap at 100 values
    );

    const executionTime = Date.now() - startTime;

    const response: ProfileResponse = {
      profile,
      executionTime
    };

    return NextResponse.json(response);
  } catch (error) {
    // Handle authentication errors
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    console.error('Data profiling error:', error);

    // Handle specific errors
    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}