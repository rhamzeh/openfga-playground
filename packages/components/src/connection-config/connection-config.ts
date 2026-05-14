// SPDX-License-Identifier: Apache-2.0
import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import type {
  ServerConfig,
  CredentialsConfig,
  ServerAddDetail,
  ServerUpdateDetail,
  ServerRemoveDetail,
  ServerSelectDetail,
  StoreAddDetail,
  StoreCreateDetail,
  StoreUpdateDetail,
  StoreRemoveDetail,
  StoreSelectDetail,
} from '../shared/types.js';

type View = 'list' | 'server-form' | 'store-form';

interface ServerFormData {
  name: string;
  apiUrl: string;
  authMethod: 'none' | 'api_token' | 'client_credentials';
  apiToken: string;
  clientId: string;
  clientSecret: string;
  apiTokenIssuer: string;
  apiAudience: string;
  storeCrud: boolean;
  storeList: boolean;
}

interface StoreFormData {
  name: string;
  storeId: string;
  alias: string;
  modelId: string;
  hasAuthOverride: boolean;
  authMethod: 'none' | 'api_token' | 'client_credentials';
  apiToken: string;
  clientId: string;
  clientSecret: string;
  apiTokenIssuer: string;
  apiAudience: string;
}

const EMPTY_SERVER_FORM: ServerFormData = {
  name: '',
  apiUrl: '',
  authMethod: 'none',
  apiToken: '',
  clientId: '',
  clientSecret: '',
  apiTokenIssuer: '',
  apiAudience: '',
  storeCrud: true,
  storeList: true,
};

const EMPTY_STORE_FORM: StoreFormData = {
  name: '',
  storeId: '',
  alias: '',
  modelId: '',
  hasAuthOverride: false,
  authMethod: 'none',
  apiToken: '',
  clientId: '',
  clientSecret: '',
  apiTokenIssuer: '',
  apiAudience: '',
};

/**
 * `<openfga-connection-config>`
 *
 * Manages server connections and their store entries.
 * All mutations are expressed as events; the shell calls the backend.
 *
 * @prop {ServerConfig[]} servers        - All available server connections.
 * @prop {string}         activeServerId - Currently selected server ID.
 * @prop {string}         activeStoreId  - Currently selected store ID.
 *
 * @fires {CustomEvent<ServerAddDetail>}    server-add
 * @fires {CustomEvent<ServerUpdateDetail>} server-update
 * @fires {CustomEvent<ServerRemoveDetail>} server-remove
 * @fires {CustomEvent<ServerSelectDetail>} server-select
 * @fires {CustomEvent<StoreCreateDetail>}  store-create
 * @fires {CustomEvent<StoreUpdateDetail>}  store-update
 * @fires {CustomEvent<StoreRemoveDetail>}  store-remove
 * @fires {CustomEvent<StoreSelectDetail>}  store-select
 */
@customElement('openfga-connection-config')
export class ConnectionConfig extends LitElement {
  static override styles = css`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      background: var(--openfga-bg-primary, #1e1e2e);
      color: var(--openfga-text-primary, #cdd6f4);
      font-family: var(--openfga-font-family, sans-serif);
      font-size: var(--openfga-font-size-sm, 12px);
      overflow: hidden;
    }

    /* ---- header ---- */
    .panel-header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 14px;
      border-bottom: 1px solid var(--openfga-border, #313244);
      flex-shrink: 0;
    }
    .panel-header h2 {
      margin: 0;
      font-size: 11px;
      font-weight: 600;
      color: var(--openfga-text-secondary, #a6adc8);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      flex: 1;
    }

    /* ---- server list ---- */
    .server-list {
      flex: 1;
      overflow-y: auto;
      min-height: 0;
    }

    .server-row {
      border-bottom: 1px solid var(--openfga-border, #313244);
    }
    .server-header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 9px 14px;
      cursor: pointer;
      transition: background 0.1s;
    }
    .server-header:hover {
      background: var(--openfga-bg-hover, #24273a);
    }
    .server-header.active {
      background: color-mix(in srgb, var(--openfga-accent, #cba6f7) 10%, transparent);
      border-left: 3px solid var(--openfga-accent, #cba6f7);
      padding-left: 11px;
    }
    .server-expand {
      font-size: 10px;
      color: var(--openfga-text-secondary, #a6adc8);
      flex-shrink: 0;
      width: 12px;
    }
    .server-info {
      flex: 1;
      min-width: 0;
    }
    .server-name {
      font-weight: 600;
      color: var(--openfga-text-primary, #cdd6f4);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .server-url {
      font-family: var(--openfga-font-mono, monospace);
      font-size: 10px;
      color: var(--openfga-text-secondary, #a6adc8);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .server-badges {
      display: flex;
      gap: 4px;
      margin-top: 3px;
      flex-wrap: wrap;
    }
    .badge {
      font-size: 9px;
      font-weight: 600;
      padding: 1px 5px;
      border-radius: 3px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .badge-auth-none  { background: var(--openfga-bg-secondary, #181825); color: var(--openfga-text-secondary, #a6adc8); }
    .badge-auth-token { background: color-mix(in srgb, var(--openfga-success, #a6e3a1) 15%, transparent); color: var(--openfga-success, #a6e3a1); }
    .badge-auth-cc    { background: color-mix(in srgb, var(--openfga-accent, #cba6f7) 15%, transparent); color: var(--openfga-accent, #cba6f7); }
    .badge-cap        { background: var(--openfga-bg-secondary, #181825); color: var(--openfga-text-secondary, #a6adc8); }
    .server-actions   { display: flex; gap: 4px; flex-shrink: 0; }

    /* ---- store entries ---- */
    .store-entries {
      border-top: 1px solid var(--openfga-border, #313244);
      background: var(--openfga-bg-secondary, #181825);
    }
    .store-entry {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 7px 14px 7px 30px;
      border-bottom: 1px solid color-mix(in srgb, var(--openfga-border, #313244) 50%, transparent);
      cursor: pointer;
      transition: background 0.1s;
    }
    .store-entry:last-child { border-bottom: none; }
    .store-entry:hover { background: var(--openfga-bg-hover, #24273a); }
    .store-entry.active {
      background: color-mix(in srgb, var(--openfga-accent, #cba6f7) 8%, transparent);
      border-left: 2px solid var(--openfga-accent, #cba6f7);
      padding-left: 28px;
    }
    .store-entry-info { flex: 1; min-width: 0; }
    .store-entry-name {
      color: var(--openfga-text-primary, #cdd6f4);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .store-entry-id {
      font-family: var(--openfga-font-mono, monospace);
      font-size: 10px;
      color: var(--openfga-text-secondary, #a6adc8);
    }
    .store-entry-actions { display: flex; gap: 4px; flex-shrink: 0; }
    .add-store-row {
      padding: 6px 14px 6px 30px;
      border-top: 1px solid color-mix(in srgb, var(--openfga-border, #313244) 50%, transparent);
    }
    .btn-add-store {
      background: transparent;
      border: 1px dashed var(--openfga-border, #313244);
      color: var(--openfga-text-secondary, #a6adc8);
      border-radius: var(--openfga-radius-sm, 4px);
      font-size: 10px;
      font-family: inherit;
      padding: 3px 8px;
      cursor: pointer;
      width: 100%;
      text-align: left;
    }
    .btn-add-store:hover { border-color: var(--openfga-accent, #cba6f7); color: var(--openfga-accent, #cba6f7); }

    .empty-state {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 32px;
      color: var(--openfga-text-secondary, #a6adc8);
      opacity: 0.6;
    }

    /* ---- form view ---- */
    .form-view {
      flex: 1;
      overflow-y: auto;
      min-height: 0;
      padding: 14px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .form-section {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .form-section-title {
      font-size: 10px;
      font-weight: 600;
      color: var(--openfga-text-secondary, #a6adc8);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      padding-bottom: 4px;
      border-bottom: 1px solid var(--openfga-border, #313244);
    }
    .field {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .field label {
      font-size: 10px;
      color: var(--openfga-text-secondary, #a6adc8);
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    input[type='text'], input[type='url'], input[type='password'], select {
      background: var(--openfga-bg-secondary, #181825);
      color: var(--openfga-text-primary, #cdd6f4);
      border: 1px solid var(--openfga-border, #313244);
      border-radius: var(--openfga-radius-sm, 4px);
      padding: 6px 8px;
      font-size: 11px;
      font-family: var(--openfga-font-mono, monospace);
      outline: none;
      width: 100%;
      box-sizing: border-box;
    }
    input:focus, select:focus { border-color: var(--openfga-accent, #cba6f7); }
    input.error { border-color: var(--openfga-error, #f38ba8); }
    .field-hint {
      font-size: 10px;
      color: var(--openfga-text-secondary, #a6adc8);
      opacity: 0.7;
    }
    .capabilities-row {
      display: flex;
      gap: 16px;
    }
    .cap-label {
      display: flex;
      align-items: center;
      gap: 6px;
      cursor: pointer;
      font-size: 11px;
      color: var(--openfga-text-primary, #cdd6f4);
    }
    input[type='checkbox'] { width: auto; accent-color: var(--openfga-accent, #cba6f7); }
    .form-error {
      color: var(--openfga-error, #f38ba8);
      font-size: 11px;
    }
    .form-actions {
      display: flex;
      gap: 8px;
      justify-content: flex-end;
      padding-top: 4px;
    }

    /* ---- buttons ---- */
    button {
      cursor: pointer;
      border: none;
      border-radius: var(--openfga-radius-sm, 4px);
      font-size: 11px;
      font-family: inherit;
      padding: 5px 10px;
      transition: opacity 0.1s;
    }
    button:disabled { opacity: 0.4; cursor: not-allowed; }
    .btn-primary {
      background: var(--openfga-accent, #cba6f7);
      color: var(--openfga-bg-primary, #1e1e2e);
      font-weight: 600;
    }
    .btn-primary:hover:not(:disabled) { opacity: 0.85; }
    .btn-secondary {
      background: var(--openfga-bg-secondary, #181825);
      color: var(--openfga-text-primary, #cdd6f4);
      border: 1px solid var(--openfga-border, #313244);
    }
    .btn-secondary:hover:not(:disabled) { background: var(--openfga-bg-hover, #24273a); }
    .btn-icon {
      background: transparent;
      color: var(--openfga-text-secondary, #a6adc8);
      padding: 3px 6px;
      font-size: 13px;
      line-height: 1;
    }
    .btn-icon:hover { color: var(--openfga-text-primary, #cdd6f4); background: var(--openfga-bg-hover, #24273a); }
    .btn-danger {
      background: transparent;
      color: var(--openfga-error, #f38ba8);
      padding: 3px 6px;
      font-size: 13px;
      line-height: 1;
    }
    .btn-danger:hover { background: color-mix(in srgb, var(--openfga-error, #f38ba8) 10%, transparent); }
    .btn-add {
      background: var(--openfga-accent, #cba6f7);
      color: var(--openfga-bg-primary, #1e1e2e);
      font-weight: 600;
      padding: 4px 10px;
      font-size: 11px;
    }
    .btn-add:hover { opacity: 0.85; }

    .confirm-row {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 14px;
      background: color-mix(in srgb, var(--openfga-error, #f38ba8) 8%, transparent);
      border-bottom: 1px solid var(--openfga-border, #313244);
      font-size: 11px;
      color: var(--openfga-error, #f38ba8);
    }
    .confirm-row span { flex: 1; }

    .sr-live {
      position: absolute;
      width: 1px; height: 1px;
      overflow: hidden;
      clip: rect(0 0 0 0);
      white-space: nowrap;
    }
  `;

  @property({ type: Array }) servers: ServerConfig[] = [];
  @property({ type: String }) activeServerId = '';
  @property({ type: String }) activeStoreId = '';

  @state() private _view: View = 'list';
  @state() private _expandedServerIds = new Set<string>();
  @state() private _editingServerId: string | null = null;
  @state() private _editingStoreId: string | null = null;
  @state() private _storeFormServerId: string | null = null;
  @state() private _storeFormMode: 'create' | 'add' = 'create';
  @state() private _confirmDeleteServerId: string | null = null;
  @state() private _confirmDeleteStoreKey: string | null = null; // "serverId:storeId"
  @state() private _serverForm: ServerFormData = { ...EMPTY_SERVER_FORM };
  @state() private _storeForm: StoreFormData = { ...EMPTY_STORE_FORM };
  @state() private _formError = '';
  @state() private _liveMsg = '';

  // ---- server form helpers ----

  private _openAddServer() {
    this._serverForm = { ...EMPTY_SERVER_FORM };
    this._editingServerId = null;
    this._formError = '';
    this._view = 'server-form';
  }

  private _openEditServer(s: ServerConfig) {
    this._serverForm = {
      name: s.name,
      apiUrl: s.apiUrl,
      authMethod: s.auth.method,
      apiToken: '',
      clientId: '',
      clientSecret: '',
      apiTokenIssuer: s.auth.method === 'client_credentials' ? (s.auth.apiTokenIssuer ?? '') : '',
      apiAudience: s.auth.method === 'client_credentials' ? (s.auth.apiAudience ?? '') : '',
      storeCrud: s.capabilities.storeCrud,
      storeList: s.capabilities.storeList,
    };
    this._editingServerId = s.id;
    this._formError = '';
    this._view = 'server-form';
  }

  private _submitServerForm(e: Event) {
    e.preventDefault();
    const f = this._serverForm;
    if (!f.name.trim()) { this._formError = 'Name is required'; return; }
    if (!f.apiUrl.trim()) { this._formError = 'API URL is required'; return; }

    const authPayload: CredentialsConfig =
      f.authMethod === 'api_token'
        ? { method: 'api_token', apiToken: f.apiToken.trim() }
        : f.authMethod === 'client_credentials'
        ? {
            method: 'client_credentials',
            clientId: f.clientId.trim() || undefined,
            clientSecret: f.clientSecret.trim() || undefined,
            apiTokenIssuer: f.apiTokenIssuer.trim() || undefined,
            apiAudience: f.apiAudience.trim() || undefined,
          }
        : { method: 'none' };

    if (this._editingServerId) {
      this.dispatchEvent(new CustomEvent<ServerUpdateDetail>('server-update', {
        detail: {
          id: this._editingServerId,
          update: {
            name: f.name.trim(),
            apiUrl: f.apiUrl.trim(),
            auth: authPayload,
            capabilities: { storeCrud: f.storeCrud, storeList: f.storeList },
          },
        },
        bubbles: true, composed: true,
      }));
      this._liveMsg = `Server "${f.name.trim()}" updated`;
    } else {
      this.dispatchEvent(new CustomEvent<ServerAddDetail>('server-add', {
        detail: {
          server: {
            name: f.name.trim(),
            apiUrl: f.apiUrl.trim(),
            auth: authPayload,
            capabilities: { storeCrud: f.storeCrud, storeList: f.storeList },
          },
        },
        bubbles: true, composed: true,
      }));
      this._liveMsg = `Server "${f.name.trim()}" added`;
    }
    this._view = 'list';
    this._editingServerId = null;
    this._formError = '';
  }

  // ---- store form helpers ----

  private _openAddStore(serverId: string) {
    this._storeForm = { ...EMPTY_STORE_FORM };
    this._editingStoreId = null;
    this._storeFormServerId = serverId;
    this._formError = '';
    // Default to 'create' if the server supports storeCrud, otherwise 'add' only.
    const server = this.servers.find((s) => s.id === serverId);
    this._storeFormMode = server?.capabilities.storeCrud !== false ? 'create' : 'add';
    this._view = 'store-form';
  }

  private _openEditStore(serverId: string, storeId: string, alias: string, modelId: string) {
    this._storeForm = {
      name: alias || storeId,
      storeId,
      alias,
      modelId,
      hasAuthOverride: false,
      authMethod: 'none',
      apiToken: '',
      clientId: '',
      clientSecret: '',
      apiTokenIssuer: '',
      apiAudience: '',
    };
    this._editingStoreId = storeId;
    this._storeFormServerId = serverId;
    this._formError = '';
    this._view = 'store-form';
  }

  private _submitStoreForm(e: Event) {
    e.preventDefault();
    const f = this._storeForm;
    const serverId = this._storeFormServerId!;

    const authOverride: CredentialsConfig = f.hasAuthOverride
      ? f.authMethod === 'api_token'
        ? { method: 'api_token', apiToken: f.apiToken.trim() }
        : f.authMethod === 'client_credentials'
        ? {
            method: 'client_credentials',
            clientId: f.clientId.trim() || undefined,
            clientSecret: f.clientSecret.trim() || undefined,
            apiTokenIssuer: f.apiTokenIssuer.trim() || undefined,
            apiAudience: f.apiAudience.trim() || undefined,
          }
        : { method: 'none' }
      : undefined;

    if (this._editingStoreId) {
      this.dispatchEvent(new CustomEvent<StoreUpdateDetail>('store-update', {
        detail: {
          serverId,
          storeId: this._editingStoreId,
          update: {
            alias: f.alias.trim() || undefined,
            modelId: f.modelId.trim() || undefined,
            auth: authOverride,
          },
        },
        bubbles: true, composed: true,
      }));
    } else if (this._storeFormMode === 'add') {
      if (!f.storeId.trim()) { this._formError = 'Store ID is required'; return; }
      this.dispatchEvent(new CustomEvent<StoreAddDetail>('store-add', {
        detail: {
          serverId,
          store: {
            storeId: f.storeId.trim(),
            alias: f.alias.trim() || undefined,
            modelId: f.modelId.trim() || undefined,
            auth: authOverride,
          },
        },
        bubbles: true, composed: true,
      }));
    } else {
      if (!f.name.trim()) { this._formError = 'Store name is required'; return; }
      this.dispatchEvent(new CustomEvent<StoreCreateDetail>('store-create', {
        detail: {
          serverId,
          name: f.name.trim(),
          alias: f.alias.trim() || undefined,
        },
        bubbles: true, composed: true,
      }));
    }

    this._view = 'list';
    this._storeFormServerId = null;
    this._editingStoreId = null;
    this._formError = '';
  }

  private _cancelForm() {
    this._view = 'list';
    this._editingServerId = null;
    this._editingStoreId = null;
    this._storeFormServerId = null;
    this._formError = '';
  }

  // ---- server actions ----

  private _selectServer(id: string) {
    this.dispatchEvent(new CustomEvent<ServerSelectDetail>('server-select', {
      detail: { id }, bubbles: true, composed: true,
    }));
  }

  private _toggleExpand(id: string) {
    const next = new Set(this._expandedServerIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    this._expandedServerIds = next;
  }

  private _doDeleteServer(id: string) {
    const s = this.servers.find((sv) => sv.id === id);
    this.dispatchEvent(new CustomEvent<ServerRemoveDetail>('server-remove', {
      detail: { id }, bubbles: true, composed: true,
    }));
    this._liveMsg = `Server "${s?.name ?? id}" deleted`;
    this._confirmDeleteServerId = null;
  }

  // ---- store actions ----

  private _selectStore(serverId: string, storeId: string) {
    this.dispatchEvent(new CustomEvent<StoreSelectDetail>('store-select', {
      detail: { serverId, storeId }, bubbles: true, composed: true,
    }));
  }

  private _doDeleteStore(serverId: string, storeId: string) {
    this.dispatchEvent(new CustomEvent<StoreRemoveDetail>('store-remove', {
      detail: { serverId, storeId }, bubbles: true, composed: true,
    }));
    this._confirmDeleteStoreKey = null;
  }

  // ---- rendering ----

  private _authBadge(type: string) {
    if (type === 'api_token') return html`<span class="badge badge-auth-token">API Token</span>`;
    if (type === 'client_credentials') return html`<span class="badge badge-auth-cc">OAuth2</span>`;
    return html`<span class="badge badge-auth-none">No Auth</span>`;
  }

  private _renderList() {
    return html`
      <div class="server-list" role="list" aria-label="Server connections">
        ${this.servers.length === 0
          ? html`<div class="empty-state">No servers yet — add one</div>`
          : repeat(this.servers, (s) => s.id, (s) => this._renderServerRow(s))}
      </div>
    `;
  }

  private _renderServerRow(s: ServerConfig) {
    const stores = s.stores ?? [];
    const isActive = s.id === this.activeServerId;
    const isExpanded = this._expandedServerIds.has(s.id);
    const confirmKey = this._confirmDeleteServerId === s.id;

    return html`
      <div class="server-row" role="listitem">
        ${confirmKey
          ? html`
              <div class="confirm-row" role="alert">
                <span>Delete "${s.name}"?</span>
                <button class="btn-danger" @click=${() => this._doDeleteServer(s.id)}>Delete</button>
                <button class="btn-secondary" style="padding:3px 8px"
                  @click=${() => (this._confirmDeleteServerId = null)}>Cancel</button>
              </div>
            `
          : nothing}
        <div
          class="server-header ${isActive ? 'active' : ''}"
          tabindex="0"
          role="button"
          aria-expanded=${isExpanded}
          aria-label="Server: ${s.name}${isActive ? ' (active)' : ''}"
          @click=${() => { this._selectServer(s.id); this._toggleExpand(s.id); }}
          @keydown=${(e: KeyboardEvent) => {
            if (e.key === 'Enter' || e.key === ' ') { this._selectServer(s.id); this._toggleExpand(s.id); }
          }}
        >
          <span class="server-expand">${isExpanded ? '▾' : '▸'}</span>
          <div class="server-info">
            <div class="server-name">${s.name}</div>
            <div class="server-url">${s.apiUrl}</div>
            <div class="server-badges">
              ${this._authBadge(s.auth.method)}
              ${!s.capabilities.storeCrud ? html`<span class="badge badge-cap">no store CRUD</span>` : nothing}
              ${!s.capabilities.storeList ? html`<span class="badge badge-cap">no store list</span>` : nothing}
              ${stores.length > 0 ? html`<span class="badge badge-cap">${stores.length} store${stores.length !== 1 ? 's' : ''}</span>` : nothing}
            </div>
          </div>
          <div class="server-actions" @click=${(e: Event) => e.stopPropagation()}>
            <button class="btn-icon" aria-label="Edit server ${s.name}" @click=${() => this._openEditServer(s)}>✎</button>
            <button class="btn-danger" aria-label="Delete server ${s.name}"
              @click=${() => (this._confirmDeleteServerId = s.id)}>×</button>
          </div>
        </div>

        ${isExpanded ? this._renderStoreList(s) : nothing}
      </div>
    `;
  }

  private _renderStoreList(s: ServerConfig) {
    const stores = s.stores ?? [];
    return html`
      <div class="store-entries">
        ${stores.length === 0
          ? nothing
          : repeat(stores, (st) => st.storeId, (st) => {
              const isActive = s.id === this.activeServerId && st.storeId === this.activeStoreId;
              const confirmKey = this._confirmDeleteStoreKey === `${s.id}:${st.storeId}`;
              const displayName = st.alias || st.storeId;

              return html`
                ${confirmKey
                  ? html`
                      <div class="confirm-row" role="alert" style="padding-left:30px">
                        <span>Remove "${displayName}"?</span>
                        <button class="btn-danger" @click=${() => this._doDeleteStore(s.id, st.storeId)}>Remove</button>
                        <button class="btn-secondary" style="padding:3px 8px"
                          @click=${() => (this._confirmDeleteStoreKey = null)}>Cancel</button>
                      </div>
                    `
                  : nothing}
                <div
                  class="store-entry ${isActive ? 'active' : ''}"
                  tabindex="0"
                  role="button"
                  aria-label="Store: ${displayName}${isActive ? ' (active)' : ''}"
                  @click=${() => this._selectStore(s.id, st.storeId)}
                  @keydown=${(e: KeyboardEvent) => {
                    if (e.key === 'Enter' || e.key === ' ') this._selectStore(s.id, st.storeId);
                  }}
                >
                  <div class="store-entry-info">
                    <div class="store-entry-name">${displayName}</div>
                    ${st.alias ? html`<div class="store-entry-id">${st.storeId}</div>` : nothing}
                  </div>
                  <div class="store-entry-actions" @click=${(e: Event) => e.stopPropagation()}>
                    <button class="btn-icon" aria-label="Edit store ${displayName}"
                      @click=${() => this._openEditStore(s.id, st.storeId, st.alias ?? '', st.modelId ?? '')}>✎</button>
                    <button class="btn-danger" aria-label="Remove store ${displayName}"
                      @click=${() => (this._confirmDeleteStoreKey = `${s.id}:${st.storeId}`)}>×</button>
                  </div>
                </div>
              `;
            })}
        <div class="add-store-row">
          <button class="btn-add-store" @click=${() => this._openAddStore(s.id)}>
            + Add store
          </button>
        </div>
      </div>
    `;
  }

  private _renderServerForm() {
    const f = this._serverForm;
    const isEdit = this._editingServerId !== null;
    return html`
      <form class="form-view" @submit=${this._submitServerForm} novalidate
        aria-label="${isEdit ? 'Edit' : 'Add'} server">
        <div class="form-section">
          <div class="form-section-title">Connection</div>
          <div class="field">
            <label for="cc-name">Name</label>
            <input id="cc-name" type="text" placeholder="Local OpenFGA"
              .value=${f.name} class=${!f.name.trim() && this._formError ? 'error' : ''}
              @input=${(e: Event) => { this._serverForm = { ...f, name: (e.target as HTMLInputElement).value }; this._formError = ''; }} />
          </div>
          <div class="field">
            <label for="cc-url">API URL</label>
            <input id="cc-url" type="url" placeholder="http://localhost:8080"
              .value=${f.apiUrl} class=${!f.apiUrl.trim() && this._formError ? 'error' : ''}
              @input=${(e: Event) => { this._serverForm = { ...f, apiUrl: (e.target as HTMLInputElement).value }; this._formError = ''; }} />
          </div>
        </div>

        <div class="form-section">
          <div class="form-section-title">Authentication</div>
          <div class="field">
            <label for="cc-authtype">Auth type</label>
            <select id="cc-authtype" .value=${f.authMethod}
              @change=${(e: Event) => {
                this._serverForm = { ...f, authMethod: (e.target as HTMLSelectElement).value as ServerFormData['authMethod'] };
              }}>
              <option value="none">No authentication</option>
              <option value="api_token">API Token</option>
              <option value="client_credentials">Client credentials (OAuth2)</option>
            </select>
          </div>
          ${f.authMethod === 'api_token' ? html`
            <div class="field">
              <label for="cc-token">API Token${isEdit ? html` <span style="opacity:0.6">(blank = keep current)</span>` : nothing}</label>
              <input id="cc-token" type="password" placeholder="sk_..."
                .value=${f.apiToken} autocomplete="off"
                @input=${(e: Event) => { this._serverForm = { ...f, apiToken: (e.target as HTMLInputElement).value }; }} />
            </div>
          ` : nothing}
          ${f.authMethod === 'client_credentials' ? html`
            <div class="field">
              <label for="cc-cid">Client ID${isEdit ? html` <span style="opacity:0.6">(blank = keep current)</span>` : nothing}</label>
              <input id="cc-cid" type="text" .value=${f.clientId}
                @input=${(e: Event) => { this._serverForm = { ...f, clientId: (e.target as HTMLInputElement).value }; }} />
            </div>
            <div class="field">
              <label for="cc-secret">Client Secret${isEdit ? html` <span style="opacity:0.6">(blank = keep current)</span>` : nothing}</label>
              <input id="cc-secret" type="password" .value=${f.clientSecret} autocomplete="off"
                @input=${(e: Event) => { this._serverForm = { ...f, clientSecret: (e.target as HTMLInputElement).value }; }} />
            </div>
            <div class="field">
              <label for="cc-issuer">Token Issuer <span style="opacity:0.6">(optional)</span></label>
              <input id="cc-issuer" type="text" placeholder="https://auth.example.com"
                .value=${f.apiTokenIssuer}
                @input=${(e: Event) => { this._serverForm = { ...f, apiTokenIssuer: (e.target as HTMLInputElement).value }; }} />
            </div>
            <div class="field">
              <label for="cc-audience">Audience <span style="opacity:0.6">(optional)</span></label>
              <input id="cc-audience" type="text" .value=${f.apiAudience}
                @input=${(e: Event) => { this._serverForm = { ...f, apiAudience: (e.target as HTMLInputElement).value }; }} />
            </div>
          ` : nothing}
        </div>

        <div class="form-section">
          <div class="form-section-title">Capabilities</div>
          <div class="capabilities-row">
            <label class="cap-label">
              <input type="checkbox" .checked=${f.storeCrud}
                @change=${(e: Event) => { this._serverForm = { ...f, storeCrud: (e.target as HTMLInputElement).checked }; }} />
              Store CRUD
            </label>
            <label class="cap-label">
              <input type="checkbox" .checked=${f.storeList}
                @change=${(e: Event) => { this._serverForm = { ...f, storeList: (e.target as HTMLInputElement).checked }; }} />
              List stores
            </label>
          </div>
          <div class="field-hint">Disable "Store CRUD" for hosted services that don't support CreateStore/DeleteStore. Disable "List stores" if ListStores is unavailable.</div>
        </div>

        ${this._formError ? html`<div class="form-error" role="alert">${this._formError}</div>` : nothing}
        <div class="form-actions">
          <button type="button" class="btn-secondary" @click=${this._cancelForm}>Cancel</button>
          <button type="submit" class="btn-primary">${isEdit ? 'Save' : 'Add server'}</button>
        </div>
      </form>
    `;
  }

  private _renderStoreForm() {
    const f = this._storeForm;
    const isEdit = this._editingStoreId !== null;
    const server = this.servers.find((s) => s.id === this._storeFormServerId);
    const canCreate = server?.capabilities.storeCrud !== false;
    return html`
      <form class="form-view" @submit=${this._submitStoreForm} novalidate
        aria-label="${isEdit ? 'Edit' : this._storeFormMode === 'add' ? 'Add existing' : 'Create'} store">

        ${!isEdit && canCreate ? html`
          <div class="form-section">
            <div style="display:flex;gap:4px" role="group" aria-label="Store action">
              <button type="button"
                class="${this._storeFormMode === 'create' ? 'btn-primary' : 'btn-secondary'}"
                style="flex:1"
                @click=${() => { this._storeFormMode = 'create'; this._formError = ''; }}
              >Create new</button>
              <button type="button"
                class="${this._storeFormMode === 'add' ? 'btn-primary' : 'btn-secondary'}"
                style="flex:1"
                @click=${() => { this._storeFormMode = 'add'; this._formError = ''; }}
              >Add by ID</button>
            </div>
          </div>
        ` : nothing}

        <div class="form-section">
          <div class="form-section-title">Store</div>
          ${!isEdit && this._storeFormMode === 'add' ? html`
            <div class="field">
              <label for="st-storeid">Store ID</label>
              <input id="st-storeid" type="text" placeholder="01ABC..."
                .value=${f.storeId} class=${!f.storeId.trim() && this._formError ? 'error' : ''}
                @input=${(e: Event) => { this._storeForm = { ...f, storeId: (e.target as HTMLInputElement).value }; this._formError = ''; }} />
            </div>
          ` : isEdit || this._storeFormMode === 'create' ? html`
            <div class="field">
              <label for="st-name">Store Name</label>
              <input id="st-name" type="text" placeholder="my-store"
                .value=${f.name} class=${!f.name.trim() && this._formError ? 'error' : ''}
                @input=${(e: Event) => { this._storeForm = { ...f, name: (e.target as HTMLInputElement).value }; this._formError = ''; }} />
            </div>
          ` : nothing}
          <div class="field">
            <label for="st-alias">Alias <span style="opacity:0.6">(optional)</span></label>
            <input id="st-alias" type="text" placeholder="friendly name"
              .value=${f.alias}
              @input=${(e: Event) => { this._storeForm = { ...f, alias: (e.target as HTMLInputElement).value }; }} />
          </div>
          <div class="field">
            <label for="st-model">Default Model ID <span style="opacity:0.6">(optional)</span></label>
            <input id="st-model" type="text" placeholder="01ABC..."
              .value=${f.modelId}
              @input=${(e: Event) => { this._storeForm = { ...f, modelId: (e.target as HTMLInputElement).value }; }} />
          </div>
        </div>

        <div class="form-section">
          <div class="form-section-title">Auth Override <span style="opacity:0.6;font-weight:400;text-transform:none">(optional — inherits from server)</span></div>
          <label class="cap-label" style="margin-bottom:4px">
            <input type="checkbox" .checked=${f.hasAuthOverride}
              @change=${(e: Event) => { this._storeForm = { ...f, hasAuthOverride: (e.target as HTMLInputElement).checked }; }} />
            Override authentication for this store
          </label>
          ${f.hasAuthOverride ? html`
            <div class="field">
              <label for="st-authtype">Auth type</label>
              <select id="st-authtype" .value=${f.authMethod}
                @change=${(e: Event) => {
                  this._storeForm = { ...f, authMethod: (e.target as HTMLSelectElement).value as StoreFormData['authMethod'] };
                }}>
                <option value="none">No authentication</option>
                <option value="api_token">API Token</option>
                <option value="client_credentials">Client credentials (OAuth2)</option>
              </select>
            </div>
            ${f.authMethod === 'api_token' ? html`
              <div class="field">
                <label for="st-token">API Token${isEdit ? html` <span style="opacity:0.6">(blank = keep current)</span>` : nothing}</label>
                <input id="st-token" type="password" .value=${f.apiToken} autocomplete="off"
                  @input=${(e: Event) => { this._storeForm = { ...f, apiToken: (e.target as HTMLInputElement).value }; }} />
              </div>
            ` : nothing}
            ${f.authMethod === 'client_credentials' ? html`
              <div class="field">
                <label for="st-cid">Client ID${isEdit ? html` <span style="opacity:0.6">(blank = keep current)</span>` : nothing}</label>
                <input id="st-cid" type="text" .value=${f.clientId}
                  @input=${(e: Event) => { this._storeForm = { ...f, clientId: (e.target as HTMLInputElement).value }; }} />
              </div>
              <div class="field">
                <label for="st-cs">Client Secret${isEdit ? html` <span style="opacity:0.6">(blank = keep current)</span>` : nothing}</label>
                <input id="st-cs" type="password" .value=${f.clientSecret} autocomplete="off"
                  @input=${(e: Event) => { this._storeForm = { ...f, clientSecret: (e.target as HTMLInputElement).value }; }} />
              </div>
              <div class="field">
                <label for="st-issuer">Token Issuer <span style="opacity:0.6">(optional)</span></label>
                <input id="st-issuer" type="text" .value=${f.apiTokenIssuer}
                  @input=${(e: Event) => { this._storeForm = { ...f, apiTokenIssuer: (e.target as HTMLInputElement).value }; }} />
              </div>
              <div class="field">
                <label for="st-audience">Audience <span style="opacity:0.6">(optional)</span></label>
                <input id="st-audience" type="text" .value=${f.apiAudience}
                  @input=${(e: Event) => { this._storeForm = { ...f, apiAudience: (e.target as HTMLInputElement).value }; }} />
              </div>
            ` : nothing}
            <div class="field-hint">Auth fields left blank inherit from the parent server's configuration.</div>
          ` : nothing}
        </div>

        ${this._formError ? html`<div class="form-error" role="alert">${this._formError}</div>` : nothing}
        <div class="form-actions">
          <button type="button" class="btn-secondary" @click=${this._cancelForm}>Cancel</button>
          <button type="submit" class="btn-primary">
            ${isEdit ? 'Save' : this._storeFormMode === 'add' ? 'Add store' : 'Create store'}
          </button>
        </div>
      </form>
    `;
  }

  private _headerTitle() {
    if (this._view === 'server-form') return this._editingServerId ? 'Edit Server' : 'New Server';
    if (this._view === 'store-form') {
      if (this._editingStoreId) return 'Edit Store';
      return this._storeFormMode === 'add' ? 'Add Existing Store' : 'Create Store';
    }
    return 'Connections';
  }

  override render() {
    return html`
      <span class="sr-live" aria-live="polite" aria-atomic="true">${this._liveMsg}</span>

      <div class="panel-header">
        <h2>${this._headerTitle()}</h2>
        ${this._view === 'list'
          ? html`<button class="btn-add" aria-label="Add server" @click=${this._openAddServer}>+ Add</button>`
          : nothing}
      </div>

      ${this._view === 'list' ? this._renderList()
        : this._view === 'server-form' ? this._renderServerForm()
        : this._renderStoreForm()}
    `;
  }
}

export type {
  ServerAddDetail,
  ServerUpdateDetail,
  ServerRemoveDetail,
  ServerSelectDetail,
  StoreAddDetail,
  StoreCreateDetail,
  StoreUpdateDetail,
  StoreRemoveDetail,
  StoreSelectDetail,
} from '../shared/types.js';

declare global {
  interface HTMLElementTagNameMap {
    'openfga-connection-config': ConnectionConfig;
  }
}
