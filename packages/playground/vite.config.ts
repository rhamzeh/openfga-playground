// SPDX-License-Identifier: Apache-2.0
import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => ({
  define: {
    // In dev mode the playground runs on a different port (5173) from fga serve
    // (8880), so API calls need an absolute URL. In production the playground
    // is served by fga serve itself, so same-origin relative paths work.
    __FGA_API_URL__: JSON.stringify(
      mode === 'development' ? 'http://localhost:8880' : '',
    ),
  },
  server: {
    port: 5173,
    headers: {
      // Allow Monaco Web Workers. Vite serves them from @fs/ (node_modules),
      // so 'self' alone isn't enough — use blob: for the bundled worker chunks.
      'Content-Security-Policy': [
        "default-src 'self'",
        "script-src 'self' 'unsafe-eval'",   // unsafe-eval needed by Monaco
        "worker-src 'self' blob:",
        "style-src 'self' 'unsafe-inline'",  // Shadow DOM inline styles
        "font-src 'self' data:",             // Monaco icon font
        "img-src 'self' data:",
        "connect-src *",  // arbitrary user-chosen backend (proxy, direct, WASM) + sample stores
      ].join('; '),
    },
  },
  build: {
    outDir: 'dist',
    target: 'es2022',
  },
  optimizeDeps: {
    include: ['monaco-editor'],
  },
}));
