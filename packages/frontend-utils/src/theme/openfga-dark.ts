// SPDX-License-Identifier: Apache-2.0

import { OpenFgaDslThemeTokenType, type OpenFgaThemeConfiguration } from './types.js';

/**
 * The canonical OpenFGA dark theme.
 *
 * Color palette derived from the OpenFGA brand design system:
 *   - TYPE / MODULE / EXTEND / CONDITION: #79ED83 (green)
 *   - RELATION / CONDITION_PARAM:         #20F1F5 (cyan)
 *   - DIRECTLY_ASSIGNABLE:                #CEEC93 (lime)
 *   - KEYWORD:                            #AAAAAA (grey)
 *   - COMMENT:                            #737981 (muted grey)
 *   - DEFAULT:                            #FFFFFF (white)
 *   - Background:                         #141517
 */
export const openfgaDark: OpenFgaThemeConfiguration = {
  name: 'openfga-dark',
  baseTheme: 'vs-dark',
  background: {
    color: '#141517',
  },
  colors: {
    [OpenFgaDslThemeTokenType.DEFAULT]: '#FFFFFF',
    [OpenFgaDslThemeTokenType.COMMENT]: '#737981',
    [OpenFgaDslThemeTokenType.KEYWORD]: '#AAAAAA',
    [OpenFgaDslThemeTokenType.MODULE]: '#79ED83',
    [OpenFgaDslThemeTokenType.EXTEND]: '#79ED83',
    [OpenFgaDslThemeTokenType.TYPE]: '#79ED83',
    [OpenFgaDslThemeTokenType.RELATION]: '#20F1F5',
    [OpenFgaDslThemeTokenType.DIRECTLY_ASSIGNABLE]: '#CEEC93',
    [OpenFgaDslThemeTokenType.CONDITION]: '#79ED83',
    [OpenFgaDslThemeTokenType.CONDITION_PARAM]: '#20F1F5',
    [OpenFgaDslThemeTokenType.CONDITION_PARAM_TYPE]: '#AAAAAA',
  },
  styles: {},
};
