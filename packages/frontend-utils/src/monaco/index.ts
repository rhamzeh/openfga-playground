// SPDX-License-Identifier: Apache-2.0

export { registerDSL } from './register.js';
export type { RegisterDSLOptions } from './register.js';
export { validateDSL } from './validate.js';
export type { MarkerWithExtra } from './validate.js';
export { buildMonacoTheme, monacoThemes } from './theme.js';
export { getLanguageConfiguration, language } from './language-definition.js';
export { providerHover } from './providers/hover.js';
export { provideCompletionItems } from './providers/completion.js';
export type { CompletionOptions } from './providers/completion.js';
export { provideCodeActions } from './providers/code-actions.js';

import { LANGUAGE_NAME } from '../constants/index.js';
import { registerDSL } from './register.js';
import { monacoThemes, buildMonacoTheme } from './theme.js';
import { validateDSL } from './validate.js';
import * as languageDefinition from './language-definition.js';

/**
 * `MonacoExtensions` — backward-compatible namespace object matching the
 * `@openfga/frontend-utils` v0.2 API used by model-editor and model-diff.
 */
export const MonacoExtensions = {
  LANGUAGE_NAME,
  registerDSL,
  monacoThemes,
  buildMonacoTheme,
  validateDSL,
  languageDefinition,
};
