// SPDX-License-Identifier: Apache-2.0

import type * as Monaco from 'monaco-editor';
import { LANGUAGE_NAME, SchemaVersion } from '../constants/index.js';
import { getLanguageConfiguration, language } from './language-definition.js';
import { providerHover } from './providers/hover.js';
import { provideCompletionItems } from './providers/completion.js';
import { provideCodeActions } from './providers/code-actions.js';
import type { DocumentationMap } from '../documentation/concepts.js';

export interface RegisterDSLOptions {
  documentationMap?: DocumentationMap;
}

/**
 * Register the OpenFGA DSL language with Monaco. Safe to call multiple times —
 * subsequent calls are no-ops if the language is already registered.
 *
 * Must be called before creating any Monaco editor or diff editor that uses
 * the DSL language (i.e. before `monaco.editor.create()` / `createDiffEditor()`).
 */
export function registerDSL(
  monaco: typeof Monaco,
  schemaVersion: SchemaVersion = SchemaVersion.OneDotOne,
  options: RegisterDSLOptions = {},
): void {
  const already = monaco.languages.getLanguages().some((l) => l.id === LANGUAGE_NAME);
  if (already) return;

  monaco.languages.register({ id: LANGUAGE_NAME });
  monaco.languages.setLanguageConfiguration(LANGUAGE_NAME, getLanguageConfiguration(monaco));
  monaco.languages.setMonarchTokensProvider(LANGUAGE_NAME, language);

  monaco.languages.registerHoverProvider(LANGUAGE_NAME, {
    provideHover: providerHover(monaco, options.documentationMap),
  });

  monaco.languages.registerCompletionItemProvider(LANGUAGE_NAME, {
    provideCompletionItems: provideCompletionItems(monaco, schemaVersion),
  });

  monaco.languages.registerCodeActionProvider(LANGUAGE_NAME, {
    provideCodeActions: provideCodeActions(monaco, schemaVersion),
  });
}
