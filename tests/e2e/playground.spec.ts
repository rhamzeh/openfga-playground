// SPDX-License-Identifier: Apache-2.0
/**
 * M4.3.1 — Playground ↔ fga serve integration test
 *
 * Prerequisites (start in separate terminals before running):
 *   1. OpenFGA:   docker run -p 8900:8080 openfga/openfga run
 *   2. fga serve: fga serve --port 8880
 *   3. Playground: pnpm --filter @openfga/playground dev
 *
 * Then run: pnpm exec playwright test
 *
 * Environment variables:
 *   PLAYGROUND_URL  (default: http://localhost:5173)
 *   FGA_SERVE_URL   (default: http://localhost:8880)
 */

import { test, expect, request } from '@playwright/test';

const FGA_SERVE = process.env['FGA_SERVE_URL'] ?? 'http://localhost:8880';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function createServer(name = 'e2e-test') {
  const ctx = await request.newContext();
  const res = await ctx.post(`${FGA_SERVE}/servers`, {
    data: {
      name,
      apiUrl: 'http://localhost:8900',
      auth: { method: 'none' },
      capabilities: { storeCrud: true, listModels: true },
    },
  });
  expect(res.ok()).toBeTruthy();
  const server = await res.json() as { id: string };
  await ctx.dispose();
  return server.id;
}

async function createStore(serverId: string, name: string) {
  const ctx = await request.newContext();
  const res = await ctx.post(`${FGA_SERVE}/servers/${serverId}/stores`, {
    data: { name },
  });
  expect(res.ok()).toBeTruthy();
  const store = await res.json() as { id: string };
  await ctx.dispose();
  return store.id;
}

async function deleteServer(serverId: string) {
  const ctx = await request.newContext();
  await ctx.delete(`${FGA_SERVE}/servers/${serverId}`);
  await ctx.dispose();
}

// ---------------------------------------------------------------------------
// Startup UX (M4.3.2)
// ---------------------------------------------------------------------------

test.describe('startup UX', () => {
  test('shows proxy banner when fga serve is not running', async ({ page }) => {
    // Intercept the /servers health check to simulate fga serve being down
    await page.route('**/servers', (route) => route.abort('connectionrefused'));

    await page.goto('/');
    await page.waitForSelector('openfga-playground');

    // Wait for the banner to appear
    const banner = page.locator('.proxy-banner');
    await expect(banner).toBeVisible({ timeout: 5000 });
    await expect(banner).toContainText('fga serve is not running');
    await expect(banner).toContainText('fga serve');
  });

  test('does not show proxy banner when fga serve is running', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('openfga-playground');

    // Give the app time to complete the proxy check
    await page.waitForTimeout(1000);

    const banner = page.locator('.proxy-banner');
    await expect(banner).not.toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Full integration flow (M4.3.1)
// ---------------------------------------------------------------------------

test.describe('full integration flow', () => {
  let serverId: string;
  let storeId: string;

  test.beforeAll(async () => {
    serverId = await createServer('e2e-flow-test');
    storeId = await createStore(serverId, 'e2e-flow-store');
  });

  test.afterAll(async () => {
    await deleteServer(serverId);
  });

  test('renders the playground shell', async ({ page }) => {
    await page.goto(`/?server=${serverId}&storeId=${storeId}`);
    await page.waitForSelector('openfga-playground');

    // Toolbar should be visible
    await expect(page.locator('.toolbar')).toBeVisible();
    await expect(page.locator('.toolbar-title')).toContainText('OpenFGA');

    // Both panels should be present
    await expect(page.locator('.panel-left')).toBeVisible();
    await expect(page.locator('.panel-right')).toBeVisible();

    // Tab bar with graph/tuples/assertions
    const tabs = page.locator('.tab');
    await expect(tabs.nth(0)).toContainText('Graph');
    await expect(tabs.nth(1)).toContainText('Tuples');
    await expect(tabs.nth(2)).toContainText('Assertions');
  });

  test('proxy round-trip: write model → save → model version appears', async ({ page }) => {
    await page.goto(`/?server=${serverId}&storeId=${storeId}`);
    await page.waitForSelector('openfga-playground');

    // Wait for Monaco editor to mount inside shadow DOM
    const editorHost = page.locator('openfga-model-editor');
    await expect(editorHost).toBeVisible({ timeout: 10000 });

    // Type a model into Monaco via the shadow DOM
    const dsl = 'model\n  schema 1.1\ntype user\ntype document\n  relations\n    define viewer: [user]';
    // Monaco editor content is in .view-lines. We use evaluate to set it programmatically.
    await page.evaluate(
      ({ dsl }) => {
        // Access the Monaco editor instance through the component's internals
        const el = document.querySelector('openfga-playground')?.shadowRoot
          ?.querySelector('openfga-model-editor') as HTMLElement & { _editor?: { setValue(v: string): void } };
        if (el?._editor) {
          el._editor.setValue(dsl);
        }
      },
      { dsl },
    );

    // Wait for save button to become enabled (no validation errors)
    const saveBtn = page.locator('.btn-save');
    await expect(saveBtn).not.toBeDisabled({ timeout: 5000 });

    // Save the model
    await saveBtn.click();

    // The editor toolbar should now show a model ID
    const versionSpan = page.locator('.editor-model-version');
    await expect(versionSpan).toContainText('Model:', { timeout: 8000 });
  });

  test('add a tuple via the tuple manager UI', async ({ page }) => {
    await page.goto(`/?server=${serverId}&storeId=${storeId}`);
    await page.waitForSelector('openfga-playground');

    // Switch to Tuples tab
    await page.locator('.tab').filter({ hasText: 'Tuples' }).click();
    await expect(page.locator('#tuples-panel')).toHaveClass(/visible/);

    // The tuple manager is inside shadow DOM — interact through evaluate
    const addedTuple = await page.evaluate(() => {
      const playground = document.querySelector('openfga-playground') as HTMLElement;
      const tupleManager = playground.shadowRoot?.querySelector('openfga-tuple-manager');
      if (!tupleManager) return null;

      // Dispatch a tuple-add event as if the user filled in the form
      const event = new CustomEvent('tuple-add', {
        detail: { user: 'user:anne', relation: 'viewer', object: 'document:readme' },
        bubbles: true,
        composed: true,
      });
      tupleManager.dispatchEvent(event);
      return { user: 'user:anne', relation: 'viewer', object: 'document:readme' };
    });

    expect(addedTuple).not.toBeNull();

    // Wait for the tuple to appear in the list (the shell will call the backend
    // and on success update state, which re-renders the list)
    await expect(page.locator('.tab').filter({ hasText: 'Tuples' }))
      .toContainText('Tuples (1)', { timeout: 5000 });
  });

  test('run an assertion via the assertion runner UI', async ({ page }) => {
    await page.goto(`/?server=${serverId}&storeId=${storeId}`);
    await page.waitForSelector('openfga-playground');

    // Switch to Assertions tab
    await page.locator('.tab').filter({ hasText: 'Assertions' }).click();

    // Add an assertion by dispatching the event
    await page.evaluate(() => {
      const playground = document.querySelector('openfga-playground') as HTMLElement;
      const runner = playground.shadowRoot?.querySelector('openfga-assertion-runner');
      if (!runner) return;

      runner.dispatchEvent(new CustomEvent('assertion-add', {
        detail: {
          user: 'user:anne',
          relation: 'viewer',
          object: 'document:readme',
          expectation: true,
        },
        bubbles: true,
        composed: true,
      }));
    });

    await expect(page.locator('.tab').filter({ hasText: 'Assertions' }))
      .toContainText('Assertions (1)', { timeout: 3000 });

    // Run all assertions
    await page.evaluate(() => {
      const playground = document.querySelector('openfga-playground') as HTMLElement;
      const runner = playground.shadowRoot?.querySelector('openfga-assertion-runner');
      runner?.dispatchEvent(new CustomEvent('assertion-run-all', {
        bubbles: true, composed: true,
      }));
    });

    // Wait for the check result to come back (allow up to 5s for the API call)
    // Playwright pierces open shadow roots in CSS selectors, so .result-pass/.result-fail
    // inside openfga-assertion-runner's shadow DOM are reachable.
    const result = page.locator('.result-pass, .result-fail, .result-error');
    await expect(result).toBeVisible({ timeout: 5000 });

    // No error toast should have appeared
    await expect(page.locator('.error-toast')).not.toBeVisible();
  });
});
