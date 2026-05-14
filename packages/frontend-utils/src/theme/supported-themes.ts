// SPDX-License-Identifier: Apache-2.0

import { SupportedTheme, type OpenFgaThemeConfiguration } from './types.js';
import { openfgaDark } from './openfga-dark.js';
import { openfgaLight } from './openfga-light.js';

export const supportedThemes: Record<SupportedTheme, OpenFgaThemeConfiguration> = {
  [SupportedTheme.OpenFgaDark]: openfgaDark,
  [SupportedTheme.OpenFgaLight]: openfgaLight,
};
