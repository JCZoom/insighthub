import { test, expect } from '@playwright/test';

/**
 * Smoke tests — the bare minimum that must pass before any deploy.
 * These verify the app boots, renders, and critical API endpoints respond.
 */

test.describe('Health & API', () => {
  test('GET /api/health returns 200 with status ok', async ({ request }) => {
    const res = await request.get('/api/health');
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.database.status).toBe('connected');
    expect(body).toHaveProperty('timestamp');
    expect(body).toHaveProperty('version');
    expect(body).toHaveProperty('uptime');
    expect(body).toHaveProperty('memory');
  });

  test('GET /api/dashboards returns 200', async ({ request }) => {
    const res = await request.get('/api/dashboards');
    expect(res.ok()).toBeTruthy();

    const body = await res.json();
    expect(Array.isArray(body.dashboards || body)).toBeTruthy();
  });

  test('GET /api/glossary/search returns 200', async ({ request }) => {
    const res = await request.get('/api/glossary/search?q=revenue');
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    // Response may be an array or an object with a results key
    expect(body).toBeDefined();
  });
});

test.describe('Page rendering', () => {
  test('Landing page loads with hero section', async ({ page }) => {
    await page.goto('/');
    // Should see the main heading or hero content
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 15_000 });
    // No uncaught errors in console
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.waitForTimeout(2_000);
    expect(errors).toHaveLength(0);
  });

  test('Gallery page loads without crash', async ({ page }) => {
    await page.goto('/gallery');
    await page.waitForLoadState('networkidle', { timeout: 15_000 });
    // Check that it's not an error page
    const bodyText = await page.textContent('body');
    expect(bodyText).not.toContain('Application error');
    expect(bodyText).not.toContain('Internal Server Error');
  });

  test('New dashboard editor loads', async ({ page }) => {
    await page.goto('/dashboard/new');
    // Should see the chat panel or canvas area
    await page.waitForLoadState('networkidle', { timeout: 20_000 });
    // Verify no crash — page should have meaningful content
    const bodyText = await page.textContent('body');
    expect(bodyText).not.toContain('Application error');
    expect(bodyText).not.toContain('Internal Server Error');
  });
});

test.describe('Critical user flows', () => {
  test('Can navigate from landing → gallery → dashboard', async ({ page }) => {
    // Start at landing
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Navigate to gallery
    await page.goto('/gallery');
    await page.waitForLoadState('networkidle');

    // Navigate to new dashboard
    await page.goto('/dashboard/new');
    await page.waitForLoadState('networkidle');
    const bodyText = await page.textContent('body');
    expect(bodyText).not.toContain('Application error');
  });
});
