import { test, expect } from '@playwright/test';

/**
 * Production health checks — run against the live site.
 * 
 * Usage:
 *   PLAYWRIGHT_BASE_URL=https://dashboards.jeffcoy.net npx playwright test e2e/production-health.spec.ts
 */

const isProduction = (process.env.PLAYWRIGHT_BASE_URL || '').includes('dashboards.jeffcoy.net');

test.describe('Production health', () => {
  test.skip(!isProduction, 'Only runs against production URL');

  test('Health endpoint responds', async ({ request }) => {
    const res = await request.get('/api/health');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.database.status).toBe('connected');
  });

  test('Landing page loads under 5s', async ({ page }) => {
    const start = Date.now();
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const loadTime = Date.now() - start;
    expect(loadTime).toBeLessThan(5_000);
    await expect(page.locator('h1').first()).toBeVisible();
  });

  test('No console errors on landing page', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2_000);
    expect(errors).toHaveLength(0);
  });

  test('SSL certificate is valid', async ({ request }) => {
    // If we can make an HTTPS request, the cert is valid
    const res = await request.get('/api/health');
    expect(res.ok()).toBeTruthy();
  });

  test('Security headers are present', async ({ request }) => {
    const res = await request.get('/api/health');
    const headers = res.headers();
    expect(headers['x-frame-options']).toBe('DENY');
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['referrer-policy']).toBeTruthy();
    expect(headers['strict-transport-security']).toContain('max-age=');
    expect(headers['content-security-policy']).toBeTruthy();
  });
});
