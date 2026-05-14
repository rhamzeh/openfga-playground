# ADR-006: Monaco Editor

## Status

Accepted

## Decision

Use [Monaco Editor](https://microsoft.github.io/monaco-editor/) via `@openfga/frontend-utils` bindings for the model editor (`<openfga-model-editor>`) and model diff (`<openfga-model-diff>`) components.

## Context

The model editor requires:

- Syntax highlighting for OpenFGA DSL
- Inline validation error markers (red squiggles at specific line/column)
- Autocompletion for DSL keywords and model types
- DSL ↔ JSON toggle
- Read-only mode for docs embedding
- Diff view for comparing two model versions

## Rationale

- **VS Code experience**: Monaco is the editor that powers VS Code. Developers working with OpenFGA likely use the VS Code extension; the playground editor should feel familiar.
- **Existing bindings**: `@openfga/frontend-utils` provides pre-built Monaco bindings for the OpenFGA DSL language (syntax highlighting, validation markers, autocompletion). Using these avoids writing and maintaining custom Monaco language definitions.
- **Rich API**: Monaco's API provides `editor.setModelMarkers()` for inline error display, `createDiffEditor()` for the diff view, and `editor.updateOptions({ readOnly: true })` for read-only mode. All required features are covered.
- **Lazy loading**: Monaco is imported dynamically (`import('monaco-editor')`) so it does not block the initial render. The component displays a container immediately and initializes Monaco asynchronously.

## Shadow DOM considerations

Monaco creates its own stylesheets and relies on DOM APIs that may not work correctly inside Shadow DOM in all browsers. The component uses `this.shadowRoot.querySelector('.monaco-host')` as the mount point. Monaco mounts at that DOM node and manages its own subtree from there.

Known issues:
- Monaco's hover tooltips and context menus may render outside the shadow boundary. This is acceptable behavior — they render correctly, just not encapsulated.
- Theme application: Monaco's built-in themes (`vs-dark`) are applied globally. Component-level theming is achieved by reading `--openfga-*` CSS custom property values at mount time and passing them to Monaco's theme API.

These limitations are noted here for future investigation. The overall approach is sound and works in practice.

## Trade-offs

- **Heavy**: ~2MB gzipped for the full Monaco bundle. Mitigated by lazy loading and subpath export isolation (importing `model-graph` does not load Monaco).
- **Component API stability**: The component API (`model`, `errors`, `readonly`, `format` props) is designed to not leak Monaco internals. A future editor swap (e.g., CodeMirror) would be a component-internal change, not a breaking public API change.

## Alternatives Considered

- **CodeMirror 6**: Lighter (~500KB), modular, better Shadow DOM support. However, `@openfga/frontend-utils` already provides Monaco bindings; switching would require rewriting those bindings or maintaining two sets.
- **Ace Editor**: Older, less actively maintained. No existing OpenFGA bindings.
- **Plain `<textarea>`**: No syntax highlighting or markers. Not acceptable for a developer-facing editor.
