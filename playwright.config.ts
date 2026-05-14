// SPDX-License-Identifier: Apache-2.0
import { defineConfig, devices } from '@playwright/test';

/**
 * E2E tests require:
 *   - OpenFGA running (e.g. docker run -p 8900:8080 openfga/openfga run)
 *   - fga serve running on port 8880, with a server profile pointing to OpenFGA
 *   - The playground dev server running on port 5173 (or set PLAYGROUND_URL)
 *
 * Environment variables:
 *   PLAYGROUND_URL   - defaults to http://localhost:5173
 *   FGA_SERVE_URL    - defaults to http://localhost:8880
 */
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  retries: 0,
  use: {
    baseURL: process.env['PLAYGROUND_URL'] ?? 'http://localhost:5173',
    headless: true,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // Do not start a built-in web server — the playground dev server and fga serve
  // must be started separately before running these tests.
});
