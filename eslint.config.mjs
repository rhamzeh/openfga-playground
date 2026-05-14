// SPDX-License-Identifier: Apache-2.0
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import litPlugin from 'eslint-plugin-lit';

export default [
  {
    ignores: ['**/dist/**', '**/node_modules/**', '**/storybook-static/**'],
  },
  {
    files: ['packages/**/*.ts'],
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: false,
      },
    },
    rules: {
      ...tsPlugin.configs['recommended'].rules,
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['packages/**/src/**/*.ts'],
    ignores: ['**/*.test.ts', '**/*.stories.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ['packages/components/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          name: '@openfga/playground-core',
          message:
            'Components must not import from core. Receive data via properties and emit CustomEvents.',
        },
      ],
    },
  },
  {
    files: ['packages/components/**/*.ts', 'packages/playground/**/*.ts'],
    plugins: {
      lit: litPlugin,
    },
    rules: {
      ...litPlugin.configs.recommended.rules,
    },
  },
  {
    // core package: no DOM APIs
    files: ['packages/core/**/*.ts'],
    rules: {
      'no-restricted-globals': [
        'error',
        { name: 'document', message: 'core package must not use DOM APIs' },
        { name: 'window', message: 'core package must not use DOM APIs' },
      ],
    },
  },
];
