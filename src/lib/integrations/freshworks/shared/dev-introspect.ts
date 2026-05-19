/**
 * Freshworks suite — dev-mode field-name introspection.
 *
 * When debugging an unfamiliar API response shape (e.g. "why is `status`
 * always undefined when the row clearly has a status?"), pass an upstream
 * row through `logRowKeysOnce()`. It prints the keys (not values, never
 * values) of the row to stderr exactly once per `(product, resource)`
 * pair per process lifetime.
 *
 * This is a developer-affordance only:
 *   - Logs ONLY field NAMES, never field VALUES (no PII risk).
 *   - Active in development mode only (NODE_ENV !== 'production').
 *   - One-shot per (product, resource); no spam.
 *   - Safe to leave in production: it's a no-op when NODE_ENV=production.
 *
 * If we wanted a permanent diagnostic, we'd wire this into an admin-only
 * endpoint. For tomorrow's demo work, console logging is fine.
 */

import { env } from '@/lib/env';
import type { FreshworksProduct } from './errors';

const seen = new Set<string>();

export function logRowKeysOnce(
  product: FreshworksProduct,
  resource: string,
  sampleRow: unknown
): void {
  if (env.isProduction) return;
  const key = `${product}:${resource}`;
  if (seen.has(key)) return;
  seen.add(key);

  if (!sampleRow || typeof sampleRow !== 'object') {
    // eslint-disable-next-line no-console
    console.log(`[freshworks/introspect] ${key}: (no sample row available)`);
    return;
  }

  const fieldNames = Object.keys(sampleRow as Record<string, unknown>).sort();
  // For object-valued fields, also enumerate the nested keys ONE level deep.
  const nestedKeys: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(sampleRow as Record<string, unknown>)) {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      nestedKeys[k] = Object.keys(v as Record<string, unknown>);
    }
  }

  // eslint-disable-next-line no-console
  console.log(
    `[freshworks/introspect] ${key} sample-row field NAMES (no values logged):`,
    {
      top_level: fieldNames,
      nested: nestedKeys,
    }
  );
}
