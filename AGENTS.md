# Instructions for AI Coding Agents

## Project Overview

This is the OpenFGA Playground — a modular, framework-agnostic web application for interacting with OpenFGA authorization servers.

Read `PLAN.md` for full architecture and design decisions. Read `TASKS.md` for the implementation plan with acceptance criteria. Read `docs/decisions/ADR-*.md` for rationale behind key choices.

## Architecture Summary

Four npm packages in a pnpm monorepo:

- **`packages/core`** (`@openfga/playground-core`) — Pure TypeScript. State management (nanostores), backend adapter interface, YAML import/export, validation orchestration. No DOM, no UI.
- **`packages/components`** (`@openfga/playground-components`) — Lit Web Components. Stateless views that receive data via properties and emit CustomEvents. Each component has a subpath export for independent import.
- **`packages/frontend-utils`** (`@openfga/frontend-utils`) — Shared Monaco language integration, theming helpers, Prism utilities, and graph types used by playground packages.
- **`packages/playground`** (`@openfga/playground`) — Lit shell app. Composes components + core. Layout, event wiring, toolbar widgets.

Data flows one way: **User action → Component emits event → Shell calls core → Core updates state / calls backend → Shell passes new state to components → Re-render.** Components never import or call core directly.

The playground supports multiple backend adapters:

- `DirectBackendAdapter` (initial rollout): calls an OpenFGA server directly from the browser for unauthenticated/same-origin setups
- `ProxyBackendAdapter` (future): talks to `fga serve` and uses `apiUrl` like `http://localhost:8880/servers/:id/proxy`
- `WasmBackendAdapter` (future): talks to a wasm instance of the OpenFGA server, allowing usage with no server

## Repository Structure

```
packages/
  core/           → @openfga/playground-core
  components/     → @openfga/playground-components
  frontend-utils/ → @openfga/frontend-utils
  playground/     → @openfga/playground
docs/decisions/   → ADRs
```

## Commands

```bash
make install        # pnpm install
make build          # Build all packages in dependency order
make dev            # Start playground dev server (Vite)
make stories        # Start component story dev server
make stories-build  # Build static story site
make test           # Run all tests
make lint           # ESLint + Prettier
make typecheck      # tsc --noEmit across all packages
make clean          # Remove build artifacts
```

Underlying tool: `pnpm` with workspaces. To run a command in a specific package: `pnpm --filter @openfga/playground-core run test`.

## Tech Stack

| Concern | Choice | Notes |
|---|---|---|
| Web Components | Lit | Thinnest abstraction over native Web Components |
| State management | nanostores | <1KB, framework-agnostic, `@nanostores/lit` for Lit bindings |
| Code editor | Monaco | Via `@openfga/frontend-utils` bindings |
| Graph visualization | Cytoscape.js + dagre | Deterministic hierarchical layouts |
| Build | tsup (packages), Vite (playground shell) | esbuild-based |
| Test (core) | Vitest | Unit + integration |
| Test (components) | @web/test-runner + @open-wc/testing | Web Component lifecycle tests |
| Test (E2E) | Playwright | Full flows against fga serve + OpenFGA |
| Package manager | pnpm | Workspaces for monorepo |

## Key Dependencies from the OpenFGA Ecosystem

- **`@openfga/sdk`** — The official JavaScript SDK. Used as the actual API client. `ProxyBackendAdapter.getClient()` returns an `OpenFgaClient` pointed at the local proxy. All request/response types (`ClientCheckRequest`, `RelationshipTuple`, `AuthorizationModel`, etc.) come from here. Do not duplicate these types.
- **`@openfga/syntax-transformer`** — DSL ↔ JSON conversion and model validation. The core's validation orchestrator wraps this. Do not write custom DSL parsing.
- **`@openfga/frontend-utils`** — Monaco editor bindings for OpenFGA DSL syntax highlighting, validation markers, and autocompletion. The model editor component wraps this. Do not write custom Monaco language definitions.

## Coding Conventions

### General

- TypeScript strict mode everywhere.
- ESLint + Prettier. Run `make lint` before committing.
- Conventional Commits. Format: `type(scope): description`. No emojis. No marketing language.
  - Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `build`, `ci`
  - Scopes: `core`, `components`, `playground`, `model-editor`, `model-graph`, `tuple-manager`, `assertion-runner`, `resolution-path`, `connection-config`, `model-diff`, `theme`, `stories`
  - Examples: `feat(model-editor): add DSL/JSON toggle`, `fix(core): handle empty model in validation`, `test(tuple-manager): add autocomplete tests`
- No default exports. Use named exports everywhere.
- License header: Apache-2.0. Each source file should include the SPDX identifier.

### Core Package (`packages/core`)

- Pure TypeScript. No DOM APIs. No `document`, no `window`, no `HTMLElement`.
- All state is in nanostores atoms/maps in `src/state/store.ts`. Mutations go through actions in `src/state/actions.ts`.
- The `BackendAdapter` interface (`src/adapter/interface.ts`) is the extension point. It must remain stable — third parties depend on it.
- Shipped adapters: `ProxyBackendAdapter` (via `fga serve`) and `DirectBackendAdapter` (direct API mode).
- Validation orchestrator wraps `@openfga/syntax-transformer`. Debounce model validation (default 300ms).
- YAML import/export uses `js-yaml`. The format matches the `.fga.yaml` spec used by the `fga` CLI.
- All async operations should handle errors and surface them through state (e.g., `$model.errors`, not unhandled rejections).

### Components Package (`packages/components`)

- Every component is a Lit element extending `LitElement`.
- Register with `openfga-` prefix: `@customElement('openfga-model-editor')`.
- **Components are stateless views.** They receive data via reactive properties (`@property()`) and emit results via `CustomEvent`. They never import from `@openfga/playground-core` or call any backend.
- Use Shadow DOM for style encapsulation.
- All colors and spacing come from CSS custom properties (`--openfga-*`). Never hardcode colors. See `src/theme/tokens.css` for the full token list.
- Every interactive element must be keyboard-accessible. Use ARIA attributes where native semantics are insufficient.
- Each component has its own directory under `src/` with an `index.ts` subpath export entry. The subpath export must not import from other component directories — this ensures `import "@openfga/playground-components/model-editor"` does not pull in Cytoscape (from model-graph).
- Co-locate stories: `model-editor.stories.ts` next to `model-editor.ts`.
- When a component needs to emit a complex value, use `detail` on the CustomEvent. Type the detail interface and export it.

```typescript
// Pattern for component events
export interface ModelChangeDetail {
  value: string;
}

this.dispatchEvent(new CustomEvent<ModelChangeDetail>('model-change', {
  detail: { value: newModel },
  bubbles: true,
  composed: true,  // crosses Shadow DOM boundaries
}));
```

```typescript
// Pattern for reactive properties
@property({ type: String }) model = '';
@property({ type: String }) format: 'dsl' | 'json' = 'dsl';
@property({ type: Array }) errors: ValidationError[] = [];
@property({ type: Boolean }) readonly = false;
```

### Playground Shell (`packages/playground`)

- Also a Lit app. The root element is `src/app.ts`.
- The shell is the **only place** that imports both core and components.
- Wiring pattern: subscribe to nanostores in the shell, pass values as component properties, listen for component events, dispatch core actions.

```typescript
// Pattern for wiring in the shell
import { $model } from '@openfga/playground-core';
import { StoreController } from '@nanostores/lit';

@customElement('openfga-playground')
export class PlaygroundApp extends LitElement {
  private modelStore = new StoreController(this, $model);

  render() {
    return html`
      <openfga-model-editor
        .model=${this.modelStore.value.dsl}
        .errors=${this.modelStore.value.errors}
        @model-change=${this.handleModelChange}
      ></openfga-model-editor>
    `;
  }

  private handleModelChange(e: CustomEvent<ModelChangeDetail>) {
    updateModel(e.detail.value);  // core action
  }
}
```

- Toolbar widgets (store selector, model selector, sample picker, YAML toolbar) live in `src/widgets/`. These are playground-specific and not in the components package.
- URL state: read `server` and `storeId` from query params on load. Update via `history.replaceState` on state changes. No hash routing.

## Capability-Gated UI

Server connections include a `capabilities` object:

```typescript
capabilities: {
  storeCrud: boolean;   // CreateStore, ListStores, DeleteStore
  storeList: boolean;   // ListStores and model version listing UX
}
```

Defaults to all-true (open-source OpenFGA). Auth0 FGA servers typically set `storeCrud: false`.

UI elements gated by capabilities:
- "New Store" button: hidden when `storeCrud` is false
- Store selector dropdown/listing: limited when `storeList` is false
- Model version selector: hidden when `storeList` is false

Check the active server's capabilities before calling gated SDK methods. Never call `createStore` or `listStores` when not allowed.

## Write Semantics

All mutations are **immediate** — no batch/draft mode:
- Model save (Ctrl+S): calls `writeAuthorizationModel` on the SDK client
- Tuple add/remove: calls `write` on the SDK client immediately
- Assertion run: calls `check` on the SDK client

Always update local state only after the server confirms success. Show inline errors on failure.

## Theming

Components use CSS custom properties from the `--openfga-*` namespace. The theme is set by the host application (or the shell). Components must never hardcode colors.

Key token categories: surface (`bg-primary`, `bg-secondary`), text (`text-primary`, `text-secondary`), accent, semantic (`success`, `error`, `warning`), editor, graph, typography, spacing.

Dark theme is the default. Light theme is defined but completed in M5. Both must meet WCAG 2.1 AA contrast ratios.

To create a new theme, define CSS custom property overrides:

```css
.my-theme {
  --openfga-bg-primary: #ffffff;
  --openfga-text-primary: #1a1a1a;
  /* ... */
}
```

## Subpath Exports

The components package uses `package.json` `exports` to allow fine-grained imports:

```json
{
  "exports": {
    ".": "./dist/index.js",
    "./model-editor": "./dist/model-editor/index.js",
    "./model-graph": "./dist/model-graph/index.js"
  }
}
```

**Critical constraint**: Each subpath entry's dependency tree must be isolated. `model-editor/index.ts` must not import anything from `model-graph/` (which would pull in Cytoscape). `model-graph/index.ts` must not import from `model-editor/` (which would pull in Monaco). Shared types go in `src/shared/types.ts`. Shared theme goes in `src/theme/`.

When adding a new component, always add its subpath export to `package.json` and verify with bundle analysis that it doesn't pull in unrelated heavy dependencies.

## Testing Patterns

### Core (Vitest)

```typescript
import { describe, it, expect, vi } from 'vitest';
import { $model, updateModel } from '../state';

describe('updateModel', () => {
  it('sets dsl and triggers validation', () => {
    updateModel('model\n  schema 1.1\ntype user');
    expect($model.get().dsl).toBe('model\n  schema 1.1\ntype user');
    expect($model.get().errors).toEqual([]);
  });
});
```

Mock the `BackendAdapter` for tests that involve API calls. Use `vi.fn()` to mock `getClient()`.

### Components (@web/test-runner)

```typescript
import { fixture, html, expect } from '@open-wc/testing';
import '../model-editor';

describe('openfga-model-editor', () => {
  it('renders with model', async () => {
    const el = await fixture(html`
      <openfga-model-editor .model=${'type user'}></openfga-model-editor>
    `);
    expect(el).to.exist;
  });

  it('fires model-change on edit', async () => {
    const el = await fixture(html`<openfga-model-editor></openfga-model-editor>`);
    const handler = sinon.spy();
    el.addEventListener('model-change', handler);
    // simulate edit...
    expect(handler).to.have.been.calledOnce;
  });
});
```

### E2E (Playwright)

E2E tests require a running `fga serve` + OpenFGA instance. Use Docker Compose for CI. Tests go in a top-level `tests/e2e/` directory.

## Accessibility Requirements

Not optional. Built into every component from the start.

- All interactive elements reachable via Tab
- Graph nodes navigable with arrow keys
- ARIA labels on non-obvious elements (`aria-label`, `role`)
- Semantic colors supplemented with icons/text (never color-only indicators)
- `aria-live` regions for async results (assertion results, write confirmations, validation errors)
- Focus trapping in modals
- WCAG 2.1 AA contrast ratios for all theme tokens

## What NOT to Do

- **Do not add React, Vue, or any other framework.** The entire stack is Lit. If you need something that feels like it needs a framework, rethink the approach.
- **Do not import core from components.** Components are reusable outside the playground. They receive data via properties and emit events. The shell does the wiring.
- **Do not hardcode colors.** Use `--openfga-*` CSS custom properties.
- **Do not duplicate types from `@openfga/sdk`.** Import `RelationshipTuple`, `AuthorizationModel`, etc. from the SDK.
- **Do not write custom DSL parsing.** Use `@openfga/syntax-transformer`.
- **Do not write custom Monaco language definitions.** Use `@openfga/frontend-utils`.
- **Do not write custom HTTP logic for OpenFGA API calls.** Configure `OpenFgaClient` from `@openfga/sdk` with the proxy URL and use its methods.
- **Do not store secrets in the browser.** Secrets go to `fga serve` via server creation. The browser never reads them back.
- **Do not call store CRUD or listing APIs without checking capabilities.** Always check `server.capabilities.storeCrud` / `server.capabilities.storeList` first.
- **Do not make breaking changes to the `BackendAdapter` interface without discussion.** Third parties depend on it.
- **Do not add default exports.** Named exports only.
- **Do not use emoji in commit messages.**
- **Do not cross-import between component directories.** Each subpath export must have an isolated dependency tree.
- **Do not skip ARIA attributes on interactive elements.** Accessibility is a hard requirement.

## fga serve (Backend Proxy)

The backend is a Go HTTP server in the `openfga/cli` repo, not this repo. If you are working on the playground TypeScript code, you interact with it as an HTTP API:

- `GET http://localhost:8880/servers` — list servers (secrets redacted)
- `POST http://localhost:8880/servers` — create server
- `PUT http://localhost:8880/servers/:id` — update server
- `DELETE http://localhost:8880/servers/:id` — delete server
- `GET/POST http://localhost:8880/servers/:id/stores` — manage server store entries
- `PUT/DELETE http://localhost:8880/servers/:id/stores/:storeId` — update/remove server store entries
- `ANY http://localhost:8880/servers/:id/proxy/*` — transparent proxy to upstream

The proxy endpoint is what `OpenFgaClient` talks to. You configure the SDK with `apiUrl: "http://localhost:8880/servers/${serverId}/proxy"` and it works transparently.

Config file: `$XDG_CONFIG_HOME/fga/servers.yaml` (version: 1). Managed by `fga serve`, not by the playground.

## Sample Stores

Fetched at runtime from `https://api.github.com/repos/openfga/sample-stores/contents/stores`. Not bundled. Cache the directory listing in memory for the session. Fetch individual `.fga.yaml` files by raw URL when selected.

## Key File Locations

| What | Where |
|---|---|
| BackendAdapter interface | `packages/core/src/adapter/interface.ts` |
| ProxyBackendAdapter | `packages/core/src/adapter/proxy.ts` |
| State atoms/maps | `packages/core/src/state/store.ts` |
| State actions | `packages/core/src/state/actions.ts` |
| Validation orchestrator | `packages/core/src/validation/orchestrator.ts` |
| YAML import/export | `packages/core/src/yaml/` |
| Theme tokens | `packages/components/src/theme/tokens.css` |
| Shared component types | `packages/components/src/shared/types.ts` |
| Shell root element | `packages/playground/src/app.ts` |
| Shell event wiring | `packages/playground/src/wiring/event-handlers.ts` |
| Shell widgets | `packages/playground/src/widgets/` |
| ADRs | `docs/decisions/` |
