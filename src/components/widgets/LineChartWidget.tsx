'use client';

import { useRef } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import type { WidgetConfig } from '@/types';
import { getColorPalette, getAnimationDuration, getTooltipConfig, formatDateTick, formatAxisNumber, calcXInterval } from './widget-utils';
import { useResponsiveWidget } from '@/hooks/useResponsiveWidget';

interface LineChartWidgetProps {
  config: WidgetConfig;
  data: Record<string, unknown>[];
  onChartClick?: (field: string, value: unknown) => void;
}

export function LineChartWidget({ config, data, onChartClick }: LineChartWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const responsive = useResponsiveWidget(containerRef);

  const palette = getColorPalette(config.visualConfig.colorScheme);
  const animDuration = getAnimationDuration(config);

  // Use responsive settings instead of static config
  const showGrid = config.visualConfig.showGrid !== false && responsive.showAxis;
  const showLabels = config.visualConfig.showLabels !== false && responsive.showLabels;
  const showLegend = config.visualConfig.showLegend !== false && responsive.showLegend;

  const tooltipConfig = getTooltipConfig(responsive.isTouchDevice);

  if (!data.length) {
    return <div className="flex items-center justify-center h-full text-[var(--text-muted)] text-sm">No data</div>;
  }

  // Determine which keys are numeric (to plot as lines)
  const sampleRow = data[0];
  const xKey = Object.keys(sampleRow).find(k =>
    k.includes('month') || k.includes('date') || k.includes('period') || k.includes('day')
  ) || Object.keys(sampleRow)[0];
  const lineKeys = Object.keys(sampleRow).filter(k => k !== xKey && typeof sampleRow[k] === 'number');

  if (lineKeys.length === 0 || !xKey) {
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
          <LineChart
            data={data}
            margin={responsive.margin}
            onClick={onChartClick ? (data: any) => {
              // When clicking a line chart, filter by the X-axis value at the click point
              if (data && data.activeLabel !== undefined) {
                onChartClick(xKey, data.activeLabel);
              }
            } : undefined}
            style={onChartClick ? { cursor: 'pointer' } : undefined}
          >
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
              interval={calcXInterval(data.length, responsive.width)}
              tickFormatter={formatDateTick}
            />
            <YAxis
              tick={showLabels ? {
                fontSize: responsive.fontSize,
                fill: 'var(--text-secondary)'
              } : false}
              axisLine={false}
              tickLine={false}
              tickCount={responsive.tickCount}
              tickFormatter={formatAxisNumber}
              width={50}
            />
            <Tooltip
              cursor={responsive.isTouchDevice ? false : { stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1 }}
              {...tooltipConfig}
            />
            {showLegend && lineKeys.length > 1 && (
              <Legend wrapperStyle={{ fontSize: `${responsive.fontSize}px` }} />
            )}
            {lineKeys.map((key, i) => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                stroke={palette[i % palette.length]}
                strokeWidth={isMobile ? 1.5 : 2}
                dot={isMobile ? false : { r: 3, fill: palette[i % palette.length] }}
                activeDot={{ r: isMobile ? 3 : 5 }}
                animationDuration={animDuration}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
