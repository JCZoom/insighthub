/**
 * Freshworks suite — shared error class hierarchy.
 *
 * Every product connector throws these — callers can pattern-match once
 * across all 4 products (Freshsales, Freshdesk, Freshcaller, Freshchat).
 */

export type FreshworksProduct = 'freshsales' | 'freshdesk' | 'freshcaller' | 'freshchat';

export class FreshworksError extends Error {
  constructor(
    message: string,
    public readonly product: FreshworksProduct,
    public readonly status: number,
    public readonly bodyPreview: string
  ) {
    super(message);
    this.name = 'FreshworksError';
  }
}

export class FreshworksNotConfiguredError extends Error {
  constructor(public readonly product: FreshworksProduct) {
    super(`Freshworks ${product} connector is not configured.`);
    this.name = 'FreshworksNotConfiguredError';
  }
}

export class FreshworksRateLimitError extends Error {
  constructor(public readonly product: FreshworksProduct) {
    super(`Freshworks ${product} outbound rate limit exceeded (process-wide).`);
    this.name = 'FreshworksRateLimitError';
  }
}

// Backwards-compatibility aliases — the previous Freshsales-only commit
// exported these without the suite prefix. Keep them re-exported by the
// freshsales product barrel.
export const FreshsalesError = FreshworksError;
export const FreshsalesNotConfiguredError = FreshworksNotConfiguredError;
export const FreshsalesRateLimitError = FreshworksRateLimitError;
