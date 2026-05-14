// SPDX-License-Identifier: Apache-2.0

export type {
  BackendAdapter,
  ConnectionManager,
  AdapterCapabilities,
  ServerConfig,
  NewServer,
  ServerUpdate,
  PublicAuth,
  PublicStoreEntry,
  NewStoreEntry,
  StoreEntryUpdate,
  Capabilities,
  CredentialsConfig,
} from './adapter/interface.js';
export { CredentialsMethod, isConnectionManager } from './adapter/interface.js';
export { ProxyBackendAdapter, AuthenticationError } from './adapter/proxy.js';
export { DirectBackendAdapter } from './adapter/direct.js';
export { checkProxyAvailable } from './adapter/health.js';
export {
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
  $apiLog,
} from './state/store.js';
export {
  setServers,
  upsertServer,
  removeServer,
  setActiveServer,
  setActiveStore,
  setActiveModel,
  setCompareModel,
  updateModel,
  addTuple,
  removeTuple,
  setTuples,
  setAssertions,
  addAssertion,
  removeAssertion,
  setAssertionResult,
  clearAssertionResults,
  setModelVersions,
  importFromYaml,
  exportToYaml,
} from './state/actions.js';
export { validateModel, dslToJson, jsonToDsl, createDebouncedValidator } from './validation/orchestrator.js';
export { importYaml } from './yaml/import.js';
export { exportYaml } from './yaml/export.js';
export { loadSampleList, loadSample } from './samples/loader.js';
export type {
  ValidationError,
  ModelData,
  AssertionData,
  AssertionResult,
  AuthorizationModelSummary,
  ApiLogEntry,
} from './types.js';
