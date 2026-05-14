// SPDX-License-Identifier: Apache-2.0
import type { OpenFgaClient } from '@openfga/sdk';
import { CredentialsMethod } from '@openfga/sdk';
export { CredentialsMethod };

/**
 * String literal union derived from the CredentialsMethod enum.
 * Produces 'none' | 'api_token' | 'client_credentials' — compatible with
 * both the enum values and plain string literals from the components layer.
 */
type AuthMethodLiteral = `${CredentialsMethod}`;

/**
 * Capability flags indicating what the upstream server supports.
 * Defaults to all-true (open-source OpenFGA).
 */
export interface Capabilities {
  /** CreateStore, GetStore, DeleteStore */
  storeCrud: boolean;
  /** ListStores */
  storeList: boolean;
}

/**
 * Public auth view — only non-secret fields returned by the management API.
 * The method tells you how the proxy authenticates; secrets are never returned.
 */
export type PublicAuth =
  | { method: CredentialsMethod.None }
  | { method: CredentialsMethod.ApiToken }
  | { method: CredentialsMethod.ClientCredentials; apiTokenIssuer?: string; apiAudience?: string };

/**
 * A known store entry within a server (public view — no secrets).
 */
export interface PublicStoreEntry {
  storeId: string;
  alias?: string;
  modelId?: string;
}

/**
 * A server connection as returned by the management API (secrets redacted).
 */
export interface ServerConfig {
  id: string;
  name: string;
  apiUrl: string;
  auth: PublicAuth;
  stores: PublicStoreEntry[];
  capabilities: Capabilities;
}

/**
 * Auth credentials payload for creating/updating a server or store.
 * Discriminated union — each method enforces exactly the fields required.
 * Shape maps 1:1 to the JSON the management API accepts.
 */
export type CredentialsConfig =
  | { method?: Extract<AuthMethodLiteral, 'none'> | undefined }
  | { method: Extract<AuthMethodLiteral, 'api_token'>; apiToken: string }
  | {
      method: Extract<AuthMethodLiteral, 'client_credentials'>;
      clientId?: string;
      clientSecret?: string;
      apiTokenIssuer?: string;
      apiAudience?: string;
    }
  | undefined;

/**
 * Payload for creating a new server connection (may include secrets).
 */
export interface NewServer {
  name: string;
  apiUrl: string;
  auth?: CredentialsConfig;
  capabilities?: Capabilities;
}

/**
 * Partial update for an existing server connection.
 */
export type ServerUpdate = Partial<NewServer>;

/**
 * Payload for adding a store entry to a server.
 */
export interface NewStoreEntry {
  storeId: string;
  alias?: string;
  modelId?: string;
  /** Optional auth overrides merged with the server's base auth. */
  auth?: CredentialsConfig;
}

/**
 * Partial update for a store entry.
 */
export type StoreEntryUpdate = Partial<NewStoreEntry>;

/**
 * Minimal interface every backend adapter must implement.
 *
 * Three adapters ship with the playground:
 * - `ProxyBackendAdapter` — goes through `fga serve`; supports multi-server
 *   management and authenticated upstream servers. Implements
 *   `ConnectionManager` in addition to `BackendAdapter`.
 * - `DirectBackendAdapter` — calls an unauthenticated OpenFGA server directly
 *   from the browser. Single-server, no secrets.
 * - `WASMBackendAdapter` (future) — runs OpenFGA in a Web Worker via WASM.
 *
 * Third parties (e.g., Auth0 FGA Dashboard) can provide their own
 * implementation configured to talk to their own backend.
 */
export interface BackendAdapter {
  /**
   * List all available server connections. Adapters that don't support
   * multiple servers (Direct, WASM) return a single-entry synthetic list
   * so the rest of the shell can treat every adapter uniformly.
   */
  listServers(): Promise<ServerConfig[]>;

  /**
   * List store entries for a server. For single-server adapters the
   * serverId is usually ignored or set to a known constant.
   */
  listStores(serverId: string): Promise<PublicStoreEntry[]>;

  /**
   * Return an `OpenFgaClient` configured for the given server.
   * The core calls standard SDK methods (check, write, read, etc.) on it.
   */
  getClient(serverId: string): OpenFgaClient;

  /**
   * Capability flags describing what this adapter supports. Used by the
   * shell to gate UI (e.g. hide the "New Server" button when the adapter
   * doesn't implement ConnectionManager).
   */
  readonly supports: AdapterCapabilities;
}

/** Capabilities an adapter may support. */
export interface AdapterCapabilities {
  /** Adapter implements ConnectionManager (multi-server, add/edit/delete). */
  connectionManagement: boolean;
  /** Adapter can write tuples and models (not read-only). */
  writes: boolean;
}

/**
 * Extension of `BackendAdapter` for adapters that support managing multiple
 * server connections and their credentials at runtime. Only implemented by
 * `ProxyBackendAdapter` — Direct and WASM are single-server.
 */
export interface ConnectionManager extends BackendAdapter {
  /** Create a new server connection. Accepts secrets; backend stores them on disk. */
  createServer(server: NewServer): Promise<ServerConfig>;

  /** Update an existing server connection by ID. */
  updateServer(id: string, update: ServerUpdate): Promise<ServerConfig>;

  /** Delete a server connection by ID. */
  deleteServer(id: string): Promise<void>;

  /** Add a store entry to a server. */
  addStore(serverId: string, store: NewStoreEntry): Promise<PublicStoreEntry>;

  /** Update a store entry within a server. */
  updateStore(serverId: string, storeId: string, update: StoreEntryUpdate): Promise<PublicStoreEntry>;

  /** Remove a store entry from a server. */
  removeStore(serverId: string, storeId: string): Promise<void>;
}

/** Runtime capability check — does this adapter support connection management? */
export function isConnectionManager(adapter: BackendAdapter): adapter is ConnectionManager {
  return adapter.supports.connectionManagement;
}
