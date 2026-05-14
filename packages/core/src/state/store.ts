// SPDX-License-Identifier: Apache-2.0
import { atom, map } from 'nanostores';
import type { TupleKey } from '@openfga/sdk';
import type {
  ApiLogEntry,
  AssertionData,
  AssertionResult,
  AuthorizationModelSummary,
  ModelData,
  ValidationError,
} from '../types.js';
import type { ServerConfig } from '../adapter/interface.js';

// ---------------------------------------------------------------------------
// Primitive atoms
// ---------------------------------------------------------------------------

/** ID of the currently active server connection, or null if none. */
export const $activeServerId = atom<string | null>(null);

/** ID of the currently active store, or null if none. */
export const $activeStoreId = atom<string | null>(null);

/** ID of the currently active authorization model version, or null if none. */
export const $activeModelId = atom<string | null>(null);

/** ID of the model version being compared (diff view), or null. */
export const $compareModelId = atom<string | null>(null);

// ---------------------------------------------------------------------------
// Map atoms (keyed collections)
// ---------------------------------------------------------------------------

/** All known server connections, keyed by server ID. */
export const $servers = map<Record<string, ServerConfig>>({});

/** Current model state: DSL text, parsed JSON, and validation errors. */
export const $model = map<ModelData>({
  dsl: '',
  json: null,
  errors: [] as ValidationError[],
});

/** Current relationship tuples in the active store. */
export const $tuples = atom<TupleKey[]>([]);

/** Defined assertions to run against the active model. */
export const $assertions = atom<AssertionData[]>([]);

/**
 * Results of running assertions, keyed by a stable string key
 * derived from `${user}#${relation}@${object}`.
 */
export const $assertionResults = map<Record<string, AssertionResult>>({});

/** List of authorization model versions for the active store. */
export const $modelVersions = atom<AuthorizationModelSummary[]>([]);

/** Captured API request/response log for the dev console. */
export const $apiLog = atom<ApiLogEntry[]>([]);

const MAX_API_LOG_ENTRIES = 200;

/** Append an entry to the API log, capping at MAX_API_LOG_ENTRIES. */
export function addApiLogEntry(entry: ApiLogEntry): void {
  const log = $apiLog.get();
  const next = [...log, entry];
  if (next.length > MAX_API_LOG_ENTRIES) next.splice(0, next.length - MAX_API_LOG_ENTRIES);
  $apiLog.set(next);
}

// ---------------------------------------------------------------------------
// Derived helpers
// ---------------------------------------------------------------------------

/** Stable key for an assertion. */
export function assertionKey(assertion: Pick<AssertionData, 'user' | 'relation' | 'object'>): string {
  return `${assertion.user}#${assertion.relation}@${assertion.object}`;
}
