# @openfga/playground-components

Lit Web Components for the OpenFGA Playground. Framework-agnostic, tree-shakeable, and independently importable.

## Overview

Each component is a standard Custom Element built with [Lit](https://lit.dev). They are **stateless views**: they receive data via properties and communicate results by emitting `CustomEvent`s. They have no dependency on `@openfga/playground-core` and can be used independently.

## Installation

```bash
npm install @openfga/playground-components
```

## Components

### Model Editor

Monaco-based DSL/JSON editor with syntax highlighting and inline validation markers.

```bash
import '@openfga/playground-components/model-editor';
```

```html
<openfga-model-editor
  model="model\n  schema 1.1\ntype user"
  format="dsl"
></openfga-model-editor>
```

Properties: `model: string`, `format: 'dsl' | 'json'`, `errors: ValidationError[]`, `readonly: boolean`

Events: `model-change` (`{ value: string }`), `format-change` (`{ format: 'dsl' | 'json' }`)

### Model Graph

Cytoscape.js + dagre visualization of the authorization model's type relationships.

```bash
import '@openfga/playground-components/model-graph';
```

```html
<openfga-model-graph .model=${authorizationModel}></openfga-model-graph>
```

Properties: `model: AuthorizationModel | null`

### Model Diff

Monaco diff editor showing changes between two model versions.

```bash
import '@openfga/playground-components/model-diff';
```

```html
<openfga-model-diff modelA="..." modelB="..."></openfga-model-diff>
```

Properties: `modelA: string`, `modelB: string`, `format: 'dsl' | 'json'`

### Tuple Manager

Table and form for managing relationship tuples in a store.

```bash
import '@openfga/playground-components/tuple-manager';
```

```html
<openfga-tuple-manager
  .tuples=${tuples}
  .model=${authorizationModel}
></openfga-tuple-manager>
```

Properties: `tuples: TupleKey[]`, `model: AuthorizationModel | null`

Events: `tuple-add` (`{ tuple: TupleKey }`), `tuple-remove` (`{ tuple: TupleKey }`)

### Assertion Runner

Run and display results of `check` assertions against the active model and tuples.

```bash
import '@openfga/playground-components/assertion-runner';
```

```html
<openfga-assertion-runner .assertions=${assertions}></openfga-assertion-runner>
```

Properties: `assertions: AssertionData[]`

Events: `assertion-run` (`{ assertion }`), `assertion-run-all`, `assertion-add`, `assertion-remove` (`{ index }`), `assertion-expand` (`{ assertion }`)

### Resolution Path

Cytoscape.js tree visualization of an OpenFGA `expand` API response.

```bash
import '@openfga/playground-components/resolution-path';
```

```html
<openfga-resolution-path .tree=${expandTree}></openfga-resolution-path>
```

Properties: `tree: object | null`

### Connection Config

Form for managing OpenFGA server connection profiles.

```bash
import '@openfga/playground-components/connection-config';
```

Properties: `servers: ServerConfig[]`, `activeServerId: string | null`

Events: `server-add`, `server-update`, `server-remove`, `server-select`

## Subpath exports

Each component has an isolated subpath export. Importing `./model-editor` does not pull in Cytoscape (used by `./model-graph`). Importing `./model-graph` does not pull in Monaco (used by `./model-editor`).

```typescript
// Fine-grained imports — tree-shake unrelated heavy deps
import '@openfga/playground-components/model-editor';  // Monaco only
import '@openfga/playground-components/model-graph';   // Cytoscape only

// Or import everything (all deps bundled)
import '@openfga/playground-components';
```

## Theming

Components use CSS custom properties from the `--openfga-*` namespace. Apply them to a parent element or `:root`:

```css
:root {
  --openfga-bg-primary: #1e1e2e;
  --openfga-bg-secondary: #181825;
  --openfga-text-primary: #cdd6f4;
  --openfga-accent: #89b4fa;
  --openfga-success: #a6e3a1;
  --openfga-error: #f38ba8;
  /* ... see src/theme/tokens.css for full list */
}
```

CSS custom properties inherit through Shadow DOM boundaries, so setting them on a host ancestor applies to all nested components.

A pre-built dark theme (Catppuccin Mocha) is the default. A light theme (Catppuccin Latte) is provided as `.openfga-light` on the `<html>` element.

## Event pattern

All components follow the same event pattern:

```typescript
this.dispatchEvent(new CustomEvent('event-name', {
  detail: { /* typed payload */ },
  bubbles: true,
  composed: true,  // crosses Shadow DOM boundaries
}));
```

## License

Apache-2.0
