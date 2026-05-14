// SPDX-License-Identifier: Apache-2.0
import { LitElement, html } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { modelEditorStyles } from './model-editor.css.js';
import type { ValidationError, ModelChangeDetail, FormatChangeDetail } from '../shared/types.js';
import { theming, constants } from '@openfga/frontend-utils';

const DEFAULT_SCHEMA_VERSION = constants.DEFAULT_SCHEMA_VERSION;
const OPENFGA_LANGUAGE_NAME = constants.LANGUAGE_NAME; // 'dsl.openfga'

// Monaco and frontend-utils are loaded lazily to keep the initial bundle small.
// They are heavy deps (~2MB) and not needed until the editor mounts.
type MonacoEditor = import('monaco-editor').editor.IStandaloneCodeEditor;

/**
 * `<openfga-model-editor>`
 *
 * A code editor for OpenFGA authorization model DSL and JSON.
 * Wraps Monaco with @openfga/frontend-utils bindings for:
 *   - OpenFGA DSL syntax highlighting and autocompletion
 *   - Inline validation markers from the `errors` prop
 *   - DSL ↔ JSON toggle via @openfga/syntax-transformer
 *
 * @prop {string}           model    - Current model text (DSL or JSON string).
 * @prop {'dsl'|'json'}     format   - Current editor language mode.
 * @prop {ValidationError[]} errors  - Validation errors to display as markers.
 * @prop {boolean}          readonly - When true, the editor is not editable.
 *
 * @fires {CustomEvent<ModelChangeDetail>}  model-change  - When the model text changes.
 * @fires {CustomEvent<FormatChangeDetail>} format-change - When the format toggle is clicked.
 */
@customElement('openfga-model-editor')
export class ModelEditor extends LitElement {
  static override styles = modelEditorStyles;

  @property({ type: String }) model = '';
  @property({ type: String }) format: 'dsl' | 'json' = 'dsl';
  @property({ type: Array }) errors: ValidationError[] = [];
  @property({ type: Boolean }) readonly = false;
  @property({ type: String }) theme: 'dark' | 'light' = 'dark';

  @state() private _editorReady = false;

  private _editor: MonacoEditor | null = null;
  private _monacoHostEl: HTMLDivElement | null = null;
  private _overflowContainer: HTMLDivElement | null = null;
  private _markerTooltip: HTMLDivElement | null = null;
  private _styleObserver: MutationObserver | null = null;
  private _resizeObserver: ResizeObserver | null = null;
  private _mirroredStyles = new WeakSet<Node>();
  private _ignoreNextChange = false;

  override connectedCallback() {
    super.connectedCallback();
    this._initMonaco();
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this._styleObserver?.disconnect();
    this._styleObserver = null;
    this._resizeObserver?.disconnect();
    this._resizeObserver = null;
    this._editor?.dispose();
    this._editor = null;
    this._overflowContainer?.remove();
    this._overflowContainer = null;
    if (this._markerTooltip) {
      document.body.removeChild(this._markerTooltip);
      this._markerTooltip = null;
    }
  }

  override updated(changed: Map<string, unknown>) {
    if (!this._editor) return;

    if (changed.has('model')) {
      const current = this._editor.getValue();
      if (current !== this.model) {
        this._ignoreNextChange = true;
        this._editor.setValue(this.model);
      }
    }

    if (changed.has('errors')) {
      this._updateMarkers();
    }

    if (changed.has('readonly')) {
      this._editor.updateOptions({ readOnly: this.readonly });
    }

    if (changed.has('format')) {
      this._updateLanguage();
    }

    if (changed.has('theme')) {
      this._updateMonacoTheme();
    }
  }

  override render() {
    return html`
      <div class="toolbar" role="toolbar" aria-label="Model editor controls">
        <div class="format-toggle" role="group" aria-label="Format">
          <button
            class="format-btn"
            aria-pressed=${this.format === 'dsl'}
            @click=${() => this._handleFormatToggle('dsl')}
          >
            DSL
          </button>
          <button
            class="format-btn"
            aria-pressed=${this.format === 'json'}
            @click=${() => this._handleFormatToggle('json')}
          >
            JSON
          </button>
        </div>
      </div>

      <div class="editor-container">
        <div class="monaco-host" aria-label="Authorization model editor"></div>
      </div>

      ${this.errors.length > 0
        ? html`
            <div
              class="error-panel"
              role="region"
              aria-label="Validation errors"
              aria-live="polite"
            >
              <span class="error-badge">${this.errors.length} error${this.errors.length > 1 ? 's' : ''}</span>
              ${this.errors.map(
                (e) => html`
                  <div class="error-item">
                    <span class="error-location">Ln ${e.line}, Col ${e.column}</span>
                    <span class="error-message">${e.message}</span>
                  </div>
                `,
              )}
            </div>
          `
        : null}
    `;
  }

  // ---------------------------------------------------------------------------
  // Monaco lifecycle
  // ---------------------------------------------------------------------------

  private async _initMonaco() {
    // Wait for the host element to be rendered in the DOM.
    await this.updateComplete;

    const hostEl = this.shadowRoot?.querySelector('.monaco-host') as HTMLDivElement | null;
    if (!hostEl) return;
    this._monacoHostEl = hostEl;

    // Lazily import Monaco and frontend-utils. Both are large and should not
    // block the initial render.
    const [monaco, frontendUtils] = await Promise.all([
      import('monaco-editor'),
      import('@openfga/frontend-utils').catch(() => null),
    ]);

    // Register OpenFGA DSL language (syntax highlighting, autocompletion, hover).
    const { MonacoExtensions } = (frontendUtils as typeof import('@openfga/frontend-utils') | null)?.tools ?? {};
    if (MonacoExtensions) {
      MonacoExtensions.registerDSL(
        monaco,
        DEFAULT_SCHEMA_VERSION,
        {},
      );
      // Register both OpenFGA themes so setTheme() works at any point.
      monaco.editor.defineTheme(theming.SupportedTheme.OpenFgaDark, MonacoExtensions.monacoThemes[theming.SupportedTheme.OpenFgaDark]);
      monaco.editor.defineTheme(theming.SupportedTheme.OpenFgaLight, MonacoExtensions.monacoThemes[theming.SupportedTheme.OpenFgaLight]);
    }

    // Monaco injects its CSS (syntax highlighting, squiggly decorations, cursor
    // positioning) into document.head. Shadow DOM blocks those styles from the
    // editor's DOM nodes. Set up a MutationObserver to mirror document.head
    // styles into the shadow root for future injections, then also snapshot
    // after editor.create() to catch Monaco's synchronous theme CSS injection.
    this._mirrorDocumentStyles();

    // Monaco's overflow widgets (hover tooltips, completion details) render
    // outside the editor container by default. When the editor is inside a
    // Shadow DOM, those widgets land in document.body and lose access to
    // Monaco's CSS (which was injected into the shadow root). Fix: attach an
    // overflow container inside the shadow root and pass it to Monaco.
    const overflowContainer = document.createElement('div');
    overflowContainer.className = 'monaco-overflow-widgets-container';
    this.shadowRoot!.appendChild(overflowContainer);
    this._overflowContainer = overflowContainer;

    this._editor = monaco.editor.create(hostEl, {
      value: this.model,
      language: this._monacoLanguage(),
      readOnly: this.readonly,
      theme: MonacoExtensions ? this._monacoThemeName() : (this.theme === 'light' ? 'vs' : 'vs-dark'),
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      fontSize: 13,
      fontFamily: 'var(--openfga-font-mono)',
      lineNumbers: 'on',
      automaticLayout: true,
      tabSize: 2,
      insertSpaces: true,
      wordWrap: 'off',
      overflowWidgetsDomNode: overflowContainer,
      // Hover uses allowEditorOverflow=true content widgets which need
      // viewport-absolute coordinates when moved to an external container.
      fixedOverflowWidgets: true,
    });

    // Monaco synchronously injects theme CSS into document.head during
    // editor.create(). The MutationObserver fires asynchronously (next
    // microtask), so those styles aren't caught by the observer. Snapshot now
    // to pick up anything Monaco injected synchronously above.
    this._snapshotDocumentStyles();

    // Monaco's CSS rules for overflow widgets (context menu, hover panel, etc.)
    // are scoped to `.monaco-editor` as an ancestor selector, e.g.:
    //   .monaco-editor .context-view { background: ...; }
    // The overflow container is a sibling of .monaco-host in the shadow root,
    // not a descendant of .monaco-editor, so those rules never match.
    // Fix: copy Monaco's theme classes from the editor DOM node onto the
    // overflow container so the same ancestor selectors apply.
    const editorDom = this._editor.getDomNode();
    if (editorDom) {
      editorDom.classList.forEach((cls) => overflowContainer.classList.add(cls));
    }

    this._editor.onDidChangeModelContent(() => {
      if (this._ignoreNextChange) {
        this._ignoreNextChange = false;
        return;
      }
      this.dispatchEvent(
        new CustomEvent<ModelChangeDetail>('model-change', {
          detail: { value: this._editor!.getValue() },
          bubbles: true,
          composed: true,
        }),
      );
      // Re-validate immediately so Monaco markers update without waiting for
      // the shell round-trip (model-change → validateModel → errors prop).
      this._updateMarkers();
    });

    this._updateMarkers();
    this._setupMarkerTooltip(monaco);
    this._setupLayoutObservers();
    this._editorReady = true;
  }

  private _setupLayoutObservers() {
    if (!this._editor || !this._monacoHostEl) return;

    const relayout = () => {
      if (!this._editor || !this._monacoHostEl) return;
      const rect = this._monacoHostEl.getBoundingClientRect();
      this._editor.layout({
        width: Math.max(320, Math.floor(rect.width || 0)),
        height: Math.max(220, Math.floor(rect.height || 0)),
      });
    };

    this._resizeObserver?.disconnect();
    this._resizeObserver = new ResizeObserver(() => {
      relayout();
    });

    this._resizeObserver.observe(this._monacoHostEl);
    if (this._monacoHostEl.parentElement) {
      this._resizeObserver.observe(this._monacoHostEl.parentElement);
    }

    // Monaco may initialize before layout settles in embedding hosts (e.g. docs pages).
    // Force several layout passes across frame/microtask boundaries.
    relayout();
    requestAnimationFrame(() => {
      relayout();
      setTimeout(() => {
        relayout();
      }, 0);
      setTimeout(() => {
        relayout();
      }, 120);
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

  private _mirrorDocumentStyles() {
    if (!this.shadowRoot) return;

    // Mirror future additions (Monaco injects theme and decoration CSS at runtime).
    // Set up the observer first so no injections are missed.
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

    // Snapshot all styles currently in document.head (pre-editor styles).
    this._snapshotDocumentStyles();
  }

  /** Copy all <style>/<link> from document.head not yet mirrored into shadow root. */
  private _snapshotDocumentStyles() {
    if (!this.shadowRoot) return;
    document.head.querySelectorAll('style, link[rel="stylesheet"]').forEach((el) => {
      if (!this._mirroredStyles.has(el)) {
        this._mirroredStyles.add(el);
        this.shadowRoot!.appendChild(el.cloneNode(true));
      }
    });
  }

  private _updateLanguage() {
    if (!this._editor) return;
    const model = this._editor.getModel();
    if (!model) return;
    // Monaco language IDs: 'json' or 'openfga' (registered by frontend-utils)
    import('monaco-editor').then((monaco) => {
      monaco.editor.setModelLanguage(model, this._monacoLanguage());
    });
  }

  private _updateMarkers() {
    if (!this._editor) return;
    const dsl = this._editor.getValue();
    Promise.all([
      import('monaco-editor'),
      import('@openfga/frontend-utils').catch(() => null),
    ]).then(([monaco, frontendUtils]) => {
      const editorModel = this._editor?.getModel();
      if (!editorModel) return;

      // In DSL mode, use validateDSL from frontend-utils for rich markers with
      // accurate positions. In JSON mode (or if frontend-utils is unavailable),
      // fall back to the errors prop passed in from the shell.
      const { MonacoExtensions } = (frontendUtils as typeof import('@openfga/frontend-utils') | null)?.tools ?? {};
      if (this.format === 'dsl' && MonacoExtensions) {
        const markers = MonacoExtensions.validateDSL(monaco, dsl);
        monaco.editor.setModelMarkers(editorModel, 'openfga-validation', markers);
      } else {
        const markers = this.errors.map((e) => ({
          severity: monaco.MarkerSeverity.Error,
          startLineNumber: e.line,
          startColumn: e.column,
          endLineNumber: e.line,
          endColumn: e.column + 1,
          message: e.message,
        }));
        monaco.editor.setModelMarkers(editorModel, 'openfga-validation', markers);
      }
    });
  }

  /**
   * Custom marker hover tooltip — works around Monaco's broken hover widgets
   * in Shadow DOM. Listens to editor mouse events, checks for markers at the
   * hovered position, and shows a simple tooltip div we fully control.
   */
  private _setupMarkerTooltip(monaco: typeof import('monaco-editor')) {
    if (!this._editor) return;

    // Tooltip lives in document.body (outside all shadow roots) to avoid
    // containment/stacking issues. Inline styles since body has no component CSS.
    const tooltip = document.createElement('div');
    tooltip.id = 'openfga-marker-tooltip';
    document.body.appendChild(tooltip);
    this._markerTooltip = tooltip;

    let hideTimer: ReturnType<typeof setTimeout> | null = null;

    const showTooltip = (markers: Array<{ severity: number; message: string }>, x: number, y: number) => {
      if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
      tooltip.innerHTML = markers.map((m) => {
        const isError = m.severity === monaco.MarkerSeverity.Error;
        const color = isError ? '#f38ba8' : '#fab387';
        const label = isError ? 'Error' : 'Warning';
        return `<div style="display:flex;align-items:baseline;gap:6px">
          <span style="font-weight:600;font-size:10px;text-transform:uppercase;color:${color};flex-shrink:0">${label}</span>
          <span>${this._escapeHtml(m.message)}</span>
        </div>`;
      }).join('');

      tooltip.style.cssText = `
        position: fixed;
        display: block;
        z-index: 2147483647;
        left: ${x + 12}px;
        top: ${y + 16}px;
        max-width: 420px;
        padding: 6px 10px;
        background: #313244;
        border: 1px solid #585b70;
        border-radius: 4px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.5);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        font-size: 12px;
        line-height: 1.5;
        color: #cdd6f4;
        pointer-events: none;
      `;
    };

    const hideTooltip = () => {
      // Delay hiding so the tooltip doesn't flicker when Monaco fires
      // rapid mousemove events with intermittent null positions.
      if (hideTimer) return;
      hideTimer = setTimeout(() => {
        tooltip.style.display = 'none';
        hideTimer = null;
      }, 200);
    };

    this._editor.onMouseMove((e) => {
      if (!this._editor) return;

      const pos = e.target.position;
      const model = this._editor.getModel();
      if (!pos || !model) {
        // Don't hide immediately if we're still on the same line — Monaco
        // sometimes fires pos:null between content cells on the same line.
        hideTooltip();
        return;
      }

      const markers = monaco.editor.getModelMarkers({ resource: model.uri }).filter((m) =>
        pos.lineNumber >= m.startLineNumber && pos.lineNumber <= m.endLineNumber,
      );

      if (markers.length === 0) {
        hideTooltip();
        return;
      }

      const evt = e.event as unknown as Record<string, unknown>;
      const browserEvt = evt.browserEvent as MouseEvent | undefined;
      const x = browserEvt?.clientX ?? (evt.posx as number | undefined) ?? 0;
      const y = browserEvt?.clientY ?? (evt.posy as number | undefined) ?? 0;

      showTooltip(markers, x, y);
    });

    this._editor.onMouseLeave(() => { hideTooltip(); });
    this._editor.onDidScrollChange(() => {
      if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
      tooltip.style.display = 'none';
    });
  }

  private _escapeHtml(str: string): string {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // ---------------------------------------------------------------------------
  // Event handlers
  // ---------------------------------------------------------------------------

  private _handleFormatToggle(format: 'dsl' | 'json') {
    if (format === this.format) return;

    this.dispatchEvent(
      new CustomEvent<FormatChangeDetail>('format-change', {
        detail: { format },
        bubbles: true,
        composed: true,
      }),
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'openfga-model-editor': ModelEditor;
  }
}
