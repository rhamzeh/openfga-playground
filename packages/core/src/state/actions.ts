// SPDX-License-Identifier: Apache-2.0
import type { TupleKey } from '@openfga/sdk';
import type { AssertionData, AssertionResult, AuthorizationModelSummary, ValidationError } from '../types.js';
import type { ServerConfig } from '../adapter/interface.js';
import {
  $activeServerId,
  $activeStoreId,
  $activeModelId,
  $compareModelId,
  $servers,
  $model,
  $tuples,
  $assertions,
  $assertionResults,
  $modelVersions,
  assertionKey,
} from './store.js';
import { importYaml } from '../yaml/import.js';
import { exportYaml } from '../yaml/export.js';

// ---------------------------------------------------------------------------
// Server actions
// ---------------------------------------------------------------------------

export function setServers(servers: ServerConfig[]): void {
  const byId: Record<string, ServerConfig> = {};
  for (const s of servers) {
    byId[s.id] = s;
  }
  $servers.set(byId);
}

export function upsertServer(server: ServerConfig): void {
  $servers.setKey(server.id, server);
}

export function removeServer(id: string): void {
  const current = { ...$servers.get() };
  delete current[id];
  $servers.set(current);
}

// ---------------------------------------------------------------------------
// Navigation actions
// ---------------------------------------------------------------------------

export function setActiveServer(serverId: string | null): void {
  $activeServerId.set(serverId);
}

export function setActiveStore(storeId: string | null): void {
  $activeStoreId.set(storeId);
  // Clear derived state when switching stores
  $activeModelId.set(null);
  $compareModelId.set(null);
  $tuples.set([]);
  $assertions.set([]);
  $assertionResults.set({});
  $modelVersions.set([]);
  $model.set({ dsl: '', json: null, errors: [] });
}

export function setActiveModel(modelId: string | null): void {
  $activeModelId.set(modelId);
}

export function setCompareModel(modelId: string | null): void {
  $compareModelId.set(modelId);
}

// ---------------------------------------------------------------------------
// Model actions
// ---------------------------------------------------------------------------

export function updateModel(dsl: string, json: object | null = null, errors: ValidationError[] = []): void {
  $model.set({ dsl, json, errors });
}

export function setModelErrors(errors: ValidationError[]): void {
  $model.setKey('errors', errors);
}

export function setModelJson(json: object | null): void {
  $model.setKey('json', json);
}

export function setModelVersions(versions: AuthorizationModelSummary[]): void {
  $modelVersions.set(versions);
}

// ---------------------------------------------------------------------------
// Tuple actions
// ---------------------------------------------------------------------------

export function setTuples(tuples: TupleKey[]): void {
  $tuples.set(tuples);
}

export function addTuple(tuple: TupleKey): void {
  $tuples.set([...$tuples.get(), tuple]);
}

export function removeTuple(tuple: TupleKey): void {
  $tuples.set(
    $tuples.get().filter(
      (t) =>
        t.user !== tuple.user ||
        t.relation !== tuple.relation ||
        t.object !== tuple.object,
    ),
  );
}

// ---------------------------------------------------------------------------
// Assertion actions
// ---------------------------------------------------------------------------

export function setAssertions(assertions: AssertionData[]): void {
  $assertions.set(assertions);
  $assertionResults.set({});
}

export function addAssertion(assertion: AssertionData): void {
  $assertions.set([...$assertions.get(), assertion]);
}

export function removeAssertion(assertion: Pick<AssertionData, 'user' | 'relation' | 'object'>): void {
  const key = assertionKey(assertion);
  $assertions.set(
    $assertions.get().filter((a) => assertionKey(a) !== key),
  );
  const results = { ...$assertionResults.get() };
  delete results[key];
  $assertionResults.set(results);
}

export function setAssertionResult(
  assertion: Pick<AssertionData, 'user' | 'relation' | 'object'>,
  result: AssertionResult,
): void {
  $assertionResults.setKey(assertionKey(assertion), result);
}

export function clearAssertionResults(): void {
  $assertionResults.set({});
}

// ---------------------------------------------------------------------------
// YAML import/export
// ---------------------------------------------------------------------------

export function importFromYaml(yaml: string): void {
  const state = importYaml(yaml);
  if (state.model !== undefined) {
    $model.set({ dsl: state.model, json: null, errors: [] });
  }
  if (state.tuples !== undefined) {
    $tuples.set(state.tuples);
  }
  if (state.assertions !== undefined) {
    $assertions.set(state.assertions);
  }
  $assertionResults.set({});
}

export function exportToYaml(): string {
  return exportYaml({
    model: $model.get().dsl,
    tuples: $tuples.get(),
    assertions: $assertions.get(),
  });
}
