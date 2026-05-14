// SPDX-License-Identifier: Apache-2.0
import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import {
  $activeServerId,
  $activeModelId,
  $modelVersions,
  $servers,
} from '@openfga/playground-core';
import { formatUlidDate } from '../utils/ulid.js';

export interface ModelVersionSelectDetail {
  modelId: string;
}

/**
 * Model version selector toolbar widget.
 *
 * Reads model versions from `$modelVersions` and the active model ID from
 * `$activeModelId`. Dispatches `model-version-select` with `{ modelId }` when
 * the user picks a different version; the shell handles the backend call.
 *
 * Hidden when the active server's `capabilities.storeList` is false.
 */
@customElement('openfga-model-selector')
export class ModelSelector extends LitElement {
  static override styles = css`
    :host {
      display: contents;
    }
    .wrapper {
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
      padding: 2px 5px;
      font-size: 10px;
      font-family: var(--openfga-font-mono, monospace);
      outline: none;
      max-width: 150px;
    }
    select:focus { border-color: var(--openfga-accent, #cba6f7); }
  `;

  @state() private _serverId: string | null = null;
  @state() private _activeModelId: string | null = null;
  @state() private _versions: ReadonlyArray<{ id: string; createdAt: string }> = [];

  private _unsubs: Array<() => void> = [];

  override connectedCallback() {
    super.connectedCallback();
    this._unsubs.push(
      $activeServerId.subscribe((id) => { this._serverId = id; }),
      $activeModelId.subscribe((id) => { this._activeModelId = id; }),
      $modelVersions.subscribe((v) => { this._versions = v; }),
      $servers.subscribe(() => { this.requestUpdate(); }),
    );
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    for (const u of this._unsubs) u();
    this._unsubs = [];
  }

  override render() {
    if (!this._serverId) return nothing;

    if (this._versions.length === 0) return nothing;

    return html`
      <div class="wrapper">
        <label for="model-version-select">Version</label>
        <select
          id="model-version-select"
          aria-label="Model version"
          .value=${this._activeModelId ?? ''}
          @change=${this._handleChange}
        >
          ${!this._activeModelId
            ? html`<option value="" disabled selected>— select —</option>`
            : nothing}
          ${this._versions.map((v) => {
            const date = formatUlidDate(v.id);
            return html`
              <option value=${v.id} ?selected=${v.id === this._activeModelId}>
                ${v.id.slice(0, 8)}…${date ? ` — ${date}` : ''}
              </option>
            `;
          })}
        </select>
      </div>
    `;
  }

  private _handleChange(e: Event) {
    const modelId = (e.target as HTMLSelectElement).value;
    if (!modelId || modelId === this._activeModelId) return;
    this.dispatchEvent(
      new CustomEvent<ModelVersionSelectDetail>('model-version-select', {
        detail: { modelId },
        bubbles: true,
        composed: true,
      }),
    );
  }

}

declare global {
  interface HTMLElementTagNameMap {
    'openfga-model-selector': ModelSelector;
  }
}
