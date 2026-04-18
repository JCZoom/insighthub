'use client';

import { useRef } from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';
import type { WidgetConfig } from '@/types';
import { getColorPalette, getAnimationDuration, getTooltipConfig } from './widget-utils';
import { useResponsiveWidget } from '@/hooks/useResponsiveWidget';

interface PieChartWidgetProps {
  config: WidgetConfig;
  data: Record<string, unknown>[];
  onChartClick?: (field: string, value: unknown) => void;
}

export function PieChartWidget({ config, data, onChartClick }: PieChartWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const responsive = useResponsiveWidget(containerRef);

  const COLORS = getColorPalette(config.visualConfig.colorScheme);
  const animDuration = getAnimationDuration(config);
  const tooltipConfig = getTooltipConfig(responsive.isTouchDevice);

  if (!data.length) {
    return <div className="flex items-center justify-center h-full text-[var(--text-muted)] text-sm">No data</div>;
  }

  const sampleRow = data[0];
  const nameKey = Object.keys(sampleRow).find(k => typeof sampleRow[k] === 'string') || Object.keys(sampleRow)[0];
  const valueKey = Object.keys(sampleRow).find(k => typeof sampleRow[k] === 'number') || Object.keys(sampleRow)[1];
  const isDonut = config.type === 'donut_chart';

  const isMobile = responsive.size === 'mobile';
  const titleSize = isMobile ? 'text-xs' : 'text-sm';
  const subtitleSize = isMobile ? 'text-[10px]' : 'text-xs';

  // Adjust pie chart sizing for mobile
  const outerRadius = isMobile ? '70%' : '80%';
  const innerRadius = isDonut ? (isMobile ? '40%' : '50%') : 0;

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
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={innerRadius}
              outerRadius={outerRadius}
              dataKey={valueKey}
              nameKey={nameKey}
              paddingAngle={isMobile ? 1 : 2}
              animationDuration={animDuration}
              onClick={onChartClick ? (data: any, index: number) => {
                // When clicking a pie slice, filter by the name key
                if (data && data.payload) {
                  const nameValue = data.payload[nameKey];
                  if (nameValue !== undefined) {
                    onChartClick(nameKey, nameValue);
                  }
                }
              } : undefined}
              style={onChartClick ? { cursor: 'pointer' } : undefined}
            >
              {data.map((_, index) => (
                <Cell key={index} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip {...tooltipConfig} />
            {config.visualConfig.showLegend !== false && responsive.showLegend && (
              <Legend wrapperStyle={{ fontSize: `${responsive.fontSize}px` }} />
            )}
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
