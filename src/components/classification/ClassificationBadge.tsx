'use client';

import { ShieldCheck, ShieldAlert, Lock, Globe } from 'lucide-react';
import { Tooltip } from '@/components/ui/Tooltip';
import {
  CLASSIFICATION_DISPLAY,
  DEFAULT_CLASSIFICATION,
  coerceClassification,
  type DataClassification,
} from '@/lib/data/classification';

interface ClassificationBadgeProps {
  classification: unknown;
  /**
   * `compact`  — small inline pill suitable for dashboard cards & list rows.
   *              Suppressed when the value equals DEFAULT_CLASSIFICATION
   *              (USZOOM_RESTRICTED) so the bulk of the gallery isn't cluttered
   *              with a single repeated badge. Returns null in that case.
   * `full`     — always rendered, with full label text. Use in detail panels,
   *              admin tables, and the editor's metadata sidebar.
   * `iconOnly` — minimal square icon with classification colour; for
   *              very tight rows. Always rendered.
   */
  size?: 'compact' | 'full' | 'iconOnly';
  className?: string;
}

const ICON_BY_CLASSIFICATION: Record<DataClassification, typeof ShieldCheck> = {
  PUBLIC: Globe,
  USZOOM_CONFIDENTIAL: ShieldCheck,
  USZOOM_RESTRICTED: ShieldAlert,
  CUSTOMER_CONFIDENTIAL: Lock,
};

/**
 * Visible classification label for an InsightHub object. Single source of
 * truth for how classification metadata surfaces in the UI; consumes the
 * display map from `src/lib/data/classification.ts`.
 *
 * Compact mode hides the default tier (USZOOM_RESTRICTED) to avoid
 * stamping every dashboard card with the same label — only deliberately
 * downgraded objects (PUBLIC) and elevated objects (CONFIDENTIAL,
 * CUSTOMER_CONFIDENTIAL) get a visible badge in compact contexts.
 */
export function ClassificationBadge({
  classification,
  size = 'full',
  className,
}: ClassificationBadgeProps) {
  const value: DataClassification = coerceClassification(classification);
  const display = CLASSIFICATION_DISPLAY[value];
  const Icon = ICON_BY_CLASSIFICATION[value];

  if (size === 'compact' && value === DEFAULT_CLASSIFICATION) {
    return null;
  }

  if (size === 'iconOnly') {
    return (
      <Tooltip content={`${display.label} — ${display.description}`} side="top">
        <span
          className={`inline-flex items-center justify-center rounded-md p-1 ${display.colorClasses} ${className ?? ''}`}
          aria-label={`Classification: ${display.label}`}
        >
          <Icon size={12} />
        </span>
      </Tooltip>
    );
  }

  if (size === 'compact') {
    return (
      <Tooltip content={`${display.label} — ${display.description}`} side="top">
        <span
          className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide ${display.colorClasses} ${className ?? ''}`}
          aria-label={`Classification: ${display.label}`}
        >
          <Icon size={10} />
          {display.shortLabel}
        </span>
      </Tooltip>
    );
  }

  return (
    <Tooltip content={display.description} side="top">
      <span
        className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium ${display.colorClasses} ${className ?? ''}`}
        aria-label={`Classification: ${display.label}`}
      >
        <Icon size={12} />
        {display.label}
      </span>
    </Tooltip>
  );
}
