// SPDX-License-Identifier: Apache-2.0

import type * as Monaco from 'monaco-editor';
import { LANGUAGE_NAME } from '../constants/index.js';
import { OpenFgaDslThemeToken, SupportedTheme, type OpenFgaThemeConfiguration } from '../theme/types.js';
import { supportedThemes } from '../theme/supported-themes.js';
import { getThemeTokenStyle } from '../theme/utils.js';

/**
 * Convert an OpenFgaThemeConfiguration into a Monaco IStandaloneThemeData object
 * ready to pass to `monaco.editor.defineTheme()`.
 */
export function buildMonacoTheme(themeConfig: OpenFgaThemeConfiguration): Monaco.editor.IStandaloneThemeData {
  return {
    base: themeConfig.baseTheme ?? 'vs',
    inherit: true,
    colors: {
      'editor.background': themeConfig.background.color,
    },
    rules: Object.values(OpenFgaDslThemeToken).map((token) => {
      const style = getThemeTokenStyle(token, themeConfig);
      return {
        token: `${token}.${LANGUAGE_NAME}`,
        ...style,
      };
    }),
  };
}

/** Pre-built Monaco theme data for all supported themes, keyed by SupportedTheme. */
export const monacoThemes: Record<SupportedTheme, Monaco.editor.IStandaloneThemeData> = Object.fromEntries(
  Object.values(SupportedTheme).map((name) => [name, buildMonacoTheme(supportedThemes[name])]),
) as Record<SupportedTheme, Monaco.editor.IStandaloneThemeData>;
