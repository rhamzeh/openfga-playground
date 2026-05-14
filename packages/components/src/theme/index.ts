// SPDX-License-Identifier: Apache-2.0

/**
 * Theme subpath export entry.
 *
 * Usage:
 *   import '@openfga/playground-components/theme';
 *
 * Then apply a theme class to a container element:
 *   <div class="openfga-dark">...</div>    <!-- default -->
 *   <div class="openfga-light">...</div>   <!-- light theme -->
 */

// CSS imports are handled by the bundler / consumer.
// This module re-exports the theme class name constants for convenience.

export const THEME_DARK = 'openfga-dark' as const;
export const THEME_LIGHT = 'openfga-light' as const;

export type ThemeClass = typeof THEME_DARK | typeof THEME_LIGHT;
