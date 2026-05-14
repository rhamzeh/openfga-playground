// SPDX-License-Identifier: Apache-2.0
import { LitElement, html, css } from 'lit';
import { customElement } from 'lit/decorators.js';
import { importFromYaml, exportToYaml } from '@openfga/playground-core';

/**
 * YAML import/export toolbar widget.
 *
 * Import: opens a file picker, reads the selected `.fga.yaml` and calls
 * `importFromYaml` from core (which updates model, tuples, and assertions).
 *
 * Export: calls `exportToYaml` from core and triggers a browser download.
 */
@customElement('openfga-yaml-toolbar')
export class YamlToolbar extends LitElement {
  static override styles = css`
    :host {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    button {
      cursor: pointer;
      background: transparent;
      color: var(--openfga-text-secondary, #a6adc8);
      border: 1px solid var(--openfga-border, #313244);
      border-radius: var(--openfga-radius-sm, 4px);
      font-size: 11px;
      font-family: inherit;
      padding: 3px 8px;
      white-space: nowrap;
      transition: color 0.1s, border-color 0.1s;
    }
    button:hover {
      color: var(--openfga-text-primary, #cdd6f4);
      border-color: var(--openfga-text-secondary, #a6adc8);
    }
    /* visually hidden file input */
    input[type='file'] {
      position: absolute;
      width: 1px; height: 1px;
      overflow: hidden;
      clip: rect(0 0 0 0);
    }
  `;

  private _triggerImport() {
    this.shadowRoot?.querySelector<HTMLInputElement>('#yaml-file-input')?.click();
  }

  private async _onFileSelected(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      importFromYaml(text);
    } catch (err) {
      console.error('YAML import failed:', err);
      alert(`Import failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      // Reset input so the same file can be re-selected
      (e.target as HTMLInputElement).value = '';
    }
  }

  private _export() {
    const yaml = exportToYaml();
    const blob = new Blob([yaml], { type: 'text/yaml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'model.fga.yaml';
    a.click();
    URL.revokeObjectURL(url);
  }

  override render() {
    return html`
      <input
        id="yaml-file-input"
        type="file"
        accept=".yaml,.yml,.fga.yaml"
        aria-hidden="true"
        tabindex="-1"
        @change=${this._onFileSelected}
      />
      <button aria-label="Import .fga.yaml file" @click=${this._triggerImport}>
        ↑ Import
      </button>
      <button aria-label="Export as .fga.yaml" @click=${this._export}>
        ↓ Export
      </button>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'openfga-yaml-toolbar': YamlToolbar;
  }
}
