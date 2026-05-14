// SPDX-License-Identifier: Apache-2.0

/**
 * Async event handler functions that bridge component events to backend calls
 * and core state mutations. Called exclusively from app.ts.
 *
 * Each function reads serverId/storeId/modelId from nanostores directly so
 * callers don't need to pass them. All backend errors are caught and re-thrown
 * as plain Error with a user-friendly message.
 */

import type { BackendAdapter, ConnectionManager, NewServer, ServerConfig, ServerUpdate, NewStoreEntry, StoreEntryUpdate } from '@openfga/playground-core';
import { isConnectionManager } from '@openfga/playground-core';

/** Narrow to a ConnectionManager or throw a clear error. */
function requireConnectionManager(adapter: BackendAdapter): ConnectionManager {
  if (!isConnectionManager(adapter)) {
    throw new Error('This operation requires a backend that supports connection management (e.g. fga serve).');
  }
  return adapter;
}
import {
  $activeServerId,
  $activeStoreId,
  $activeModelId,
  $servers,
  addTuple,
  removeTuple,
  setTuples,
  setAssertions,
  setAssertionResult,
  setModelVersions,
  setActiveModel,
  updateModel,
  upsertServer,
  removeServer,
  setActiveServer,
} from '@openfga/playground-core';

import type { GraphDefinition } from '@openfga/frontend-utils/graph';
import { TreeBuilder } from '@openfga/frontend-utils/graph';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getActiveContext(): { serverId: string; storeId: string; modelId: string | null } {
  const serverId = $activeServerId.get();
  const storeId = $activeStoreId.get();
  if (!serverId || !storeId) throw new Error('No active server or store selected');
  return { serverId, storeId, modelId: $activeModelId.get() };
}

function clientFor(adapter: BackendAdapter, serverId: string) {
  return adapter.getClient(serverId);
}

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------

/**
 * Save the current DSL as a new authorization model version.
 * On success, fetches updated model list and sets the new version as active.
 */
export async function handleModelSave(
  adapter: BackendAdapter,
  dsl: string,
  modelJson: object | null,
): Promise<void> {
  if (!modelJson) throw new Error('Model has validation errors — fix them before saving');
  const { serverId, storeId } = getActiveContext();
  const client = clientFor(adapter, serverId);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const response = await client.writeAuthorizationModel(modelJson as any, { storeId });
  const newId = response.authorization_model_id;
  if (newId) {
    setActiveModel(newId);
    // New model version = new assertion set; load from backend (non-fatal)
    await handleLoadAssertions(adapter, newId).catch(() => {});
  }

  // Refresh version list
  await handleLoadModelVersions(adapter);
}

/** Fetch all model versions for the active store, following pagination. */
export async function handleLoadModelVersions(adapter: BackendAdapter): Promise<void> {
  const { serverId, storeId } = getActiveContext();
  const client = clientFor(adapter, serverId);
  const all: Array<{ id: string; createdAt: string }> = [];
  let continuationToken: string | undefined;
  do {
    const response = await client.readAuthorizationModels({ storeId, pageSize: 50, continuationToken });
    for (const m of response.authorization_models ?? []) {
      all.push({ id: (m as { id?: string }).id ?? '', createdAt: (m as { created_at?: string }).created_at ?? '' });
    }
    continuationToken = response.continuation_token || undefined;
  } while (continuationToken);
  setModelVersions(all);
}

/** Load and display a specific model version in the editor. */
export async function handleLoadModel(
  adapter: BackendAdapter,
  modelId: string,
  jsonToDsl: (json: object) => Promise<string | null>,
): Promise<void> {
  const { serverId, storeId } = getActiveContext();
  const client = clientFor(adapter, serverId);

  const response = await client.readAuthorizationModel({ storeId, authorizationModelId: modelId });
  const model = response.authorization_model;
  if (!model) return;

  setActiveModel(modelId);
  const dsl = await jsonToDsl(model as object);
  if (dsl !== null) {
    updateModel(dsl, model as object, []);
  }
  // Load assertions for the newly active model version (non-fatal)
  await handleLoadAssertions(adapter, modelId).catch(() => {});
}

/**
 * Load a model version for comparison only — does NOT update global model state.
 * Returns the DSL string, or null if the model could not be loaded.
 */
export async function handleLoadCompareModel(
  adapter: BackendAdapter,
  modelId: string,
  jsonToDsl: (json: object) => Promise<string | null>,
): Promise<string | null> {
  const { serverId, storeId } = getActiveContext();
  const client = clientFor(adapter, serverId);

  const response = await client.readAuthorizationModel({ storeId, authorizationModelId: modelId });
  const model = response.authorization_model;
  if (!model) return null;

  return jsonToDsl(model as object);
}

// ---------------------------------------------------------------------------
// Tuples
// ---------------------------------------------------------------------------

/** Write a tuple to the backend, then add it to local state on success. */
export async function handleTupleAdd(
  adapter: BackendAdapter,
  tuple: { user: string; relation: string; object: string },
): Promise<void> {
  const { serverId, storeId, modelId } = getActiveContext();
  const client = clientFor(adapter, serverId);

  await client.write(
    { writes: [{ user: tuple.user, relation: tuple.relation, object: tuple.object }] },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { storeId, authorizationModelId: modelId ?? undefined } as any,
  );
  addTuple(tuple);
}

/** Delete a tuple from the backend, then remove it from local state. */
export async function handleTupleRemove(
  adapter: BackendAdapter,
  tuple: { user: string; relation: string; object: string },
): Promise<void> {
  const { serverId, storeId } = getActiveContext();
  const client = clientFor(adapter, serverId);

  await client.write(
    { deletes: [{ user: tuple.user, relation: tuple.relation, object: tuple.object }] },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { storeId } as any,
  );
  removeTuple(tuple);
}

/** Load all tuples for the active store into state. */
export async function handleLoadTuples(adapter: BackendAdapter): Promise<void> {
  const { serverId, storeId } = getActiveContext();
  const client = clientFor(adapter, serverId);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const response = await client.read({} as any, { storeId } as any);
  const tuples = (response.tuples ?? []).map((t: { key: { user: string; relation: string; object: string } }) => {
    return { user: t.key.user, relation: t.key.relation, object: t.key.object };
  });
  setTuples(tuples);
}

// ---------------------------------------------------------------------------
// Assertions
// ---------------------------------------------------------------------------

/**
 * Run a single Check assertion against the backend and record the result.
 */
export async function handleAssertionRun(
  adapter: BackendAdapter,
  assertion: { user: string; relation: string; object: string; expectation: boolean },
): Promise<void> {
  const { serverId, storeId, modelId } = getActiveContext();
  const client = clientFor(adapter, serverId);

  try {
    const response = await client.check(
      { user: assertion.user, relation: assertion.relation, object: assertion.object },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { storeId, authorizationModelId: modelId ?? undefined } as any,
    );
    const allowed = response.allowed ?? false;
    const pass = allowed === assertion.expectation;
    setAssertionResult(assertion, { allowed, error: null, status: pass ? 'pass' : 'fail' });
  } catch (err) {
    setAssertionResult(assertion, {
      allowed: null,
      error: err instanceof Error ? err.message : String(err),
      status: 'error',
    });
  }
}

/**
 * Call the Expand API recursively for a single assertion tuple, build the
 * full resolution graph, and return a {@link GraphDefinition} ready for
 * `<openfga-resolution-path>`. Returns null if the tree is empty.
 */
export async function handleAssertionExpand(
  adapter: BackendAdapter,
  assertion: { user: string; relation: string; object: string },
): Promise<GraphDefinition | null> {
  const { serverId, storeId, modelId } = getActiveContext();
  const client = clientFor(adapter, serverId);

  const expandFn = async (relation: string, object: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const resp = await client.expand({ relation, object }, { storeId, authorizationModelId: modelId ?? undefined } as any);
    return resp as { tree?: { root?: object } };
  };

  const builder = new TreeBuilder(expandFn, { relation: assertion.relation, object: assertion.object });
  await builder.buildTree();
  if (!builder.tree || Object.keys(builder.tree).length === 0) return null;
  return builder.buildGraph(assertion.user);
}

/**
 * Load assertions for the given model version from the backend into state.
 * Clears existing assertion results so stale pass/fail indicators are removed.
 */
export async function handleLoadAssertions(
  adapter: BackendAdapter,
  modelId: string,
): Promise<void> {
  const { serverId, storeId } = getActiveContext();
  const client = clientFor(adapter, serverId);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const response = await (client as any).readAssertions({ storeId, authorizationModelId: modelId });
  const raw = (response as { assertions?: Array<{ tuple_key: { user: string; relation: string; object: string }; expectation: boolean }> }).assertions ?? [];
  const assertions = raw.map((a) => ({
    user: a.tuple_key.user,
    relation: a.tuple_key.relation,
    object: a.tuple_key.object,
    expectation: a.expectation,
  }));
  setAssertions(assertions);
}

/**
 * Persist the full assertion list for the active model to the backend.
 * OpenFGA's WriteAssertions replaces the entire list, so we always send all.
 */
export async function handleAssertionWrite(
  adapter: BackendAdapter,
  assertions: ReadonlyArray<{ user: string; relation: string; object: string; expectation: boolean }>,
): Promise<void> {
  const { serverId, storeId, modelId } = getActiveContext();
  if (!modelId) return; // no model to attach assertions to
  const client = clientFor(adapter, serverId);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (client as any).writeAssertions(
    assertions.map((a) => ({ user: a.user, relation: a.relation, object: a.object, expectation: a.expectation })),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { storeId, authorizationModelId: modelId } as any,
  );
}

/** Run all assertions in parallel. */
export async function handleAssertionRunAll(
  adapter: BackendAdapter,
  assertions: ReadonlyArray<{ user: string; relation: string; object: string; expectation: boolean }>,
): Promise<void> {
  await Promise.all(assertions.map((a) => handleAssertionRun(adapter, a)));
}

// ---------------------------------------------------------------------------
// Server management
// ---------------------------------------------------------------------------

export async function handleServerAdd(
  adapter: BackendAdapter,
  server: NewServer,
): Promise<void> {
  const mgr = requireConnectionManager(adapter);
  const created = await mgr.createServer(server);
  upsertServer(created);
  setActiveServer(created.id);
}

export async function handleServerUpdate(
  adapter: BackendAdapter,
  id: string,
  update: ServerUpdate,
): Promise<void> {
  const mgr = requireConnectionManager(adapter);
  const updated = await mgr.updateServer(id, update);
  upsertServer(updated);
}

export async function handleServerRemove(
  adapter: BackendAdapter,
  id: string,
): Promise<void> {
  const mgr = requireConnectionManager(adapter);
  await mgr.deleteServer(id);
  removeServer(id);
  if ($activeServerId.get() === id) {
    setActiveServer(null);
  }
}

// ---------------------------------------------------------------------------
// Store management
// ---------------------------------------------------------------------------

/**
 * Create a new OpenFGA store via the API, then refresh the server's store
 * list in local state. Works for all adapters — store CRUD is a real
 * OpenFGA API, distinct from proxy server/connection management.
 *
 * For ConnectionManager adapters the new store is also registered in the
 * proxy config so it persists across `fga serve` restarts.
 */
export async function handleStoreCreate(
  adapter: BackendAdapter,
  serverId: string,
  name: string,
  alias?: string,
): Promise<string> {
  const client = clientFor(adapter, serverId);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const response = await (client as any).createStore({ name });
  const storeId = (response as { id?: string }).id;
  if (!storeId) throw new Error('CreateStore did not return a store ID');

  if (isConnectionManager(adapter)) {
    // Register in the proxy config (persists in servers.yaml).
    await adapter.addStore(serverId, { storeId, alias: alias || undefined });
    const servers = await adapter.listServers();
    const updated = servers.find((s) => s.id === serverId);
    if (updated) upsertServer(updated);
  } else {
    // Refresh from the live ListStores API.
    const stores = await adapter.listStores(serverId);
    const currentServer = $servers.get()[serverId];
    if (currentServer) upsertServer({ ...currentServer, stores });
  }
  return storeId;
}

/**
 * Delete an OpenFGA store via the API. For ConnectionManager adapters, also
 * unregisters it from the proxy config. For direct adapters, refreshes the
 * store list from the live API.
 */
export async function handleStoreDelete(
  adapter: BackendAdapter,
  serverId: string,
  storeId: string,
): Promise<void> {
  const client = clientFor(adapter, serverId);
  // The SDK's deleteStore reads the store ID from options.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (client as any).deleteStore({ storeId } as any);

  if (isConnectionManager(adapter)) {
    // Also remove from the proxy config so it doesn't show up after reload.
    try {
      await adapter.removeStore(serverId, storeId);
    } catch { /* already removed upstream is fine */ }
    const servers = await adapter.listServers();
    const updated = servers.find((s) => s.id === serverId);
    if (updated) upsertServer(updated);
  } else {
    const stores = await adapter.listStores(serverId);
    const currentServer = $servers.get()[serverId];
    if (currentServer) upsertServer({ ...currentServer, stores });
  }
}

export async function handleStoreAdd(
  adapter: BackendAdapter,
  serverId: string,
  store: NewStoreEntry,
): Promise<void> {
  const mgr = requireConnectionManager(adapter);
  const entry = await mgr.addStore(serverId, store);
  const servers = await mgr.listServers();
  const updated = servers.find((s) => s.id === serverId);
  if (updated) upsertServer(updated);
  void entry;
}

export async function handleStoreUpdate(
  adapter: BackendAdapter,
  serverId: string,
  storeId: string,
  update: StoreEntryUpdate,
): Promise<void> {
  const mgr = requireConnectionManager(adapter);
  await mgr.updateStore(serverId, storeId, update);
  const servers = await mgr.listServers();
  const updated = servers.find((s) => s.id === serverId);
  if (updated) upsertServer(updated);
}

export async function handleStoreRemove(
  adapter: BackendAdapter,
  serverId: string,
  storeId: string,
): Promise<void> {
  const mgr = requireConnectionManager(adapter);
  await mgr.removeStore(serverId, storeId);
  const servers = await mgr.listServers();
  const updated = servers.find((s) => s.id === serverId);
  if (updated) upsertServer(updated);
}

// ---------------------------------------------------------------------------
// Full store-switch initialisation
// ---------------------------------------------------------------------------

/**
 * Called when the active server or store changes. Loads model versions,
 * the latest model, and all tuples. Errors are non-fatal.
 */
export async function handleStoreSwitch(
  adapter: BackendAdapter,
  serverId: string,
  storeId: string,
  jsonToDsl: (json: object) => Promise<string | null>,
): Promise<{ error?: string }> {
  const server: ServerConfig | undefined = $servers.get()[serverId];
  if (!server) return {};
  const client = clientFor(adapter, serverId);

  try {
    // Load all model versions, following continuation tokens.
    const allModels: Array<{ id: string; createdAt: string }> = [];
    let firstPage: unknown[] = [];
    let continuationToken: string | undefined;
    do {
      const resp = await client.readAuthorizationModels({ storeId, pageSize: 50, continuationToken });
      const page = resp.authorization_models ?? [];
      if (firstPage.length === 0) firstPage = page as unknown[];
      for (const m of page) {
        allModels.push({
          id: (m as { id?: string }).id ?? '',
          createdAt: (m as { created_at?: string }).created_at ?? '',
        });
      }
      continuationToken = resp.continuation_token || undefined;
    } while (continuationToken);
    setModelVersions(allModels);

    // Load the latest model (first in the list — newest first) into the editor.
    const latest = firstPage[0] as { id?: string } | undefined;
    if (latest?.id) {
      setActiveModel(latest.id);
      const dsl = await jsonToDsl(latest as object);
      if (dsl !== null) updateModel(dsl, latest as object, []);
      await handleLoadAssertions(adapter, latest.id).catch(() => {});
    }
  } catch { /* model loading is non-fatal */ }

  try {
    // Load tuples
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tupleResp = await client.read({} as any, { storeId } as any);
    const tuples = (tupleResp.tuples ?? []).map((t: { key: { user: string; relation: string; object: string } }) => ({
      user: t.key.user, relation: t.key.relation, object: t.key.object,
    }));
    setTuples(tuples);
  } catch { /* tuple loading is non-fatal */ }

  return {};
}

// ---------------------------------------------------------------------------
// Changelog
// ---------------------------------------------------------------------------

export interface ChangelogEntry {
  tuple_key: { user: string; relation: string; object: string };
  operation: string;
  timestamp: string;
}

export interface ChangelogPage {
  entries: ChangelogEntry[];
  continuationToken: string | undefined;
}

/**
 * Load a page of changelog entries (ReadChanges) for the active store.
 * @param type Optional type filter (e.g. "document")
 * @param startTime Optional ISO 8601 timestamp to start from
 * @param continuationToken Pagination token from a previous response
 */
export async function handleChangelogLoad(
  adapter: BackendAdapter,
  opts: { type?: string; startTime?: string; continuationToken?: string } = {},
): Promise<ChangelogPage> {
  const { serverId, storeId } = getActiveContext();
  const client = clientFor(adapter, serverId);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const response = await (client as any).readChanges(
    { type: opts.type ?? '', startTime: opts.startTime },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { storeId, pageSize: 50, continuationToken: opts.continuationToken } as any,
  );
  const raw = response as { changes?: ChangelogEntry[]; continuation_token?: string };
  return {
    entries: (raw.changes ?? []).map((c) => ({
      tuple_key: c.tuple_key,
      operation: c.operation,
      timestamp: c.timestamp,
    })),
    continuationToken: raw.continuation_token || undefined,
  };
}

// ---------------------------------------------------------------------------
// Ad-hoc queries (Check, ListObjects, ListUsers)
// ---------------------------------------------------------------------------

export interface CheckResult {
  allowed: boolean;
}

export async function handleQueryCheck(
  adapter: BackendAdapter,
  q: { user: string; relation: string; object: string },
): Promise<CheckResult> {
  const { serverId, storeId, modelId } = getActiveContext();
  const client = clientFor(adapter, serverId);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const response = await client.check({ user: q.user, relation: q.relation, object: q.object }, { storeId, authorizationModelId: modelId ?? undefined } as any);
  return { allowed: response.allowed ?? false };
}

export async function handleQueryListObjects(
  adapter: BackendAdapter,
  q: { user: string; relation: string; type: string },
): Promise<string[]> {
  const { serverId, storeId, modelId } = getActiveContext();
  const client = clientFor(adapter, serverId);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const response = await (client as any).listObjects({ user: q.user, relation: q.relation, type: q.type }, { storeId, authorizationModelId: modelId ?? undefined } as any);
  return (response as { objects?: string[] }).objects ?? [];
}

export async function handleQueryListUsers(
  adapter: BackendAdapter,
  q: { objectType: string; objectId: string; relation: string; userType: string },
): Promise<string[]> {
  const { serverId, storeId, modelId } = getActiveContext();
  const client = clientFor(adapter, serverId);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const response = await (client as any).listUsers(
    { object: { type: q.objectType, id: q.objectId }, relation: q.relation, user_filters: [{ type: q.userType }] },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { storeId, authorizationModelId: modelId ?? undefined } as any,
  );
  type UserEntry = { object?: { type: string; id: string }; userset?: { type: string; id: string; relation: string } };
  const users = (response as { users?: UserEntry[] }).users ?? [];
  return users.map((u) => {
    if (u.object) return `${u.object.type}:${u.object.id}`;
    if (u.userset) return `${u.userset.type}:${u.userset.id}#${u.userset.relation}`;
    return String(u);
  });
}

export async function handleQueryListRelations(
  adapter: BackendAdapter,
  q: { user: string; object: string; relations: string[] },
): Promise<string[]> {
  const { serverId, storeId, modelId } = getActiveContext();
  const client = clientFor(adapter, serverId);
  // The SDK's listRelations uses batchCheck internally which may not
  // forward custom headers correctly. Use individual check calls instead.
  const opts = { storeId, authorizationModelId: modelId ?? undefined };
  const results = await Promise.allSettled(
    q.relations.map(async (relation) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const resp = await (client as any).check(
        { user: q.user, relation, object: q.object },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        opts as any,
      );
      return { relation, allowed: !!(resp as { allowed?: boolean }).allowed };
    }),
  );
  return results
    .filter((r): r is PromiseFulfilledResult<{ relation: string; allowed: boolean }> =>
      r.status === 'fulfilled' && r.value.allowed)
    .map((r) => r.value.relation);
}
