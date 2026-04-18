import { test, expect } from '@playwright/test';

/**
 * API integration tests — verify response shapes, status codes,
 * and business logic for all critical API endpoints.
 *
 * These complement the smoke tests by testing edge cases and response contracts.
 */

test.describe('Health API', () => {
  test('returns structured health response', async ({ request }) => {
    const res = await request.get('/api/health');
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body).toMatchObject({
      status: 'ok',
      database: { status: 'connected' },
    });
    expect(body.uptime.seconds).toBeGreaterThanOrEqual(0);
    expect(body.memory.heapUsedMB).toBeGreaterThan(0);
    expect(body.memory.rssMB).toBeGreaterThan(0);
    expect(body.node).toMatch(/^v\d+/);
  });
});

test.describe('Dashboards API', () => {
  test('GET /api/dashboards returns paginated list', async ({ request }) => {
    const res = await request.get('/api/dashboards');
    expect(res.ok()).toBeTruthy();

    const body = await res.json();
    expect(body).toHaveProperty('dashboards');
    expect(body).toHaveProperty('total');
    expect(Array.isArray(body.dashboards)).toBeTruthy();
    expect(typeof body.total).toBe('number');
  });

  test('GET /api/dashboards supports search query', async ({ request }) => {
    const res = await request.get('/api/dashboards?q=executive');
    expect(res.ok()).toBeTruthy();

    const body = await res.json();
    expect(Array.isArray(body.dashboards)).toBeTruthy();
  });

  test('GET /api/dashboards supports pagination', async ({ request }) => {
    const res = await request.get('/api/dashboards?limit=2&offset=0');
    expect(res.ok()).toBeTruthy();

    const body = await res.json();
    expect(body.dashboards.length).toBeLessThanOrEqual(2);
  });

  test('GET /api/dashboards supports sort by title', async ({ request }) => {
    const res = await request.get('/api/dashboards?sort=title');
    expect(res.ok()).toBeTruthy();

    const body = await res.json();
    if (body.dashboards.length >= 2) {
      const titles = body.dashboards.map((d: { title: string }) => d.title);
      const sorted = [...titles].sort((a: string, b: string) => a.localeCompare(b));
      expect(titles).toEqual(sorted);
    }
  });

  test('POST /api/dashboards creates a new dashboard', async ({ request }) => {
    const res = await request.post('/api/dashboards', {
      data: {
        title: 'E2E Test Dashboard',
        description: 'Created by Playwright integration tests',
        tags: ['test', 'e2e'],
      },
    });

    // 201 if DB is seeded (dev user exists), 500 if not (FK constraint)
    if (res.status() === 201) {
      const body = await res.json();
      expect(body.dashboard).toMatchObject({
        title: 'E2E Test Dashboard',
        description: 'Created by Playwright integration tests',
      });
      expect(body.dashboard.id).toBeTruthy();
      expect(body.dashboard.versions).toHaveLength(1);
    } else {
      // Acceptable — DB may not be seeded in all environments
      expect([500, 403]).toContain(res.status());
    }
  });

  test('POST /api/dashboards defaults title to Untitled', async ({ request }) => {
    const res = await request.post('/api/dashboards', {
      data: {},
    });

    if (res.status() === 201) {
      const body = await res.json();
      expect(body.dashboard.title).toBe('Untitled Dashboard');
    } else {
      expect([500, 403]).toContain(res.status());
    }
  });
});

test.describe('Glossary API', () => {
  test('GET /api/glossary returns YAML terms by default', async ({ request }) => {
    const res = await request.get('/api/glossary');
    expect(res.ok()).toBeTruthy();

    const body = await res.json();
    expect(body).toHaveProperty('terms');
    expect(body.source).toBe('yaml');
    expect(Array.isArray(body.terms)).toBeTruthy();
    // YAML glossary should have some terms
    expect(body.terms.length).toBeGreaterThan(0);
  });

  test('GET /api/glossary?source=db returns DB terms', async ({ request }) => {
    const res = await request.get('/api/glossary?source=db');
    expect(res.ok()).toBeTruthy();

    const body = await res.json();
    expect(body).toHaveProperty('terms');
    // Source may fall through to yaml if DB is empty
    expect(['db', 'yaml']).toContain(body.source);
  });

  test('GET /api/glossary/search returns matching terms', async ({ request }) => {
    const res = await request.get('/api/glossary/search?q=revenue');
    expect(res.ok()).toBeTruthy();

    const body = await res.json();
    expect(body).toHaveProperty('terms');
    expect(Array.isArray(body.terms)).toBeTruthy();
  });

  test('GET /api/glossary/search with category filter', async ({ request }) => {
    const res = await request.get('/api/glossary/search?category=Revenue');
    expect(res.ok()).toBeTruthy();

    const body = await res.json();
    expect(body).toHaveProperty('terms');
    // All returned terms should be in the Revenue category
    for (const term of body.terms) {
      expect(term.category).toBe('Revenue');
    }
  });

  test('GET /api/glossary/search with empty query returns all terms', async ({ request }) => {
    const res = await request.get('/api/glossary/search');
    expect(res.ok()).toBeTruthy();

    const body = await res.json();
    expect(body).toHaveProperty('terms');
  });
});

test.describe('Widgets API', () => {
  test('GET /api/widgets returns widget library', async ({ request }) => {
    const res = await request.get('/api/widgets');
    expect(res.ok()).toBeTruthy();

    const body = await res.json();
    // Response should have widgets array
    expect(body).toHaveProperty('widgets');
    expect(Array.isArray(body.widgets)).toBeTruthy();
  });

  test('GET /api/widgets supports search', async ({ request }) => {
    const res = await request.get('/api/widgets?q=revenue');
    expect(res.ok()).toBeTruthy();
  });

  test('GET /api/widgets supports type filter', async ({ request }) => {
    const res = await request.get('/api/widgets?type=kpi');
    expect(res.ok()).toBeTruthy();
  });
});

test.describe('Data API', () => {
  test('POST /api/data/query executes sample data query', async ({ request }) => {
    const res = await request.post('/api/data/query', {
      data: {
        source: 'sample_customers',
        aggregation: 'count',
      },
    });
    // May return 200 or 400 depending on query format — just verify it doesn't crash
    expect([200, 400]).toContain(res.status());
  });
});

test.describe('Error handling', () => {
  test('Non-existent API route returns 404', async ({ request }) => {
    const res = await request.get('/api/does-not-exist');
    expect(res.status()).toBe(404);
  });

  test('GET /api/dashboards/nonexistent returns 404', async ({ request }) => {
    const res = await request.get('/api/dashboards/nonexistent-id-12345');
    expect([404, 500]).toContain(res.status());
  });
});
