# ADR-004: Component Story Tooling — Storybook

## Status

Accepted — **not yet implemented**

## Decision

Use [Storybook](https://storybook.js.org/) (`@storybook/web-components-vite`) as the component story tool for `@openfga/playground-components`.

## Context (Evaluation)

Story tool requirements:

1. Isolated component rendering without the full playground shell
2. Interactive prop controls (knobs/args)
3. Theme switching (dark/light)
4. Static site build for component documentation
5. Hot-reload on component source changes
6. Low dev startup time
7. Manageable dependency weight

Three options were evaluated:

### Storybook (`@storybook/web-components-vite`)

- **Web Component support**: First-class via the `web-components` framework preset. Custom elements render correctly. Lit's `html` template literal works in story render functions.
- **Prop controls**: `@storybook/addon-essentials` provides Controls addon for interactive arg editing.
- **Theme switching**: Custom `globalTypes` toolbar for dark/light theme class switching.
- **Static site**: `storybook build` produces a deployable static site.
- **Hot-reload**: Vite-based HMR. Component changes reflect immediately in the story iframe.
- **Startup time**: Comparable to a Vite dev server (~1–2s cold start).
- **Dependency weight**: ~50MB installed (devDependency only, not in published packages). Acceptable.

### Histoire

- **Web Component support**: Primarily designed for Vue 3 with some Vue-agnostic stories via vanilla JS. Web Component support is not first-class.
- **Verdict**: Not suitable without significant custom setup.

### Custom Vite story runner

- **Web Component support**: Full control — just render custom elements in HTML.
- **Prop controls**: Would need to be built from scratch.
- **Verdict**: Significant implementation cost for equivalent functionality to Storybook.

## Decision Rationale

Storybook with `@storybook/web-components-vite` meets all requirements with the least implementation effort. The Web Component story pattern (`html` tagged literals in render functions) is clean and well-documented. The Controls addon provides interactive arg editing without custom code.

## Planned story conventions

- Stories co-located with components: `model-editor.stories.ts` next to `model-editor.ts`
- Each component has stories for: empty/default state, with data, error states, dark theme, light theme
- Accessibility-focused variants (keyboard-only interaction notes) documented in story descriptions
- `make stories` starts the dev server; `make stories-build` produces the static site

## Trade-offs

- Storybook is a large devDependency. It is a devDependency only; it does not appear in published packages.
- Storybook's Web Component integration is mature but some addons (e.g., a11y) may need per-component configuration.
- Major version upgrades of Storybook have historically required significant migration effort.
