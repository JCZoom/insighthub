import type { WidgetConfig } from '@/types';

// Base color palette — order matches the colorScheme names
const BASE_COLORS: Record<string, string> = {
  blue: '#6baaff',
  green: '#56c47a',
  purple: '#b48eff',
  amber: '#dba644',
  cyan: '#4dcec2',
  red: '#f47670',
};

const ALL_COLORS = ['#6baaff', '#56c47a', '#b48eff', '#dba644', '#4dcec2', '#f47670'];

/**
 * Returns a 6-color palette rotated so the selected scheme's color is first.
 * e.g. getColorPalette('green') → ['#56c47a', '#b48eff', '#dba644', '#4dcec2', '#f47670', '#6baaff']
 */
export function getColorPalette(scheme?: string): string[] {
  if (!scheme || !BASE_COLORS[scheme]) return ALL_COLORS;
  const primary = BASE_COLORS[scheme];
  const idx = ALL_COLORS.indexOf(primary);
  if (idx <= 0) return ALL_COLORS;
  return [...ALL_COLORS.slice(idx), ...ALL_COLORS.slice(0, idx)];
}

/** Returns the primary accent color for single-color widgets (scatter, gauge, etc.) */
export function getPrimaryColor(scheme?: string): string {
  return BASE_COLORS[scheme || 'blue'] || BASE_COLORS.blue;
}

/** Returns animation duration: 0 if animate is explicitly false, 800 otherwise */
export function getAnimationDuration(config: WidgetConfig): number {
  return config.visualConfig.animate === false ? 0 : 800;
}

/** Shared Recharts tooltip style matching the glassmorphism theme */
export const TOOLTIP_STYLE = {
  contentStyle: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border-color)',
    borderRadius: '8px',
    fontSize: '12px',
    boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
  },
  labelStyle: { color: 'var(--text-primary)', fontWeight: 600 },
  itemStyle: { color: 'var(--text-secondary)' },
};
