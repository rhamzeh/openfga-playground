# ADR-001: Web Components via Lit

## Status

Accepted

## Decision

Use [Lit](https://lit.dev/) for all Web Components in `@openfga/playground-components`.

## Context

The playground's UI components must be:

- **Framework-agnostic**: Embeddable in React (OpenFGA docs, Docusaurus MDX), Vue, vanilla HTML, VS Code webviews, and the Auth0 FGA dashboard without framework version conflicts.
- **Independently importable**: Each component should be usable in isolation without pulling in the full component library (achieved via subpath exports — see ADR-005).
- **Themeable**: Host applications supply CSS custom property overrides; components must not hardcode colors or fonts.
- **Long-term maintainable**: Minimal dependency surface; avoid framework major-version churn.

## Rationale

Lit is the thinnest viable abstraction over native Web Components:

- **Reactive properties** via `@property()` decorators, eliminating manual `attributeChangedCallback` boilerplate.
- **Declarative templates** via `html` tagged literals — familiar, efficient DOM diffing.
- **Shadow DOM** for style encapsulation — components receive no host-page style bleed-in.
- **Small footprint** (~6KB gzipped), meaning it does not dominate bundle sizes.
- **Native interoperability**: Lit elements are real custom elements. React 19+, Vue 3, and every other framework can consume them without wrappers.
- **VS Code webviews**: Webviews are plain HTML/JS. Native Web Components work without any framework adapter.
- **Existing OpenFGA precedent**: The VS Code extension already uses a Lit-adjacent approach; Lit aligns with that direction.

## Trade-offs

- Lit's ecosystem for complex app-level concerns (routing, devtools, server-side rendering) is thinner than React or Vue. This is acceptable because the playground shell is simple and the components are stateless views.
- Shadow DOM complicates global style application (e.g., Monaco editor tooltips, portal-based dropdowns). Mitigated by the CSS custom property token contract and noted per-component where needed.
- Lit's `@customElement` decorator syntax requires `experimentalDecorators: true` in TypeScript config. This is a known, stable pattern with no planned breaking changes.

## Alternatives Considered

- **React**: Dominant ecosystem, excellent devtools, but requires React in every host app. Docusaurus, VS Code webviews, and Auth0 FGA dashboard all have different framework contexts. Web Components are the only zero-friction option.
- **Stencil.js**: Compiles to Web Components but adds its own toolchain and constraints. More complexity than Lit for marginal benefit.
- **Vanilla Web Components**: Zero abstraction — maximum verbosity. `attributeChangedCallback`, `observedAttributes`, manual template cloning. Not worth the maintenance cost.
