// SPDX-License-Identifier: Apache-2.0

/**
 * Bridges @openfga/frontend-utils Monaco theme colors to the graph CSS
 * custom properties consumed by <openfga-model-graph>.
 *
 * Call applyGraphTheme(theme, element) once at startup. The element is
 * typically document.documentElement so all graph instances inherit the
 * variables. Third-party consumers (e.g. Auth0 FGA Dashboard) call this
 * with their own theme to keep graph node colors in sync with the DSL
 * syntax colors without any additional configuration.
 *
 * Node background colors are derived by alpha-blending the foreground
 * color at 12% opacity over the theme's background color.
 */

type ThemeConfiguration = {
  background: { color: string };
  colors: Record<string, string>;
};

/** Alpha-blend `fg` over `bg` at `alpha` (0–1). Returns #rrggbb. */
function alphaMix(fg: string, bg: string, alpha: number): string {
  const parse = (h: string) => [
    parseInt(h.slice(1, 3), 16),
    parseInt(h.slice(3, 5), 16),
    parseInt(h.slice(5, 7), 16),
  ];
  const [fr, fg_, fb] = parse(fg);
  const [br, bg_, bb] = parse(bg);
  const r = Math.round(alpha * fr + (1 - alpha) * br);
  const g = Math.round(alpha * fg_ + (1 - alpha) * bg_);
  const b = Math.round(alpha * fb + (1 - alpha) * bb);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

/**
 * Apply graph CSS custom properties derived from a frontend-utils theme.
 *
 * DSL token → graph element mapping:
 *   TYPE               → type node border + label
 *   RELATION           → relation node border + label
 *   DIRECTLY_ASSIGNABLE → direct (solid) edge color
 *   COMMENT            → computed (dashed) edge color
 *   background.color   → graph canvas background + node bg tints (12% alpha)
 */
const STYLE_ID = 'openfga-graph-theme';

/**
 * Apply graph CSS custom properties derived from a frontend-utils theme.
 *
 * DSL token → graph element mapping:
 *   TYPE               → type node border + label
 *   RELATION           → relation node border + label
 *   DIRECTLY_ASSIGNABLE → direct (solid) edge color
 *   COMMENT            → computed (dashed) edge color
 *   background.color   → graph canvas background + node bg tints (12% alpha)
 *
 * Injects a <style> tag (not inline styles) so class-based overrides like
 * .openfga-light { --openfga-graph-node-type: ... } keep working.
 * Call again with a different theme to swap (the tag is replaced in place).
 */
export function applyGraphTheme(theme: ThemeConfiguration): void {
  const bg = theme.background.color;
  const typeColor = theme.colors['type'] ?? '#79ed83';
  const relationColor = theme.colors['relation'] ?? '#20f1f5';
  const directColor = theme.colors['directly-assignable'] ?? '#ceec93';
  const computedColor = theme.colors['comment'] ?? '#737981';

  const css = `:root {
  --openfga-graph-bg: ${bg};
  --openfga-graph-node-type: ${typeColor};
  --openfga-graph-node-type-bg: ${alphaMix(typeColor, bg, 0.12)};
  --openfga-graph-node-relation: ${relationColor};
  --openfga-graph-node-relation-bg: ${alphaMix(relationColor, bg, 0.12)};
  --openfga-graph-edge: ${directColor};
  --openfga-graph-edge-computed: ${computedColor};
}`;

  let el = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement('style');
    el.id = STYLE_ID;
    document.head.appendChild(el);
  }
  el.textContent = css;
}
