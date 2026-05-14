# Embedding playground components in a VS Code extension

This guide shows how to use `@openfga/playground-components` in a [VS Code extension webview](https://code.visualstudio.com/api/extension-guides/webview).

## How VS Code webviews work

A webview is an isolated `<iframe>` running inside VS Code. It has its own JavaScript context — no `require`, no Node.js APIs, no access to the extension host. Communication with the extension host happens through `postMessage`.

Custom Elements work fine inside webviews because they only need a browser-like DOM, which VS Code's webview provides.

## 1. Install the package

In your extension's `package.json`:

```bash
npm install @openfga/playground-components
```

## 2. Bundle the components for the webview

The webview must load a self-contained bundle — it cannot use `require()` or Node module resolution. Bundle the component(s) you need with esbuild or your existing bundler.

Add a build step to your extension's build script:

```typescript
// scripts/build-webview.ts
import { build } from 'esbuild';

await build({
  entryPoints: ['src/webview/index.ts'],
  bundle: true,
  outfile: 'dist/webview/index.js',
  format: 'esm',
  platform: 'browser',
  // Monaco requires workers — see note below
  external: [],
});
```

**Note on Monaco workers**: If you use `model-editor` or `model-diff`, Monaco spawns Web Workers. In a VS Code webview, `new Worker(url)` is supported but the worker scripts must be served from a URI that VS Code allows. The simplest approach is to use `model-graph`, `tuple-manager`, `assertion-runner`, or `resolution-path`, which have no worker requirements. If you need the Monaco editor, see the [Monaco + webview](#monaco-and-web-workers) section.

## 3. Create the webview HTML

Your extension creates the webview panel and provides HTML. Use `webview.asWebviewUri()` to convert local file paths to valid webview URIs.

```typescript
// src/extension.ts
import * as vscode from 'vscode';
import * as path from 'path';

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand('myExtension.openModelGraph', () => {
      const panel = vscode.window.createWebviewPanel(
        'openfgaModelGraph',
        'Authorization Model Graph',
        vscode.ViewColumn.Beside,
        {
          enableScripts: true,
          localResourceRoots: [
            vscode.Uri.joinPath(context.extensionUri, 'dist', 'webview'),
          ],
        },
      );

      panel.webview.html = getWebviewHtml(panel.webview, context.extensionUri);

      // Send initial data to the webview
      panel.webview.postMessage({
        type: 'setModel',
        model: getActiveModel(), // your extension logic here
      });

      // Listen for messages from the webview
      panel.webview.onDidReceiveMessage((message) => {
        if (message.type === 'nodeSelected') {
          // handle graph node selection
        }
      });
    }),
  );
}

function getWebviewHtml(webview: vscode.Webview, extensionUri: vscode.Uri): string {
  const scriptUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, 'dist', 'webview', 'index.js'),
  );

  // Content Security Policy — required by VS Code
  const nonce = crypto.randomUUID().replace(/-/g, '');
  const csp = [
    `default-src 'none'`,
    `script-src 'nonce-${nonce}'`,
    `style-src 'unsafe-inline'`,  // needed for Shadow DOM styles
    `img-src data:`,
    `font-src data:`,             // Monaco uses data: URIs for fonts
  ].join('; ');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="${csp}" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Authorization Model Graph</title>
  <style>
    /* OpenFGA dark theme tokens */
    :root {
      --openfga-bg-primary: #1e1e2e;
      --openfga-bg-secondary: #181825;
      --openfga-bg-elevated: #313244;
      --openfga-border: #45475a;
      --openfga-text-primary: #cdd6f4;
      --openfga-text-secondary: #a6adc8;
      --openfga-accent: #89b4fa;
      --openfga-success: #a6e3a1;
      --openfga-error: #f38ba8;
      --openfga-graph-node-type: #cba6f7;
      --openfga-graph-node-relation: #89dceb;
      --openfga-graph-node-text: #1e1e2e;
      --openfga-graph-edge: #6c7086;
      --openfga-graph-edge-computed: #45475a;
      --openfga-graph-bg: #181825;
      --openfga-font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      --openfga-font-mono: 'Cascadia Code', monospace;
      --openfga-font-size-base: 13px;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { height: 100%; background: var(--openfga-bg-primary); color: var(--openfga-text-primary); }
    openfga-model-graph { display: block; height: 100vh; }
  </style>
</head>
<body>
  <openfga-model-graph id="graph"></openfga-model-graph>
  <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
}
```

## 4. Wire messages in the webview script

```typescript
// src/webview/index.ts
import '@openfga/playground-components/model-graph';

const vscode = acquireVsCodeApi();
const graph = document.getElementById('graph') as HTMLElement & {
  model: object | null;
};

// Receive messages from the extension host
window.addEventListener('message', (event: MessageEvent) => {
  const message = event.data as { type: string; model?: object };

  if (message.type === 'setModel' && message.model) {
    graph.model = message.model;
  }
});

// Send events back to the extension host
graph.addEventListener('node-select', (e: Event) => {
  const detail = (e as CustomEvent<{ type: string; relation?: string }>).detail;
  vscode.postMessage({ type: 'nodeSelected', ...detail });
});
```

> **TypeScript**: VS Code provides `acquireVsCodeApi` as a global. Add `@types/vscode-webview` to your devDependencies to get its type declaration.

## 5. Use VS Code's colour tokens (optional)

VS Code exposes its current theme as CSS custom properties on the webview body. You can map these to `--openfga-*` tokens so the graph adapts to the user's VS Code theme:

```css
:root {
  /* Map VS Code theme variables to OpenFGA tokens */
  --openfga-bg-primary: var(--vscode-editor-background, #1e1e2e);
  --openfga-bg-secondary: var(--vscode-sideBar-background, #181825);
  --openfga-text-primary: var(--vscode-editor-foreground, #cdd6f4);
  --openfga-text-secondary: var(--vscode-descriptionForeground, #a6adc8);
  --openfga-border: var(--vscode-panel-border, #45475a);
  --openfga-accent: var(--vscode-textLink-foreground, #89b4fa);
  --openfga-success: var(--vscode-testing-iconPassed, #a6e3a1);
  --openfga-error: var(--vscode-testing-iconFailed, #f38ba8);
  --openfga-graph-bg: var(--vscode-sideBar-background, #181825);
  --openfga-font-family: var(--vscode-font-family, sans-serif);
  --openfga-font-mono: var(--vscode-editor-font-family, monospace);
}
```

## 6. Content Security Policy

VS Code enforces a strict CSP on webviews. Key rules:

| Need | CSP directive |
|---|---|
| Run your bundle | `script-src 'nonce-<nonce>'` |
| Shadow DOM inline styles | `style-src 'unsafe-inline'` |
| Monaco fonts (if used) | `font-src data:` |
| Monaco workers (if used) | `worker-src blob:` |
| Cytoscape canvas | *(no extra directives needed)* |

Generate a fresh cryptographic nonce per webview creation (as shown above). Never reuse nonces.

## 7. Monaco and Web Workers

If you need the model editor (`openfga-model-editor`), Monaco requires Web Workers. In a webview:

1. The worker scripts must be served from a `webview.asWebviewUri` URI — they cannot use `blob:` URLs by default unless you add `worker-src blob:` to CSP.
2. The recommended approach is to use `MonacoEnvironment.getWorkerUrl` to point at your bundled worker files:

```typescript
// src/webview/index.ts (before importing Monaco or model-editor)
declare global {
  interface Window {
    MonacoEnvironment: { getWorkerUrl: (id: string, label: string) => string };
  }
}

// The extension must pass the webview URI for each worker file as a message
window.MonacoEnvironment = {
  getWorkerUrl(_id: string, label: string) {
    if (label === 'editorWorkerService') return window.__editorWorkerUri;
    return window.__editorWorkerUri; // fallback
  },
};
```

In practice, for most documentation or visualisation use cases, `model-graph` (Cytoscape) is simpler to embed in a webview than `model-editor` (Monaco). Reserve Monaco for use cases where users need to author DSL inside the extension.

## Complete example: model graph panel

A minimal end-to-end example is in [`example/vscode-extension/`](../example/vscode-extension/) (if present), showing:

- Extension activation and command registration
- Webview panel creation with correct CSP
- Bundling with esbuild
- `postMessage` wiring between extension host and webview

## Troubleshooting

**"Refused to execute script" in webview console**
→ The script URI is not in `localResourceRoots`, or the `nonce` in the CSP doesn't match the `<script>` tag.

**Graph renders at 0px height**
→ Set `height` explicitly on the `<openfga-model-graph>` element. It does not auto-size from content.

**`acquireVsCodeApi is not defined`**
→ The webview script is loading outside VS Code (e.g., in a browser during development). Guard with `typeof acquireVsCodeApi !== 'undefined'`.

**Cytoscape canvas is blank**
→ The graph needs non-zero dimensions at mount time. If the panel is created hidden, call `cy.resize()` when it becomes visible using the VS Code `onDidChangeViewState` event.
