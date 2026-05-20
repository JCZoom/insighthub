'use client';

import type { WidgetConfig } from '@/types';
import { getPrimaryColor } from './widget-utils';

interface GaugeWidgetProps {
  config: WidgetConfig;
  data: Record<string, unknown>[];
}

/**
 * GaugeWidget — half-circle gauge from 0..max.
 *
 * Configuration (all optional, sensible defaults preserve legacy
 * "percentage gauge" behavior):
 *
 *   visualConfig.customStyles.max   →  numeric ceiling (string-parsed).
 *                                      Default 100 (the legacy
 *                                      hard-coded value), which keeps
 *                                      percentage gauges rendering
 *                                      identically. Set to 5 for
 *                                      ratings, to N for capacity, etc.
 *
 *   visualConfig.customStyles.unit  →  display suffix (string).
 *                                      Default '%' when max=100 (legacy),
 *                                      else '' (empty). Override to '/5',
 *                                      ' pts', '°C', whatever fits the
 *                                      bound metric.
 *
 *   visualConfig.thresholds         →  Array<{value, color, label?}>.
 *                                      When non-empty, the arc colour
 *                                      is the colour of the highest
 *                                      threshold whose value ≤ current.
 *                                      When empty/undefined, falls back
 *                                      to the legacy percentage-band
 *                                      heuristic (>75% green, >50%
 *                                      amber, else red).
 *
 *   visualConfig.colorScheme        →  if set, ALWAYS wins over the
 *                                      threshold colour resolver. Use
 *                                      this to lock a brand colour
 *                                      regardless of value.
 *
 * The customStyles escape hatch (`Record<string, string>`) is the
 * existing convention for widget-specific config — see auto-layout.ts
 * which reads `customStyles.variant` for text blocks. We're following
 * that pattern instead of expanding the WidgetConfig type, which would
 * ripple through every consumer.
 *
 * Pre-2026-05-19 the renderer hard-coded `max = 100` and a `%` suffix,
 * which silently mislabeled any non-percentage binding as a percentage.
 * That's the bug this fixes.
 */
export function GaugeWidget({ config, data }: GaugeWidgetProps) {
  const row = data[0] || {};
  const field = config.dataConfig.aggregation?.field || Object.keys(row).find(k => typeof row[k] === 'number') || 'value';
  const value = typeof row[field] === 'number' ? row[field] as number : Number(row[field]) || 0;

  // Resolve max + unit from customStyles, with legacy-compatible fallbacks.
  const cs = config.visualConfig.customStyles ?? {};
  const parsedMax = cs.max !== undefined ? Number(cs.max) : NaN;
  const max = Number.isFinite(parsedMax) && parsedMax > 0 ? parsedMax : 100;
  const unit = cs.unit !== undefined ? cs.unit : (max === 100 ? '%' : '');

  // Clamp percent to [0, 1] for the arc geometry; an out-of-range value
  // (e.g. value=120 against max=100) caps the arc at full but still
  // displays the raw number underneath, so the truth-by-default contract
  // applies here too — we don't lie about what the data said.
  const percent = max > 0 ? Math.min(Math.max(value / max, 0), 1) : 0;
  const angle = percent * 180;

  // Resolve arc colour:
  //   1. Explicit colorScheme always wins (operator override).
  //   2. Configured thresholds: pick the colour of the highest threshold
  //      whose value ≤ current. If `value` is below all thresholds, use
  //      the colour of the LOWEST threshold as the "below floor" colour.
  //   3. Legacy fallback: percentage-band heuristic.
  const thresholds = config.visualConfig.thresholds;
  let thresholdColor: string;
  if (thresholds && thresholds.length > 0) {
    const sorted = [...thresholds].sort((a, b) => a.value - b.value);
    const matched = sorted.filter((t) => value >= t.value).pop();
    thresholdColor = matched?.color ?? sorted[0].color;
  } else {
    thresholdColor = percent > 0.75 ? '#56c47a' : percent > 0.5 ? '#dba644' : '#f47670';
  }
  const color = config.visualConfig.colorScheme ? getPrimaryColor(config.visualConfig.colorScheme) : thresholdColor;

  return (
    <div className="card p-4 h-full flex flex-col items-center justify-center fade-in">
      <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-2">{config.title}</h3>
      <div className="relative w-32 h-16 overflow-hidden">
        <svg viewBox="0 0 100 50" className="w-full h-full">
          <path d="M 5 50 A 45 45 0 0 1 95 50" fill="none" stroke="var(--border-color)" strokeWidth="8" strokeLinecap="round" />
          <path
            d="M 5 50 A 45 45 0 0 1 95 50"
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${(angle / 180) * 141.37} 141.37`}
            className="transition-all duration-1000"
          />
        </svg>
      </div>
      <p className="text-2xl font-bold mt-1" style={{ color }}>{value.toFixed(1)}{unit}</p>
      {config.subtitle && <p className="text-xs text-[var(--text-muted)] mt-1">{config.subtitle}</p>}
    </div>
  );
}
