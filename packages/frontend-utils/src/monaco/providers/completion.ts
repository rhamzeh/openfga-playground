// SPDX-License-Identifier: Apache-2.0

import type * as Monaco from 'monaco-editor';
import { transformer } from '@openfga/syntax-transformer';
import { Keyword, SINGLE_INDENTATION, SchemaVersion } from '../../constants/index.js';

export interface CompletionOptions {
  /** Bundled sample models keyed by name. Used to generate sample snippets. */
  samples?: Record<string, { type_definitions: unknown[] }>;
}

function getSampleSuggestions(
  monaco: typeof Monaco,
  range: Monaco.IRange,
  schemaVersion: SchemaVersion,
  samples: CompletionOptions['samples'] = {},
): Monaco.languages.CompletionItem[] {
  const sampleKeys = ['entitlements', 'expenses', 'gdrive', 'generic', 'github', 'iot', 'slack', 'customRoles'] as const;
  const suggestions: Monaco.languages.CompletionItem[] = [];

  for (const key of sampleKeys) {
    const sampleModel = samples[key];
    if (!sampleModel) continue;

    const modelForTransform =
      schemaVersion === SchemaVersion.OneDotOne || schemaVersion === SchemaVersion.OneDotTwo
        ? sampleModel
        : {
            schema_version: SchemaVersion.OneDotZero,
            type_definitions: sampleModel.type_definitions.map((td: unknown) => {
              const t = td as { type: string; relations: unknown };
              return { type: t.type, relations: t.relations };
            }),
          };

    suggestions.push({
      label: `sample-${key}`,
      kind: monaco.languages.CompletionItemKind.Struct,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      insertText: transformer.transformJSONToDSL(modelForTransform as any),
      range,
    });
  }
  return suggestions;
}

function provideCompletionItemsOneDotOne(
  monaco: typeof Monaco,
  options: CompletionOptions = {},
): Monaco.languages.CompletionItemProvider['provideCompletionItems'] {
  return (model, position) => {
    const word = model.getWordUntilPosition(position);
    const range: Monaco.IRange = {
      startLineNumber: position.lineNumber,
      endLineNumber: position.lineNumber,
      startColumn: word.startColumn,
      endColumn: word.endColumn,
    };
    const I = SINGLE_INDENTATION;
    let suggestions: Monaco.languages.CompletionItem[];

    if (position.column === 2) {
      suggestions = [
        {
          label: Keyword.TYPE,
          kind: monaco.languages.CompletionItemKind.Function,
          insertText: `${Keyword.TYPE} \${1:typeName}\n${I}${Keyword.RELATIONS}\n${I}${I}${Keyword.DEFINE} \${2:relationName}: [\${3:typeName}]`,
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range,
        },
        {
          label: 'type_group',
          kind: monaco.languages.CompletionItemKind.Function,
          insertText: `${Keyword.TYPE} \${1:group}\n${I}${Keyword.RELATIONS}\n${I}${I}${Keyword.DEFINE} \${2:member}: [\${3:user, group#member}]`,
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range,
        },
        {
          label: Keyword.TYPE,
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: Keyword.TYPE,
          range,
        },
        {
          label: Keyword.MODEL,
          kind: monaco.languages.CompletionItemKind.Function,
          insertText: `${Keyword.MODEL}\n${I}${Keyword.SCHEMA} \${1:1.1}`,
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range,
        },
        {
          label: Keyword.MODEL,
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: Keyword.MODEL,
          range,
        },
        {
          label: Keyword.CONDITION,
          kind: monaco.languages.CompletionItemKind.Function,
          insertText: `${Keyword.CONDITION} \${1:conditionName}(\${2:parameterName}: \${3:string}) {\n  \${4}\n}`,
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range,
        },
      ];
    } else if (position.column === 4) {
      suggestions = [
        {
          label: Keyword.RELATIONS,
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: Keyword.RELATIONS,
          range,
        },
      ];
    } else if (position.column === 6) {
      suggestions = [
        {
          label: 'define-assignable',
          kind: monaco.languages.CompletionItemKind.Function,
          insertText: 'define ${1:relationName}: [${2:typeName}]',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range,
        },
        {
          label: 'define-from-other-relation',
          kind: monaco.languages.CompletionItemKind.Function,
          insertText: 'define ${1:relationName}: ${2:otherRelationName}',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range,
        },
        {
          label: 'define-from-other-relation-assignable',
          kind: monaco.languages.CompletionItemKind.Function,
          insertText: 'define ${1:relationName}: [${2:typeName}] or ${3:otherRelationName}',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range,
        },
        {
          label: 'define-from-object',
          kind: monaco.languages.CompletionItemKind.Function,
          insertText: 'define ${1:relationName}: ${2:relationInRelatedObject} from ${3:relationInThisType}}',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range,
        },
        {
          label: 'define',
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: 'define',
          range,
        },
      ];
    } else if (position.column > 6) {
      suggestions = [
        {
          label: Keyword.OR,
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: Keyword.OR,
          range,
        },
        {
          label: Keyword.AND,
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: Keyword.AND,
          range,
        },
        {
          label: Keyword.BUT_NOT,
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: Keyword.BUT_NOT,
          range,
        },
        {
          label: Keyword.FROM,
          kind: monaco.languages.CompletionItemKind.Function,
          insertText: `\${1:relation1} ${Keyword.FROM} \${2:relation2}`,
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range,
        },
        {
          label: Keyword.FROM,
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: Keyword.FROM,
          range,
        },
        {
          label: Keyword.CONDITION,
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: Keyword.CONDITION,
          range,
        },
      ];
    } else {
      suggestions = getSampleSuggestions(monaco, range, SchemaVersion.OneDotOne, options.samples);
    }

    return { suggestions };
  };
}

/**
 * Returns a Monaco completion item provider for the OpenFGA DSL.
 * Completions are context-sensitive based on column indentation level.
 */
export function provideCompletionItems(
  monaco: typeof Monaco,
  schemaVersion: SchemaVersion = SchemaVersion.OneDotOne,
  options: CompletionOptions = {},
): Monaco.languages.CompletionItemProvider['provideCompletionItems'] {
  switch (schemaVersion) {
    case SchemaVersion.OneDotTwo:
    case SchemaVersion.OneDotOne:
      return provideCompletionItemsOneDotOne(monaco, options);
    case SchemaVersion.OneDotZero:
      throw new Error('Schema version 1.0 is no longer supported');
  }
}
