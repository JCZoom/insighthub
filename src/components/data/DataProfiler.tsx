'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  BarChart3,
  TrendingUp,
  Hash,
  Calendar,
  FileText,
  Loader2,
  AlertCircle,
  X,
  RefreshCw,
  Info
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip } from '@/components/ui/Tooltip';
import type {
  ColumnProfile,
  NumericStats,
  TextStats,
  DateStats,
  ValueCount,
  HistogramBucket
} from '@/types/data-explorer';

interface DataProfilerProps {
  source?: string;
  table?: string;
  column?: string;
  isOpen: boolean;
  onClose?: () => void;
  className?: string;
}

export function DataProfiler({
  source,
  table,
  column,
  isOpen,
  onClose,
  className
}: DataProfilerProps) {
  const [profile, setProfile] = useState<ColumnProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch column profile
  const fetchProfile = useCallback(async () => {
    if (!source || !table || !column) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/data/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source,
          table,
          column,
          includeHistogram: true,
          includeTopValues: true,
          topValuesLimit: 10
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch profile: ${response.statusText}`);
      }

      const result = await response.json();
      setProfile(result.profile);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load column profile');
    } finally {
      setLoading(false);
    }
  }, [source, table, column]);

  useEffect(() => {
    if (isOpen && source && table && column) {
      fetchProfile();
    }
  }, [isOpen, fetchProfile]);

  // Render numeric statistics
  const renderNumericStats = (stats: NumericStats) => (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-[var(--bg-card)]/50 p-2 rounded border border-[var(--border-color)]">
          <p className="text-[10px] text-[var(--text-muted)] mb-1">Range</p>
          <p className="text-xs font-mono text-[var(--text-primary)]">
            {stats.min.toLocaleString()} → {stats.max.toLocaleString()}
          </p>
        </div>
        <div className="bg-[var(--bg-card)]/50 p-2 rounded border border-[var(--border-color)]">
          <p className="text-[10px] text-[var(--text-muted)] mb-1">Mean</p>
          <p className="text-xs font-mono text-[var(--text-primary)]">
            {stats.mean.toLocaleString()}
          </p>
        </div>
        <div className="bg-[var(--bg-card)]/50 p-2 rounded border border-[var(--border-color)]">
          <p className="text-[10px] text-[var(--text-muted)] mb-1">Median</p>
          <p className="text-xs font-mono text-[var(--text-primary)]">
            {stats.median.toLocaleString()}
          </p>
        </div>
        <div className="bg-[var(--bg-card)]/50 p-2 rounded border border-[var(--border-color)]">
          <p className="text-[10px] text-[var(--text-muted)] mb-1">Std Dev</p>
          <p className="text-xs font-mono text-[var(--text-primary)]">
            {stats.standardDeviation.toLocaleString()}
          </p>
        </div>
      </div>

      <div className="bg-[var(--bg-card)]/50 p-2 rounded border border-[var(--border-color)]">
        <p className="text-[10px] text-[var(--text-muted)] mb-2">Percentiles</p>
        <div className="grid grid-cols-3 gap-2 text-[10px]">
          <div>
            <span className="text-[var(--text-muted)]">25th:</span>
            <span className="ml-1 font-mono text-[var(--text-primary)]">{stats.percentiles.p25.toLocaleString()}</span>
          </div>
          <div>
            <span className="text-[var(--text-muted)]">75th:</span>
            <span className="ml-1 font-mono text-[var(--text-primary)]">{stats.percentiles.p75.toLocaleString()}</span>
          </div>
          <div>
            <span className="text-[var(--text-muted)]">95th:</span>
            <span className="ml-1 font-mono text-[var(--text-primary)]">{stats.percentiles.p95.toLocaleString()}</span>
          </div>
        </div>
      </div>
    </div>
  );

  // Render text statistics
  const renderTextStats = (stats: TextStats) => (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-[var(--bg-card)]/50 p-2 rounded border border-[var(--border-color)]">
          <p className="text-[10px] text-[var(--text-muted)] mb-1">Min Length</p>
          <p className="text-xs font-mono text-[var(--text-primary)]">{stats.minLength}</p>
        </div>
        <div className="bg-[var(--bg-card)]/50 p-2 rounded border border-[var(--border-color)]">
          <p className="text-[10px] text-[var(--text-muted)] mb-1">Avg Length</p>
          <p className="text-xs font-mono text-[var(--text-primary)]">{stats.avgLength}</p>
        </div>
        <div className="bg-[var(--bg-card)]/50 p-2 rounded border border-[var(--border-color)]">
          <p className="text-[10px] text-[var(--text-muted)] mb-1">Max Length</p>
          <p className="text-xs font-mono text-[var(--text-primary)]">{stats.maxLength}</p>
        </div>
      </div>

      {stats.patterns && (
        <div className="bg-[var(--bg-card)]/50 p-2 rounded border border-[var(--border-color)]">
          <p className="text-[10px] text-[var(--text-muted)] mb-2">Patterns Detected</p>
          <div className="grid grid-cols-2 gap-1 text-[10px]">
            <div className="flex justify-between">
              <span className="text-[var(--text-muted)]">Email:</span>
              <span className="font-mono text-[var(--text-primary)]">{stats.patterns.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--text-muted)]">URL:</span>
              <span className="font-mono text-[var(--text-primary)]">{stats.patterns.url}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--text-muted)]">Phone:</span>
              <span className="font-mono text-[var(--text-primary)]">{stats.patterns.phone}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--text-muted)]">Numeric:</span>
              <span className="font-mono text-[var(--text-primary)]">{stats.patterns.numeric}</span>
            </div>
          </div>
        </div>
      )}

      {stats.mostCommonWords && stats.mostCommonWords.length > 0 && (
        <div className="bg-[var(--bg-card)]/50 p-2 rounded border border-[var(--border-color)]">
          <p className="text-[10px] text-[var(--text-muted)] mb-2">Common Words</p>
          <div className="flex flex-wrap gap-1">
            {stats.mostCommonWords.map((word, index) => (
              <span
                key={index}
                className="px-1.5 py-0.5 bg-accent-blue/10 text-accent-blue text-[9px] rounded"
              >
                {word}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  // Render date statistics
  const renderDateStats = (stats: DateStats) => (
    <div className="space-y-3">
      <div className="bg-[var(--bg-card)]/50 p-2 rounded border border-[var(--border-color)]">
        <p className="text-[10px] text-[var(--text-muted)] mb-2">Date Range</p>
        <div className="text-[10px] space-y-1">
          <div className="flex justify-between">
            <span className="text-[var(--text-muted)]">Earliest:</span>
            <span className="font-mono text-[var(--text-primary)]">
              {stats.earliestDate.toLocaleDateString()}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--text-muted)]">Latest:</span>
            <span className="font-mono text-[var(--text-primary)]">
              {stats.latestDate.toLocaleDateString()}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--text-muted)]">Span:</span>
            <span className="font-mono text-[var(--text-primary)]">{stats.dateRange}</span>
          </div>
        </div>
      </div>

      {stats.distribution && (
        <div className="bg-[var(--bg-card)]/50 p-2 rounded border border-[var(--border-color)]">
          <p className="text-[10px] text-[var(--text-muted)] mb-2">Distribution by Year</p>
          <div className="space-y-1">
            {Object.entries(stats.distribution.byYear)
              .sort(([a], [b]) => b.localeCompare(a))
              .slice(0, 5)
              .map(([year, count]) => (
                <div key={year} className="flex justify-between text-[10px]">
                  <span className="text-[var(--text-muted)]">{year}:</span>
                  <span className="font-mono text-[var(--text-primary)]">{count}</span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );

  // Render histogram
  const renderHistogram = (histogram: HistogramBucket[]) => {
    const maxCount = Math.max(...histogram.map(b => b.count));

    return (
      <div className="bg-[var(--bg-card)]/50 p-2 rounded border border-[var(--border-color)]">
        <p className="text-[10px] text-[var(--text-muted)] mb-2">Distribution</p>
        <div className="space-y-1">
          {histogram.slice(0, 10).map((bucket, index) => (
            <div key={index} className="flex items-center gap-2 text-[9px]">
              <div className="w-16 text-[var(--text-muted)] font-mono text-right">
                {bucket.min.toFixed(0)}-{bucket.max.toFixed(0)}
              </div>
              <div className="flex-1 bg-[var(--border-color)] rounded-full h-1.5 relative">
                <div
                  className="bg-accent-blue h-full rounded-full"
                  style={{ width: `${(bucket.count / maxCount) * 100}%` }}
                />
              </div>
              <div className="w-8 text-[var(--text-primary)] font-mono text-right">
                {bucket.count}
              </div>
              <div className="w-8 text-[var(--text-muted)] text-right">
                {bucket.percentage}%
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Render top values
  const renderTopValues = (topValues: ValueCount[]) => (
    <div className="bg-[var(--bg-card)]/50 p-2 rounded border border-[var(--border-color)]">
      <p className="text-[10px] text-[var(--text-muted)] mb-2">Top Values</p>
      <div className="space-y-1">
        {topValues.map((item, index) => (
          <div key={index} className="flex items-center gap-2 text-[10px]">
            <div className="flex-1 truncate text-[var(--text-primary)] font-mono">
              {String(item.value)}
            </div>
            <div className="w-8 text-[var(--text-muted)] text-right">
              {item.count}
            </div>
            <div className="w-10 text-[var(--text-muted)] text-right">
              {item.percentage}%
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  if (!isOpen) return null;

  return (
    <div className={cn("flex flex-col h-full border-l border-[var(--border-color)] bg-[var(--bg-primary)] w-80 shrink-0", className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-3 border-b border-[var(--border-color)]">
        <div className="flex items-center gap-2">
          <BarChart3 size={14} className="text-accent-purple" />
          <h3 className="text-xs font-semibold text-[var(--text-primary)] uppercase tracking-wider">
            Column Profile
          </h3>
        </div>
        <div className="flex items-center gap-1">
          <Tooltip content="Refresh profile">
            <button
              onClick={fetchProfile}
              className="p-1 rounded-md hover:bg-[var(--bg-card-hover)] transition-colors"
              disabled={loading}
            >
              <RefreshCw size={12} className={cn("text-[var(--text-muted)]", loading && "animate-spin")} />
            </button>
          </Tooltip>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 rounded-md hover:bg-[var(--bg-card-hover)] transition-colors"
            >
              <X size={12} className="text-[var(--text-muted)]" />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={16} className="animate-spin text-[var(--text-muted)]" />
          </div>
        ) : error ? (
          <div className="text-center py-8 px-3">
            <AlertCircle size={24} className="mx-auto text-red-400 mb-2" />
            <p className="text-xs text-red-400 mb-2">Failed to load profile</p>
            <p className="text-[10px] text-[var(--text-muted)]">{error}</p>
          </div>
        ) : !column ? (
          <div className="text-center py-8 px-3">
            <BarChart3 size={24} className="mx-auto text-[var(--text-muted)] mb-2 opacity-40" />
            <p className="text-xs text-[var(--text-muted)]">Select a column to view profile</p>
          </div>
        ) : !profile ? (
          <div className="text-center py-8 px-3">
            <BarChart3 size={24} className="mx-auto text-[var(--text-muted)] mb-2 opacity-40" />
            <p className="text-xs text-[var(--text-muted)]">No profile data available</p>
          </div>
        ) : (
          <div className="p-3 space-y-4">
            {/* Column header */}
            <div className="border border-[var(--border-color)] rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <Hash size={12} className="text-accent-yellow" />
                <h4 className="text-sm font-semibold text-[var(--text-primary)]">{profile.columnName}</h4>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[10px]">
                <div>
                  <span className="text-[var(--text-muted)]">Type:</span>
                  <span className="ml-1 font-mono text-[var(--text-primary)]">{profile.dataType}</span>
                </div>
                <div>
                  <span className="text-[var(--text-muted)]">Total Rows:</span>
                  <span className="ml-1 font-mono text-[var(--text-primary)]">{profile.totalRows.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-[var(--text-muted)]">Null Count:</span>
                  <span className="ml-1 font-mono text-[var(--text-primary)]">
                    {profile.nullCount.toLocaleString()} ({profile.nullPercentage}%)
                  </span>
                </div>
                <div>
                  <span className="text-[var(--text-muted)]">Unique:</span>
                  <span className="ml-1 font-mono text-[var(--text-primary)]">
                    {profile.uniqueCount.toLocaleString()} ({profile.uniquePercentage}%)
                  </span>
                </div>
              </div>
            </div>

            {/* Type-specific statistics */}
            {profile.statistics && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  {profile.dataType === 'numeric' && <TrendingUp size={12} className="text-accent-blue" />}
                  {profile.dataType === 'text' && <FileText size={12} className="text-accent-green" />}
                  {profile.dataType === 'date' && <Calendar size={12} className="text-accent-purple" />}
                  <h5 className="text-xs font-medium text-[var(--text-primary)]">Statistics</h5>
                </div>
                {profile.dataType === 'numeric' && renderNumericStats(profile.statistics as NumericStats)}
                {profile.dataType === 'text' && renderTextStats(profile.statistics as TextStats)}
                {profile.dataType === 'date' && renderDateStats(profile.statistics as DateStats)}
              </div>
            )}

            {/* Histogram */}
            {profile.histogram && profile.histogram.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <BarChart3 size={12} className="text-accent-cyan" />
                  <h5 className="text-xs font-medium text-[var(--text-primary)]">Histogram</h5>
                </div>
                {renderHistogram(profile.histogram)}
              </div>
            )}

            {/* Top values */}
            {profile.topValues && profile.topValues.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Hash size={12} className="text-accent-orange" />
                  <h5 className="text-xs font-medium text-[var(--text-primary)]">Top Values</h5>
                </div>
                {renderTopValues(profile.topValues)}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}