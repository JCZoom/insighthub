'use client';

import { useRef } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import type { WidgetConfig } from '@/types';
import { getColorPalette, getAnimationDuration, getTooltipConfig } from './widget-utils';
import { useResponsiveWidget } from '@/hooks/useResponsiveWidget';

interface BarChartWidgetProps {
  config: WidgetConfig;
  data: Record<string, unknown>[];
}

export function BarChartWidget({ config, data }: BarChartWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const responsive = useResponsiveWidget(containerRef);

  const COLORS = getColorPalette(config.visualConfig.colorScheme);
  const animDuration = getAnimationDuration(config);

  // Use responsive settings
  const showGrid = config.visualConfig.showGrid !== false && responsive.showAxis;
  const showLabels = config.visualConfig.showLabels !== false && responsive.showLabels;
  const showLegend = config.visualConfig.showLegend !== false && responsive.showLegend;

  const tooltipConfig = getTooltipConfig(responsive.isTouchDevice);

  if (!data.length) {
    return <div className="flex items-center justify-center h-full text-[var(--text-muted)] text-sm">No data</div>;
  }

  const sampleRow = data[0];
  const xKey = Object.keys(sampleRow).find(k =>
    typeof sampleRow[k] === 'string'
  ) || Object.keys(sampleRow)[0];
  const barKeys = Object.keys(sampleRow).filter(k => k !== xKey && typeof sampleRow[k] === 'number');

  if (barKeys.length === 0) {
    return (
      <div className="card p-4 h-full flex flex-col items-center justify-center text-center gap-1">
        <p className="text-xs font-medium text-[var(--text-primary)]">{config.title}</p>
        <p className="text-[10px] text-[var(--text-muted)]">No numeric data found to chart</p>
      </div>
    );
  }

  const isMobile = responsive.size === 'mobile';
  const titleSize = isMobile ? 'text-xs' : 'text-sm';
  const subtitleSize = isMobile ? 'text-[10px]' : 'text-xs';

  return (
    <div ref={containerRef} className="card p-4 h-full flex flex-col fade-in">
      <div className="mb-3">
        <h3 className={`${titleSize} font-semibold text-[var(--text-primary)]`}>{config.title}</h3>
        {config.subtitle && !isMobile && (
          <p className={`${subtitleSize} text-[var(--text-muted)]`}>{config.subtitle}</p>
        )}
      </div>
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={responsive.margin}>
            {showGrid && (
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--border-color)"
                opacity={0.5}
              />
            )}
            <XAxis
              dataKey={xKey}
              tick={showLabels ? {
                fontSize: responsive.fontSize,
                fill: 'var(--text-secondary)'
              } : false}
              axisLine={responsive.showAxis ? { stroke: 'var(--border-color)' } : false}
              tickLine={false}
              interval={responsive.size === 'mobile' ? 'preserveStartEnd' : 0}
              tickCount={responsive.tickCount}
            />
            <YAxis
              tick={showLabels ? {
                fontSize: responsive.fontSize,
                fill: 'var(--text-secondary)'
              } : false}
              axisLine={false}
              tickLine={false}
              tickCount={responsive.tickCount}
            />
            <Tooltip
              cursor={responsive.isTouchDevice ? false : { fill: 'rgba(255,255,255,0.04)' }}
              {...tooltipConfig}
            />
            {showLegend && barKeys.length > 1 && (
              <Legend wrapperStyle={{ fontSize: `${responsive.fontSize}px` }} />
            )}
            {barKeys.map((key, i) => (
              <Bar
                key={key}
                dataKey={key}
                fill={COLORS[i % COLORS.length]}
                radius={isMobile ? [2, 2, 0, 0] : [4, 4, 0, 0]}
                animationDuration={animDuration}
                stackId={config.visualConfig.stacked ? 'stack' : undefined}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
