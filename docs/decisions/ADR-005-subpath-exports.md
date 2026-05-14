# ADR-005: Subpath Exports for Component Package

## Status

Accepted

## Decision

Use `package.json` `exports` subpath entries in `@openfga/playground-components` to allow fine-grained component imports with isolated dependency trees.

## Context

`@openfga/playground-components` ships multiple components with very different dependency weights:

| Component | Heavy dependency |
|---|---|
| `model-editor` | `monaco-editor` (~2MB gzipped) |
| `model-graph` | `cytoscape` + `cytoscape-dagre` (~170KB gzipped) |
| `model-diff` | `monaco-editor` (~2MB gzipped) |
| Others | None |

A docs page embedding only a read-only `<openfga-model-editor>` should not load Cytoscape. A VS Code webview using only `<openfga-model-graph>` should not load Monaco. However, maintaining N separate npm packages has its own overhead (separate versions, separate CI, separate changelogs).

## Decision

One npm package (`@openfga/playground-components`) with subpath exports:

```json
{
  "exports": {
    ".": "./dist/index.js",
    "./model-editor": "./dist/model-editor/index.js",
    "./model-graph": "./dist/model-graph/index.js",
    "./theme": "./dist/theme/index.js"
  }
}
```

Each subpath entry is built by `tsup` as a separate entry point. Its dependency tree is isolated from other subpaths.

**Critical constraint**: `model-editor/index.ts` must not import anything from `model-graph/` (which would pull in Cytoscape), and vice versa. Shared types go in `src/shared/types.ts`, which is inlined into each subpath's bundle and is small enough (~2KB) that duplication is acceptable.

## Rationale

- **Single package, one version number**: Easier to coordinate releases than N packages.
- **Consumer ergonomics**: `import "@openfga/playground-components/model-editor"` is clean and discoverable.
- **Tree-shaking by subpath**: Modern bundlers (Vite, webpack 5, Rollup) respect `exports` and will not include other subpaths' code when only one is imported.
- **Build isolation**: `tsup` builds each entry point separately. We can verify tree-shaking correctness with bundle analysis (tracked in M5.6).

## Verification (M5.6)

Bundle analysis will verify:
- `import "@openfga/playground-components/model-editor"` → Cytoscape NOT in bundle
- `import "@openfga/playground-components/model-graph"` → Monaco NOT in bundle

## Trade-offs

- Subpath imports are less discoverable than a single `import { ModelEditor } from "@openfga/playground-components"`. Both forms are supported: the bare `.` export re-exports everything (for the playground shell); subpath exports are for selective consumers.
- `tsup` must be configured with explicit entry points for each subpath. When adding a new component, the developer must also add its subpath export and entry point.
- TypeScript consumers must use `moduleResolution: "bundler"` or `"node16"` to resolve subpath exports correctly.

## Alternatives Considered

- **Separate npm packages** (`@openfga/model-editor`, `@openfga/model-graph`, ...): Maximum isolation, but N changelogs, N CI jobs, N `package.json` files, and complex cross-package type sharing.
- **Single bundle, rely on tree-shaking**: Bundlers can tree-shake unused exports, but only if Cytoscape and Monaco are `import()`ed dynamically. This is more fragile and harder to verify than explicit subpath isolation.
- **ESM-only with side-effect-free annotation**: Adding `"sideEffects": false` helps tree-shaking but does not prevent bundlers from including dependencies of re-exported modules.
