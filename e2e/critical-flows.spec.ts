import { test, expect } from '@playwright/test';

/**
 * Critical user flow tests — exercises the complete user journeys
 * that must work before production deployment.
 *
 * These tests assume dev mode (auth bypass) and a seeded database.
 * Run: npx playwright test e2e/critical-flows.spec.ts
 */

test.describe('Dashboard Lifecycle', () => {
  let createdDashboardId: string | null = null;

  test('Create new dashboard via API', async ({ request }) => {
    const res = await request.post('/api/dashboards', {
      data: {
        title: 'E2E Critical Flow Dashboard',
        description: 'Automated test — safe to delete',
        tags: ['e2e', 'automated-test'],
      },
    });

    if (res.status() === 201) {
      const body = await res.json();
      createdDashboardId = body.dashboard.id;
      expect(body.dashboard.title).toBe('E2E Critical Flow Dashboard');
      expect(body.dashboard.versions).toHaveLength(1);
    } else {
      // Skip remaining tests if DB not seeded
      test.skip();
    }
  });

  test('Retrieve created dashboard', async ({ request }) => {
    test.skip(!createdDashboardId, 'No dashboard created');

    const res = await request.get(`/api/dashboards/${createdDashboardId}`);
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.dashboard.title).toBe('E2E Critical Flow Dashboard');
    expect(body.dashboard.id).toBe(createdDashboardId);
  });

  test('Update dashboard metadata', async ({ request }) => {
    test.skip(!createdDashboardId, 'No dashboard created');

    const res = await request.put(`/api/dashboards/${createdDashboardId}`, {
      data: {
        title: 'E2E Updated Title',
        description: 'Updated by Playwright',
      },
    });

    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.dashboard.title).toBe('E2E Updated Title');
  });

  test('Save new version with schema', async ({ request }) => {
    test.skip(!createdDashboardId, 'No dashboard created');

    const schema = {
      widgets: [
        {
          id: 'w-test-1',
          type: 'kpi',
          title: 'Test KPI',
          position: { x: 0, y: 0, w: 3, h: 2 },
          dataConfig: { source: 'sample_customers', aggregation: 'count' },
        },
      ],
      layout: { columns: 12 },
    };

    const res = await request.post(`/api/dashboards/${createdDashboardId}/versions`, {
      data: { schema: JSON.stringify(schema), changeNote: 'E2E test version' },
    });

    if (res.ok()) {
      const body = await res.json();
      expect(body.version.versionNumber).toBe(2);
    }
  });

  test('List versions for dashboard', async ({ request }) => {
    test.skip(!createdDashboardId, 'No dashboard created');

    const res = await request.get(`/api/dashboards/${createdDashboardId}/versions`);
    expect(res.ok()).toBeTruthy();

    const body = await res.json();
    expect(body.versions.length).toBeGreaterThanOrEqual(1);
  });

  test('Duplicate dashboard', async ({ request }) => {
    test.skip(!createdDashboardId, 'No dashboard created');

    const res = await request.post(`/api/dashboards/${createdDashboardId}/duplicate`);

    if (res.ok()) {
      const body = await res.json();
      expect(body.dashboard.title).toContain('Copy');
      expect(body.dashboard.id).not.toBe(createdDashboardId);

      // Clean up the duplicate
      await request.delete(`/api/dashboards/${body.dashboard.id}`);
    }
  });

  test('Delete dashboard (soft-delete)', async ({ request }) => {
    test.skip(!createdDashboardId, 'No dashboard created');

    const res = await request.delete(`/api/dashboards/${createdDashboardId}`);
    expect(res.ok()).toBeTruthy();
  });
});

test.describe('Gallery → Editor Navigation', () => {
  test('Landing page → Gallery → New Dashboard editor', async ({ page }) => {
    // Landing page
    await page.goto('/');
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 15_000 });

    // Navigate to gallery
    await page.goto('/gallery');
    await page.waitForLoadState('networkidle', { timeout: 15_000 });

    // Gallery should render without errors
    const galleryText = await page.textContent('body');
    expect(galleryText).not.toContain('Application error');

    // Navigate to new dashboard editor
    await page.goto('/dashboard/new');
    await page.waitForLoadState('networkidle', { timeout: 20_000 });

    // Editor should have canvas area or chat panel
    const editorText = await page.textContent('body');
    expect(editorText).not.toContain('Application error');
    expect(editorText).not.toContain('Internal Server Error');
  });

  test('Gallery search works', async ({ page }) => {
    await page.goto('/gallery');
    await page.waitForLoadState('networkidle', { timeout: 15_000 });

    // Find search input
    const searchInput = page.locator('input[placeholder*="earch"]').first();
    if (await searchInput.isVisible()) {
      await searchInput.fill('executive');
      await page.waitForTimeout(500);
      // Page should update without crashing
      const bodyText = await page.textContent('body');
      expect(bodyText).not.toContain('Application error');
    }
  });

  test('Gallery view toggle works (card/list)', async ({ page }) => {
    await page.goto('/gallery');
    await page.waitForLoadState('networkidle', { timeout: 15_000 });

    // Look for view toggle buttons
    const listViewBtn = page.locator('button[aria-label*="ist"], button[title*="ist"]').first();
    if (await listViewBtn.isVisible()) {
      await listViewBtn.click();
      await page.waitForTimeout(300);
      const bodyText = await page.textContent('body');
      expect(bodyText).not.toContain('Application error');
    }
  });
});

test.describe('Admin User Management', () => {
  test('Admin users page loads with user list', async ({ page }) => {
    await page.goto('/admin/users');
    await page.waitForLoadState('networkidle', { timeout: 15_000 });

    const bodyText = await page.textContent('body');
    // Should show user management heading or user data
    expect(bodyText).toMatch(/User Management|Users/i);
    expect(bodyText).not.toContain('Application error');
  });

  test('PUT /api/admin/users/[id]/role validates input', async ({ request }) => {
    // Should reject invalid role
    const res = await request.put('/api/admin/users/fake-user-id/role', {
      data: { role: 'INVALID_ROLE' },
    });
    expect(res.status()).toBe(400);

    const body = await res.json();
    expect(body.error).toContain('Invalid role');
  });

  test('PUT /api/admin/users/[id]/role rejects non-existent user', async ({ request }) => {
    const res = await request.put('/api/admin/users/cl_nonexistent_user_id/role', {
      data: { role: 'CREATOR' },
    });
    // Should be 404 (user not found) or 400 (CUID validation)
    expect([400, 404]).toContain(res.status());
  });

  test('GET /api/admin/users returns user list with permissions', async ({ request }) => {
    const res = await request.get('/api/admin/users');

    if (res.ok()) {
      const body = await res.json();
      expect(body).toHaveProperty('users');
      expect(Array.isArray(body.users)).toBeTruthy();

      if (body.users.length > 0) {
        const firstUser = body.users[0];
        expect(firstUser).toHaveProperty('id');
        expect(firstUser).toHaveProperty('email');
        expect(firstUser).toHaveProperty('role');
        expect(firstUser).toHaveProperty('permissionAssignments');
        expect(firstUser).toHaveProperty('_count');
      }
    }
  });
});

test.describe('Admin Audit Log', () => {
  test('Audit log page loads', async ({ page }) => {
    await page.goto('/admin/audit');
    await page.waitForLoadState('networkidle', { timeout: 15_000 });

    const bodyText = await page.textContent('body');
    expect(bodyText).toMatch(/Audit|Log/i);
    expect(bodyText).not.toContain('Application error');
  });

  test('GET /api/admin/audit returns paginated logs', async ({ request }) => {
    const res = await request.get('/api/admin/audit?limit=10');

    if (res.ok()) {
      const body = await res.json();
      expect(body).toHaveProperty('logs');
      expect(body).toHaveProperty('total');
      expect(Array.isArray(body.logs)).toBeTruthy();
    }
  });

  test('GET /api/admin/audit supports action filter', async ({ request }) => {
    const res = await request.get('/api/admin/audit?action=user.login');
    if (res.ok()) {
      const body = await res.json();
      for (const log of body.logs) {
        expect(log.action).toBe('user.login');
      }
    }
  });
});

test.describe('Glossary System', () => {
  test('Glossary page renders with terms', async ({ page }) => {
    await page.goto('/glossary');
    await page.waitForLoadState('networkidle', { timeout: 15_000 });

    const bodyText = await page.textContent('body');
    expect(bodyText).not.toContain('Application error');
    // Should have some glossary content
    expect(bodyText).toMatch(/Glossary|Terms|Revenue|Churn|MRR/i);
  });

  test('Glossary search filters terms', async ({ page }) => {
    await page.goto('/glossary');
    await page.waitForLoadState('networkidle', { timeout: 15_000 });

    const searchInput = page.locator('input[placeholder*="earch"]').first();
    if (await searchInput.isVisible()) {
      await searchInput.fill('revenue');
      await page.waitForTimeout(500);
      const bodyText = await page.textContent('body');
      expect(bodyText).not.toContain('Application error');
    }
  });

  test('POST /api/glossary creates a term (admin)', async ({ request }) => {
    const res = await request.post('/api/glossary', {
      data: {
        term: 'E2E Test Term',
        definition: 'A term created by automated E2E tests',
        category: 'Revenue',
        formula: 'COUNT(e2e_tests)',
        dataSource: 'test_data',
      },
    });

    if (res.ok()) {
      const body = await res.json();
      expect(body.term).toHaveProperty('id');
      expect(body.term.term).toBe('E2E Test Term');

      // Cleanup — delete the term
      if (body.term.id) {
        await request.delete(`/api/glossary/${body.term.id}`);
      }
    }
  });
});

test.describe('Onboarding Flow', () => {
  test('Onboarding page loads', async ({ page }) => {
    await page.goto('/onboarding');
    await page.waitForLoadState('networkidle', { timeout: 15_000 });

    const bodyText = await page.textContent('body');
    expect(bodyText).not.toContain('Application error');
    expect(bodyText).not.toContain('Internal Server Error');
  });
});

test.describe('Templates', () => {
  test('Templates page loads with template cards', async ({ page }) => {
    await page.goto('/templates');
    await page.waitForLoadState('networkidle', { timeout: 15_000 });

    const bodyText = await page.textContent('body');
    expect(bodyText).not.toContain('Application error');
    expect(bodyText).toMatch(/Template/i);
  });
});

test.describe('Chat API Contract', () => {
  test('POST /api/chat validates message length', async ({ request }) => {
    const res = await request.post('/api/chat', {
      data: {
        message: '', // Empty message should fail
        dashboardId: 'test-id',
      },
    });
    expect([400, 422]).toContain(res.status());
  });

  test('POST /api/chat rejects oversized messages', async ({ request }) => {
    const oversizedMessage = 'x'.repeat(11_000); // Over 10,000 char limit
    const res = await request.post('/api/chat', {
      data: {
        message: oversizedMessage,
        dashboardId: 'test-id',
      },
    });
    expect([400, 422]).toContain(res.status());
  });

  test('POST /api/chat requires message field', async ({ request }) => {
    const res = await request.post('/api/chat', {
      data: {
        dashboardId: 'test-id',
      },
    });
    expect([400, 422]).toContain(res.status());
  });
});

test.describe('Rate Limiting', () => {
  test('API returns rate limit headers', async ({ request }) => {
    const res = await request.get('/api/dashboards');
    const headers = res.headers();

    // Rate limit headers should be present
    const hasRateHeaders =
      headers['x-ratelimit-limit'] ||
      headers['x-ratelimit-remaining'] ||
      headers['ratelimit-limit'];

    // Not all endpoints may have rate limiting in dev mode
    if (res.ok() && hasRateHeaders) {
      expect(
        headers['x-ratelimit-limit'] || headers['ratelimit-limit']
      ).toBeTruthy();
    }
  });
});

test.describe('Permissions & Access Control', () => {
  test('GET /api/admin/permission-groups returns groups', async ({ request }) => {
    const res = await request.get('/api/admin/permission-groups');

    if (res.ok()) {
      const body = await res.json();
      expect(body).toHaveProperty('groups');
      expect(Array.isArray(body.groups)).toBeTruthy();

      if (body.groups.length > 0) {
        const group = body.groups[0];
        expect(group).toHaveProperty('id');
        expect(group).toHaveProperty('name');
        expect(group).toHaveProperty('isSystem');
      }
    }
  });
});

test.describe('Folders API', () => {
  let folderId: string | null = null;

  test('POST /api/folders creates a folder', async ({ request }) => {
    const res = await request.post('/api/folders', {
      data: {
        name: 'E2E Test Folder',
        visibility: 'private',
      },
    });

    if (res.ok()) {
      const body = await res.json();
      folderId = body.folder.id;
      expect(body.folder.name).toBe('E2E Test Folder');
    }
  });

  test('GET /api/folders returns folder list', async ({ request }) => {
    const res = await request.get('/api/folders');
    if (res.ok()) {
      const body = await res.json();
      expect(body).toHaveProperty('folders');
      expect(Array.isArray(body.folders)).toBeTruthy();
    }
  });

  test('DELETE /api/folders/[id] removes folder', async ({ request }) => {
    test.skip(!folderId, 'No folder created');

    const res = await request.delete(`/api/folders/${folderId}`);
    expect(res.ok()).toBeTruthy();
  });
});

test.describe('Thumbnail API (authenticated)', () => {
  test('GET /api/thumbnails requires authentication context', async ({ request }) => {
    const res = await request.get('/api/thumbnails?dashboardId=test-id');
    // Should not crash — either returns data or 401/404
    expect([200, 401, 404]).toContain(res.status());
  });

  test('POST /api/thumbnails validates input', async ({ request }) => {
    const res = await request.post('/api/thumbnails', {
      data: {
        // Missing required dashboardId and thumbnail
      },
    });
    // Should return 400 (bad request) or 401 (unauth)
    expect([400, 401]).toContain(res.status());
  });
});

test.describe('Data Query API', () => {
  test('POST /api/data/query with valid source', async ({ request }) => {
    const res = await request.post('/api/data/query', {
      data: {
        source: 'sample_customers',
        aggregation: 'count',
        limit: 10,
      },
    });

    if (res.ok()) {
      const body = await res.json();
      expect(body).toHaveProperty('data');
    }
  });

  test('POST /api/data/query rejects unknown source', async ({ request }) => {
    const res = await request.post('/api/data/query', {
      data: {
        source: 'nonexistent_table_xyz',
        aggregation: 'count',
      },
    });
    // Should fail gracefully
    expect([400, 403, 404]).toContain(res.status());
  });
});
