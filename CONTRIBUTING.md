# Contributing to OpenFGA Playground

Thank you for your interest in contributing. This document covers the codebase structure, development workflow, commit conventions, and how to add new components or stories.

## Packages

This is a pnpm monorepo with four packages:

| Package | npm | Description |
|---|---|---|
| [`packages/core`](packages/core/) | [`@openfga/playground-core`](https://www.npmjs.com/package/@openfga/playground-core) | Pure TypeScript state management and backend adapter |
| [`packages/components`](packages/components/) | [`@openfga/playground-components`](https://www.npmjs.com/package/@openfga/playground-components) | Lit Web Components (framework-agnostic, tree-shakeable) |
| [`packages/frontend-utils`](packages/frontend-utils/) | [`@openfga/frontend-utils`](https://www.npmjs.com/package/@openfga/frontend-utils) | Shared Monaco/theming/graph utilities |
| [`packages/playground`](packages/playground/) | (not published) | Shell application — composes core + components |

## Architecture

```
packages/
  core/        — @openfga/playground-core
               nanostores state, BackendAdapter interface,
               ProxyBackendAdapter, validation, YAML import/export

  frontend-utils/ — @openfga/frontend-utils
               shared Monaco integration, theming helpers,
               graph utilities and shared frontend types

  components/  — @openfga/playground-components
               Lit Web Components: model-editor, model-graph,
               model-diff, tuple-manager, assertion-runner,
               resolution-path, connection-config, theme

  playground/  — shell app (Vite)
               wires core + components + frontend-utils integrations;
               URL state management
```

Data flows one way: **User action → Component emits event → Shell calls core action → Core updates state → Shell re-renders components.**

Components never import core. Core has no DOM dependency. The shell is the only place both are used together. Shared editor/graph/theme integrations are provided by `@openfga/frontend-utils` and consumed by playground packages where needed.

### Backend modes

Backend support is phased:

1. Shipped: direct browser mode for unauthenticated/same-origin servers
2. Planned: `fga serve` proxy mode for secure/authenticated workflows
3. Planned: WASM backend mode

All three modes use the same shell/components through the `BackendAdapter` interface. See [ADR-008](./docs/decisions/ADR-008-backend-adapter-modes.md) and [ADR-009](./docs/decisions/ADR-009-backend-proxy.md) for design rationale.

## Tech stack

| Concern | Choice |
|---|---|
| Web Components | Lit |
| State management | nanostores |
| Code editor | Monaco (via `@openfga/frontend-utils`) |
| Graph visualization | Cytoscape.js + dagre |
| Build | tsup (libraries), Vite (shell) |
| Tests (core) | Vitest |
| Tests (components) | @web/test-runner + @open-wc/testing |
| Tests (E2E) | Playwright |
| Package manager | pnpm workspaces |

## Development setup

Requires Node.js >= 20 and pnpm 9.

```bash
make install   # install all dependencies
make dev       # start dev server → http://localhost:5173
make test      # run all tests
make typecheck # type check all packages
make lint      # lint all packages
```

See [Make targets](#make-targets) below for the full command reference.

## Make targets

| Command | Description |
|---|---|
| `make install` | Install all workspace dependencies |
| `make build` | Build all packages in dependency order |
| `make build-core` | Build `@openfga/playground-core` only |
| `make build-components` | Build `@openfga/playground-components` only |
| `make build-playground` | Build `@openfga/playground` shell only |
| `make dev` | Start playground Vite dev server |
| `make test` | Run all tests across all packages |
| `make test-core` | Run core package tests only |
| `make test-components` | Run components package tests only |
| `make test-e2e` | Run Playwright end-to-end tests |
| `make lint` | Run ESLint + Prettier checks |
| `make typecheck` | Run TypeScript typechecks across all packages |
| `make clean` | Remove build artifacts |
| `make ci` | Run CI sequence: typecheck, lint, build, test |

## Commit conventions

We use [Conventional Commits](https://www.conventionalcommits.org/).

Format: `type(scope): description`

**Types**: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `build`, `ci`

**Scopes**: `core`, `components`, `playground`, `model-editor`, `model-graph`, `tuple-manager`, `assertion-runner`, `resolution-path`, `connection-config`, `model-diff`, `theme`

**Examples**:

```
feat(model-editor): add DSL/JSON toggle
fix(core): handle empty model in validation
test(tuple-manager): add autocomplete tests
docs(readme): update quick start steps
build(ci): add publish workflow
```

Rules:
- No emojis in commit messages
- Description is lowercase, imperative mood, no trailing period
- Breaking changes: add `!` after scope and a `BREAKING CHANGE:` footer

## Pull requests

1. Fork the repo and create a branch from `main`
2. Make your changes — keep PRs focused on a single concern
3. Run `make test`, `make typecheck`, and `make lint` before pushing
4. Open a PR with a clear description of what changes and why

## Adding a new component

1. Create `packages/components/src/<name>/` with:
   - `<name>.ts` — the Lit element
   - `index.ts` — re-exports the element and its event detail types

2. Register the element with the `openfga-` prefix:
   ```typescript
   @customElement('openfga-<name>')
   export class MyComponent extends LitElement { ... }
   ```

3. Add a subpath export in `packages/components/package.json`:
   ```json
   "./<name>": {
     "types": "./dist/<name>/index.d.ts",
     "import": "./dist/<name>/index.js",
     "require": "./dist/<name>/index.cjs"
   }
   ```

4. Add an entry in `packages/components/tsup.config.ts` (if it has explicit entry points).

5. Wire the component in `packages/playground/src/app.ts`:
   - Subscribe to relevant nanostores atoms
   - Pass state as properties
   - Listen for emitted events
   - Call core actions in event handlers

**Critical constraint**: Each subpath export's dependency tree must remain isolated. Do not import from other component directories. Shared types go in `src/shared/types.ts`. Shared theme utilities go in `src/theme/`.

## Component design rules

- Extend `LitElement`. Use Shadow DOM.
- Components are **stateless views**. They receive data via `@property()` decorators and emit results via `CustomEvent`.
- Never import from `@openfga/playground-core`. Never call the backend.
- All colors and spacing use `--openfga-*` CSS custom properties. Never hardcode colors.
- Every interactive element must be keyboard-accessible. Use ARIA attributes where native semantics are insufficient.
- Event detail interfaces must be exported from `index.ts`.

```typescript
// Event pattern
export interface MyDetail { value: string }

this.dispatchEvent(new CustomEvent<MyDetail>('my-event', {
  detail: { value },
  bubbles: true,
  composed: true,
}));
```

## Architecture decisions

Major architectural decisions are recorded in `docs/decisions/ADR-*.md`. If you are making a significant design choice (new dependency, changed data flow, new adapter), write an ADR first and reference it in your PR.

## License

By contributing, you agree that your contributions will be licensed under the Apache-2.0 License.
