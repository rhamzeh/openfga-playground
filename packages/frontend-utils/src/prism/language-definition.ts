// SPDX-License-Identifier: Apache-2.0

import { OpenFgaDslThemeTokenType } from '../theme/types.js';

/**
 * Prism.js grammar definition for the OpenFGA DSL.
 * Used by Docusaurus and other documentation sites that integrate Prism for
 * syntax highlighting in code blocks.
 *
 * Register with:
 * ```js
 * import Prism from 'prismjs';
 * Prism.languages['openfga'] = languageDefinition;
 * ```
 */
export const languageDefinition: Record<string, unknown> = {
  [OpenFgaDslThemeTokenType.MODULE]: {
    pattern: /(module\s+)[\w_-]+/i,
    lookbehind: true,
  },
  [OpenFgaDslThemeTokenType.TYPE]: {
    pattern: /(\btype\s+)[\w_-]+/i,
    lookbehind: true,
  },
  [OpenFgaDslThemeTokenType.EXTEND]: {
    pattern: /(\bextend type\s+)[\w_-]+/i,
    lookbehind: true,
  },
  [OpenFgaDslThemeTokenType.RELATION]: {
    pattern: /(\bdefine\s+)[\w_-]+/i,
    lookbehind: true,
  },
  [OpenFgaDslThemeTokenType.DIRECTLY_ASSIGNABLE]: /\[.*]|self/,
  [OpenFgaDslThemeTokenType.CONDITION]: {
    pattern: /(\bcondition\s+)[\w_-]+/i,
    lookbehind: true,
  },
  'condition-params': {
    pattern: /\(.*\)\s*\{/,
    inside: {
      [OpenFgaDslThemeTokenType.CONDITION_PARAM]: /\b([\w_-]+)\s*:/i,
      [OpenFgaDslThemeTokenType.CONDITION_PARAM_TYPE]:
        /\b(string|int|map|uint|list|timestamp|bool|duration|double|ipaddress)\b/,
    },
  },
  [OpenFgaDslThemeTokenType.COMMENT]: {
    pattern: /(^\s*|\s+)#.*/,
  },
  [OpenFgaDslThemeTokenType.KEYWORD]: {
    pattern:
      /\b(type|relations|define|and|or|but not|from|as|model|schema|condition|module|extend)\b/,
  },
};
