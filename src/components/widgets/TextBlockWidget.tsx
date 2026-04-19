'use client';

import {
  Info,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Lightbulb,
  Target,
  TrendingUp,
  Star,
  Zap,
  FileText,
  type LucideIcon,
} from 'lucide-react';
import type { WidgetConfig } from '@/types';

// ── Icon mapping ─────────────────────────────────────────────────────────────

const ICON_MAP: Record<string, LucideIcon> = {
  info: Info,
  warning: AlertTriangle,
  success: CheckCircle2,
  error: XCircle,
  lightbulb: Lightbulb,
  target: Target,
  trending: TrendingUp,
  star: Star,
  zap: Zap,
  file: FileText,
};

// ── Preset color palettes keyed by variant ───────────────────────────────────

type Variant = 'plain' | 'banner' | 'callout' | 'header' | 'quote';

interface VariantDefaults {
  bg: string;
  text: string;
  titleText: string;
  border: string;
  radius: string;
  padding: string;
}

const VARIANT_DEFAULTS: Record<Variant, VariantDefaults> = {
  plain: {
    bg: 'transparent',
    text: 'var(--text-secondary)',
    titleText: 'var(--text-primary)',
    border: 'none',
    radius: '12px',
    padding: '1rem',
  },
  banner: {
    bg: 'rgba(107, 170, 255, 0.12)',
    text: 'rgba(255,255,255,0.8)',
    titleText: '#ffffff',
    border: 'none',
    radius: '12px',
    padding: '1.25rem 1.5rem',
  },
  callout: {
    bg: 'rgba(219, 166, 68, 0.08)',
    text: 'var(--text-secondary)',
    titleText: 'var(--text-primary)',
    border: '3px solid rgba(219, 166, 68, 0.5)',
    radius: '12px',
    padding: '1rem 1.25rem',
  },
  header: {
    bg: 'transparent',
    text: 'var(--text-secondary)',
    titleText: 'var(--text-primary)',
    border: 'none',
    radius: '0',
    padding: '0.75rem 0.25rem',
  },
  quote: {
    bg: 'rgba(180, 142, 255, 0.06)',
    text: 'var(--text-secondary)',
    titleText: 'var(--text-primary)',
    border: '3px solid rgba(180, 142, 255, 0.4)',
    radius: '12px',
    padding: '1rem 1.25rem',
  },
};

// ── Font size mapping ────────────────────────────────────────────────────────

const FONT_SIZE_MAP: Record<string, { title: string; body: string }> = {
  xs:   { title: '0.75rem',  body: '0.65rem'  },
  sm:   { title: '0.875rem', body: '0.75rem'  },
  base: { title: '1rem',     body: '0.8125rem' },
  lg:   { title: '1.25rem',  body: '0.875rem' },
  xl:   { title: '1.5rem',   body: '1rem'     },
  '2xl':{ title: '1.875rem', body: '1.125rem' },
  '3xl':{ title: '2.25rem',  body: '1.25rem'  },
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function resolveColor(value: string | undefined, fallback: string): string {
  if (!value) return fallback;
  // Named semantic tokens
  const NAMED: Record<string, string> = {
    blue:   'rgba(107, 170, 255, 0.15)',
    green:  'rgba(86, 196, 122, 0.15)',
    purple: 'rgba(180, 142, 255, 0.15)',
    amber:  'rgba(219, 166, 68, 0.15)',
    cyan:   'rgba(77, 206, 194, 0.15)',
    red:    'rgba(244, 118, 112, 0.15)',
    white:  '#ffffff',
    dark:   'rgba(0, 0, 0, 0.5)',
  };
  return NAMED[value] ?? value;
}

function resolveTextColor(value: string | undefined, fallback: string): string {
  if (!value) return fallback;
  const NAMED: Record<string, string> = {
    blue:   '#6baaff',
    green:  '#56c47a',
    purple: '#b48eff',
    amber:  '#dba644',
    cyan:   '#4dcec2',
    red:    '#f47670',
    white:  '#ffffff',
    muted:  'var(--text-muted)',
    primary:'var(--text-primary)',
    secondary:'var(--text-secondary)',
  };
  return NAMED[value] ?? value;
}

// ── Component ────────────────────────────────────────────────────────────────

interface TextBlockWidgetProps {
  config: WidgetConfig;
}

export function TextBlockWidget({ config }: TextBlockWidgetProps) {
  const cs = config.visualConfig?.customStyles ?? {};

  const variant: Variant = (['plain', 'banner', 'callout', 'header', 'quote'].includes(cs.variant ?? '')
    ? cs.variant
    : 'plain') as Variant;
  const defaults = VARIANT_DEFAULTS[variant];

  // Resolve individual style overrides
  const bgColor     = resolveColor(cs.backgroundColor, defaults.bg);
  const textColor   = resolveTextColor(cs.textColor, defaults.text);
  const titleColor  = resolveTextColor(cs.titleColor, defaults.titleText);
  const borderStyle = cs.borderAccent
    ? `3px solid ${resolveTextColor(cs.borderAccent, defaults.border)}`
    : defaults.border;
  const align       = (cs.textAlign as 'left' | 'center' | 'right') ?? (variant === 'banner' ? 'center' : 'left');
  const fontSizes   = FONT_SIZE_MAP[cs.fontSize ?? ''] ?? (variant === 'header'
    ? FONT_SIZE_MAP['xl']
    : variant === 'banner'
      ? FONT_SIZE_MAP['lg']
      : FONT_SIZE_MAP['sm']);
  const fontWeight  = cs.fontWeight ?? (variant === 'header' || variant === 'banner' ? 'bold' : 'normal');

  // Icon
  const IconComponent = cs.icon ? ICON_MAP[cs.icon] : undefined;

  const containerStyle: React.CSSProperties = {
    background: bgColor,
    color: textColor,
    textAlign: align,
    borderLeft: borderStyle !== 'none' ? borderStyle : undefined,
    borderRadius: cs.borderRadius ?? defaults.radius,
    padding: defaults.padding,
  };

  const showTitle = config.title && variant !== 'header';
  const headerTitle = variant === 'header' ? config.title : undefined;
  const bodyContent = config.subtitle || '';

  return (
    <div className="h-full flex flex-col fade-in" style={containerStyle}>
      {/* Header variant: title IS the main content, large and prominent */}
      {headerTitle && (
        <div className="flex items-center gap-3" style={{ justifyContent: align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start' }}>
          {IconComponent && <IconComponent size={Number(fontSizes.title.replace('rem', '')) * 16 * 1.1} style={{ color: titleColor, flexShrink: 0 }} />}
          <h2 style={{ fontSize: fontSizes.title, fontWeight, color: titleColor, lineHeight: 1.3, margin: 0 }}>
            {headerTitle}
          </h2>
        </div>
      )}

      {/* Non-header variant: title + body */}
      {showTitle && (
        <div className="flex items-center gap-2.5 mb-1.5" style={{ justifyContent: align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start' }}>
          {IconComponent && (
            <span style={{ flexShrink: 0 }}>
              <IconComponent size={16} style={{ color: titleColor }} />
            </span>
          )}
          <h3 style={{ fontSize: fontSizes.title, fontWeight, color: titleColor, lineHeight: 1.4, margin: 0 }}>
            {config.title}
          </h3>
        </div>
      )}

      {bodyContent && (
        <div
          className="leading-relaxed whitespace-pre-wrap"
          style={{
            fontSize: fontSizes.body,
            color: textColor,
            fontWeight: fontWeight === 'bold' ? 'normal' : fontWeight,
            flex: 1,
          }}
        >
          {bodyContent}
        </div>
      )}

      {/* Bottom accent line for banner variant */}
      {variant === 'banner' && (
        <div
          className="mt-3"
          style={{
            height: '2px',
            background: `linear-gradient(90deg, transparent, ${titleColor}33, transparent)`,
            borderRadius: '1px',
          }}
        />
      )}

      {/* Header bottom border */}
      {variant === 'header' && bodyContent && (
        <p
          className="mt-1.5 leading-relaxed whitespace-pre-wrap"
          style={{ fontSize: fontSizes.body, color: textColor, margin: 0 }}
        >
          {bodyContent}
        </p>
      )}
      {variant === 'header' && (
        <div
          className="mt-2"
          style={{
            height: '2px',
            background: `linear-gradient(90deg, ${titleColor}, transparent)`,
            borderRadius: '1px',
          }}
        />
      )}
    </div>
  );
}
