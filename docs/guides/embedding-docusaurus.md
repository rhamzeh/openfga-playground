# Embedding playground components in Docusaurus

This guide shows how to embed `@openfga/playground-components` in a [Docusaurus](https://docusaurus.io) site — for example, to add a live model editor or graph visualization to your documentation.

## Prerequisites

- Docusaurus 3.x
- Node.js >= 20

## 1. Install the package

```bash
npm install @openfga/playground-components
# or
pnpm add @openfga/playground-components
```

## 2. Apply theme tokens

The components need CSS custom properties from the `--openfga-*` namespace. The easiest way is to import the built-in theme from a [client module](https://docusaurus.io/docs/api/docusaurus-config#clientModules) or a global CSS file.

Create `src/css/openfga.css`:

```css
/* Import the OpenFGA component theme tokens */
@import '@openfga/playground-components/theme';
```

Reference it in `docusaurus.config.ts`:

```typescript
export default {
  // ...
  stylesheets: [
    // your existing stylesheets
  ],
  customFields: {},
  // Add as a global CSS import via the styles config
} satisfies Config;
```

Or import it directly in your `src/css/custom.css`:

```css
@import '@openfga/playground-components/theme';
```

> **Docusaurus dark mode**: Docusaurus manages its own dark/light toggle. To align component themes with Docusaurus's theme, add this to your `custom.css`:
>
> ```css
> /* Map Docusaurus dark mode to OpenFGA dark theme (default, no changes needed) */
> /* Map Docusaurus light mode to OpenFGA light theme */
> [data-theme='light'] {
>   --openfga-bg-primary: #eff1f5;
>   --openfga-bg-secondary: #e6e9ef;
>   --openfga-bg-elevated: #dce0e8;
>   --openfga-border: #bcc0cc;
>   --openfga-text-primary: #4c4f69;
>   --openfga-text-secondary: #6c6f85;
>   --openfga-accent: #1e66f5;
>   --openfga-success: #40a02b;
>   --openfga-error: #d20f39;
>   --openfga-editor-bg: #eff1f5;
>   --openfga-editor-gutter: #e6e9ef;
>   --openfga-graph-bg: #e6e9ef;
> }
> ```

## 3. Register components in a client module

Custom Elements must be registered before they can be used. Create `src/clientModules/openfgaComponents.ts`:

```typescript
// Register the components you use.
// Each subpath import only loads that component's dependencies
// (e.g., model-editor doesn't pull in Cytoscape).
import '@openfga/playground-components/model-editor';
import '@openfga/playground-components/model-graph';
```

Add it to `docusaurus.config.ts`:

```typescript
export default {
  clientModules: [
    require.resolve('./src/clientModules/openfgaComponents.ts'),
  ],
} satisfies Config;
```

## 4. Use components in MDX

### Model editor (read-only code display)

```mdx
---
title: Example model
---

import BrowserOnly from '@docusaurus/BrowserOnly';

The following model defines a document sharing system:

<BrowserOnly>
  {() => (
    <openfga-model-editor
      model={`model
  schema 1.1
type user
type document
  relations
    define viewer: [user]
    define editor: [user]
    define owner: [user]`}
      format="dsl"
      readonly={true}
    />
  )}
</BrowserOnly>
```

> **`BrowserOnly` is required** because Web Components rely on `customElements` which is not available during Docusaurus's server-side rendering (SSR). Wrapping with `BrowserOnly` ensures the component only renders in the browser.

### Model graph visualization

```mdx
<BrowserOnly>
  {() => {
    const model = {
      schema_version: '1.1',
      type_definitions: [
        { type: 'user', relations: {}, metadata: null },
        {
          type: 'document',
          relations: {
            viewer: { this: {} },
            editor: { this: {} },
          },
          metadata: {
            relations: {
              viewer: { directly_related_user_types: [{ type: 'user' }] },
              editor: { directly_related_user_types: [{ type: 'user' }] },
            },
          },
        },
      ],
    };
    return <openfga-model-graph model={model} style={{ height: '300px', display: 'block' }} />;
  }}
</BrowserOnly>
```

## 5. TypeScript declarations

If you use TypeScript and get "Property does not exist on type JSX.IntrinsicElements" errors, add a declaration file `src/declarations.d.ts`:

```typescript
import type { } from '@openfga/playground-components';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'openfga-model-editor': React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          model?: string;
          format?: 'dsl' | 'json';
          readonly?: boolean;
        },
        HTMLElement
      >;
      'openfga-model-graph': React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          model?: object | null;
        },
        HTMLElement
      >;
    }
  }
}
```

## 6. Webpack/swc config for Monaco

If you use the model editor, Monaco requires special Webpack handling. Add to `docusaurus.config.ts`:

```typescript
import { Configuration } from 'webpack';

export default {
  plugins: [
    [
      '@docusaurus/plugin-content-docs',
      // ...
    ],
  ],
  webpack: {
    jsLoader: (isServer: boolean) => ({
      loader: require.resolve('swc-loader'),
      options: {
        jsc: { parser: { syntax: 'typescript', tsx: true } },
        module: { type: isServer ? 'commonjs' : 'es6' },
      },
    }),
  },
} satisfies Config;
```

Or configure `docusaurus.config.ts` to use the `customWebpack` plugin pattern:

```typescript
function webpackPlugin() {
  return {
    name: 'monaco-webpack-plugin',
    configureWebpack(_config: Configuration, isServer: boolean) {
      if (isServer) return {};
      return {
        plugins: [
          // Monaco bundles its own workers. Tell Webpack where to find them.
          new MonacoWebpackPlugin({ languages: [] }),
        ],
      };
    },
  };
}
```

Alternatively, use the `model-graph` and other non-Monaco components, which have no Webpack requirements.

## Complete working example

```mdx title="docs/authorization-model.mdx"
---
title: Authorization Model
description: Example OpenFGA model for a document sharing system
---

import BrowserOnly from '@docusaurus/BrowserOnly';

## Model definition

```
model
  schema 1.1
type user
type document
  relations
    define viewer: [user]
    define owner: [user]
```

## Visual graph

<BrowserOnly fallback={<div>Loading graph…</div>}>
  {() => {
    const model = {
      schema_version: '1.1',
      type_definitions: [
        { type: 'user', relations: {}, metadata: null },
        {
          type: 'document',
          relations: { viewer: { this: {} }, owner: { this: {} } },
          metadata: {
            relations: {
              viewer: { directly_related_user_types: [{ type: 'user' }] },
              owner: { directly_related_user_types: [{ type: 'user' }] },
            },
          },
        },
      ],
    };
    return (
      <openfga-model-graph
        model={model}
        style={{ height: '250px', display: 'block', borderRadius: '8px' }}
      />
    );
  }}
</BrowserOnly>
```

## Subpath imports and bundle size

Each component has an isolated subpath export. Only import what you use:

| Import | Includes |
|---|---|
| `@openfga/playground-components/model-editor` | Monaco editor only |
| `@openfga/playground-components/model-graph` | Cytoscape + dagre only |
| `@openfga/playground-components/model-diff` | Monaco diff editor only |
| `@openfga/playground-components/tuple-manager` | Lit only |
| `@openfga/playground-components/assertion-runner` | Lit only |
| `@openfga/playground-components/resolution-path` | Cytoscape + dagre only |
| `@openfga/playground-components` | Everything |

Importing `./model-graph` does not include Monaco. Importing `./model-editor` does not include Cytoscape. This keeps documentation sites fast.
