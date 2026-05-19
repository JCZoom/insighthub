/**
 * Freshworks suite — per-product outbound rate limiter.
 *
 * Each product has its own sliding window. They are independent — hitting
 * Freshsales hard doesn't slow Freshdesk down. The window is process-wide
 * (not per-user) because the constraint we're protecting is the upstream
 * API's tenant-wide quota.
 *
 * Freshworks API quotas vary by plan; defaults assume free / starter tiers:
 *   Freshsales:    100 req/min upstream → we cap at 60
 *   Freshdesk:     50 req/min upstream  → we cap at 40
 *   Freshcaller:   30 req/min upstream  → we cap at 25
 *   Freshchat:     180 req/min upstream → we cap at 60 (PII volume bound, not quota)
 *
 * The caps are configurable per-product via env vars.
 */

import type { FreshworksProduct } from './errors';

const WINDOW_MS = 60_000;

/** Per-product sliding-window timestamps in ms. */
const windows: Record<FreshworksProduct, number[]> = {
  freshsales: [],
  freshdesk: [],
  freshcaller: [],
  freshchat: [],
};

/**
 * Attempt to acquire a slot in the named product's window.
 *
 * Returns true if the call may proceed and reserves a slot.
 * Returns false if the window is full.
 *
 * Side effect: expired entries are pruned on every call.
 */
export function rateLimitAcquire(
  product: FreshworksProduct,
  maxPerMin: number
): boolean {
  const now = Date.now();
  const w = windows[product];
  while (w.length > 0 && w[0] < now - WINDOW_MS) {
    w.shift();
  }
  if (w.length >= maxPerMin) return false;
  w.push(now);
  return true;
}

/** How many slots are currently outstanding in this product's window. */
export function rateLimitWindowSize(product: FreshworksProduct): number {
  return windows[product].length;
}
