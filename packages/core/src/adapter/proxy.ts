// SPDX-License-Identifier: Apache-2.0
import axios from 'axios';
import type { AxiosInstance, InternalAxiosRequestConfig, AxiosResponse } from 'axios';
import { OpenFgaClient } from '@openfga/sdk';
import type {
  AdapterCapabilities,
  ConnectionManager,
  NewServer,
  NewStoreEntry,
  PublicStoreEntry,
  ServerConfig,
  ServerUpdate,
  StoreEntryUpdate,
} from './interface.js';
import type { ApiLogEntry } from '../types.js';
import { addApiLogEntry } from '../state/store.js';

const DEFAULT_BASE_URL = 'http://localhost:8880';

/** Header name for session-token authentication with `fga serve`. */
const SESSION_TOKEN_HEADER = 'X-Serve-Token';

/** Headers to capture in the dev console (lowercase for comparison). */
const INTERESTING_REQ_HEADERS = ['content-type', 'authorization'];
const INTERESTING_RES_HEADERS = ['content-type', 'x-request-id', 'openfga-authorization-model-id'];

/**
 * Thrown when `fga serve` returns 401, indicating the request was rejected
 * because no valid session token was provided.
 */
export class AuthenticationError extends Error {
  constructor(message = 'Session token required') {
    super(message);
    this.name = 'AuthenticationError';
  }
}

/**
 * BackendAdapter implementation that routes through `fga serve`.
 *
 * Server CRUD calls hit `fga serve`'s management API.
 * `getClient()` returns an `OpenFgaClient` configured with:
 *   apiUrl = "<baseUrl>/servers/<serverId>/proxy"
 *
 * `fga serve` transparently forwards OpenFGA API calls to the upstream server
 * and attaches the appropriate auth headers. No secrets touch the browser.
 */
export class ProxyBackendAdapter implements ConnectionManager {
  readonly baseUrl: string;
  readonly supports: AdapterCapabilities = {
    connectionManagement: true,
    writes: true,
  };
  private readonly clients = new Map<string, OpenFgaClient>();
  private _token = '';
  private _axiosInstance: AxiosInstance | null = null;
  private _logIdCounter = 0;

  constructor(baseUrl?: string) {
    // Resolve base URL: empty/undefined + browser → same-origin URL.
    // Falls back to the hardcoded default for non-browser environments.
    let resolved = baseUrl;
    if (resolved == null || resolved === '') {
      const g = globalThis as Record<string, unknown>;
      const loc = (g['location'] as { origin?: string } | undefined);
      resolved = loc?.origin ?? DEFAULT_BASE_URL;
    }
    this.baseUrl = resolved.replace(/\/$/, '');
  }

  /**
   * Set (or clear) the session token used for authenticating requests to
   * `fga serve`. Clears cached SDK clients so they are re-created with the
   * new token on next use.
   */
  setSessionToken(token: string): void {
    this._token = token;
    this.clients.clear();
  }

  /** Merge the session token into any existing headers object. */
  private _authHeaders(extra: Record<string, string> = {}): Record<string, string> {
    if (this._token) {
      return { ...extra, [SESSION_TOKEN_HEADER]: this._token };
    }
    return extra;
  }

  /** Wrapper around fetch that injects the session token and checks for 401. */
  private async _fetch(url: string, init: RequestInit = {}): Promise<Response> {
    const headers = this._authHeaders(init.headers as Record<string, string> | undefined);
    const response = await fetch(url, { ...init, headers });
    if (response.status === 401) {
      throw new AuthenticationError();
    }
    return response;
  }

  // ---- Server management ----

  async listServers(): Promise<ServerConfig[]> {
    const response = await this._fetch(`${this.baseUrl}/servers`);
    if (!response.ok) {
      throw new Error(`Failed to list servers: ${response.statusText}`);
    }
    return response.json() as Promise<ServerConfig[]>;
  }

  async createServer(server: NewServer): Promise<ServerConfig> {
    const response = await this._fetch(`${this.baseUrl}/servers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(server),
    });
    if (!response.ok) {
      throw new Error(`Failed to create server: ${response.statusText}`);
    }
    return response.json() as Promise<ServerConfig>;
  }

  async updateServer(id: string, update: ServerUpdate): Promise<ServerConfig> {
    const response = await this._fetch(`${this.baseUrl}/servers/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(update),
    });
    if (!response.ok) {
      throw new Error(`Failed to update server ${id}: ${response.statusText}`);
    }
    return response.json() as Promise<ServerConfig>;
  }

  async deleteServer(id: string): Promise<void> {
    const response = await this._fetch(`${this.baseUrl}/servers/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      throw new Error(`Failed to delete server ${id}: ${response.statusText}`);
    }
  }

  // ---- Store entry management ----

  async listStores(serverId: string): Promise<PublicStoreEntry[]> {
    const response = await this._fetch(`${this.baseUrl}/servers/${encodeURIComponent(serverId)}/stores`);
    if (!response.ok) {
      throw new Error(`Failed to list stores: ${response.statusText}`);
    }
    return response.json() as Promise<PublicStoreEntry[]>;
  }

  async addStore(serverId: string, store: NewStoreEntry): Promise<PublicStoreEntry> {
    const response = await this._fetch(`${this.baseUrl}/servers/${encodeURIComponent(serverId)}/stores`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(store),
    });
    if (!response.ok) {
      throw new Error(`Failed to add store: ${response.statusText}`);
    }
    return response.json() as Promise<PublicStoreEntry>;
  }

  async updateStore(serverId: string, storeId: string, update: StoreEntryUpdate): Promise<PublicStoreEntry> {
    const response = await fetch(
      `${this.baseUrl}/servers/${encodeURIComponent(serverId)}/stores/${encodeURIComponent(storeId)}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(update),
      },
    );
    if (!response.ok) {
      throw new Error(`Failed to update store ${storeId}: ${response.statusText}`);
    }
    return response.json() as Promise<PublicStoreEntry>;
  }

  async removeStore(serverId: string, storeId: string): Promise<void> {
    const response = await fetch(
      `${this.baseUrl}/servers/${encodeURIComponent(serverId)}/stores/${encodeURIComponent(storeId)}`,
      { method: 'DELETE' },
    );
    if (!response.ok) {
      throw new Error(`Failed to remove store ${storeId}: ${response.statusText}`);
    }
  }

  // ---- API client ----

  /**
   * Returns a cached `OpenFgaClient` for the given server, configured to
   * route all OpenFGA API calls through `fga serve`'s proxy endpoint.
   */
  getClient(serverId: string): OpenFgaClient {
    if (!this.clients.has(serverId)) {
      const client = new OpenFgaClient(
        {
          apiUrl: `${this.baseUrl}/servers/${encodeURIComponent(serverId)}/proxy`,
          baseOptions: { headers: this._authHeaders() },
        },
        this._getAxios(),
      );
      this.clients.set(serverId, client);
    }
    return this.clients.get(serverId)!;
  }

  // ---- API log interceptor ----

  /**
   * Returns a shared axios instance with request/response interceptors that
   * capture every SDK call into the `$apiLog` nanostore for the dev console.
   */
  private _getAxios(): AxiosInstance {
    if (this._axiosInstance) return this._axiosInstance;

    const instance = axios.create();

    // Tag each request with a start time so we can compute duration.
    instance.interceptors.request.use((config: InternalAxiosRequestConfig) => {
      (config as unknown as Record<string, unknown>)['_startTime'] = Date.now();
      return config;
    });

    const logResponse = (config: InternalAxiosRequestConfig, response: AxiosResponse | null, error?: unknown) => {
      const startTime = (config as unknown as Record<string, number>)['_startTime'] ?? Date.now();
      const now = Date.now();

      // Strip the proxy prefix to show the real OpenFGA API path.
      const fullUrl = config.url ?? '';
      const proxyIdx = fullUrl.indexOf('/proxy/');
      const apiPath = proxyIdx >= 0 ? fullUrl.slice(proxyIdx + '/proxy'.length) : fullUrl;

      // Parse URL for path vs query separation.
      let path = apiPath;
      let query = '';
      const qIdx = apiPath.indexOf('?');
      if (qIdx >= 0) {
        path = apiPath.slice(0, qIdx);
        query = apiPath.slice(qIdx + 1);
      }

      // Collect interesting headers.
      const reqHeaders: Record<string, string> = {};
      if (config.headers) {
        for (const name of INTERESTING_REQ_HEADERS) {
          const v = config.headers[name];
          if (v && typeof v === 'string') reqHeaders[name] = v;
        }
      }
      const resHeaders: Record<string, string> = {};
      if (response?.headers) {
        for (const name of INTERESTING_RES_HEADERS) {
          const v = response.headers[name];
          if (v && typeof v === 'string') resHeaders[name] = v;
        }
      }

      const entry: ApiLogEntry = {
        id: ++this._logIdCounter,
        timestamp: startTime,
        method: (config.method ?? 'GET').toUpperCase(),
        path,
        query,
        requestBody: config.data ?? null,
        statusCode: response?.status ?? 0,
        responseBody: response?.data ?? (error instanceof Error ? error.message : null),
        durationMs: now - startTime,
        requestHeaders: reqHeaders,
        responseHeaders: resHeaders,
      };
      addApiLogEntry(entry);
    };

    instance.interceptors.response.use(
      (response: AxiosResponse) => {
        logResponse(response.config, response);
        return response;
      },
      (error: unknown) => {
        const axiosError = error as { config?: InternalAxiosRequestConfig; response?: AxiosResponse };
        if (axiosError.config) {
          logResponse(axiosError.config, axiosError.response ?? null, error);
        }
        return Promise.reject(error);
      },
    );

    this._axiosInstance = instance;
    return instance;
  }
}
