// SPDX-License-Identifier: Apache-2.0
import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { StoreController } from '@nanostores/lit';
import {
  $model,
  $tuples,
  $assertions,
  $assertionResults,
  $servers,
  $activeServerId,
  $activeStoreId,
  $activeModelId,
  $compareModelId,
  $modelVersions,
  checkProxyAvailable,
  ProxyBackendAdapter,
  DirectBackendAdapter,
  AuthenticationError,
  $apiLog,
  setServers,
  setActiveServer,
  setActiveStore,
  setCompareModel,
  updateModel,
  addAssertion,
  removeAssertion,
  validateModel,
  dslToJson,
  jsonToDsl,
  importFromYaml,
  exportToYaml,
} from '@openfga/playground-core';

// Register all components
import '@openfga/playground-components/model-editor';
import '@openfga/playground-components/model-graph';
import '@openfga/playground-components/tuple-manager';
import '@openfga/playground-components/assertion-runner';
import '@openfga/playground-components/connection-config';

// Register all components
import '@openfga/playground-components/model-diff';
import '@openfga/playground-components/resolution-path';
import '@openfga/playground-components/relationship-graph';
import '@openfga/playground-components/changelog';
import '@openfga/playground-components/query-runner';
import '@openfga/playground-components/dev-console';

// Register shell widgets
import './widgets/store-selector.js';
import './widgets/model-selector.js';
import './widgets/yaml-toolbar.js';
import './widgets/sample-picker.js';

import type { ModelChangeDetail, FormatChangeDetail } from '@openfga/playground-components/model-editor';
import type {
  TupleAddDetail,
  TupleRemoveDetail,
} from '@openfga/playground-components/tuple-manager';
import type {
  AssertionAddDetail,
  AssertionRemoveDetail,
  AssertionRunDetail,
  AssertionExpandDetail,
} from '@openfga/playground-components/assertion-runner';
import type { ChangelogEntry, ChangelogLoadDetail } from '@openfga/playground-components/changelog';
import type { QueryCheckDetail, QueryListObjectsDetail, QueryListUsersDetail, QueryExpandDetail, QueryListRelationsDetail } from '@openfga/playground-components/query-runner';
import { QueryRunner } from '@openfga/playground-components/query-runner';
import type {
  ServerAddDetail,
  ServerUpdateDetail,
  ServerRemoveDetail,
  ServerSelectDetail,
  StoreAddDetail,
  StoreCreateDetail,
  StoreUpdateDetail,
  StoreRemoveDetail,
  StoreSelectDetail,
} from '@openfga/playground-components/connection-config';

import type { GraphDefinition } from '@openfga/frontend-utils/graph';
import type { ModelVersionSelectDetail } from './widgets/model-selector.js';
import { formatUlidDate } from './utils/ulid.js';
import { applyGraphTheme } from './theme/graph-theme.js';
import {
  handleTupleAdd,
  handleTupleRemove,
  handleAssertionRun,
  handleAssertionRunAll,
  handleAssertionWrite,
  handleServerAdd,
  handleServerUpdate,
  handleServerRemove,
  handleStoreAdd,
  handleStoreCreate,
  handleStoreDelete,
  handleStoreUpdate,
  handleStoreRemove,
  handleModelSave,
  handleStoreSwitch,
  handleLoadModel,
  handleLoadCompareModel,
  handleAssertionExpand,
  handleChangelogLoad,
  handleQueryCheck,
  handleQueryListObjects,
  handleQueryListUsers,
  handleQueryListRelations,
} from './wiring/event-handlers.js';
import type { ChangelogPage } from './wiring/event-handlers.js';

/**
 * Root playground application element.
 *
 * The only place that imports both `playground-core` and `playground-components`.
 * Responsibility: subscribe to stores, pass state as component props,
 * handle component events → call core actions / backend.
 */
@customElement('openfga-playground')
export class PlaygroundApp extends LitElement {
  static override styles = css`
    :host {
      display: flex;
      flex-direction: column;
      height: 100vh;
      background: var(--openfga-bg-primary, #1e1e2e);
      color: var(--openfga-text-primary, #cdd6f4);
      font-family: var(--openfga-font-family, sans-serif);
      overflow: hidden;
    }

    /* ---- proxy warning banner ---- */
    .proxy-banner {
      padding: 7px 14px;
      background: var(--openfga-warning, #fab387);
      color: var(--openfga-bg-primary, #1e1e2e);
      font-size: 12px;
      text-align: center;
      flex-shrink: 0;
    }
    .proxy-banner code {
      background: rgba(0,0,0,0.15);
      padding: 1px 4px;
      border-radius: 3px;
      font-family: var(--openfga-font-mono, monospace);
    }

    /* ---- error toast ---- */
    .error-toast {
      position: fixed;
      bottom: 16px;
      right: 16px;
      background: var(--openfga-error, #f38ba8);
      color: var(--openfga-bg-primary, #1e1e2e);
      padding: 8px 14px;
      border-radius: 6px;
      font-size: 12px;
      max-width: 320px;
      z-index: 100;
      box-shadow: 0 4px 12px rgba(0,0,0,0.4);
      animation: toast-in 0.15s ease;
    }
    @keyframes toast-in { from { opacity: 0; transform: translateY(8px); } }

    /* ---- toolbar ---- */
    .toolbar {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 14px;
      background: var(--openfga-bg-secondary, #181825);
      border-bottom: 1px solid var(--openfga-border, #45475a);
      flex-shrink: 0;
      overflow: hidden;
    }
    .toolbar-title {
      font-weight: 700;
      font-size: 13px;
      color: var(--openfga-text-primary, #cdd6f4);
      margin-right: 8px;
      white-space: nowrap;
      flex-shrink: 0;
    }
    .toolbar-sep {
      width: 1px;
      height: 16px;
      background: var(--openfga-border, #45475a);
      flex-shrink: 0;
    }
    .toolbar-spacer { flex: 1; }
    .btn-connection {
      cursor: pointer;
      background: transparent;
      color: var(--openfga-text-secondary, #a6adc8);
      border: 1px solid var(--openfga-border, #313244);
      border-radius: var(--openfga-radius-sm, 4px);
      font-size: 11px;
      font-family: inherit;
      padding: 3px 9px;
      white-space: nowrap;
      flex-shrink: 0;
    }
    .btn-connection:hover { color: var(--openfga-text-primary, #cdd6f4); border-color: var(--openfga-text-secondary, #a6adc8); }
    .btn-theme {
      cursor: pointer;
      background: transparent;
      color: var(--openfga-text-secondary, #a6adc8);
      border: none;
      font-size: 14px;
      padding: 3px 6px;
      line-height: 1;
      flex-shrink: 0;
    }
    .btn-theme:hover { color: var(--openfga-text-primary, #cdd6f4); }
    .btn-connection.active {
      color: var(--openfga-accent, #cba6f7);
      border-color: var(--openfga-accent, #cba6f7);
    }

    /* ---- main layout ---- */
    .panels {
      display: flex;
      flex: 1;
      min-height: 0;
      position: relative;
    }
    .panel-left {
      display: flex;
      flex-direction: column;
      min-width: 160px;
      max-width: calc(100% - 160px);
      border-right: none;
      overflow: hidden;
    }
    .panel-divider {
      width: 5px;
      background: var(--openfga-border, #45475a);
      cursor: col-resize;
      flex-shrink: 0;
      transition: background 0.1s;
      touch-action: none;
    }
    .panel-divider:hover,
    .panel-divider.dragging {
      background: var(--openfga-accent, #cba6f7);
    }
    .panel-right {
      flex: 1;
      min-width: 160px;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    /* ---- right panel tabs ---- */
    .tab-bar {
      display: flex;
      background: var(--openfga-bg-secondary, #181825);
      border-bottom: 1px solid var(--openfga-border, #45475a);
      flex-shrink: 0;
    }
    .tab {
      padding: 7px 14px;
      border: none;
      background: transparent;
      color: var(--openfga-text-secondary, #a6adc8);
      cursor: pointer;
      font-size: 12px;
      font-family: inherit;
      border-bottom: 2px solid transparent;
      transition: color 0.1s;
      white-space: nowrap;
    }
    .tab:hover { color: var(--openfga-text-primary, #cdd6f4); }
    .tab[aria-selected='true'] {
      color: var(--openfga-accent, #cba6f7);
      border-bottom-color: var(--openfga-accent, #cba6f7);
    }
    .tab:focus-visible {
      outline: 2px solid var(--openfga-accent, #cba6f7);
      outline-offset: -2px;
    }
    .tab-content {
      flex: 1;
      min-height: 0;
      display: none;
    }
    .tab-content.visible {
      display: flex;
      flex-direction: column;
    }

    /* ---- graph mode toggle ---- */
    .graph-mode-bar {
      display: flex;
      gap: 0;
      padding: 3px 8px;
      background: var(--openfga-bg-secondary, #181825);
      border-bottom: 1px solid var(--openfga-border, #45475a);
      flex-shrink: 0;
    }
    .graph-mode-btn {
      cursor: pointer;
      background: transparent;
      color: var(--openfga-text-secondary, #a6adc8);
      border: 1px solid var(--openfga-border, #313244);
      font-size: 10px;
      font-family: inherit;
      padding: 2px 10px;
    }
    .graph-mode-btn:first-child { border-radius: 3px 0 0 3px; }
    .graph-mode-btn:last-child { border-radius: 0 3px 3px 0; border-left: none; }
    .graph-mode-btn.active {
      color: var(--openfga-accent, #89b4fa);
      border-color: var(--openfga-accent, #89b4fa);
      background: rgba(137, 180, 250, 0.08);
    }
    .graph-mode-btn:hover:not(.active) { color: var(--openfga-text-primary, #cdd6f4); }

    /* ---- connection config drawer ---- */
    .cc-drawer {
      position: fixed;
      right: 0; top: 0; bottom: 0;
      width: 340px;
      background: var(--openfga-bg-primary, #1e1e2e);
      border-left: 1px solid var(--openfga-border, #313244);
      z-index: 50;
      display: flex;
      flex-direction: column;
      box-shadow: -4px 0 16px rgba(0,0,0,0.4);
      animation: drawer-in 0.15s ease;
    }
    @keyframes drawer-in { from { transform: translateX(340px); } }
    .cc-drawer-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.4);
      z-index: 49;
    }
    .cc-drawer-close {
      position: absolute;
      top: 8px; right: 10px;
      cursor: pointer;
      background: transparent;
      border: none;
      color: var(--openfga-text-secondary, #a6adc8);
      font-size: 18px;
      line-height: 1;
      padding: 4px;
      z-index: 1;
    }
    .cc-drawer-close:hover { color: var(--openfga-text-primary, #cdd6f4); }

    /* ---- save bar (model editor) ---- */
    .editor-toolbar {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 4px 8px;
      background: var(--openfga-bg-secondary, #181825);
      border-bottom: 1px solid var(--openfga-border, #45475a);
      flex-shrink: 0;
      font-size: 11px;
    }
    .editor-model-version {
      display: flex;
      align-items: baseline;
      gap: 5px;
      font-family: var(--openfga-font-mono, monospace);
      color: var(--openfga-text-secondary, #a6adc8);
      font-size: 10px;
      flex: 1;
      min-width: 0;
      overflow: hidden;
    }
    .model-id {
      color: var(--openfga-text-primary, #cdd6f4);
      user-select: all;
      cursor: text;
      white-space: nowrap;
    }
    .model-date {
      white-space: nowrap;
    }
    .btn-save {
      cursor: pointer;
      background: var(--openfga-success, #a6e3a1);
      color: var(--openfga-bg-primary, #1e1e2e);
      border: none;
      border-radius: var(--openfga-radius-sm, 4px);
      font-size: 11px;
      font-family: inherit;
      font-weight: 600;
      padding: 3px 10px;
      white-space: nowrap;
    }
    .btn-save:hover { opacity: 0.85; }
    .btn-save:disabled { opacity: 0.4; cursor: not-allowed; }

    .btn-compare {
      cursor: pointer;
      background: transparent;
      color: var(--openfga-text-secondary, #a6adc8);
      border: 1px solid var(--openfga-border, #313244);
      border-radius: var(--openfga-radius-sm, 4px);
      font-size: 11px;
      font-family: inherit;
      padding: 2px 8px;
      white-space: nowrap;
    }
    .btn-compare:hover { color: var(--openfga-text-primary, #cdd6f4); }
    .btn-compare.active {
      color: var(--openfga-accent, #cba6f7);
      border-color: var(--openfga-accent, #cba6f7);
    }
    .compare-select {
      background: var(--openfga-bg-primary, #1e1e2e);
      color: var(--openfga-text-primary, #cdd6f4);
      border: 1px solid var(--openfga-accent, #cba6f7);
      border-radius: var(--openfga-radius-sm, 4px);
      padding: 2px 5px;
      font-size: 10px;
      font-family: var(--openfga-font-mono, monospace);
      outline: none;
      max-width: 130px;
    }
    .compare-select:focus { border-color: var(--openfga-accent, #cba6f7); }

    /* ---- resolution path modal ---- */
    .rp-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.5);
      z-index: 60;
    }
    .rp-modal {
      position: fixed;
      top: 48px;
      left: 50%;
      transform: translateX(-50%);
      width: min(800px, 90vw);
      height: calc(100vh - 80px);
      background: var(--openfga-bg-primary, #1e1e2e);
      border: 1px solid var(--openfga-border, #313244);
      border-radius: var(--openfga-radius, 8px);
      z-index: 61;
      display: flex;
      flex-direction: column;
      box-shadow: 0 8px 32px rgba(0,0,0,0.6);
      animation: modal-in 0.15s ease;
    }
    @keyframes modal-in { from { opacity: 0; transform: translateX(-50%) translateY(-8px); } }
    .rp-header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 14px;
      background: var(--openfga-bg-secondary, #181825);
      border-bottom: 1px solid var(--openfga-border, #45475a);
      border-radius: var(--openfga-radius, 8px) var(--openfga-radius, 8px) 0 0;
      flex-shrink: 0;
      font-size: 12px;
    }
    .rp-title {
      flex: 1;
      color: var(--openfga-text-primary, #cdd6f4);
      font-weight: 600;
    }
    .rp-close {
      cursor: pointer;
      background: transparent;
      border: none;
      color: var(--openfga-text-secondary, #a6adc8);
      font-size: 18px;
      line-height: 1;
      padding: 2px 6px;
    }
    .rp-close:hover { color: var(--openfga-text-primary, #cdd6f4); }

    /* ---- session token prompt ---- */
    .token-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.6);
      z-index: 70;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .token-dialog {
      background: var(--openfga-bg-primary, #1e1e2e);
      border: 1px solid var(--openfga-border, #313244);
      border-radius: var(--openfga-radius-lg, 8px);
      padding: 24px;
      width: min(400px, 90vw);
      box-shadow: 0 8px 32px rgba(0,0,0,0.6);
      animation: modal-in 0.15s ease;
    }
    .token-dialog h2 {
      margin: 0 0 8px;
      font-size: 15px;
      font-weight: 600;
      color: var(--openfga-text-primary, #cdd6f4);
    }
    .token-dialog p {
      margin: 0 0 16px;
      font-size: 12px;
      color: var(--openfga-text-secondary, #a6adc8);
      line-height: 1.5;
    }
    .token-dialog code {
      background: var(--openfga-bg-elevated, #313244);
      padding: 1px 5px;
      border-radius: 3px;
      font-family: var(--openfga-font-mono, monospace);
      font-size: 11px;
    }
    .token-input {
      width: 100%;
      box-sizing: border-box;
      padding: 8px 10px;
      background: var(--openfga-bg-secondary, #181825);
      color: var(--openfga-text-primary, #cdd6f4);
      border: 1px solid var(--openfga-border, #45475a);
      border-radius: var(--openfga-radius-sm, 4px);
      font-family: var(--openfga-font-mono, monospace);
      font-size: 12px;
      outline: none;
      margin-bottom: 12px;
    }
    .token-input:focus { border-color: var(--openfga-accent, #89b4fa); }
    .token-input::placeholder { color: var(--openfga-text-secondary, #a6adc8); opacity: 0.6; }
    .token-submit {
      cursor: pointer;
      background: var(--openfga-accent, #89b4fa);
      color: var(--openfga-accent-text, #1e1e2e);
      border: none;
      border-radius: var(--openfga-radius-sm, 4px);
      font-size: 12px;
      font-family: inherit;
      font-weight: 600;
      padding: 7px 18px;
    }
    .token-submit:hover { opacity: 0.9; }
    .token-submit:disabled { opacity: 0.4; cursor: not-allowed; }

    /* ---- backend picker ---- */
    .backend-options {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin: 12px 0 4px;
    }
    .backend-option {
      cursor: pointer;
      text-align: left;
      padding: 10px 12px;
      border: 1px solid var(--openfga-border, #45475a);
      border-radius: var(--openfga-radius-sm, 4px);
      background: var(--openfga-bg-secondary, #181825);
      color: var(--openfga-text-primary, #cdd6f4);
      font-family: inherit;
      font-size: 12px;
      transition: border-color 0.1s, background 0.1s;
    }
    .backend-option:hover:not(:disabled) {
      border-color: var(--openfga-accent, #89b4fa);
      background: var(--openfga-bg-elevated, #313244);
    }
    .backend-option:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
    .backend-option strong {
      display: block;
      font-size: 13px;
      color: var(--openfga-text-primary, #cdd6f4);
      margin-bottom: 3px;
    }
    .backend-option span {
      color: var(--openfga-text-secondary, #a6adc8);
      font-size: 11px;
      line-height: 1.4;
    }
    .backend-option .tag-future {
      display: inline-block;
      font-size: 9px;
      padding: 1px 5px;
      border-radius: 3px;
      background: var(--openfga-border, #45475a);
      color: var(--openfga-text-secondary, #a6adc8);
      margin-left: 6px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
  `;

  // Store controllers — trigger re-render on any change
  private _model = new StoreController(this, $model);
  private _tuples = new StoreController(this, $tuples);
  private _assertions = new StoreController(this, $assertions);
  private _assertionResults = new StoreController(this, $assertionResults);
  private _servers = new StoreController(this, $servers);
  private _activeServerId = new StoreController(this, $activeServerId);
  private _activeStoreId = new StoreController(this, $activeStoreId);
  private _activeModelId = new StoreController(this, $activeModelId);
  private _compareModelId = new StoreController(this, $compareModelId);
  private _modelVersions = new StoreController(this, $modelVersions);
  private _apiLog = new StoreController(this, $apiLog);

  @state() private _activeTab: 'graph' | 'tuples' | 'assertions' | 'diff' | 'changelog' | 'query' | 'api-log' = 'graph';
  @state() private _graphMode: 'model' | 'relationships' = 'model';
  @state() private _compareDsl = '';
  @state() private _theme: 'dark' | 'light' = 'dark';
  @state() private _resolutionGraph: GraphDefinition | null = null;
  @state() private _resolutionLabel = '';
  @state() private _changelogEntries: ChangelogEntry[] = [];
  @state() private _changelogHasMore = false;
  @state() private _changelogLoading = false;
  private _changelogToken: string | undefined;
  @state() private _modelFormat: 'dsl' | 'json' = 'dsl';
  @state() private _jsonContent = '';
  @state() private _proxyAvailable: boolean | null = null;
  @state() private _ccOpen = false;
  @state() private _leftWidthPct = 50;
  @state() private _dividerDragging = false;
  @state() private _errorMsg = '';
  @state() private _saving = false;
  @state() private _tokenRequired = false;
  @state() private _tokenInput = '';

  // Backend selection — null until the user picks one from the "Choose Backend"
  // dialog on first load (or a persisted choice is read from localStorage).
  @state() private _backendPickerOpen = false;
  @state() private _backendPickerMode: 'choose' | 'proxy-url' | 'direct-url' = 'choose';
  @state() private _backendUrlInput = '';
  private _adapter: ProxyBackendAdapter | DirectBackendAdapter | null = null;
  private _errorTimer: ReturnType<typeof setTimeout> | null = null;
  private _unsubs: Array<() => void> = [];
  private _lastServerId: string | null = null;
  private _lastStoreId: string | null = null;
  private _savedDsl = '';

  override async connectedCallback() {
    super.connectedCallback();
    // Apply graph colors from the Monaco DSL theme — keeps graph in sync with
    // syntax highlighting without hardcoding colors in HTML/CSS.
    import('@openfga/frontend-utils')
      .then(({ theming }) => {
        const theme = theming.openfgaDark;
        if (theme) applyGraphTheme(theme);
      })
      .catch(() => { /* frontend-utils optional; graph falls back to CSS tokens */ });
    await this._initBackend();
    this._readUrlParams();
    this._watchStoreChanges();
    this._addKeyboardShortcuts();
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    for (const u of this._unsubs) u();
    this._unsubs = [];
    document.removeEventListener('keydown', this._onGlobalKeydown);
  }

  // ---- startup ----

  private async _initBackend() {
    // Read persisted backend choice from localStorage.
    const kind = localStorage.getItem('fga-backend-kind');
    const url = localStorage.getItem('fga-backend-url') || '';

    if (kind === 'proxy') {
      await this._initProxyAdapter(url || this._defaultProxyUrl());
      return;
    }
    if (kind === 'direct') {
      if (!url) {
        // Direct was chosen but no URL stored — show the picker.
        this._backendPickerOpen = true;
        this._backendPickerMode = 'direct-url';
        return;
      }
      await this._initDirectAdapter(url);
      return;
    }

    // No persisted choice — show the picker.
    this._backendPickerOpen = true;
    this._backendPickerMode = 'choose';
  }

  private _defaultProxyUrl(): string {
    // __FGA_API_URL__ is injected by Vite's `define`:
    // - development: "http://localhost:8880" (cross-origin to fga serve)
    // - production:  "" (same-origin → adapter uses window.location.origin)
    return (typeof __FGA_API_URL__ !== 'undefined' && __FGA_API_URL__) ? __FGA_API_URL__ : '';
  }

  private async _initProxyAdapter(baseUrl: string) {
    const adapter = new ProxyBackendAdapter(baseUrl || undefined);
    this._adapter = adapter;
    this._proxyAvailable = await checkProxyAvailable(adapter.baseUrl);
    if (!this._proxyAvailable) return;

    // Resolve session token: URL param > sessionStorage > prompt later.
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get('token');
    const storedToken = sessionStorage.getItem('fga-serve-token');
    const token = urlToken || storedToken || '';
    if (token) {
      adapter.setSessionToken(token);
      sessionStorage.setItem('fga-serve-token', token);
    }
    if (urlToken) {
      params.delete('token');
      const qs = params.toString();
      history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname);
    }

    try {
      const servers = await adapter.listServers();
      setServers(servers);
      if (servers.length > 0) setActiveServer(servers[0].id);
    } catch (err) {
      if (err instanceof AuthenticationError) {
        this._tokenRequired = true;
      }
    }
  }

  private async _initDirectAdapter(apiUrl: string) {
    const adapter = new DirectBackendAdapter(apiUrl);
    this._adapter = adapter;
    this._proxyAvailable = true; // direct doesn't use fga serve
    try {
      const servers = await adapter.listServers();
      // Fetch the store list from OpenFGA directly and attach it to the
      // synthetic server entry so the store selector can render it.
      const stores = await adapter.listStores(servers[0].id).catch(() => []);
      servers[0] = { ...servers[0], stores };
      setServers(servers);
      setActiveServer(servers[0].id);
    } catch (err) {
      this._showError(`Direct connection failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  private async _pickBackend(kind: 'proxy' | 'direct' | 'wasm') {
    if (kind === 'wasm') {
      this._showError('WASM backend is not yet available — please pick Proxy or Direct.');
      return;
    }
    if (kind === 'proxy') {
      // For proxy, try the default URL first; if unreachable, prompt for a URL.
      const defaultUrl = this._defaultProxyUrl();
      const probeUrl = defaultUrl || (typeof window !== 'undefined' ? window.location.origin : '');
      const reachable = await checkProxyAvailable(probeUrl);
      if (reachable) {
        localStorage.setItem('fga-backend-kind', 'proxy');
        localStorage.setItem('fga-backend-url', defaultUrl);
        this._backendPickerOpen = false;
        await this._initProxyAdapter(defaultUrl);
      } else {
        this._backendPickerMode = 'proxy-url';
        this._backendUrlInput = defaultUrl || 'http://localhost:8880';
      }
      return;
    }
    // direct
    this._backendPickerMode = 'direct-url';
    this._backendUrlInput = 'http://localhost:8080';
  }

  private async _confirmBackendUrl() {
    const url = this._backendUrlInput.trim();
    if (!url) return;
    if (this._backendPickerMode === 'proxy-url') {
      localStorage.setItem('fga-backend-kind', 'proxy');
      localStorage.setItem('fga-backend-url', url);
      this._backendPickerOpen = false;
      this._backendUrlInput = '';
      await this._initProxyAdapter(url);
    } else if (this._backendPickerMode === 'direct-url') {
      localStorage.setItem('fga-backend-kind', 'direct');
      localStorage.setItem('fga-backend-url', url);
      this._backendPickerOpen = false;
      this._backendUrlInput = '';
      await this._initDirectAdapter(url);
    }
  }

  private _switchBackend() {
    // Clear persisted choice and reload so the picker shows again.
    localStorage.removeItem('fga-backend-kind');
    localStorage.removeItem('fga-backend-url');
    sessionStorage.removeItem('fga-serve-token');
    window.location.reload();
  }

  /** Assert the adapter has been initialized. Throws if not — used inside event handlers. */
  private _requireAdapter(): ProxyBackendAdapter | DirectBackendAdapter {
    if (!this._adapter) {
      throw new Error('No backend selected. Please choose a backend from the picker.');
    }
    return this._adapter;
  }

  private async _submitToken() {
    const token = this._tokenInput.trim();
    if (!token) return;
    // Token flow only applies to the proxy adapter.
    if (!(this._adapter instanceof ProxyBackendAdapter)) return;
    const adapter = this._adapter;
    adapter.setSessionToken(token);
    sessionStorage.setItem('fga-serve-token', token);
    this._tokenRequired = false;
    this._tokenInput = '';
    try {
      const servers = await adapter.listServers();
      setServers(servers);
      if (servers.length > 0) setActiveServer(servers[0].id);
    } catch (err) {
      if (err instanceof AuthenticationError) {
        this._tokenRequired = true;
        this._showError('Invalid session token.');
      } else {
        this._showError(err instanceof Error ? err.message : 'Connection failed');
      }
    }
  }

  private _readUrlParams() {
    const p = new URLSearchParams(window.location.search);
    const serverId = p.get('server');
    const storeId = p.get('storeId');
    if (serverId) setActiveServer(serverId);
    if (storeId) setActiveStore(storeId);
  }

  private _watchStoreChanges() {
    const check = async () => {
      const serverId = $activeServerId.get();
      const storeId = $activeStoreId.get();
      if (serverId === this._lastServerId && storeId === this._lastStoreId) return;
      this._lastServerId = serverId;
      this._lastStoreId = storeId;
      this._syncUrl();
      if (serverId && storeId) {
        await handleStoreSwitch(this._requireAdapter(), serverId, storeId, (json) => jsonToDsl(json));
        this._savedDsl = this._model.value.dsl;
      }
    };

    this._unsubs.push(
      $activeServerId.subscribe(() => { void check(); }),
      $activeStoreId.subscribe(() => { void check(); }),
    );
  }

  private _syncUrl() {
    const serverId = $activeServerId.get();
    const storeId = $activeStoreId.get();
    const params = new URLSearchParams(window.location.search);
    if (serverId) params.set('server', serverId); else params.delete('server');
    if (storeId) params.set('storeId', storeId); else params.delete('storeId');
    history.replaceState(null, '', `?${params.toString()}`);
  }

  // ---- keyboard shortcuts ----

  private _onGlobalKeydown = (e: KeyboardEvent) => {
    const ctrl = e.ctrlKey || e.metaKey;
    if (ctrl && e.key === 's') { e.preventDefault(); void this._saveModel(); }
    if (ctrl && e.shiftKey && e.key === 'R') { e.preventDefault(); this._runAllAssertions(); }
    if (ctrl && e.key === '1') { e.preventDefault(); this._activeTab = 'graph'; }
    if (ctrl && e.key === '2') { e.preventDefault(); this._activeTab = 'tuples'; }
    if (ctrl && e.key === '3') { e.preventDefault(); this._activeTab = 'assertions'; }
    if (ctrl && e.key === 'i') { e.preventDefault(); this._triggerImport(); }
    if (ctrl && e.key === 'e') { e.preventDefault(); this._triggerExport(); }
  };

  private _triggerImport() {
    this.shadowRoot?.querySelector<HTMLInputElement>('#global-yaml-input')?.click();
  }

  private async _onGlobalYamlSelected(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    try {
      importFromYaml(await file.text());
    } catch (err) {
      this._showError(`Import failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      (e.target as HTMLInputElement).value = '';
    }
  }

  private _triggerExport() {
    const yaml = exportToYaml();
    const blob = new Blob([yaml], { type: 'text/yaml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'model.fga.yaml'; a.click();
    URL.revokeObjectURL(url);
  }

  private async _toggleTheme() {
    const newTheme = this._theme === 'dark' ? 'light' : 'dark';
    // Update the injected graph-theme <style> tag BEFORE Lit re-renders.
    // applyGraphTheme writes to :root which wins over the .openfga-light class
    // rules (same specificity, later position); updating it first ensures
    // Cytoscape reads the correct token values when it re-initializes.
    try {
      const { theming } = await import('@openfga/frontend-utils');
      const key = newTheme === 'light' ? theming.SupportedTheme.OpenFgaLight : theming.SupportedTheme.OpenFgaDark;
      const cfg = theming.supportedThemes[key];
      if (cfg) applyGraphTheme(cfg);
    } catch { /* non-fatal */ }
    this._theme = newTheme;
    document.documentElement.classList.toggle('openfga-light', newTheme === 'light');
  }

  private _addKeyboardShortcuts() {
    document.addEventListener('keydown', this._onGlobalKeydown);
  }

  // ---- resizable divider ----

  private _onDividerPointerDown(e: PointerEvent) {
    this._dividerDragging = true;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  private _onDividerPointerMove(e: PointerEvent) {
    if (!this._dividerDragging) return;
    const host = this.shadowRoot?.host as HTMLElement;
    const rect = host.getBoundingClientRect();
    const pct = ((e.clientX - rect.left) / rect.width) * 100;
    this._leftWidthPct = Math.min(85, Math.max(15, pct));
  }

  private _onDividerPointerUp() {
    this._dividerDragging = false;
  }

  // ---- error display ----

  private _showError(msg: string) {
    this._errorMsg = msg;
    if (this._errorTimer) clearTimeout(this._errorTimer);
    this._errorTimer = setTimeout(() => { this._errorMsg = ''; }, 5000);
  }

  // ---- model actions ----

  private async _saveModel() {
    if (this._saving) return;
    const model = this._model.value;
    if (!model.json) { this._showError('Fix validation errors before saving.'); return; }
    this._saving = true;
    try {
      await handleModelSave(this._requireAdapter(), model.dsl, model.json);
      this._savedDsl = model.dsl;
    } catch (err) {
      this._showError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      this._saving = false;
    }
  }

  private _handleModelChange(e: CustomEvent<ModelChangeDetail>) {
    const dsl = e.detail.value;
    updateModel(dsl);
    void Promise.all([validateModel(dsl), dslToJson(dsl)]).then(([errors, json]) => {
      updateModel(dsl, json ?? undefined, errors);
    });
  }

  private async _handleFormatChange(e: CustomEvent<FormatChangeDetail>) {
    const newFormat = e.detail.format;
    if (newFormat === this._modelFormat) return;
    if (newFormat === 'json') {
      const model = this._model.value;
      const json = await dslToJson(model.dsl);
      this._jsonContent = json ? JSON.stringify(json, null, 2) : '';
    }
    this._modelFormat = newFormat;
  }

  private async _handleModelVersionSelect(e: CustomEvent<ModelVersionSelectDetail>) {
    try {
      await handleLoadModel(this._requireAdapter(), e.detail.modelId, (json) => jsonToDsl(json));
      this._savedDsl = this._model.value.dsl;
    } catch (err) {
      this._showError(`Load model failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  private async _handleCompareVersionSelect(e: Event) {
    const modelId = (e.target as HTMLSelectElement).value;
    if (!modelId) return;
    try {
      const dsl = await handleLoadCompareModel(this._requireAdapter(), modelId, (json) => jsonToDsl(json));
      if (dsl !== null) {
        this._compareDsl = dsl;
        setCompareModel(modelId);
        this._activeTab = 'diff';
      }
    } catch (err) {
      this._showError(`Load compare model failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  private _exitCompareMode() {
    setCompareModel(null);
    this._compareDsl = '';
    if (this._activeTab === 'diff') this._activeTab = 'graph';
  }

  private async _handleAssertionExpand(e: CustomEvent<AssertionExpandDetail>) {
    const a = e.detail.assertion;
    try {
      const graph = await handleAssertionExpand(this._requireAdapter(), a);
      this._resolutionGraph = graph;
      this._resolutionLabel = `${a.user} ${a.relation} ${a.object}`;
    } catch (err) {
      this._showError(`Expand failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // ---- tuple actions ----

  private async _handleTupleAdd(e: CustomEvent<TupleAddDetail>) {
    try {
      await handleTupleAdd(this._requireAdapter(), e.detail);
    } catch (err) {
      this._showError(`Add tuple failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  private async _handleTupleRemove(e: CustomEvent<TupleRemoveDetail>) {
    try {
      await handleTupleRemove(this._requireAdapter(), e.detail);
    } catch (err) {
      this._showError(`Remove tuple failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // ---- assertion actions ----

  private _handleAssertionAdd(e: CustomEvent<AssertionAddDetail>) {
    addAssertion(e.detail);
    void handleAssertionWrite(this._requireAdapter(), $assertions.get()).catch(() => {});
  }

  private _handleAssertionRemove(e: CustomEvent<AssertionRemoveDetail>) {
    removeAssertion(e.detail);
    void handleAssertionWrite(this._requireAdapter(), $assertions.get()).catch(() => {});
  }

  private async _handleAssertionRun(e: CustomEvent<AssertionRunDetail>) {
    try {
      await handleAssertionRun(this._requireAdapter(), e.detail.assertion);
    } catch (err) {
      this._showError(`Check failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  private _runAllAssertions() {
    void handleAssertionRunAll(this._requireAdapter(), this._assertions.value).catch((err) =>
      this._showError(`Run all failed: ${err instanceof Error ? err.message : String(err)}`),
    );
  }

  // ---- changelog actions ----

  private async _handleChangelogLoad(e: CustomEvent<ChangelogLoadDetail>) {
    this._changelogLoading = true;
    this._changelogToken = undefined;
    this._changelogEntries = [];
    try {
      // Convert datetime-local value to ISO string if provided
      const startTime = e.detail.startTime ? new Date(e.detail.startTime).toISOString() : undefined;
      const page: ChangelogPage = await handleChangelogLoad(this._requireAdapter(), {
        type: e.detail.type || undefined,
        startTime,
      });
      this._changelogEntries = page.entries;
      this._changelogToken = page.continuationToken;
      this._changelogHasMore = !!page.continuationToken;
    } catch (err) {
      this._showError(`Changelog failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      this._changelogLoading = false;
    }
  }

  private async _handleChangelogLoadMore() {
    if (!this._changelogHasMore || !this._changelogToken) return;
    this._changelogLoading = true;
    try {
      const page: ChangelogPage = await handleChangelogLoad(this._requireAdapter(), {
        continuationToken: this._changelogToken,
      });
      this._changelogEntries = [...this._changelogEntries, ...page.entries];
      this._changelogToken = page.continuationToken;
      this._changelogHasMore = !!page.continuationToken;
    } catch (err) {
      this._showError(`Load more failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      this._changelogLoading = false;
    }
  }

  // ---- query runner actions ----

  private _queryRunnerEl(): QueryRunner | null {
    return this.shadowRoot?.querySelector<QueryRunner>('openfga-query-runner') ?? null;
  }

  private async _handleQueryCheck(e: CustomEvent<QueryCheckDetail>) {
    const qr = this._queryRunnerEl();
    try {
      const result = await handleQueryCheck(this._requireAdapter(), e.detail);
      qr?.setCheckResult(result.allowed);
    } catch (err) {
      qr?.setCheckError(err instanceof Error ? err.message : String(err));
    }
  }

  private async _handleQueryListObjects(e: CustomEvent<QueryListObjectsDetail>) {
    const qr = this._queryRunnerEl();
    try {
      const results = await handleQueryListObjects(this._requireAdapter(), e.detail);
      qr?.setListObjectsResult(results);
    } catch (err) {
      qr?.setListObjectsError(err instanceof Error ? err.message : String(err));
    }
  }

  private async _handleQueryListUsers(e: CustomEvent<QueryListUsersDetail>) {
    const qr = this._queryRunnerEl();
    try {
      const results = await handleQueryListUsers(this._requireAdapter(), e.detail);
      qr?.setListUsersResult(results);
    } catch (err) {
      qr?.setListUsersError(err instanceof Error ? err.message : String(err));
    }
  }

  private async _handleQueryListRelations(e: CustomEvent<QueryListRelationsDetail>) {
    const qr = this._queryRunnerEl();
    try {
      const results = await handleQueryListRelations(this._requireAdapter(), e.detail);
      qr?.setListRelationsResult(results);
    } catch (err) {
      qr?.setListRelationsError(err instanceof Error ? err.message : String(err));
    }
  }

  private async _handleQueryExpand(e: CustomEvent<QueryExpandDetail>) {
    const { user, relation, object } = e.detail;
    try {
      const graph = await handleAssertionExpand(this._requireAdapter(), { user, relation, object });
      this._resolutionGraph = graph;
      this._resolutionLabel = `${user} ${relation} ${object}`;
    } catch (err) {
      this._showError(`Expand failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // ---- server/connection config actions ----

  private async _handleServerAdd(e: CustomEvent<ServerAddDetail>) {
    try {
      await handleServerAdd(this._requireAdapter(), e.detail.server);
    } catch (err) {
      this._showError(`Add server failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  private async _handleServerUpdate(e: CustomEvent<ServerUpdateDetail>) {
    try {
      await handleServerUpdate(this._requireAdapter(), e.detail.id, e.detail.update);
    } catch (err) {
      this._showError(`Update server failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  private async _handleServerRemove(e: CustomEvent<ServerRemoveDetail>) {
    try {
      await handleServerRemove(this._requireAdapter(), e.detail.id);
    } catch (err) {
      this._showError(`Delete server failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  private _handleServerSelect(e: CustomEvent<ServerSelectDetail>) {
    setActiveServer(e.detail.id);
  }

  private async _handleStoreAdd(e: CustomEvent<StoreAddDetail>) {
    try {
      await handleStoreAdd(this._requireAdapter(), e.detail.serverId, e.detail.store);
    } catch (err) {
      this._showError(`Add store failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  private async _handleStoreCreate(e: CustomEvent<StoreCreateDetail>) {
    try {
      await handleStoreCreate(this._requireAdapter(), e.detail.serverId, e.detail.name, e.detail.alias);
    } catch (err) {
      this._showError(`Create store failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  private async _handleStoreCreateInline(e: CustomEvent<{ serverId: string; name: string }>) {
    try {
      const storeId = await handleStoreCreate(
        this._requireAdapter(),
        e.detail.serverId,
        e.detail.name,
      );
      // Switch to the newly created store so the user sees immediate feedback.
      setActiveStore(storeId);
    } catch (err) {
      this._showError(`Create store failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  private async _handleStoreDeleteInline(e: CustomEvent<{ serverId: string; storeId: string }>) {
    try {
      await handleStoreDelete(this._requireAdapter(), e.detail.serverId, e.detail.storeId);
      // Clear active store so the selector falls back to the placeholder.
      if (this._activeStoreId.value === e.detail.storeId) {
        setActiveStore(null);
      }
    } catch (err) {
      this._showError(`Delete store failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  private async _handleStoreUpdate(e: CustomEvent<StoreUpdateDetail>) {
    try {
      await handleStoreUpdate(this._requireAdapter(), e.detail.serverId, e.detail.storeId, e.detail.update);
    } catch (err) {
      this._showError(`Update store failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  private async _handleStoreRemove(e: CustomEvent<StoreRemoveDetail>) {
    try {
      await handleStoreRemove(this._requireAdapter(), e.detail.serverId, e.detail.storeId);
    } catch (err) {
      this._showError(`Remove store failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  private _handleStoreSelect(e: CustomEvent<StoreSelectDetail>) {
    setActiveServer(e.detail.serverId);
    setActiveStore(e.detail.storeId);
    this._ccOpen = false;
  }

  // ---- render ----

  override render() {
    const model = this._model.value;
    const tuples = this._tuples.value;
    const assertions = this._assertions.value;
    const assertionResults = this._assertionResults.value;
    const servers = Object.values(this._servers.value);
    const activeServerId = this._activeServerId.value ?? '';
    const activeStoreId = this._activeStoreId.value ?? '';
    const activeModelId = this._activeModelId.value;

    const activeServer = this._servers.value[activeServerId];
    const isDirty = model.dsl !== this._savedDsl;
    const canSave = !!activeStoreId && model.errors.length === 0 && model.dsl.trim() !== '' && isDirty;
    const compareModelId = this._compareModelId.value;
    const versions = this._modelVersions.value;

    return html`
      ${this._proxyAvailable === false
        ? html`
            <div class="proxy-banner" role="alert">
              <strong>fga serve is not running.</strong>
              Start it with <code>fga serve</code> to connect to an OpenFGA server.
              The playground will work in read-only/offline mode until then.
            </div>
          `
        : nothing}

      <!-- ---- toolbar ---- -->
      <header class="toolbar" @model-version-select=${this._handleModelVersionSelect}>
        <img src="/openfga-icon.png" alt="" aria-hidden="true" style="width:20px;height:20px;flex-shrink:0" />
        <span class="toolbar-title" aria-label="OpenFGA Playground">OpenFGA</span>
        <div class="toolbar-sep" aria-hidden="true"></div>
        <openfga-store-selector
          @store-create-request=${this._handleStoreCreateInline}
          @store-delete-request=${this._handleStoreDeleteInline}
        ></openfga-store-selector>
        <div class="toolbar-sep" aria-hidden="true"></div>
        <openfga-model-selector></openfga-model-selector>
        <div class="toolbar-sep" aria-hidden="true"></div>
        <openfga-sample-picker></openfga-sample-picker>
        <div class="toolbar-sep" aria-hidden="true"></div>
        <openfga-yaml-toolbar></openfga-yaml-toolbar>
        <div class="toolbar-spacer"></div>
        ${activeServer
          ? html`<span style="font-size:10px;color:var(--openfga-text-secondary,#a6adc8)">${activeServer.name}</span>`
          : nothing}
        <button
          class="btn-theme"
          aria-label="Toggle ${this._theme === 'dark' ? 'light' : 'dark'} theme"
          title="Toggle theme"
          @click=${this._toggleTheme}
        >${this._theme === 'dark' ? '☀' : '☾'}</button>
        <button
          class="btn-connection"
          aria-label="Switch backend"
          title="Switch backend (Proxy, Direct, WASM)"
          @click=${this._switchBackend}
        >
          ⇄ Backend
        </button>
        ${this._adapter && 'createServer' in this._adapter
          ? html`
              <button
                class="btn-connection ${this._ccOpen ? 'active' : ''}"
                aria-label="Connection settings${this._ccOpen ? ' (open)' : ''}"
                aria-expanded=${this._ccOpen}
                @click=${() => (this._ccOpen = !this._ccOpen)}
              >
                ⚙ Connections
              </button>
            `
          : nothing}
      </header>

      <!-- hidden file input for Ctrl+I import shortcut -->
      <input
        id="global-yaml-input"
        type="file"
        accept=".yaml,.yml,.fga.yaml"
        aria-hidden="true"
        tabindex="-1"
        style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)"
        @change=${this._onGlobalYamlSelected}
      />

      <!-- ---- main panels ---- -->
      <main
        class="panels"
        @pointermove=${this._onDividerPointerMove}
        @pointerup=${this._onDividerPointerUp}
        @pointercancel=${this._onDividerPointerUp}
      >
        <!-- LEFT: model editor -->
        <section
          class="panel-left"
          style="width: ${this._leftWidthPct}%"
          aria-label="Model editor"
        >
          <div class="editor-toolbar">
            <span class="editor-model-version">
              ${activeModelId
                ? html`
                    <span class="model-id" title="Click to select all and copy">${activeModelId}</span>
                    ${formatUlidDate(activeModelId)
                      ? html`<span class="model-date">${formatUlidDate(activeModelId)}</span>`
                      : nothing}
                  `
                : versions.length > 0
                ? `${versions.length} version${versions.length !== 1 ? 's' : ''}`
                : 'No model saved'}
            </span>
            ${compareModelId
              ? html`
                  <button
                    class="btn-compare active"
                    aria-label="Exit compare mode"
                    title="Exit compare mode"
                    @click=${this._exitCompareMode}
                  >× Compare</button>
                `
              : versions.length > 1
              ? html`
                  <select
                    class="compare-select"
                    aria-label="Compare with model version"
                    title="Compare with a model version"
                    @change=${this._handleCompareVersionSelect}
                  >
                    <option value="">Compare…</option>
                    ${versions
                      .filter((v) => v.id !== activeModelId)
                      .map((v) => {
                        const date = formatUlidDate(v.id);
                        return html`<option value=${v.id}>${v.id.slice(0, 8)}…${date ? ` — ${date}` : ''}</option>`;
                      })}
                  </select>
                `
              : nothing}
            <button
              class="btn-save"
              ?disabled=${!canSave || this._saving}
              aria-label="Save model (Ctrl+S)"
              title="Save model (Ctrl+S)"
              @click=${() => void this._saveModel()}
            >
              ${this._saving ? 'Saving…' : 'Save'}
            </button>
          </div>

          <openfga-model-editor
            style="flex:1;min-height:0"
            .model=${this._modelFormat === 'json' ? this._jsonContent : model.dsl}
            .format=${this._modelFormat}
            .errors=${this._modelFormat === 'json' ? [] : model.errors}
            .readonly=${this._modelFormat === 'json'}
            .theme=${this._theme}
            @model-change=${this._handleModelChange}
            @format-change=${this._handleFormatChange}
          ></openfga-model-editor>
        </section>

        <!-- DIVIDER -->
        <div
          class="panel-divider ${this._dividerDragging ? 'dragging' : ''}"
          role="separator"
          aria-label="Resize panels"
          aria-orientation="vertical"
          tabindex="0"
          @pointerdown=${this._onDividerPointerDown}
          @keydown=${(e: KeyboardEvent) => {
            if (e.key === 'ArrowLeft') this._leftWidthPct = Math.max(15, this._leftWidthPct - 2);
            if (e.key === 'ArrowRight') this._leftWidthPct = Math.min(85, this._leftWidthPct + 2);
          }}
        ></div>

        <!-- RIGHT: graph / tuples / assertions tabs -->
        <section class="panel-right" aria-label="Graph, tuples, and assertions">
          <div class="tab-bar" role="tablist" aria-label="Right panel">
            ${(['graph', 'tuples', 'assertions', 'changelog', 'query', 'api-log'] as const).map(
              (tab) => html`
                <button
                  class="tab"
                  role="tab"
                  aria-selected=${this._activeTab === tab}
                  aria-controls="${tab}-panel"
                  id="${tab}-tab"
                  @click=${() => (this._activeTab = tab)}
                >
                  ${{ graph: 'Graph', tuples: `Tuples (${tuples.length})`, assertions: `Assertions (${assertions.length})`, changelog: 'Changelog', query: 'Query', 'api-log': `API Log (${this._apiLog.value.length})` }[tab]}
                </button>
              `,
            )}
            ${compareModelId
              ? html`
                  <button
                    class="tab"
                    role="tab"
                    aria-selected=${this._activeTab === 'diff'}
                    aria-controls="diff-panel"
                    id="diff-tab"
                    @click=${() => (this._activeTab = 'diff')}
                  >Diff</button>
                `
              : nothing}
          </div>

          <div
            id="graph-panel"
            class="tab-content ${this._activeTab === 'graph' ? 'visible' : ''}"
            role="tabpanel"
            aria-labelledby="graph-tab"
            aria-hidden=${this._activeTab !== 'graph'}
          >
            <div class="graph-mode-bar">
              <button
                class="graph-mode-btn ${this._graphMode === 'model' ? 'active' : ''}"
                @click=${() => { this._graphMode = 'model'; }}
              >Model</button>
              <button
                class="graph-mode-btn ${this._graphMode === 'relationships' ? 'active' : ''}"
                @click=${() => { this._graphMode = 'relationships'; }}
              >Relationships</button>
            </div>
            ${this._graphMode === 'model'
              ? html`<openfga-model-graph style="flex:1;min-height:0" .model=${model.json} .theme=${this._theme}></openfga-model-graph>`
              : html`<openfga-relationship-graph style="flex:1;min-height:0" .tuples=${tuples}></openfga-relationship-graph>`}
          </div>

          <div
            id="tuples-panel"
            class="tab-content ${this._activeTab === 'tuples' ? 'visible' : ''}"
            role="tabpanel"
            aria-labelledby="tuples-tab"
            aria-hidden=${this._activeTab !== 'tuples'}
          >
            <openfga-tuple-manager
              style="flex:1;min-height:0"
              .tuples=${tuples}
              .model=${model.json}
              @tuple-add=${this._handleTupleAdd}
              @tuple-remove=${this._handleTupleRemove}
            ></openfga-tuple-manager>
          </div>

          <div
            id="assertions-panel"
            class="tab-content ${this._activeTab === 'assertions' ? 'visible' : ''}"
            role="tabpanel"
            aria-labelledby="assertions-tab"
            aria-hidden=${this._activeTab !== 'assertions'}
          >
            <openfga-assertion-runner
              style="flex:1;min-height:0"
              .assertions=${assertions}
              .results=${assertionResults}
              .model=${model.json}
              @assertion-add=${this._handleAssertionAdd}
              @assertion-remove=${this._handleAssertionRemove}
              @assertion-run=${this._handleAssertionRun}
              @assertion-run-all=${this._runAllAssertions}
              @assertion-expand=${this._handleAssertionExpand}
            ></openfga-assertion-runner>
          </div>

          <div
            id="changelog-panel"
            class="tab-content ${this._activeTab === 'changelog' ? 'visible' : ''}"
            role="tabpanel"
            aria-labelledby="changelog-tab"
            aria-hidden=${this._activeTab !== 'changelog'}
          >
            <openfga-changelog
              style="flex:1;min-height:0"
              .entries=${this._changelogEntries}
              .hasMore=${this._changelogHasMore}
              .loading=${this._changelogLoading}
              @changelog-load=${this._handleChangelogLoad}
              @changelog-load-more=${this._handleChangelogLoadMore}
            ></openfga-changelog>
          </div>

          <div
            id="query-panel"
            class="tab-content ${this._activeTab === 'query' ? 'visible' : ''}"
            role="tabpanel"
            aria-labelledby="query-tab"
            aria-hidden=${this._activeTab !== 'query'}
          >
            <openfga-query-runner
              style="flex:1;min-height:0"
              .model=${model.json}
              @query-check=${this._handleQueryCheck}
              @query-list-objects=${this._handleQueryListObjects}
              @query-list-users=${this._handleQueryListUsers}
              @query-list-relations=${this._handleQueryListRelations}
              @query-expand=${this._handleQueryExpand}
            ></openfga-query-runner>
          </div>

          <div
            id="api-log-panel"
            class="tab-content ${this._activeTab === 'api-log' ? 'visible' : ''}"
            role="tabpanel"
            aria-labelledby="api-log-tab"
            aria-hidden=${this._activeTab !== 'api-log'}
          >
            <openfga-dev-console
              style="flex:1;min-height:0"
              .entries=${this._apiLog.value}
              @clear-log=${() => { $apiLog.set([]); }}
            ></openfga-dev-console>
          </div>

          ${compareModelId
            ? html`
                <div
                  id="diff-panel"
                  class="tab-content ${this._activeTab === 'diff' ? 'visible' : ''}"
                  role="tabpanel"
                  aria-labelledby="diff-tab"
                  aria-hidden=${this._activeTab !== 'diff'}
                >
                  <openfga-model-diff
                    style="flex:1;min-height:0"
                    .modelA=${this._compareDsl}
                    .modelB=${model.dsl}
                    .theme=${this._theme}
                    .labelA=${compareModelId
                      ? `${compareModelId.slice(0, 8)}…${formatUlidDate(compareModelId) ? ` (${formatUlidDate(compareModelId)})` : ''}`
                      : 'Original'}
                    .labelB=${activeModelId
                      ? `${activeModelId.slice(0, 8)}…${formatUlidDate(activeModelId) ? ` (${formatUlidDate(activeModelId)})` : ''}`
                      : 'Current'}
                    .format=${this._modelFormat}
                  ></openfga-model-diff>
                </div>
              `
            : nothing}
        </section>
      </main>

      <!-- ---- connection config drawer ---- -->
      ${this._ccOpen
        ? html`
            <div
              class="cc-drawer-backdrop"
              aria-hidden="true"
              @click=${() => (this._ccOpen = false)}
            ></div>
            <div class="cc-drawer" role="dialog" aria-label="Connection settings" aria-modal="true">
              <button
                class="cc-drawer-close"
                aria-label="Close connection settings"
                @click=${() => (this._ccOpen = false)}
              >×</button>
              <openfga-connection-config
                style="flex:1;min-height:0"
                .servers=${servers}
                .activeServerId=${activeServerId}
                .activeStoreId=${activeStoreId}
                @server-add=${this._handleServerAdd}
                @server-update=${this._handleServerUpdate}
                @server-remove=${this._handleServerRemove}
                @server-select=${this._handleServerSelect}
                @store-add=${this._handleStoreAdd}
                @store-create=${this._handleStoreCreate}
                @store-update=${this._handleStoreUpdate}
                @store-remove=${this._handleStoreRemove}
                @store-select=${this._handleStoreSelect}
              ></openfga-connection-config>
            </div>
          `
        : nothing}

      <!-- ---- resolution path modal ---- -->
      ${this._resolutionGraph
        ? html`
            <div
              class="rp-backdrop"
              aria-hidden="true"
              @click=${() => { this._resolutionGraph = null; }}
            ></div>
            <div class="rp-modal" role="dialog" aria-label="Resolution path" aria-modal="true">
              <div class="rp-header">
                <span class="rp-title">Resolution path: ${this._resolutionLabel}</span>
                <button
                  class="rp-close"
                  aria-label="Close resolution path"
                  @click=${() => { this._resolutionGraph = null; }}
                >×</button>
              </div>
              <openfga-resolution-path
                style="flex:1;min-height:0"
                .graph=${this._resolutionGraph}
              ></openfga-resolution-path>
            </div>
          `
        : nothing}

      <!-- ---- backend picker ---- -->
      ${this._backendPickerOpen
        ? html`
            <div class="token-backdrop">
              <div class="token-dialog" role="dialog" aria-label="Choose backend" aria-modal="true">
                ${this._backendPickerMode === 'choose'
                  ? html`
                      <h2>Choose Backend</h2>
                      <p>
                        Pick how the playground should connect to OpenFGA. Your
                        choice is saved locally and can be changed from the toolbar.
                      </p>
                      <div class="backend-options">
                        <button
                          class="backend-option"
                          @click=${() => void this._pickBackend('direct')}
                        >
                          <strong>Direct</strong>
                          <span>
                            Connect directly to an unauthenticated OpenFGA server
                            (e.g. local docker-compose).
                          </span>
                        </button>
                        <button
                          class="backend-option"
                          disabled
                          @click=${() => void this._pickBackend('proxy')}
                        >
                          <strong>Proxy (via <code>fga serve</code>) <span class="tag-future">future</span></strong>
                          <span>
                            Recommended for local development. Manages multiple server
                            connections and secrets. Supports authenticated OpenFGA
                            servers (API token, OAuth). Coming soon!
                          </span>
                        </button>
                        <button
                          class="backend-option"
                          disabled
                        >
                          <strong>WASM <span class="tag-future">future</span></strong>
                          <span>
                            Run OpenFGA entirely in the browser via WebAssembly. No
                            network required. Not yet available.
                          </span>
                        </button>
                      </div>
                    `
                  : html`
                      <h2>${this._backendPickerMode === 'proxy-url' ? 'Proxy URL' : 'OpenFGA Server URL'}</h2>
                      <p>
                        ${this._backendPickerMode === 'proxy-url'
                          ? html`Enter the URL where <code>fga serve</code> is running.`
                          : html`Enter the URL of the unauthenticated OpenFGA server to connect to.`}
                      </p>
                      <input
                        class="token-input"
                        type="text"
                        placeholder=${this._backendPickerMode === 'proxy-url' ? 'http://localhost:8880' : 'http://localhost:8080'}
                        .value=${this._backendUrlInput}
                        @input=${(e: Event) => { this._backendUrlInput = (e.target as HTMLInputElement).value; }}
                        @keydown=${(e: KeyboardEvent) => { if (e.key === 'Enter') void this._confirmBackendUrl(); }}
                        autofocus
                        spellcheck="false"
                        autocomplete="off"
                      />
                      <div style="display:flex;gap:8px">
                        <button
                          class="token-submit"
                          ?disabled=${!this._backendUrlInput.trim()}
                          @click=${() => void this._confirmBackendUrl()}
                        >Connect</button>
                        <button
                          class="btn-connection"
                          style="font-size:12px;padding:7px 14px"
                          @click=${() => { this._backendPickerMode = 'choose'; this._backendUrlInput = ''; }}
                        >Back</button>
                      </div>
                    `}
              </div>
            </div>
          `
        : nothing}

      <!-- ---- session token prompt ---- -->
      ${this._tokenRequired
        ? html`
            <div class="token-backdrop">
              <div class="token-dialog" role="dialog" aria-label="Session token required" aria-modal="true">
                <h2>Session Token Required</h2>
                <p>
                  <code>fga serve</code> requires a session token. Copy the token
                  from your terminal and paste it below, or open the URL printed
                  by <code>fga serve</code> which includes the token.
                </p>
                <input
                  class="token-input"
                  type="text"
                  placeholder="Paste session token here"
                  .value=${this._tokenInput}
                  @input=${(e: Event) => { this._tokenInput = (e.target as HTMLInputElement).value; }}
                  @keydown=${(e: KeyboardEvent) => { if (e.key === 'Enter') void this._submitToken(); }}
                  autofocus
                  spellcheck="false"
                  autocomplete="off"
                />
                <button
                  class="token-submit"
                  ?disabled=${!this._tokenInput.trim()}
                  @click=${() => void this._submitToken()}
                >Connect</button>
              </div>
            </div>
          `
        : nothing}

      <!-- ---- error toast ---- -->
      ${this._errorMsg
        ? html`<div class="error-toast" role="alert">${this._errorMsg}</div>`
        : nothing}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'openfga-playground': PlaygroundApp;
  }
}
