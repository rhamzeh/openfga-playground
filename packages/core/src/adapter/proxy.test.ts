// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProxyBackendAdapter } from './proxy.js';

const BASE_URL = 'http://localhost:8880';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
}

const SERVER_FIXTURE = {
  id: 'local',
  name: 'Local',
  apiUrl: 'http://localhost:8080',
  auth: { method: 'none' as const },
  stores: [],
  capabilities: { storeCrud: true, storeList: true },
};

describe('ProxyBackendAdapter', () => {
  let adapter: ProxyBackendAdapter;

  beforeEach(() => {
    adapter = new ProxyBackendAdapter(BASE_URL);
    mockFetch.mockReset();
  });

  describe('listServers', () => {
    it('fetches GET /servers and returns server list', async () => {
      mockFetch.mockReturnValue(jsonResponse([SERVER_FIXTURE]));

      const result = await adapter.listServers();

      expect(mockFetch).toHaveBeenCalledWith(`${BASE_URL}/servers`, expect.objectContaining({ headers: {} }));
      expect(result).toEqual([SERVER_FIXTURE]);
    });

    it('throws on non-ok response', async () => {
      mockFetch.mockReturnValue(Promise.resolve(new Response(null, { status: 500, statusText: 'Internal Server Error' })));
      await expect(adapter.listServers()).rejects.toThrow('Failed to list servers');
    });
  });

  describe('createServer', () => {
    it('POSTs to /servers with the server payload', async () => {
      const newServer = { name: 'Local', apiUrl: 'http://localhost:8080' };
      mockFetch.mockReturnValue(jsonResponse(SERVER_FIXTURE));

      const result = await adapter.createServer(newServer);

      expect(mockFetch).toHaveBeenCalledWith(`${BASE_URL}/servers`, expect.objectContaining({ method: 'POST' }));
      expect(result).toEqual(SERVER_FIXTURE);
    });
  });

  describe('updateServer', () => {
    it('PUTs to /servers/:id', async () => {
      mockFetch.mockReturnValue(jsonResponse({ ...SERVER_FIXTURE, name: 'Updated' }));

      await adapter.updateServer('local', { name: 'Updated' });

      expect(mockFetch).toHaveBeenCalledWith(
        `${BASE_URL}/servers/local`,
        expect.objectContaining({ method: 'PUT' }),
      );
    });
  });

  describe('deleteServer', () => {
    it('DELETEs /servers/:id', async () => {
      mockFetch.mockReturnValue(Promise.resolve(new Response(null, { status: 204 })));

      await adapter.deleteServer('local');

      expect(mockFetch).toHaveBeenCalledWith(
        `${BASE_URL}/servers/local`,
        expect.objectContaining({ method: 'DELETE' }),
      );
    });
  });

  describe('addStore', () => {
    it('POSTs to /servers/:id/stores', async () => {
      const store = { storeId: '01HX', alias: 'Test' };
      mockFetch.mockReturnValue(jsonResponse(store));

      await adapter.addStore('local', store);

      expect(mockFetch).toHaveBeenCalledWith(
        `${BASE_URL}/servers/local/stores`,
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });

  describe('removeStore', () => {
    it('DELETEs /servers/:id/stores/:storeId', async () => {
      mockFetch.mockReturnValue(Promise.resolve(new Response(null, { status: 204 })));

      await adapter.removeStore('local', '01HX');

      expect(mockFetch).toHaveBeenCalledWith(
        `${BASE_URL}/servers/local/stores/01HX`,
        expect.objectContaining({ method: 'DELETE' }),
      );
    });
  });

  describe('getClient', () => {
    it('returns an OpenFgaClient with the proxy apiUrl', () => {
      const client = adapter.getClient('my-server');
      expect(client).toBeDefined();
    });

    it('returns the same client instance for the same serverId (cached)', () => {
      const client1 = adapter.getClient('my-server');
      const client2 = adapter.getClient('my-server');
      expect(client1).toBe(client2);
    });

    it('returns different client instances for different serverIds', () => {
      const client1 = adapter.getClient('server-a');
      const client2 = adapter.getClient('server-b');
      expect(client1).not.toBe(client2);
    });
  });
});
