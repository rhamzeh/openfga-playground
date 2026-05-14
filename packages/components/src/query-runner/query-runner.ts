// SPDX-License-Identifier: Apache-2.0
import { LitElement, html, css, nothing, TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

// ---------------------------------------------------------------------------
// Event detail types
// ---------------------------------------------------------------------------

export interface QueryCheckDetail {
  user: string;
  relation: string;
  object: string;
}

export interface QueryListObjectsDetail {
  user: string;
  relation: string;
  type: string;
}

export interface QueryListUsersDetail {
  objectType: string;
  objectId: string;
  relation: string;
  userType: string;
}

export interface QueryExpandDetail {
  user: string;
  relation: string;
  object: string;
}

export interface QueryListRelationsDetail {
  user: string;
  object: string;
  relations: string[];
}

// ---------------------------------------------------------------------------
// Coloring helper
// ---------------------------------------------------------------------------

function renderSeg(str: string): TemplateResult {
  const hashIdx = str.indexOf('#');
  const rel = hashIdx >= 0 ? str.substring(hashIdx + 1) : undefined;
  const obj = hashIdx >= 0 ? str.substring(0, hashIdx) : str;
  const colonIdx = obj.indexOf(':');
  if (colonIdx <= 0) return html`${str}`;
  return html`<span class="seg-type">${obj.substring(0, colonIdx)}</span><span class="seg-id">${obj.substring(colonIdx)}</span>${rel !== undefined
    ? html`<span class="seg-rel">#${rel}</span>`
    : nothing}`;
}

// ---------------------------------------------------------------------------
// Model helpers
// ---------------------------------------------------------------------------

function typesFromModel(model: object | null): string[] {
  if (!model) return [];
  const m = model as { type_definitions?: Array<{ type: string }> };
  return (m.type_definitions ?? []).map((td) => td.type).sort();
}

/** Relations for a specific type (or all if type is empty). */
function relationsForType(model: object | null, typeName: string): string[] {
  if (!model) return [];
  const m = model as { type_definitions?: Array<{ type: string; relations?: Record<string, unknown> }> };
  for (const td of m.type_definitions ?? []) {
    if (td.type === typeName) return Object.keys(td.relations ?? {}).sort();
  }
  return [];
}

function relationsFromModel(model: object | null): string[] {
  if (!model) return [];
  const m = model as { type_definitions?: Array<{ relations?: Record<string, unknown> }> };
  const seen = new Set<string>();
  for (const td of m.type_definitions ?? []) {
    for (const r of Object.keys(td.relations ?? {})) seen.add(r);
  }
  return [...seen].sort();
}

function typeHintsFromModel(model: object | null): string[] {
  return typesFromModel(model).map((t) => `${t}:`).sort();
}

// ---------------------------------------------------------------------------
// Sub-tab types
// ---------------------------------------------------------------------------

type QueryTab = 'check' | 'list-objects' | 'list-users' | 'list-relations';

interface CheckState {
  user: string; relation: string; object: string;
  result: boolean | null; error: string | null; ran: boolean;
}

interface ListObjectsState {
  user: string; relation: string; type: string;
  results: string[]; error: string | null; ran: boolean;
}

interface ListUsersState {
  objectType: string; objectId: string; relation: string; userType: string;
  results: string[]; error: string | null; ran: boolean;
}

interface ListRelationsState {
  user: string; object: string;
  results: string[]; error: string | null; ran: boolean;
}

/**
 * `<openfga-query-runner>`
 *
 * Provides three sub-tabs for running ad-hoc OpenFGA queries:
 *   - Check: user/relation/object → allowed/denied
 *   - ListObjects: user/relation/type → list of objects
 *   - ListUsers: object/relation/user-type → list of users
 *
 * @prop {object | null} model - Parsed model JSON for autocomplete.
 *
 * @fires {CustomEvent<QueryCheckDetail>}       query-check        - Run a Check query.
 * @fires {CustomEvent<QueryListObjectsDetail>} query-list-objects - Run a ListObjects query.
 * @fires {CustomEvent<QueryListUsersDetail>}   query-list-users   - Run a ListUsers query.
 */
@customElement('openfga-query-runner')
export class QueryRunner extends LitElement {
  static override styles = css`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      background: var(--openfga-bg-primary, #1e1e2e);
      color: var(--openfga-text-primary, #cdd6f4);
      font-family: var(--openfga-font-family, sans-serif);
      font-size: var(--openfga-font-size-sm, 12px);
    }

    /* ---- sub-tab bar ---- */
    .subtab-bar {
      display: flex;
      background: var(--openfga-bg-secondary, #181825);
      border-bottom: 1px solid var(--openfga-border, #45475a);
      flex-shrink: 0;
    }
    .subtab {
      padding: 8px 14px;
      border: none;
      background: transparent;
      color: var(--openfga-text-secondary, #a6adc8);
      cursor: pointer;
      font-size: 11px;
      font-family: inherit;
      border-bottom: 2px solid transparent;
      transition: color 0.1s;
    }
    .subtab:hover { color: var(--openfga-text-primary, #cdd6f4); }
    .subtab[aria-selected='true'] {
      color: var(--openfga-accent, #cba6f7);
      border-bottom-color: var(--openfga-accent, #cba6f7);
    }

    /* ---- query panel ---- */
    .query-panel {
      flex: 1;
      display: flex;
      flex-direction: column;
      padding: 14px;
      gap: 12px;
      overflow-y: auto;
      min-height: 0;
    }

    /* ---- form grid ---- */
    .form-grid {
      display: grid;
      gap: 8px;
    }
    .form-row {
      display: flex;
      gap: 8px;
      align-items: end;
      flex-wrap: wrap;
    }
    .field {
      display: flex;
      flex-direction: column;
      gap: 3px;
      flex: 1;
      min-width: 120px;
    }
    .field-label {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--openfga-text-secondary, #a6adc8);
    }
    .field-label.type-color { color: var(--openfga-graph-node-type, #79ed83); opacity: 0.85; }
    .field-label.rel-color  { color: var(--openfga-graph-node-relation, #20f1f5); opacity: 0.85; }
    input, select {
      background: var(--openfga-bg-secondary, #181825);
      color: var(--openfga-text-primary, #cdd6f4);
      border: 1px solid var(--openfga-border, #313244);
      border-radius: var(--openfga-radius-sm, 4px);
      padding: 5px 8px;
      font-size: 11px;
      font-family: var(--openfga-font-mono, monospace);
      outline: none;
      width: 100%;
      box-sizing: border-box;
    }
    input:focus, select:focus { border-color: var(--openfga-accent, #cba6f7); }
    select.rel-value { color: var(--openfga-graph-node-relation, #20f1f5); }
    select.type-value { color: var(--openfga-graph-node-type, #79ed83); }

    /* ---- run button ---- */
    .btn-run {
      cursor: pointer;
      background: var(--openfga-accent, #cba6f7);
      color: var(--openfga-bg-primary, #1e1e2e);
      border: none;
      border-radius: var(--openfga-radius-sm, 4px);
      font-size: 11px;
      font-family: inherit;
      font-weight: 600;
      padding: 5px 14px;
      white-space: nowrap;
      align-self: flex-end;
    }
    .btn-run:hover:not(:disabled) { opacity: 0.85; }
    .btn-run:disabled { opacity: 0.4; cursor: not-allowed; }

    /* ---- results ---- */
    .result-box {
      border: 1px solid var(--openfga-border, #313244);
      border-radius: var(--openfga-radius-sm, 4px);
      padding: 10px 12px;
      background: var(--openfga-bg-secondary, #181825);
      min-height: 48px;
    }
    .result-label {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--openfga-text-secondary, #a6adc8);
      margin-bottom: 6px;
    }
    .result-allowed, .result-denied {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
      font-weight: 700;
    }
    .result-allowed { color: var(--openfga-success, #a6e3a1); }
    .result-denied { color: var(--openfga-error, #f38ba8); }
    .btn-expand {
      cursor: pointer;
      background: transparent;
      color: var(--openfga-text-secondary, #a6adc8);
      border: 1px solid var(--openfga-border, #313244);
      border-radius: 3px;
      font-size: 10px;
      font-family: inherit;
      font-weight: 400;
      padding: 1px 8px;
    }
    .btn-expand:hover { color: var(--openfga-accent, #89b4fa); border-color: var(--openfga-accent, #89b4fa); }
    .result-error {
      color: var(--openfga-warning, #fab387);
      font-size: 11px;
    }
    .result-empty {
      color: var(--openfga-text-secondary, #a6adc8);
      font-size: 11px;
      opacity: 0.7;
    }
    .result-list {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .result-item {
      font-family: var(--openfga-font-mono, monospace);
      font-size: 11px;
      padding: 3px 0;
      border-bottom: 1px solid var(--openfga-border, #313244);
    }
    .result-item:last-child { border-bottom: none; }
    .result-count {
      font-size: 10px;
      color: var(--openfga-text-secondary, #a6adc8);
      margin-top: 4px;
    }
    .seg-type { color: var(--openfga-graph-node-type, #79ed83); }
    .seg-id   { color: var(--openfga-text-primary, #cdd6f4); }
    .seg-rel  { color: var(--openfga-graph-node-relation, #20f1f5); }
  `;

  @property({ type: Object }) model: object | null = null;

  @state() private _tab: QueryTab = 'check';
  @state() private _check: CheckState = { user: '', relation: '', object: '', result: null, error: null, ran: false };
  @state() private _listObjects: ListObjectsState = { user: '', relation: '', type: '', results: [], error: null, ran: false };
  @state() private _listUsers: ListUsersState = { objectType: '', objectId: '', relation: '', userType: '', results: [], error: null, ran: false };
  @state() private _listRelations: ListRelationsState = { user: '', object: '', results: [], error: null, ran: false };

  private get _types() { return typesFromModel(this.model); }
  private get _relations() { return relationsFromModel(this.model); }
  private get _typeHints() { return typeHintsFromModel(this.model); }

  // --- Check ---

  private _runCheck() {
    const { user, relation, object } = this._check;
    if (!user.trim() || !relation.trim() || !object.trim()) return;
    this.dispatchEvent(new CustomEvent<QueryCheckDetail>('query-check', {
      detail: { user: user.trim(), relation: relation.trim(), object: object.trim() },
      bubbles: true, composed: true,
    }));
  }

  setCheckResult(allowed: boolean) {
    this._check = { ...this._check, result: allowed, error: null, ran: true };
  }

  setCheckError(error: string) {
    this._check = { ...this._check, result: null, error, ran: true };
  }

  // --- ListObjects ---

  private _runListObjects() {
    const { user, relation, type } = this._listObjects;
    if (!user.trim() || !relation.trim() || !type.trim()) return;
    this.dispatchEvent(new CustomEvent<QueryListObjectsDetail>('query-list-objects', {
      detail: { user: user.trim(), relation: relation.trim(), type: type.trim() },
      bubbles: true, composed: true,
    }));
  }

  setListObjectsResult(results: string[]) {
    this._listObjects = { ...this._listObjects, results, error: null, ran: true };
  }

  setListObjectsError(error: string) {
    this._listObjects = { ...this._listObjects, results: [], error, ran: true };
  }

  // --- ListUsers ---

  private _runListUsers() {
    const { objectType, objectId, relation, userType } = this._listUsers;
    if (!objectType.trim() || !objectId.trim() || !relation.trim() || !userType.trim()) return;
    this.dispatchEvent(new CustomEvent<QueryListUsersDetail>('query-list-users', {
      detail: { objectType: objectType.trim(), objectId: objectId.trim(), relation: relation.trim(), userType: userType.trim() },
      bubbles: true, composed: true,
    }));
  }

  private _runListRelations() {
    const { user, object } = this._listRelations;
    if (!user.trim() || !object.trim()) return;
    // Only check relations defined on the object's type.
    const colonIdx = object.indexOf(':');
    const objectType = colonIdx > 0 ? object.substring(0, colonIdx) : '';
    const relations = objectType
      ? relationsForType(this.model, objectType)
      : relationsFromModel(this.model);
    if (relations.length === 0) return;
    this.dispatchEvent(new CustomEvent<QueryListRelationsDetail>('query-list-relations', {
      detail: { user: user.trim(), object: object.trim(), relations },
      bubbles: true, composed: true,
    }));
  }

  setListUsersResult(results: string[]) {
    this._listUsers = { ...this._listUsers, results, error: null, ran: true };
  }

  setListUsersError(error: string) {
    this._listUsers = { ...this._listUsers, results: [], error, ran: true };
  }

  setListRelationsResult(results: string[]) {
    this._listRelations = { ...this._listRelations, results, error: null, ran: true };
  }

  setListRelationsError(error: string) {
    this._listRelations = { ...this._listRelations, results: [], error, ran: true };
  }

  // --- Render helpers ---

  private _renderCheckResult() {
    const { user, relation, object, result, error, ran } = this._check;
    if (!ran) return nothing;
    if (error) return html`<div class="result-error">Error: ${error}</div>`;
    const canExpand = user.trim() && relation.trim() && object.trim();
    return html`
      <div class="${result === true ? 'result-allowed' : 'result-denied'}">
        ${result === true ? '✓ Allowed' : '✗ Denied'}
        ${canExpand ? html`
          <button class="btn-expand" @click=${this._fireExpand}
            title="Show resolution path">Expand</button>
        ` : nothing}
      </div>
    `;
  }

  private _fireExpand() {
    const { user, relation, object } = this._check;
    this.dispatchEvent(new CustomEvent<QueryExpandDetail>('query-expand', {
      detail: { user, relation, object },
      bubbles: true, composed: true,
    }));
  }

  private _renderListResult(results: string[], error: string | null, ran: boolean, label: string) {
    if (!ran) return nothing;
    if (error) return html`<div class="result-error">Error: ${error}</div>`;
    if (!results.length) return html`<div class="result-empty">No ${label} found</div>`;
    return html`
      <div class="result-list">
        ${results.map((r) => html`<div class="result-item">${renderSeg(r)}</div>`)}
      </div>
      <div class="result-count">${results.length} result${results.length !== 1 ? 's' : ''}</div>
    `;
  }

  private _renderCheck() {
    const { user, relation, object } = this._check;
    const relations = this._relations;
    const typeHints = this._typeHints;
    const userListId = 'qr-check-user';
    const objListId = 'qr-check-obj';
    return html`
      <div class="query-panel">
        ${typeHints.length > 0 ? html`
          <datalist id=${userListId}>${typeHints.map((h) => html`<option value=${h}></option>`)}</datalist>
          <datalist id=${objListId}>${typeHints.map((h) => html`<option value=${h}></option>`)}</datalist>
        ` : nothing}
        <div class="form-row">
          <div class="field">
            <span class="field-label type-color">User</span>
            <input type="text" placeholder="user:anne" .value=${user}
              list=${typeHints.length > 0 ? userListId : nothing}
              @input=${(e: Event) => { this._check = { ...this._check, user: (e.target as HTMLInputElement).value }; }}
              @keydown=${(e: KeyboardEvent) => { if (e.key === 'Enter') this._runCheck(); }} />
          </div>
          <div class="field">
            <span class="field-label rel-color">Relation</span>
            ${relations.length > 0 ? html`
              <select class=${relation ? 'rel-value' : ''}
                .value=${relation}
                @change=${(e: Event) => { this._check = { ...this._check, relation: (e.target as HTMLSelectElement).value }; }}>
                <option value="" disabled ?selected=${!relation}>— select —</option>
                ${relations.map((r) => html`<option value=${r} ?selected=${relation === r}>${r}</option>`)}
              </select>
            ` : html`
              <input type="text" placeholder="viewer" .value=${relation}
                @input=${(e: Event) => { this._check = { ...this._check, relation: (e.target as HTMLInputElement).value }; }}
                @keydown=${(e: KeyboardEvent) => { if (e.key === 'Enter') this._runCheck(); }} />
            `}
          </div>
          <div class="field">
            <span class="field-label type-color">Object</span>
            <input type="text" placeholder="document:budget" .value=${object}
              list=${typeHints.length > 0 ? objListId : nothing}
              @input=${(e: Event) => { this._check = { ...this._check, object: (e.target as HTMLInputElement).value }; }}
              @keydown=${(e: KeyboardEvent) => { if (e.key === 'Enter') this._runCheck(); }} />
          </div>
          <button class="btn-run" @click=${this._runCheck}
            ?disabled=${!user.trim() || !relation.trim() || !object.trim()}>
            Check
          </button>
        </div>
        <div class="result-box">
          <div class="result-label">Result</div>
          ${this._renderCheckResult()}
        </div>
      </div>
    `;
  }

  private _renderListObjects() {
    const { user, relation, type } = this._listObjects;
    const relations = this._relations;
    const types = this._types;
    const typeHints = this._typeHints;
    const userListId = 'qr-lo-user';
    return html`
      <div class="query-panel">
        ${typeHints.length > 0 ? html`
          <datalist id=${userListId}>${typeHints.map((h) => html`<option value=${h}></option>`)}</datalist>
        ` : nothing}
        <div class="form-row">
          <div class="field">
            <span class="field-label type-color">User</span>
            <input type="text" placeholder="user:anne" .value=${user}
              list=${typeHints.length > 0 ? userListId : nothing}
              @input=${(e: Event) => { this._listObjects = { ...this._listObjects, user: (e.target as HTMLInputElement).value }; }} />
          </div>
          <div class="field">
            <span class="field-label rel-color">Relation</span>
            ${relations.length > 0 ? html`
              <select class=${relation ? 'rel-value' : ''} .value=${relation}
                @change=${(e: Event) => { this._listObjects = { ...this._listObjects, relation: (e.target as HTMLSelectElement).value }; }}>
                <option value="" disabled ?selected=${!relation}>— select —</option>
                ${relations.map((r) => html`<option value=${r} ?selected=${relation === r}>${r}</option>`)}
              </select>
            ` : html`
              <input type="text" placeholder="viewer" .value=${relation}
                @input=${(e: Event) => { this._listObjects = { ...this._listObjects, relation: (e.target as HTMLInputElement).value }; }} />
            `}
          </div>
          <div class="field">
            <span class="field-label type-color">Object type</span>
            ${types.length > 0 ? html`
              <select class=${type ? 'type-value' : ''} .value=${type}
                @change=${(e: Event) => { this._listObjects = { ...this._listObjects, type: (e.target as HTMLSelectElement).value }; }}>
                <option value="" disabled ?selected=${!type}>— select —</option>
                ${types.map((t) => html`<option value=${t} ?selected=${type === t}>${t}</option>`)}
              </select>
            ` : html`
              <input type="text" placeholder="document" .value=${type}
                @input=${(e: Event) => { this._listObjects = { ...this._listObjects, type: (e.target as HTMLInputElement).value }; }} />
            `}
          </div>
          <button class="btn-run" @click=${this._runListObjects}
            ?disabled=${!user.trim() || !relation.trim() || !type.trim()}>
            List
          </button>
        </div>
        <div class="result-box">
          <div class="result-label">Objects</div>
          ${this._renderListResult(this._listObjects.results, this._listObjects.error, this._listObjects.ran, 'objects')}
        </div>
      </div>
    `;
  }

  private _renderListUsers() {
    const { objectType, objectId, relation, userType } = this._listUsers;
    const relations = this._relations;
    const types = this._types;
    return html`
      <div class="query-panel">
        <div class="form-row">
          <div class="field">
            <span class="field-label type-color">Object type</span>
            ${types.length > 0 ? html`
              <select class=${objectType ? 'type-value' : ''} .value=${objectType}
                @change=${(e: Event) => { this._listUsers = { ...this._listUsers, objectType: (e.target as HTMLSelectElement).value }; }}>
                <option value="" disabled ?selected=${!objectType}>— select —</option>
                ${types.map((t) => html`<option value=${t} ?selected=${objectType === t}>${t}</option>`)}
              </select>
            ` : html`
              <input type="text" placeholder="document" .value=${objectType}
                @input=${(e: Event) => { this._listUsers = { ...this._listUsers, objectType: (e.target as HTMLInputElement).value }; }} />
            `}
          </div>
          <div class="field">
            <span class="field-label type-color">Object ID</span>
            <input type="text" placeholder="budget" .value=${objectId}
              @input=${(e: Event) => { this._listUsers = { ...this._listUsers, objectId: (e.target as HTMLInputElement).value }; }} />
          </div>
          <div class="field">
            <span class="field-label rel-color">Relation</span>
            ${relations.length > 0 ? html`
              <select class=${relation ? 'rel-value' : ''} .value=${relation}
                @change=${(e: Event) => { this._listUsers = { ...this._listUsers, relation: (e.target as HTMLSelectElement).value }; }}>
                <option value="" disabled ?selected=${!relation}>— select —</option>
                ${relations.map((r) => html`<option value=${r} ?selected=${relation === r}>${r}</option>`)}
              </select>
            ` : html`
              <input type="text" placeholder="viewer" .value=${relation}
                @input=${(e: Event) => { this._listUsers = { ...this._listUsers, relation: (e.target as HTMLInputElement).value }; }} />
            `}
          </div>
          <div class="field">
            <span class="field-label type-color">User type</span>
            ${types.length > 0 ? html`
              <select class=${userType ? 'type-value' : ''} .value=${userType}
                @change=${(e: Event) => { this._listUsers = { ...this._listUsers, userType: (e.target as HTMLSelectElement).value }; }}>
                <option value="" disabled ?selected=${!userType}>— select —</option>
                ${types.map((t) => html`<option value=${t} ?selected=${userType === t}>${t}</option>`)}
              </select>
            ` : html`
              <input type="text" placeholder="user" .value=${userType}
                @input=${(e: Event) => { this._listUsers = { ...this._listUsers, userType: (e.target as HTMLInputElement).value }; }} />
            `}
          </div>
          <button class="btn-run" @click=${this._runListUsers}
            ?disabled=${!objectType.trim() || !objectId.trim() || !relation.trim() || !userType.trim()}>
            List
          </button>
        </div>
        <div class="result-box">
          <div class="result-label">Users</div>
          ${this._renderListResult(this._listUsers.results, this._listUsers.error, this._listUsers.ran, 'users')}
        </div>
      </div>
    `;
  }

  private _renderListRelations() {
    const { user, object } = this._listRelations;
    const typeHints = this._typeHints;
    const userListId = 'qr-lr-user';
    const objListId = 'qr-lr-obj';
    return html`
      <div class="query-panel">
        ${typeHints.length > 0 ? html`
          <datalist id=${userListId}>${typeHints.map((h) => html`<option value=${h}></option>`)}</datalist>
          <datalist id=${objListId}>${typeHints.map((h) => html`<option value=${h}></option>`)}</datalist>
        ` : nothing}
        <div class="form-row">
          <div class="field">
            <span class="field-label type-color">User</span>
            <input type="text" placeholder="user:anne" .value=${user}
              list=${typeHints.length > 0 ? userListId : nothing}
              @input=${(e: Event) => { this._listRelations = { ...this._listRelations, user: (e.target as HTMLInputElement).value }; }}
              @keydown=${(e: KeyboardEvent) => { if (e.key === 'Enter') this._runListRelations(); }} />
          </div>
          <div class="field">
            <span class="field-label type-color">Object</span>
            <input type="text" placeholder="document:budget" .value=${object}
              list=${typeHints.length > 0 ? objListId : nothing}
              @input=${(e: Event) => { this._listRelations = { ...this._listRelations, object: (e.target as HTMLInputElement).value }; }}
              @keydown=${(e: KeyboardEvent) => { if (e.key === 'Enter') this._runListRelations(); }} />
          </div>
          <button class="btn-run" @click=${this._runListRelations}
            ?disabled=${!user.trim() || !object.trim()}>
            List Relations
          </button>
        </div>
        <div class="result-box">
          <div class="result-label">Relations</div>
          ${this._renderListResult(this._listRelations.results, this._listRelations.error, this._listRelations.ran, 'relations')}
        </div>
      </div>
    `;
  }

  override render() {
    return html`
      <div class="subtab-bar" role="tablist" aria-label="Query type">
        ${(['check', 'list-objects', 'list-users', 'list-relations'] as const).map((tab) => html`
          <button
            class="subtab"
            role="tab"
            aria-selected=${this._tab === tab}
            @click=${() => { this._tab = tab; }}
          >
            ${{ check: 'Check', 'list-objects': 'List Objects', 'list-users': 'List Users', 'list-relations': 'List Relations' }[tab]}
          </button>
        `)}
      </div>
      ${this._tab === 'check' ? this._renderCheck()
        : this._tab === 'list-objects' ? this._renderListObjects()
        : this._tab === 'list-users' ? this._renderListUsers()
        : this._renderListRelations()}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'openfga-query-runner': QueryRunner;
  }
}
