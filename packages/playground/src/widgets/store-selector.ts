// SPDX-License-Identifier: Apache-2.0
import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import {
  $activeServerId,
  $activeStoreId,
  $servers,
  setActiveStore,
} from '@openfga/playground-core';

/** Event detail for creating a new store on the active server. */
export interface StoreCreateRequestDetail {
  serverId: string;
  name: string;
}

/** Event detail for deleting a store on the active server. */
export interface StoreDeleteRequestDetail {
  serverId: string;
  storeId: string;
}

/**
 * Store selector toolbar widget.
 *
 * Reads stores from the active server's `stores[]` array in state.
 * When the active server has `capabilities.storeCrud = true`:
 *   - Shows a `<select>` to switch stores plus "New" and "Delete" buttons
 * When `storeCrud = false`:
 *   - Shows the active store ID as static text (no dropdown, no buttons)
 *
 * This works for all backend adapters — store CRUD is an OpenFGA API
 * concern, distinct from proxy-level connection management.
 */
@customElement('openfga-store-selector')
export class StoreSelector extends LitElement {
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
      font-family: var(--openfga-font-mono, monospace);
      outline: none;
      max-width: 160px;
    }
    select:focus { border-color: var(--openfga-accent, #cba6f7); }
    .static-id {
      font-family: var(--openfga-font-mono, monospace);
      font-size: 11px;
      color: var(--openfga-text-primary, #cdd6f4);
      max-width: 140px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .btn {
      cursor: pointer;
      background: transparent;
      color: var(--openfga-text-secondary, #a6adc8);
      border: 1px solid var(--openfga-border, #313244);
      border-radius: var(--openfga-radius-sm, 4px);
      font-size: 10px;
      font-family: inherit;
      padding: 2px 8px;
      white-space: nowrap;
    }
    .btn:hover { color: var(--openfga-text-primary, #cdd6f4); border-color: var(--openfga-accent, #89b4fa); }
    .btn:disabled { opacity: 0.4; cursor: not-allowed; }
    .btn-danger:hover { color: var(--openfga-error, #f38ba8); border-color: var(--openfga-error, #f38ba8); }
  `;

  @state() private _serverId: string | null = null;
  @state() private _storeId: string | null = null;

  private _unsubs: Array<() => void> = [];

  override connectedCallback() {
    super.connectedCallback();
    this._unsubs.push(
      $activeServerId.subscribe((id) => { this._serverId = id; }),
      $activeStoreId.subscribe((id) => { this._storeId = id; }),
      $servers.subscribe(() => { this.requestUpdate(); }),
    );
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    for (const u of this._unsubs) u();
    this._unsubs = [];
  }

  private _createStore() {
    if (!this._serverId) return;
    const name = prompt('New store name:');
    if (!name || !name.trim()) return;
    this.dispatchEvent(new CustomEvent<StoreCreateRequestDetail>('store-create-request', {
      detail: { serverId: this._serverId, name: name.trim() },
      bubbles: true, composed: true,
    }));
  }

  private _deleteStore() {
    if (!this._serverId || !this._storeId) return;
    if (!confirm(`Delete store ${this._storeId}?\n\nThis deletes the store on the OpenFGA server and cannot be undone.`)) return;
    this.dispatchEvent(new CustomEvent<StoreDeleteRequestDetail>('store-delete-request', {
      detail: { serverId: this._serverId, storeId: this._storeId },
      bubbles: true, composed: true,
    }));
  }

  override render() {
    if (!this._serverId) return nothing;

    const server = $servers.get()[this._serverId];
    if (!server) return nothing;

    const stores = server.stores ?? [];
    const storeList = server.capabilities.storeList;
    const storeCrud = server.capabilities.storeCrud;

    return html`
      <label for="store-select">Store</label>
      ${storeList
        ? html`
            <select
              id="store-select"
              aria-label="Active store"
              .value=${this._storeId ?? ''}
              @change=${(e: Event) => setActiveStore((e.target as HTMLSelectElement).value)}
            >
              ${!this._storeId ? html`<option value="" disabled selected>— select store —</option>` : nothing}
              ${stores.map(
                (s) => html`<option value=${s.storeId} ?selected=${s.storeId === this._storeId}>
                  ${s.alias ?? s.storeId}
                </option>`,
              )}
            </select>
          `
        : html`
            <span class="static-id" title=${this._storeId ?? ''}>${this._storeId ?? '—'}</span>
          `}
      ${storeCrud
        ? html`
            <button
              class="btn"
              type="button"
              aria-label="Create new store"
              title="Create a new store on this OpenFGA server"
              @click=${this._createStore}
            >+ New</button>
            <button
              class="btn btn-danger"
              type="button"
              aria-label="Delete active store"
              title="Delete the currently selected store"
              ?disabled=${!this._storeId}
              @click=${this._deleteStore}
            >× Delete</button>
          `
        : nothing}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'openfga-store-selector': StoreSelector;
  }
}
