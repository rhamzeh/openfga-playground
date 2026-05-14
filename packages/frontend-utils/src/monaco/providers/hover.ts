// SPDX-License-Identifier: Apache-2.0

import type * as Monaco from 'monaco-editor';
import { defaultDocumentationMap, type DocumentationMap } from '../../documentation/concepts.js';

function buildHoverContent(
  keyword: string,
  documentationMap: DocumentationMap,
): Monaco.IMarkdownString[] | undefined {
  const entry = documentationMap[keyword];
  if (!entry) return undefined;

  const parts: Monaco.IMarkdownString[] = [
    { value: '**Documentation**' },
    { value: entry.summary },
  ];
  if (entry.link) {
    parts.push({ value: `[Learn more](${entry.link})` });
  }
  return parts;
}

/**
 * Returns a Monaco hover provider that shows DSL documentation for recognized keywords.
 *
 * Pass a custom `documentationMap` to override or extend the built-in docs.
 */
export function providerHover(
  monaco: typeof Monaco,
  documentationMap: DocumentationMap = defaultDocumentationMap,
): Monaco.languages.HoverProvider['provideHover'] {
  return (model, position) => {
    const wordMeta = model.getWordAtPosition(position);
    if (!wordMeta) return undefined;

    const { startColumn, endColumn, word } = wordMeta;
    const contents = buildHoverContent(word, documentationMap);
    if (!contents) return undefined;

    return {
      range: new monaco.Range(position.lineNumber, startColumn, position.lineNumber, endColumn),
      contents,
    };
  };
}
