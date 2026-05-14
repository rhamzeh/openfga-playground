// SPDX-License-Identifier: Apache-2.0
import type { SampleStore } from '../types.js';

const SAMPLE_STORES_API =
  'https://api.github.com/repos/openfga/sample-stores/contents/stores';

let cachedList: SampleStore[] | null = null;

interface GitHubContentEntry {
  name: string;
  path: string;
  type: string;
  download_url: string | null;
}

/**
 * Fetch the list of sample stores from the openfga/sample-stores GitHub repo.
 * The result is cached in memory for the session.
 */
export async function loadSampleList(): Promise<SampleStore[]> {
  if (cachedList !== null) {
    return cachedList;
  }

  const response = await fetch(SAMPLE_STORES_API, {
    headers: { Accept: 'application/vnd.github.v3+json' },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch sample list: ${response.statusText}`);
  }

  const entries = (await response.json()) as GitHubContentEntry[];

  cachedList = entries
    .filter((e) => e.type === 'dir')
    .map((e) => ({
      name: e.name,
      path: e.path,
      downloadUrl: `https://raw.githubusercontent.com/openfga/sample-stores/main/${e.path}/store.fga.yaml`,
    }));

  return cachedList;
}

/**
 * Fetch the raw YAML content for a sample store by its download URL.
 */
export async function loadSample(downloadUrl: string): Promise<string> {
  const response = await fetch(downloadUrl);

  if (!response.ok) {
    throw new Error(`Failed to fetch sample store: ${response.statusText}`);
  }

  return response.text();
}

/** Clear the in-memory cache (useful for testing). */
export function clearSampleCache(): void {
  cachedList = null;
}
