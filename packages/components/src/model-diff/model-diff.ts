// SPDX-License-Identifier: Apache-2.0
import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { constants, theming } from '@openfga/frontend-utils';

const OPENFGA_LANGUAGE_NAME = constants.LANGUAGE_NAME; // 'dsl.openfga'
const DEFAULT_SCHEMA_VERSION = constants.DEFAULT_SCHEMA_VERSION;

type MonacoDiffEditor = import('monaco-editor').editor.IStandaloneDiffEditor;

/**
 * `<openfga-model-diff>`
 *
 * Side-by-side (or inline) diff view for two authorization model strings,
 * powered by Monaco's diff editor. Read-only; no events emitted.
 *
 * @prop {string}       modelA  - Left/original model text.
 * @prop {string}       modelB  - Right/modified model text.
 * @prop {string}       labelA  - Label shown above the left (original) side.
 * @prop {string}       labelB  - Label shown above the right (modified) side.
 * @prop {'dsl'|'json'} format  - Language mode for both sides.
 */
@customElement('openfga-model-diff')
export class ModelDiff extends LitElement {
  static override styles = css`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      background: var(--openfga-editor-bg, #1e1e2e);
      overflow: hidden;
    }

    .toolbar {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 4px 8px;
      background: var(--openfga-bg-secondary, #181825);
      border-bottom: 1px solid var(--openfga-border, #45475a);
      flex-shrink: 0;
      font-size: 11px;
      font-family: var(--openfga-font-family, sans-serif);
    }

    .toolbar-label {
      color: var(--openfga-text-secondary, #a6adc8);
      flex: 1;
      font-family: var(--openfga-font-mono, monospace);
    }

    .toolbar-label strong {
      color: var(--openfga-text-primary, #cdd6f4);
      font-weight: 600;
    }

    .btn-toggle {
      cursor: pointer;
      background: transparent;
      color: var(--openfga-text-secondary, #a6adc8);
      border: 1px solid var(--openfga-border, #313244);
      border-radius: var(--openfga-radius-sm, 4px);
      font-size: 11px;
      font-family: inherit;
      padding: 2px 8px;
    }
    .btn-toggle:hover { color: var(--openfga-text-primary, #cdd6f4); }
    .btn-toggle[aria-pressed='true'] {
      color: var(--openfga-accent, #cba6f7);
      border-color: var(--openfga-accent, #cba6f7);
    }

    .diff-container {
      flex: 1;
      min-height: 0;
    }

    .monaco-host {
      width: 100%;
      height: 100%;
    }

    /* Same overflow widget container pattern as model-editor */
    .monaco-overflow-widgets-container {
      position: fixed;
      top: 0;
      left: 0;
      width: 0;
      height: 0;
      overflow: visible;
      pointer-events: none;
      z-index: 9999;
    }
    .monaco-overflow-widgets-container > * {
      pointer-events: auto;
    }
  `;

  @property({ type: String }) modelA = '';
  @property({ type: String }) modelB = '';
  @property({ type: String }) labelA = '';
  @property({ type: String }) labelB = '';
  @property({ type: String }) format: 'dsl' | 'json' = 'dsl';
  @property({ type: String }) theme: 'dark' | 'light' = 'dark';

  @state() private _inline = false;

  private _diffEditor: MonacoDiffEditor | null = null;
  private _overflowContainer: HTMLDivElement | null = null;
  private _styleObserver: MutationObserver | null = null;
  private _mirroredStyles = new WeakSet<Node>();

  override connectedCallback() {
    super.connectedCallback();
    this._initDiffEditor();
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this._styleObserver?.disconnect();
    this._styleObserver = null;
    this._diffEditor?.dispose();
    this._diffEditor = null;
    this._overflowContainer?.remove();
    this._overflowContainer = null;
  }

  override updated(changed: Map<string, unknown>) {
    if (!this._diffEditor) return;

    if (changed.has('modelA') || changed.has('modelB')) {
      this._updateModels();
    }

    if (changed.has('format')) {
      this._updateLanguage();
    }

    if (changed.has('theme')) {
      this._updateMonacoTheme();
    }

    if (changed.has('_inline')) {
      this._diffEditor.updateOptions({ renderSideBySide: !this._inline });
    }
  }

  override render() {
    return html`
      <div class="toolbar" role="toolbar" aria-label="Diff controls">
        <span class="toolbar-label">
          <strong>${this.labelA || 'Original'}</strong>
          &nbsp;→&nbsp;
          <strong>${this.labelB || 'Modified'}</strong>
        </span>
        <!-- Inline diff toggle hidden: renderSideBySide:false doesn't render
             correctly in Shadow DOM. Tracked in ISSUES.md. -->
      </div>
      <div class="diff-container">
        <div class="monaco-host" aria-label="Model diff view"></div>
      </div>
    `;
  }

  // ---------------------------------------------------------------------------
  // Monaco lifecycle
  // ---------------------------------------------------------------------------

  private async _initDiffEditor() {
    await this.updateComplete;

    const hostEl = this.shadowRoot?.querySelector('.monaco-host') as HTMLDivElement | null;
    if (!hostEl) return;

    // Mirror document.head styles into shadow root so Monaco's CSS (syntax
    // highlighting, diff decorations, cursor) reaches the editor DOM nodes.
    this._mirrorDocumentStyles();

    const [monaco, frontendUtils] = await Promise.all([
      import('monaco-editor'),
      import('@openfga/frontend-utils').catch(() => null),
    ]);

    const { MonacoExtensions } = (frontendUtils as typeof import('@openfga/frontend-utils') | null)?.tools ?? {};
    if (MonacoExtensions) {
      MonacoExtensions.registerDSL(monaco, DEFAULT_SCHEMA_VERSION, {});
      monaco.editor.defineTheme(theming.SupportedTheme.OpenFgaDark, MonacoExtensions.monacoThemes[theming.SupportedTheme.OpenFgaDark]);
      monaco.editor.defineTheme(theming.SupportedTheme.OpenFgaLight, MonacoExtensions.monacoThemes[theming.SupportedTheme.OpenFgaLight]);
    }

    const overflowContainer = document.createElement('div');
    overflowContainer.className = 'monaco-overflow-widgets-container';
    this.shadowRoot!.appendChild(overflowContainer);
    this._overflowContainer = overflowContainer;

    const lang = this._monacoLanguage();
    const originalModel = monaco.editor.createModel(this.modelA, lang);
    const modifiedModel = monaco.editor.createModel(this.modelB, lang);

    this._diffEditor = monaco.editor.createDiffEditor(hostEl, {
      theme: MonacoExtensions ? this._monacoThemeName() : (this.theme === 'light' ? 'vs' : 'vs-dark'),
      readOnly: true,
      renderSideBySide: !this._inline,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      fontSize: 13,
      fontFamily: 'var(--openfga-font-mono)',
      automaticLayout: true,
      ignoreTrimWhitespace: false,
      overflowWidgetsDomNode: overflowContainer,
      fixedOverflowWidgets: true,
    });

    this._diffEditor.setModel({ original: originalModel, modified: modifiedModel });

    // Snapshot styles Monaco injected synchronously during createDiffEditor.
    this._snapshotDocumentStyles();

    // Copy editor theme classes so .monaco-editor ancestor CSS selectors match
    // on the overflow container (same pattern as model-editor).
    const editorDom = hostEl.querySelector('.monaco-editor') as HTMLElement | null;
    if (editorDom) {
      editorDom.classList.forEach((cls: string) => overflowContainer.classList.add(cls));
    }
  }

  private _mirrorDocumentStyles() {
    if (!this.shadowRoot) return;
    this._styleObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach((node) => {
          if (
            this.shadowRoot &&
            !this._mirroredStyles.has(node) &&
            (node instanceof HTMLStyleElement ||
              (node instanceof HTMLLinkElement && node.rel === 'stylesheet'))
          ) {
            this._mirroredStyles.add(node);
            this.shadowRoot.appendChild(node.cloneNode(true));
          }
        });
      }
    });
    this._styleObserver.observe(document.head, { childList: true });
    this._snapshotDocumentStyles();
  }

  private _snapshotDocumentStyles() {
    if (!this.shadowRoot) return;
    document.head.querySelectorAll('style, link[rel="stylesheet"]').forEach((el) => {
      if (!this._mirroredStyles.has(el)) {
        this._mirroredStyles.add(el);
        this.shadowRoot!.appendChild(el.cloneNode(true));
      }
    });
  }

  private _monacoLanguage(): string {
    return this.format === 'json' ? 'json' : OPENFGA_LANGUAGE_NAME;
  }

  private _monacoThemeName(): string {
    return this.theme === 'light' ? theming.SupportedTheme.OpenFgaLight : theming.SupportedTheme.OpenFgaDark;
  }

  private _updateMonacoTheme() {
    import('monaco-editor').then((monaco) => {
      monaco.editor.setTheme(this._monacoThemeName());
    });
  }

  private _updateModels() {
    const diffEditor = this._diffEditor;
    if (!diffEditor) return;
    const model = diffEditor.getModel();
    if (!model) return;
    model.original.setValue(this.modelA);
    model.modified.setValue(this.modelB);
  }

  private _updateLanguage() {
    const diffEditor = this._diffEditor;
    if (!diffEditor) return;
    import('monaco-editor').then((monaco) => {
      const model = diffEditor.getModel();
      if (!model) return;
      const lang = this._monacoLanguage();
      monaco.editor.setModelLanguage(model.original, lang);
      monaco.editor.setModelLanguage(model.modified, lang);
    });
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'openfga-model-diff': ModelDiff;
  }
}
