// SPDX-License-Identifier: Apache-2.0

/**
 * Shared TypeScript interfaces for component props.
 *
 * These types are used in component @property() declarations and event detail
 * interfaces. They extend or re-export types from @openfga/sdk where applicable
 * to avoid duplication.
 */

/**
 * A relationship tuple (user, relation, object).
 * Structurally compatible with @openfga/sdk's TupleKey.
 */
export interface TupleKey {
  user: string;
  relation: string;
  object: string;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export interface ValidationError {
  line: number;
  column: number;
  message: string;
}

// ---------------------------------------------------------------------------
// Authorization model
// ---------------------------------------------------------------------------

/** Current model data passed to editor and graph components. */
export interface ModelData {
  dsl: string;
  json: object | null;
  errors: ValidationError[];
}

/** Summary of an authorization model version for the version selector. */
export interface AuthorizationModelSummary {
  id: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Assertions
// ---------------------------------------------------------------------------

export interface AssertionData {
  user: string;
  relation: string;
  object: string;
  expectation: boolean;
}

export interface AssertionResult {
  allowed: boolean | null;
  error: string | null;
  status: 'pass' | 'fail' | 'error' | 'pending';
}

// ---------------------------------------------------------------------------
// Server connections
// ---------------------------------------------------------------------------

export interface Capabilities {
  /** CreateStore, GetStore, DeleteStore */
  storeCrud: boolean;
  /** ListStores */
  storeList: boolean;
}

/**
 * Public auth view — mirrors PublicAuth from @openfga/playground-core.
 * Only non-secret fields; secrets are never returned by the API.
 */
export type PublicAuth =
  | { method: 'none' }
  | { method: 'api_token' }
  | { method: 'client_credentials'; apiTokenIssuer?: string; apiAudience?: string };

export interface PublicStoreEntry {
  storeId: string;
  alias?: string;
  modelId?: string;
}

export interface ServerConfig {
  id: string;
  name: string;
  apiUrl: string;
  auth: PublicAuth;
  stores: PublicStoreEntry[];
  capabilities: Capabilities;
}

// ---------------------------------------------------------------------------
// Event detail interfaces — exported so shell can type event handlers
// ---------------------------------------------------------------------------

export interface ModelChangeDetail {
  value: string;
}

export interface FormatChangeDetail {
  format: 'dsl' | 'json';
}

export interface NodeSelectDetail {
  type: string;
  relation?: string;
}

export interface TupleAddDetail {
  user: string;
  relation: string;
  object: string;
}

export interface TupleRemoveDetail {
  user: string;
  relation: string;
  object: string;
}

export interface TupleEditDetail {
  old: { user: string; relation: string; object: string };
  updated: { user: string; relation: string; object: string };
}

export interface AssertionAddDetail {
  user: string;
  relation: string;
  object: string;
  expectation: boolean;
}

export interface AssertionRemoveDetail {
  user: string;
  relation: string;
  object: string;
}

export interface AssertionRunDetail {
  assertion: AssertionData;
}

export interface AssertionExpandDetail {
  assertion: AssertionData;
}

// ---- Server event details ----

/**
 * Discriminated union for auth credentials in component events.
 * Mirrors CredentialsConfig from @openfga/playground-core (without SDK dep).
 * Values match CredentialsMethod enum from @openfga/sdk.
 */
export type CredentialsConfig =
  | { method?: 'none' | undefined }
  | { method: 'api_token'; apiToken: string }
  | {
      method: 'client_credentials';
      clientId?: string;
      clientSecret?: string;
      apiTokenIssuer?: string;
      apiAudience?: string;
    }
  | undefined;

export interface ServerAddDetail {
  server: {
    name: string;
    apiUrl: string;
    auth?: CredentialsConfig;
    capabilities?: Capabilities;
  };
}

export interface ServerUpdateDetail {
  id: string;
  update: Partial<ServerAddDetail['server']>;
}

export interface ServerRemoveDetail {
  id: string;
}

export interface ServerSelectDetail {
  id: string;
}

export interface StoreCreateDetail {
  serverId: string;
  name: string;
  alias?: string;
}

export interface StoreAddDetail {
  serverId: string;
  store: {
    storeId: string;
    alias?: string;
    modelId?: string;
    auth?: CredentialsConfig;
  };
}

export interface StoreUpdateDetail {
  serverId: string;
  storeId: string;
  update: Partial<StoreAddDetail['store']>;
}

export interface StoreRemoveDetail {
  serverId: string;
  storeId: string;
}

export interface StoreSelectDetail {
  serverId: string;
  storeId: string;
}
