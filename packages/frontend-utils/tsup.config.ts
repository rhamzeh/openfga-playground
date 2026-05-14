// SPDX-License-Identifier: Apache-2.0
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'constants/index': 'src/constants/index.ts',
    'theme/index': 'src/theme/index.ts',
    'monaco/index': 'src/monaco/index.ts',
    'documentation/index': 'src/documentation/index.ts',
    'prism/index': 'src/prism/index.ts',
    'graph/index': 'src/graph/index.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  // monaco-editor is optional peer dep — keep it external
  external: ['monaco-editor'],
});
