// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, beforeEach } from 'vitest';
import {
  setActiveServer,
  setActiveStore,
  setActiveModel,
  setCompareModel,
  updateModel,
  addTuple,
  removeTuple,
  setTuples,
  addAssertion,
  removeAssertion,
  setAssertionResult,
  clearAssertionResults,
  setModelVersions,
  setServers,
  upsertServer,
  removeServer,
} from './actions.js';
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
} from './store.js';

function resetState() {
  $activeServerId.set(null);
  $activeStoreId.set(null);
  $activeModelId.set(null);
  $compareModelId.set(null);
  $servers.set({});
  $model.set({ dsl: '', json: null, errors: [] });
  $tuples.set([]);
  $assertions.set([]);
  $assertionResults.set({});
  $modelVersions.set([]);
}

describe('server actions', () => {
  beforeEach(resetState);

  it('setServers populates $servers keyed by id', () => {
    const servers = [
      { id: 'a', name: 'A', apiUrl: 'http://a', auth: { method: 'none' as const } as const, stores: [], capabilities: { storeCrud: true, storeList: true } },
      { id: 'b', name: 'B', apiUrl: 'http://b', auth: { method: 'none' as const } as const, stores: [], capabilities: { storeCrud: false, storeList: true } },
    ];
    setServers(servers);
    expect($servers.get()).toEqual({ a: servers[0], b: servers[1] });
  });

  it('upsertServer adds or updates a server', () => {
    const s = { id: 'x', name: 'X', apiUrl: 'http://x', auth: { method: 'none' as const } as const, stores: [], capabilities: { storeCrud: true, storeList: true } };
    upsertServer(s);
    expect($servers.get()['x']).toEqual(s);

    upsertServer({ ...s, name: 'X Updated' });
    expect($servers.get()['x'].name).toBe('X Updated');
  });

  it('removeServer deletes a server by id', () => {
    const s = { id: 'x', name: 'X', apiUrl: 'http://x', auth: { method: 'none' as const } as const, stores: [], capabilities: { storeCrud: true, storeList: true } };
    upsertServer(s);
    removeServer('x');
    expect($servers.get()['x']).toBeUndefined();
  });
});

describe('navigation actions', () => {
  beforeEach(resetState);

  it('setActiveServer updates $activeServerId', () => {
    setActiveServer('my-server');
    expect($activeServerId.get()).toBe('my-server');
  });

  it('setActiveStore clears derived state', () => {
    $activeModelId.set('model-1');
    $tuples.set([{ user: 'user:a', relation: 'reader', object: 'doc:b' }]);
    $assertions.set([{ user: 'user:a', relation: 'reader', object: 'doc:b', expectation: true }]);

    setActiveStore('store-2');

    expect($activeStoreId.get()).toBe('store-2');
    expect($activeModelId.get()).toBeNull();
    expect($tuples.get()).toEqual([]);
    expect($assertions.get()).toEqual([]);
  });

  it('setActiveModel updates $activeModelId', () => {
    setActiveModel('model-abc');
    expect($activeModelId.get()).toBe('model-abc');
  });

  it('setCompareModel updates $compareModelId', () => {
    setCompareModel('model-old');
    expect($compareModelId.get()).toBe('model-old');
  });
});

describe('model actions', () => {
  beforeEach(resetState);

  it('updateModel sets dsl, json, and errors', () => {
    const dsl = 'model\n  schema 1.1\ntype user';
    updateModel(dsl, { schema_version: '1.1' }, []);
    expect($model.get()).toEqual({ dsl, json: { schema_version: '1.1' }, errors: [] });
  });

  it('updateModel defaults json and errors to null/empty', () => {
    updateModel('type user');
    expect($model.get().json).toBeNull();
    expect($model.get().errors).toEqual([]);
  });

  it('setModelVersions updates $modelVersions', () => {
    const versions = [{ id: 'v1', createdAt: '2024-01-01T00:00:00Z' }];
    setModelVersions(versions);
    expect($modelVersions.get()).toEqual(versions);
  });
});

describe('tuple actions', () => {
  beforeEach(resetState);

  it('addTuple appends to $tuples', () => {
    addTuple({ user: 'user:anne', relation: 'reader', object: 'doc:readme' });
    expect($tuples.get()).toHaveLength(1);
  });

  it('removeTuple removes the matching tuple', () => {
    const tuple = { user: 'user:anne', relation: 'reader', object: 'doc:readme' };
    setTuples([tuple, { user: 'user:bob', relation: 'writer', object: 'doc:plan' }]);

    removeTuple(tuple);

    expect($tuples.get()).toHaveLength(1);
    expect($tuples.get()[0].user).toBe('user:bob');
  });

  it('setTuples replaces $tuples', () => {
    const tuples = [{ user: 'user:a', relation: 'r', object: 'o:1' }];
    setTuples(tuples);
    expect($tuples.get()).toEqual(tuples);
  });
});

describe('assertion actions', () => {
  beforeEach(resetState);

  it('addAssertion appends to $assertions', () => {
    addAssertion({ user: 'user:a', relation: 'reader', object: 'doc:b', expectation: true });
    expect($assertions.get()).toHaveLength(1);
  });

  it('removeAssertion removes assertion and its result', () => {
    const a = { user: 'user:a', relation: 'reader', object: 'doc:b', expectation: true };
    addAssertion(a);
    setAssertionResult(a, { allowed: true, error: null, status: 'pass' });

    removeAssertion(a);

    expect($assertions.get()).toHaveLength(0);
    expect($assertionResults.get()['user:a#reader@doc:b']).toBeUndefined();
  });

  it('setAssertionResult stores result keyed by assertion', () => {
    const a = { user: 'user:a', relation: 'reader', object: 'doc:b' };
    setAssertionResult(a, { allowed: true, error: null, status: 'pass' });

    expect($assertionResults.get()['user:a#reader@doc:b']).toEqual({
      allowed: true,
      error: null,
      status: 'pass',
    });
  });

  it('clearAssertionResults empties $assertionResults', () => {
    const a = { user: 'user:a', relation: 'reader', object: 'doc:b' };
    setAssertionResult(a, { allowed: true, error: null, status: 'pass' });

    clearAssertionResults();

    expect($assertionResults.get()).toEqual({});
  });
});
