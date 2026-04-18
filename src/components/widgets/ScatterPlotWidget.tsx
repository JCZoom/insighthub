'use client';

import { ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ZAxis } from 'recharts';
import type { WidgetConfig } from '@/types';
import { getPrimaryColor, getAnimationDuration, TOOLTIP_STYLE } from './widget-utils';

interface ScatterPlotWidgetProps {
  config: WidgetConfig;
  data: Record<string, unknown>[];
}

export function ScatterPlotWidget({ config, data }: ScatterPlotWidgetProps) {
  const primaryColor = getPrimaryColor(config.visualConfig.colorScheme);
  const animDuration = getAnimationDuration(config);
  const showGrid = config.visualConfig.showGrid !== false;
  const showLabels = config.visualConfig.showLabels !== false;
  if (!data.length) {
    return <div className="flex items-center justify-center h-full text-[var(--text-muted)] text-sm">No data</div>;
  }

  const numericKeys = Object.keys(data[0]).filter(k => typeof data[0][k] === 'number');
  const xKey = numericKeys[0] || Object.keys(data[0])[0];
  const yKey = numericKeys[1] || numericKeys[0] || Object.keys(data[0])[1];
  const zKey = numericKeys[2]; // optional size dimension

  return (
    <div className="card p-4 h-full flex flex-col fade-in">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">{config.title}</h3>
        {config.subtitle && <p className="text-xs text-[var(--text-muted)]">{config.subtitle}</p>}
      </div>
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" opacity={0.5} />}
            <XAxis
              dataKey={xKey}
              type="number"
              name={xKey}
              tick={showLabels ? { fontSize: 11, fill: 'var(--text-secondary)' } : false}
              axisLine={{ stroke: 'var(--border-color)' }}
              tickLine={false}
            />
            <YAxis
              dataKey={yKey}
              type="number"
              name={yKey}
              tick={showLabels ? { fontSize: 11, fill: 'var(--text-secondary)' } : false}
              axisLine={false}
              tickLine={false}
            />
            {zKey && <ZAxis dataKey={zKey} range={[40, 400]} name={zKey} />}
            <Tooltip
              cursor={{ strokeDasharray: '3 3', stroke: 'rgba(255,255,255,0.1)' }}
              {...TOOLTIP_STYLE}
            />
            <Scatter
              data={data}
              fill={primaryColor}
              fillOpacity={0.7}
              animationDuration={animDuration}
            />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
