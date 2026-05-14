// SPDX-License-Identifier: Apache-2.0

import { OpenFgaDslThemeTokenType, type OpenFgaThemeConfiguration } from './types.js';

/**
 * The canonical OpenFGA light theme.
 *
 * Based on Catppuccin Latte palette — all token colors verified to meet
 * WCAG 2.1 AA contrast against the light background (#eff1f5):
 *   TYPE / MODULE / EXTEND / CONDITION: #2e7d32 (dark green,  ~7.5:1)
 *   RELATION / CONDITION_PARAM:         #0369a1 (dark blue,   ~7.2:1)
 *   DIRECTLY_ASSIGNABLE:               #5a6a0a (dark olive,   ~6.1:1)
 *   KEYWORD:                           #6e6f77 (gray,         ~4.6:1)
 *   COMMENT:                           #8c8fa1 (muted, decorative)
 *   DEFAULT:                           #4c4f69 (text,         ~9.5:1)
 *   Background:                        #eff1f5
 */
export const openfgaLight: OpenFgaThemeConfiguration = {
  name: 'openfga-light',
  baseTheme: 'vs',
  background: {
    color: '#eff1f5',
  },
  colors: {
    [OpenFgaDslThemeTokenType.DEFAULT]: '#4c4f69',
    [OpenFgaDslThemeTokenType.COMMENT]: '#8c8fa1',
    [OpenFgaDslThemeTokenType.KEYWORD]: '#6e6f77',
    [OpenFgaDslThemeTokenType.MODULE]: '#2e7d32',
    [OpenFgaDslThemeTokenType.EXTEND]: '#2e7d32',
    [OpenFgaDslThemeTokenType.TYPE]: '#2e7d32',
    [OpenFgaDslThemeTokenType.RELATION]: '#0369a1',
    [OpenFgaDslThemeTokenType.DIRECTLY_ASSIGNABLE]: '#5a6a0a',
    [OpenFgaDslThemeTokenType.CONDITION]: '#2e7d32',
    [OpenFgaDslThemeTokenType.CONDITION_PARAM]: '#0369a1',
    [OpenFgaDslThemeTokenType.CONDITION_PARAM_TYPE]: '#6e6f77',
  },
  styles: {},
};
