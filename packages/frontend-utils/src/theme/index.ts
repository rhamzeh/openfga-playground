// SPDX-License-Identifier: Apache-2.0

export {
  OpenFgaDslThemeTokenType,
  OpenFgaDslThemeToken,
  SupportedTheme,
} from './types.js';
export type { OpenFgaThemeConfiguration } from './types.js';
export { getThemeTokenStyle } from './utils.js';
export type { TokenStyle } from './utils.js';
export { openfgaDark } from './openfga-dark.js';

/** All built-in theme configurations keyed by SupportedTheme. */
export { supportedThemes } from './supported-themes.js';
