import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import type { Result } from 'axe-core';

/**
 * Accessibility tests using axe-core.
 *
 * Runs WCAG 2.1 AA checks against key pages. Any violations will cause
 * the test to fail with detailed information about the failing elements.
 *
 * Run: npx playwright test e2e/accessibility.spec.ts
 */

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

test.describe('Accessibility (WCAG 2.1 AA)', () => {
  test('Home page', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const results = await new AxeBuilder({ page })
      .withTags(WCAG_TAGS)
      .analyze();

    logViolations(results.violations);
    expect(results.violations).toEqual([]);
  });

  test('Dashboard gallery', async ({ page }) => {
    await page.goto('/dashboards');
    await page.waitForLoadState('networkidle');

    const results = await new AxeBuilder({ page })
      .withTags(WCAG_TAGS)
      .analyze();

    logViolations(results.violations);
    expect(results.violations).toEqual([]);
  });

  test('New dashboard editor', async ({ page }) => {
    await page.goto('/dashboard/new');
    await page.waitForLoadState('networkidle');

    const results = await new AxeBuilder({ page })
      .withTags(WCAG_TAGS)
      // Exclude dynamically loaded chart canvases — they have known issues
      .exclude('.recharts-wrapper')
      .analyze();

    logViolations(results.violations);
    expect(results.violations).toEqual([]);
  });

  test('Glossary page', async ({ page }) => {
    await page.goto('/glossary');
    await page.waitForLoadState('networkidle');

    const results = await new AxeBuilder({ page })
      .withTags(WCAG_TAGS)
      .analyze();

    logViolations(results.violations);
    expect(results.violations).toEqual([]);
  });

  test('Login page', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    const results = await new AxeBuilder({ page })
      .withTags(WCAG_TAGS)
      .analyze();

    logViolations(results.violations);
    expect(results.violations).toEqual([]);
  });

  test('404 page', async ({ page }) => {
    await page.goto('/this-page-does-not-exist');
    await page.waitForLoadState('networkidle');

    const results = await new AxeBuilder({ page })
      .withTags(WCAG_TAGS)
      .analyze();

    logViolations(results.violations);
    expect(results.violations).toEqual([]);
  });
});

/** Log violations in a human-readable format for debugging */
function logViolations(violations: Result[]) {
  if (violations.length === 0) return;

  console.log(`\n🔴 ${violations.length} accessibility violation(s):\n`);
  for (const v of violations) {
    console.log(`  [${v.impact}] ${v.id}: ${v.description}`);
    console.log(`  Help: ${v.helpUrl}`);
    for (const node of v.nodes.slice(0, 3)) {
      console.log(`    → ${node.html.substring(0, 120)}`);
      console.log(`      ${node.failureSummary}`);
    }
    if (v.nodes.length > 3) {
      console.log(`    ... and ${v.nodes.length - 3} more`);
    }
    console.log('');
  }
}
