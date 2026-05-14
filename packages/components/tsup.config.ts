// SPDX-License-Identifier: Apache-2.0
import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: {
      index: 'src/index.ts',
      'model-editor/index': 'src/model-editor/index.ts',
      'model-graph/index': 'src/model-graph/index.ts',
      'model-diff/index': 'src/model-diff/index.ts',
      'tuple-manager/index': 'src/tuple-manager/index.ts',
      'assertion-runner/index': 'src/assertion-runner/index.ts',
      'resolution-path/index': 'src/resolution-path/index.ts',
      'connection-config/index': 'src/connection-config/index.ts',
      'theme/index': 'src/theme/index.ts',
      'changelog/index': 'src/changelog/index.ts',
      'query-runner/index': 'src/query-runner/index.ts',
      'relationship-graph/index': 'src/relationship-graph/index.ts',
      'dev-console/index': 'src/dev-console/index.ts',
    },
    format: ['esm', 'cjs'],
    dts: true,
    clean: true,
    sourcemap: true,
    // monaco-editor and cytoscape are externalized to allow tree-shaking
    // per-subpath and to avoid bundling them multiple times
    external: ['monaco-editor', 'cytoscape', 'cytoscape-dagre', '@openfga/frontend-utils'],
  },
]);
