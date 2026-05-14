// SPDX-License-Identifier: Apache-2.0

/**
 * @openfga/frontend-utils
 *
 * Monaco language integration, theming, and graph utilities for OpenFGA UIs.
 *
 * Named namespace exports preserve backward compatibility with the previous
 * external `@openfga/frontend-utils@0.2.x` API:
 *
 *   import { constants, theming, tools } from '@openfga/frontend-utils';
 *   constants.LANGUAGE_NAME          // 'dsl.openfga'
 *   theming.SupportedTheme.OpenFgaDark
 *   tools.MonacoExtensions.registerDSL(monaco, schemaVersion, opts)
 */

export * as constants from './constants/index.js';
export * as theming from './theme/index.js';
export * as tools from './tools/index.js';
export * as graphBuilder from './graph/index.js';
export { sampleAuthorizationModels } from './samples/index.js';
