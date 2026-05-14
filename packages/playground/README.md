# @openfga/playground

The OpenFGA Playground shell application. Composes `@openfga/playground-core` and `@openfga/playground-components` into a full interactive UI for working with OpenFGA authorization servers.

## Prerequisites

- [fga CLI](https://github.com/openfga/cli) with `fga serve` running on `http://localhost:8880`
- Node.js >= 20

## Development

```bash
# From the repo root
make install   # install all workspace dependencies
make dev       # start Vite dev server (http://localhost:5173)
```

`fga serve` must be running before starting the dev server. It provides the HTTP proxy that the playground uses to communicate with OpenFGA.

## Building

```bash
make build
```

The built output is in `packages/playground/dist/`. It is a static site that can be served from any web server.

## Architecture

The shell (`src/app.ts`) is the only place that imports both `@openfga/playground-core` and `@openfga/playground-components`. It:

1. Subscribes to nanostores state atoms from core
2. Passes state values as properties to components
3. Listens for component `CustomEvent`s
4. Calls core actions in response

Components never call the backend directly. Core never touches the DOM.

```
User action
  → Component emits CustomEvent
    → Shell calls core action
      → Core updates state / calls backend
        → Shell passes new state to components
          → Components re-render
```

## URL state

The shell reads `profile`, `storeId`, and `modelId` from query parameters on load and updates them via `history.replaceState` as state changes. This makes individual store/model views bookmarkable.

## Keyboard shortcuts

| Shortcut | Action |
|---|---|
| Ctrl+S | Save model |
| Ctrl+I | Import YAML |
| Ctrl+E | Export YAML |

## Widgets

Toolbar widgets in `src/widgets/` are playground-specific UI elements that are not exported as reusable components:

- `store-selector` — dropdown for switching between FGA stores
- `model-selector` — version picker for authorization model history
- `sample-picker` — loads example models from `openfga/sample-stores`
- `yaml-toolbar` — import/export YAML toolbar buttons
- `server-selector` — dropdown for switching connection profiles

## License

Apache-2.0
