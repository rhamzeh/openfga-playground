// SPDX-License-Identifier: Apache-2.0

const DEFAULT_BASE_URL = 'http://localhost:8880';
const HEALTH_CHECK_TIMEOUT_MS = 3000;

/**
 * Check whether `fga serve` is reachable at the given base URL.
 * Used by the shell on startup to determine whether the proxy is running.
 *
 * @returns true if the proxy responds, false on timeout or any error.
 */
export async function checkProxyAvailable(baseUrl: string = DEFAULT_BASE_URL): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT_MS);

  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/healthz`, {
      signal: controller.signal,
    });
    return response.ok || response.status === 401;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
