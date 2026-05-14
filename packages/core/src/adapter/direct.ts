// SPDX-License-Identifier: Apache-2.0
import axios from 'axios';
import type { AxiosInstance, InternalAxiosRequestConfig, AxiosResponse } from 'axios';
import { OpenFgaClient } from '@openfga/sdk';
import type { ApiLogEntry } from '../types.js';
import { addApiLogEntry } from '../state/store.js';
import type {
  AdapterCapabilities,
  BackendAdapter,
  PublicStoreEntry,
  ServerConfig,
} from './interface.js';
import { CredentialsMethod } from './interface.js';

/** Synthetic server ID used for the single in-scope server. */
const DIRECT_SERVER_ID = 'direct';

const INTERESTING_REQ_HEADERS = ['content-type', 'authorization'];
const INTERESTING_RES_HEADERS = ['content-type', 'x-request-id', 'openfga-authorization-model-id'];

/**
 * BackendAdapter that calls an OpenFGA server directly from the browser,
 * bypassing `fga serve`. Intended for unauthenticated local servers (e.g.
 * a docker-compose OpenFGA instance with CORS configured) or for same-origin
 * embedding (playground served from the same host as the OpenFGA server).
 *
 * This adapter intentionally does NOT support API token or client
 * credentials auth — storing those in the browser is unsafe. Authenticated
 * servers must use `ProxyBackendAdapter` + `fga serve`.
 *
 * Single-server by design: `listServers()` returns exactly one synthetic
 * entry constructed from the `apiUrl` passed at construction time. Does not
 * implement `ConnectionManager`.
 */
export class DirectBackendAdapter implements BackendAdapter {
  readonly supports: AdapterCapabilities = {
    connectionManagement: false,
    writes: true,
  };

  readonly apiUrl: string;
  private _client: OpenFgaClient | null = null;
  private _axiosInstance: AxiosInstance | null = null;
  private _logIdCounter = 0;

  constructor(apiUrl: string) {
    this.apiUrl = apiUrl.replace(/\/$/, '');
  }

  async listServers(): Promise<ServerConfig[]> {
    // Return a single synthetic entry so the shell can treat all adapters
    // uniformly. The user never adds/removes servers with this adapter.
    return [
      {
        id: DIRECT_SERVER_ID,
        name: 'OpenFGA (direct)',
        apiUrl: this.apiUrl,
        auth: { method: CredentialsMethod.None },
        stores: [],
        capabilities: {
          storeCrud: true,
          storeList: true,
        },
      },
    ];
  }

  async listStores(_serverId: string): Promise<PublicStoreEntry[]> {
    // Call the OpenFGA ListStores API directly. For Direct mode there is no
    // config file — the authoritative store list lives on the upstream
    // OpenFGA server, so we query it on demand and follow pagination.
    const client = this.getClient('direct');
    const entries: PublicStoreEntry[] = [];
    let continuationToken: string | undefined;
    do {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const resp = await (client as any).listStores(
        continuationToken ? { continuationToken } : undefined,
      );
      const stores = (resp as { stores?: Array<{ id: string; name?: string }> }).stores ?? [];
      for (const s of stores) {
        entries.push({ storeId: s.id, alias: s.name });
      }
      continuationToken = (resp as { continuation_token?: string }).continuation_token;
    } while (continuationToken);
    return entries;
  }

  getClient(_serverId: string): OpenFgaClient {
    if (!this._client) {
      this._client = new OpenFgaClient(
        { apiUrl: this.apiUrl },
        this._getAxios(),
      );
    }
    return this._client;
  }

  // ---- API log interceptor (same pattern as ProxyBackendAdapter) ----

  private _getAxios(): AxiosInstance {
    if (this._axiosInstance) return this._axiosInstance;

    const instance = axios.create();

    instance.interceptors.request.use((config: InternalAxiosRequestConfig) => {
      (config as unknown as Record<string, unknown>)['_startTime'] = Date.now();
      return config;
    });

    const logResponse = (config: InternalAxiosRequestConfig, response: AxiosResponse | null, error?: unknown) => {
      const startTime = (config as unknown as Record<string, number>)['_startTime'] ?? Date.now();
      const now = Date.now();

      const fullUrl = config.url ?? '';
      // No proxy prefix to strip for direct calls — the URL is already the
      // real OpenFGA API path after the base URL.
      let apiPath = fullUrl;
      if (apiPath.startsWith(this.apiUrl)) apiPath = apiPath.slice(this.apiUrl.length);

      let path = apiPath;
      let query = '';
      const qIdx = apiPath.indexOf('?');
      if (qIdx >= 0) {
        path = apiPath.slice(0, qIdx);
        query = apiPath.slice(qIdx + 1);
      }

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
