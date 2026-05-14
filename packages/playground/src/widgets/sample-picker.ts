// SPDX-License-Identifier: Apache-2.0
import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { loadSampleList, loadSample } from '@openfga/playground-core';

interface SampleEntry {
  name: string;
  downloadUrl: string;
}

/**
 * Sample store picker toolbar widget.
 *
 * Samples are **read-only references**, not importable as working state.
 * Selecting a sample opens a preview modal that displays the YAML. The user
 * can download it to disk and then explicitly import it via the YAML toolbar
 * if they want to use it as a starting point. This prevents accidental loss
 * of the user's current working state.
 */
@customElement('openfga-sample-picker')
export class SamplePicker extends LitElement {
  static override styles = css`
    :host {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    label {
      font-size: 10px;
      color: var(--openfga-text-secondary, #a6adc8);
      text-transform: uppercase;
      letter-spacing: 0.04em;
      white-space: nowrap;
    }
    select {
      background: var(--openfga-bg-primary, #1e1e2e);
      color: var(--openfga-text-primary, #cdd6f4);
      border: 1px solid var(--openfga-border, #313244);
      border-radius: var(--openfga-radius-sm, 4px);
      padding: 3px 6px;
      font-size: 11px;
      outline: none;
      max-width: 180px;
    }
    select:focus { border-color: var(--openfga-accent, #cba6f7); }
    select:disabled { opacity: 0.5; }
    .spinner {
      width: 12px; height: 12px;
      border: 2px solid var(--openfga-border, #313244);
      border-top-color: var(--openfga-accent, #cba6f7);
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
      flex-shrink: 0;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* ---- preview modal ---- */
    .backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.55);
      z-index: 80;
    }
    .modal {
      position: fixed;
      top: 40px;
      left: 50%;
      transform: translateX(-50%);
      width: min(760px, 92vw);
      max-height: calc(100vh - 80px);
      background: var(--openfga-bg-primary, #1e1e2e);
      border: 1px solid var(--openfga-border, #313244);
      border-radius: var(--openfga-radius, 8px);
      z-index: 81;
      display: flex;
      flex-direction: column;
      box-shadow: 0 8px 32px rgba(0,0,0,0.6);
      color: var(--openfga-text-primary, #cdd6f4);
    }
    .modal-header {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 14px;
      background: var(--openfga-bg-secondary, #181825);
      border-bottom: 1px solid var(--openfga-border, #45475a);
      border-radius: 8px 8px 0 0;
      flex-shrink: 0;
    }
    .modal-title {
      flex: 1;
      font-weight: 600;
      font-size: 13px;
      font-family: var(--openfga-font-mono, monospace);
      color: var(--openfga-text-primary, #cdd6f4);
    }
    .modal-readonly {
      font-size: 10px;
      padding: 2px 6px;
      border-radius: 3px;
      background: var(--openfga-border, #45475a);
      color: var(--openfga-text-secondary, #a6adc8);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .modal-close {
      cursor: pointer;
      background: transparent;
      border: none;
      color: var(--openfga-text-secondary, #a6adc8);
      font-size: 18px;
      line-height: 1;
      padding: 2px 6px;
    }
    .modal-close:hover { color: var(--openfga-text-primary, #cdd6f4); }
    .modal-note {
      padding: 8px 14px;
      background: var(--openfga-bg-elevated, #313244);
      border-bottom: 1px solid var(--openfga-border, #45475a);
      font-size: 11px;
      color: var(--openfga-text-secondary, #a6adc8);
      line-height: 1.5;
      flex-shrink: 0;
    }
    .modal-yaml {
      flex: 1;
      min-height: 0;
      overflow: auto;
      padding: 12px 14px;
      font-family: var(--openfga-font-mono, monospace);
      font-size: 11px;
      line-height: 1.5;
      white-space: pre;
      color: var(--openfga-text-primary, #cdd6f4);
      background: var(--openfga-bg-primary, #1e1e2e);
    }
    .modal-actions {
      display: flex;
      gap: 8px;
      padding: 10px 14px;
      border-top: 1px solid var(--openfga-border, #45475a);
      flex-shrink: 0;
    }
    .modal-actions button {
      cursor: pointer;
      font-family: inherit;
      font-size: 12px;
      padding: 6px 14px;
      border-radius: 4px;
      border: 1px solid var(--openfga-border, #45475a);
      background: transparent;
      color: var(--openfga-text-primary, #cdd6f4);
    }
    .modal-actions button:hover { border-color: var(--openfga-accent, #89b4fa); }
    .modal-actions .primary {
      background: var(--openfga-accent, #89b4fa);
      color: var(--openfga-accent-text, #1e1e2e);
      border-color: var(--openfga-accent, #89b4fa);
      font-weight: 600;
    }
  `;

  @state() private _samples: SampleEntry[] = [];
  @state() private _loadingSamples = false;
  @state() private _loadingYaml = false;
  @state() private _loadError = '';
  @state() private _previewOpen = false;
  @state() private _previewName = '';
  @state() private _previewYaml = '';

  override async connectedCallback() {
    super.connectedCallback();
    await this._fetchSamples();
  }

  private async _fetchSamples() {
    this._loadingSamples = true;
    this._loadError = '';
    try {
      const list = await loadSampleList();
      this._samples = list.map((s) => ({ name: s.name, downloadUrl: s.downloadUrl }));
    } catch {
      this._loadError = 'Could not load samples';
    } finally {
      this._loadingSamples = false;
    }
  }

  private async _openSamplePreview(e: Event) {
    const select = e.target as HTMLSelectElement;
    const url = select.value;
    if (!url) return;
    const name = select.options[select.selectedIndex]?.text ?? 'Sample';
    // Reset so the same sample can be re-selected
    select.value = '';

    this._loadingYaml = true;
    try {
      const yaml = await loadSample(url);
      this._previewName = name;
      this._previewYaml = yaml;
      this._previewOpen = true;
    } catch (err) {
      alert(`Failed to load sample: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      this._loadingYaml = false;
    }
  }

  private _downloadSample() {
    const blob = new Blob([this._previewYaml], { type: 'text/yaml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${this._previewName.replace(/[^\w-]+/g, '-')}.fga.yaml`;
    a.click();
    URL.revokeObjectURL(url);
  }

  private _closePreview() {
    this._previewOpen = false;
    this._previewYaml = '';
    this._previewName = '';
  }

  override render() {
    if (this._loadingSamples) {
      return html`<div class="spinner" aria-label="Loading samples…" role="status"></div>`;
    }
    if (this._loadError) return nothing;

    return html`
      <label for="sample-select">Sample</label>
      <select
        id="sample-select"
        aria-label="View a sample store"
        ?disabled=${this._loadingYaml}
        @change=${this._openSamplePreview}
      >
        <option value="">— view sample —</option>
        ${this._samples.map(
          (s) => html`<option value=${s.downloadUrl}>${s.name}</option>`,
        )}
      </select>
      ${this._loadingYaml
        ? html`<div class="spinner" aria-label="Loading sample…" role="status"></div>`
        : nothing}

      ${this._previewOpen
        ? html`
            <div class="backdrop" @click=${this._closePreview}></div>
            <div class="modal" role="dialog" aria-label="Sample preview" aria-modal="true">
              <div class="modal-header">
                <span class="modal-title">${this._previewName}</span>
                <span class="modal-readonly">Read-only</span>
                <button class="modal-close" aria-label="Close preview" @click=${this._closePreview}>×</button>
              </div>
              <div class="modal-note">
                Samples are reference-only. To work with this sample, download
                it and then import it via the YAML toolbar. This prevents
                accidentally replacing your current work.
              </div>
              <div class="modal-yaml">${this._previewYaml}</div>
              <div class="modal-actions">
                <button class="primary" @click=${this._downloadSample}>Download YAML</button>
                <button @click=${this._closePreview}>Close</button>
              </div>
            </div>
          `
        : nothing}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'openfga-sample-picker': SamplePicker;
  }
}
