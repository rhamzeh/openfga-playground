// SPDX-License-Identifier: Apache-2.0

/**
 * OpenFGA DSL Monarch tokenizer and language configuration for Monaco.
 *
 * The tokenizer is structured to match DSL patterns in priority order.
 * Complex patterns (schema version, type declarations, define statements)
 * are matched before simpler identifier fallbacks.
 */

import type * as Monaco from 'monaco-editor';
import { LANGUAGE_NAME, Keyword } from '../constants/index.js';
import { OpenFgaDslThemeToken } from '../theme/types.js';

export function getLanguageConfiguration(monaco: typeof Monaco): Monaco.languages.LanguageConfiguration {
  return {
    comments: {
      lineComment: '#',
    },
    brackets: [
      ['[', ']'],
      ['(', ')'],
      ['{', '}'],
    ],
    autoClosingPairs: [
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '{', close: '}' },
    ],
    surroundingPairs: [
      { open: '[', close: ']' },
      { open: '(', close: ')' },
    ],
    onEnterRules: [
      {
        beforeText: /^\s*(?:type|relations|model|define).*?:\s*$/,
        action: { indentAction: monaco.languages.IndentAction.Indent },
      },
    ],
    folding: {
      offSide: true,
      markers: {
        start: /^\s*#region\b/,
        end: /^\s*#endregion\b/,
      },
    },
  };
}

export const language: Monaco.languages.IMonarchLanguage = {
  defaultToken: '',
  tokenPostfix: `.${LANGUAGE_NAME}`,
  keywords: [],
  operators: [],
  identifiers: /(?!self)(?:\w|-[a-zA-Z])*/,
  brackets: [
    { open: '[', close: ']', token: OpenFgaDslThemeToken.DELIMITER_BRACKET_TYPE_RESTRICTIONS },
    { open: '(', close: ')', token: OpenFgaDslThemeToken.DELIMITER_BRACKET_RELATION_DEFINITION },
    { open: '{', close: '}', token: OpenFgaDslThemeToken.DELIMITER_BRACKET_CONDITION_EXPRESSION },
  ],
  tokenizer: {
    root: [
      { include: '@comment' },
      { include: '@whitespace' },
      [/(\[)/, '@brackets', '@restrictions'],
      [/(\{)/, '@brackets', '@cel_symbols'],
      [/[{}[\]()]/, '@brackets'],
      [
        /(schema)(\s+)(\d\.\d)/,
        [OpenFgaDslThemeToken.KEYWORD_SCHEMA, '@whitespace', OpenFgaDslThemeToken.VALUE_SCHEMA],
      ],
      [
        /(module)(\s+)(@identifiers)/,
        [OpenFgaDslThemeToken.KEYWORD_MODULE, '@whitespace', OpenFgaDslThemeToken.VALUE_MODULE],
      ],
      [
        /(extend)(\s+)(type)(\s+)(@identifiers)/,
        [
          OpenFgaDslThemeToken.KEYWORD_EXTEND,
          '@whitespace',
          OpenFgaDslThemeToken.KEYWORD_TYPE,
          '@whitespace',
          OpenFgaDslThemeToken.VALUE_TYPE_NAME,
        ],
      ],
      [
        /(type)(\s+)(@identifiers)/,
        [OpenFgaDslThemeToken.KEYWORD_TYPE, '@whitespace', OpenFgaDslThemeToken.VALUE_TYPE_NAME],
      ],
      [
        /(define)(\s+)(@identifiers)/,
        [OpenFgaDslThemeToken.KEYWORD_DEFINE, '@whitespace', OpenFgaDslThemeToken.VALUE_RELATION_NAME],
      ],
      [
        /(or)(\s+)(@identifiers)/,
        [OpenFgaDslThemeToken.OPERATOR_OR, '@whitespace', OpenFgaDslThemeToken.VALUE_RELATION_COMPUTED],
      ],
      [
        /(and)(\s+)(@identifiers)/,
        [OpenFgaDslThemeToken.OPERATOR_AND, '@whitespace', OpenFgaDslThemeToken.VALUE_RELATION_COMPUTED],
      ],
      [
        /(but not)(\s+)(@identifiers)/,
        [OpenFgaDslThemeToken.OPERATOR_BUT_NOT, '@whitespace', OpenFgaDslThemeToken.VALUE_RELATION_COMPUTED],
      ],
      [
        /(as)(\s+)(@identifiers)/,
        [OpenFgaDslThemeToken.KEYWORD_AS, '@whitespace', OpenFgaDslThemeToken.VALUE_RELATION_COMPUTED],
      ],
      [
        /(:)(\s+)(@identifiers)/,
        [OpenFgaDslThemeToken.DELIMITER_DEFINE_COLON, '@whitespace', OpenFgaDslThemeToken.VALUE_RELATION_COMPUTED],
      ],
      [
        /(@identifiers)(\s+)(from)(\s+)(@identifiers)/,
        [
          OpenFgaDslThemeToken.VALUE_RELATION_TUPLE_TO_USERSET_COMPUTED,
          '@whitespace',
          OpenFgaDslThemeToken.KEYWORD_FROM,
          '@whitespace',
          OpenFgaDslThemeToken.VALUE_RELATION_TUPLE_TO_USERSET_TUPLESET,
        ],
      ],
      // Condition parameter with generic type: paramName: list<type>,
      [
        /(@identifiers)(\s*)(:)(\s*)(@identifiers)(<@identifiers>)(,?)(\s*)/,
        [
          OpenFgaDslThemeToken.CONDITION_PARAM,
          '@whitespace',
          OpenFgaDslThemeToken.DELIMITER_COLON_CONDITION_PARAM,
          '@whitespace',
          OpenFgaDslThemeToken.CONDITION_PARAM_TYPE,
          OpenFgaDslThemeToken.CONDITION_PARAM_TYPE,
          OpenFgaDslThemeToken.DELIMITER_COMMA_CONDITION_PARAM,
          '@whitespace',
        ],
      ],
      // Condition parameter with simple type: paramName: type,
      [
        /(@identifiers)(\s*)(:)(\s*)(@identifiers)(,?)(\s*)/,
        [
          OpenFgaDslThemeToken.CONDITION_PARAM,
          '@whitespace',
          OpenFgaDslThemeToken.DELIMITER_COLON_CONDITION_PARAM,
          '@whitespace',
          OpenFgaDslThemeToken.CONDITION_PARAM_TYPE,
          OpenFgaDslThemeToken.DELIMITER_COMMA_CONDITION_PARAM,
          '@whitespace',
        ],
      ],
      // Condition block header: condition name(...)
      [
        /(condition)(\s*)(@identifiers)(\s*)(\()/,
        [
          OpenFgaDslThemeToken.KEYWORD_CONDITION,
          '@whitespace',
          OpenFgaDslThemeToken.VALUE_CONDITION,
          '@whitespace',
          '@brackets',
        ],
      ],
      [':', OpenFgaDslThemeToken.DELIMITER_DEFINE_COLON],
      [',', OpenFgaDslThemeToken.DELIMITER_COMMA_TYPE_RESTRICTIONS],
      [Keyword.BUT_NOT, OpenFgaDslThemeToken.OPERATOR_BUT_NOT],
      [Keyword.SELF, OpenFgaDslThemeToken.KEYWORD_SELF],
      [
        /@identifiers/,
        {
          cases: {
            [Keyword.AND]: OpenFgaDslThemeToken.OPERATOR_AND,
            [Keyword.OR]: OpenFgaDslThemeToken.OPERATOR_OR,
            [Keyword.TYPE]: OpenFgaDslThemeToken.KEYWORD_TYPE,
            [Keyword.RELATIONS]: OpenFgaDslThemeToken.KEYWORD_RELATIONS,
            [Keyword.DEFINE]: OpenFgaDslThemeToken.KEYWORD_DEFINE,
            [Keyword.FROM]: OpenFgaDslThemeToken.KEYWORD_FROM,
            [Keyword.WITH]: OpenFgaDslThemeToken.KEYWORD_WITH,
            [Keyword.CONDITION]: OpenFgaDslThemeToken.KEYWORD_CONDITION,
            [Keyword.AS]: OpenFgaDslThemeToken.KEYWORD_AS,
            [Keyword.MODEL]: OpenFgaDslThemeToken.KEYWORD_MODEL,
            [Keyword.SCHEMA]: { token: OpenFgaDslThemeToken.KEYWORD_SCHEMA },
            '@default': OpenFgaDslThemeToken.VALUE_RELATION_TUPLE_TO_USERSET_TUPLESET,
          },
        },
      ],
    ],
    cel_symbols: [
      [/"/, 'string', '@string_double'],
      [/'/, 'string', '@string_single'],
      [/(\w|-[a-zA-Z])+/, OpenFgaDslThemeToken.CONDITION_SYMBOL],
      [/(<|<=|>=|>|=|!=|&&|\|\||\.|null|in)/, OpenFgaDslThemeToken.CONDITION_SYMBOL],
      [/\[|\]|\(|\)/, '@brackets'],
      [/\}/, '@brackets', '@pop'],
    ],
    string_double: [
      [/[^\\"]+/, 'string'],
      [/\\./, 'string.escape.invalid'],
      [/"/, 'string', '@pop'],
    ],
    string_single: [
      [/[^\\']+/, 'string'],
      [/\\./, 'string.escape.invalid'],
      [/'/, 'string', '@pop'],
    ],
    restrictions: [
      { include: '@whitespace' },
      [new RegExp(`${Keyword.WITH}`), OpenFgaDslThemeToken.KEYWORD_WITH],
      [/(\w|-[a-zA-Z])+/, OpenFgaDslThemeToken.VALUE_TYPE_RESTRICTIONS_TYPE],
      [
        /(:)(\*)/,
        [OpenFgaDslThemeToken.DELIMITER_COLON_TYPE_RESTRICTIONS, OpenFgaDslThemeToken.VALUE_TYPE_RESTRICTIONS_WILDCARD],
      ],
      [/#/, OpenFgaDslThemeToken.DELIMITER_HASHTAG_TYPE_RESTRICTIONS],
      [/,/, OpenFgaDslThemeToken.DELIMITER_COMMA_TYPE_RESTRICTIONS],
      [/\]/, '@brackets', '@pop'],
    ],
    whitespace: [[/\s+/, 'white']],
    comment: [
      [/\s+(#.*)/, OpenFgaDslThemeToken.COMMENT],
      [/^\s*(#.*)/, OpenFgaDslThemeToken.COMMENT],
    ],
  },
};
