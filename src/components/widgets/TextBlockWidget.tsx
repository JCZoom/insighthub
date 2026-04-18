'use client';

import type { WidgetConfig } from '@/types';

interface TextBlockWidgetProps {
  config: WidgetConfig;
}

export function TextBlockWidget({ config }: TextBlockWidgetProps) {
  return (
    <div className="card p-4 h-full flex flex-col fade-in">
      <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-2">{config.title}</h3>
      <div className="text-xs text-[var(--text-secondary)] leading-relaxed whitespace-pre-wrap">
        {config.subtitle || 'No content'}
      </div>
    </div>
  );
}
