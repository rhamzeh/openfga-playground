// SPDX-License-Identifier: Apache-2.0
import { LitElement, html, css, nothing, TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import type {
  TupleKey,
  TupleAddDetail,
  TupleRemoveDetail,
} from '../shared/types.js';

// ---------------------------------------------------------------------------
// Model analysis helpers
// ---------------------------------------------------------------------------

interface DirectlyRelatedUserType {
  type: string;
  relation?: string;
  wildcard?: Record<string, unknown>;
}

interface TypeDef {
  type: string;
  relations?: Record<string, unknown>;
  metadata?: {
    relations?: Record<string, { directly_related_user_types?: DirectlyRelatedUserType[] }>;
  };
}

function parseTypeFromString(str: string): string | null {
  const s = str.trim();
  if (!s) return null;
  const i = s.indexOf(':');
  return i > 0 ? s.substring(0, i) : null;
}

function parseRelationFromString(str: string): string | undefined {
  const i = str.indexOf('#');
  return i >= 0 ? str.substring(i + 1) : undefined;
}

function relationAcceptsUser(
  meta: { directly_related_user_types?: DirectlyRelatedUserType[] },
  userType: string,
  userRelation: string | undefined,
): boolean {
  for (const rut of meta.directly_related_user_types ?? []) {
    if (rut.type !== userType) continue;
    if (!userRelation && !rut.relation) return true; // direct: [user]
    if (!userRelation && rut.wildcard) return true;   // wildcard: [user:*]
    if (userRelation && rut.relation === userRelation) return true; // userset: [team#member]
  }
  return false;
}

/**
 * Compute which relation names are compatible given the user and object values.
 * - If object type is specified, restrict to relations on that type.
 * - If user is specified, restrict to relations that accept that user type.
 * Falls back to showing all relations when either side can't be parsed.
 */
function computeRelations(model: object | null, user: string, object: string): string[] {
  if (!model) return [];
  const m = model as { type_definitions?: TypeDef[] };
  const typeDefs = m.type_definitions ?? [];

  const objectType = parseTypeFromString(object);
  const userType = parseTypeFromString(user);
  const userRel = userType ? parseRelationFromString(user) : undefined;

  const seen = new Set<string>();

  for (const td of typeDefs) {
    // Filter by object type if provided
    if (objectType && td.type !== objectType) continue;

    const metaRels = td.metadata?.relations ?? {};
    const hasMetadata = Object.keys(metaRels).length > 0;

    if (hasMetadata) {
      for (const [relName, meta] of Object.entries(metaRels)) {
        if (userType && !relationAcceptsUser(meta, userType, userRel)) continue;
        seen.add(relName);
      }
    } else {
      // No metadata: include all relations for this type when no user filter
      if (!userType) {
        for (const relName of Object.keys(td.relations ?? {})) seen.add(relName);
      }
    }
  }

  // Fallback: if nothing matched but user/object supplied, show all relations
  if (seen.size === 0 && (userType || objectType)) {
    for (const td of typeDefs) {
      if (objectType && td.type !== objectType) continue;
      for (const relName of Object.keys(td.relations ?? {})) seen.add(relName);
    }
  }

  return [...seen].sort();
}

/** Extract "type:" prefix suggestions from a parsed model JSON. */
function typeHintsFromModel(model: object | null): string[] {
  if (!model) return [];
  const m = model as { type_definitions?: Array<{ type: string }> };
  return (m.type_definitions ?? []).map((td) => `${td.type}:`).sort();
}

// ---------------------------------------------------------------------------
// Coloring helpers
// ---------------------------------------------------------------------------

/** Render a tuple component string (user / object) with type/relation coloring. */
function renderTupleSegment(str: string): TemplateResult {
  const hashIdx = str.indexOf('#');
  const relation = hashIdx >= 0 ? str.substring(hashIdx + 1) : undefined;
  const obj = hashIdx >= 0 ? str.substring(0, hashIdx) : str;
  const colonIdx = obj.indexOf(':');
  if (colonIdx <= 0) return html`${str}`;
  const typePart = obj.substring(0, colonIdx);
  const idPart = obj.substring(colonIdx); // includes ':'
  return html`<span class="seg-type">${typePart}</span><span class="seg-id">${idPart}</span>${relation !== undefined
    ? html`<span class="seg-rel">#${relation}</span>`
    : nothing}`;
}

const EMPTY_FORM = { user: '', relation: '', object: '' };

/**
 * `<openfga-tuple-manager>`
 *
 * Table UI for managing relationship tuples. Displays all current tuples and
 * provides an inline form to add new ones.
 *
 * Type names are rendered in the type color; relation names (including userset
 * `#relation` parts) are rendered in the relation color.
 *
 * The relation dropdown is filtered by both user and object field values when
 * the model metadata provides `directly_related_user_types` information.
 *
 * @prop {TupleKey[]}    tuples - Current tuples to display.
 * @prop {object | null} model  - Parsed model JSON for autocomplete.
 *
 * @fires {CustomEvent<TupleAddDetail>}    tuple-add    - When a tuple is submitted.
 * @fires {CustomEvent<TupleRemoveDetail>} tuple-remove - When a tuple is deleted.
 */
@customElement('openfga-tuple-manager')
export class TupleManager extends LitElement {
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

    /* ---- filter bar ---- */
    .filter-bar {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 4px 12px;
      background: var(--openfga-bg-secondary, #181825);
      border-bottom: 1px solid var(--openfga-border, #313244);
      flex-shrink: 0;
    }
    .filter-bar label {
      color: var(--openfga-text-secondary, #a6adc8);
      font-size: 10px;
      white-space: nowrap;
    }
    .filter-input {
      flex: 1;
      font-size: 11px;
      font-family: var(--openfga-font-mono, monospace);
      background: var(--openfga-bg-primary, #1e1e2e);
      color: var(--openfga-text-primary, #cdd6f4);
      border: 1px solid var(--openfga-border, #313244);
      border-radius: 3px;
      padding: 2px 6px;
      outline: none;
    }
    .filter-input:focus { border-color: var(--openfga-accent, #89b4fa); }
    .filter-input::placeholder { color: var(--openfga-text-secondary, #a6adc8); opacity: 0.5; }
    .filter-count {
      color: var(--openfga-text-secondary, #a6adc8);
      font-size: 10px;
      white-space: nowrap;
    }

    /* ---- header ---- */
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--openfga-spacing-sm, 8px) var(--openfga-spacing-md, 12px);
      border-bottom: 1px solid var(--openfga-border, #313244);
      flex-shrink: 0;
    }
    .header h2 {
      margin: 0;
      font-size: var(--openfga-font-size-sm, 12px);
      font-weight: 600;
      color: var(--openfga-text-secondary, #a6adc8);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .count-badge {
      background: var(--openfga-bg-secondary, #181825);
      color: var(--openfga-text-secondary, #a6adc8);
      border-radius: 10px;
      padding: 1px 7px;
      font-size: 10px;
    }

    /* ---- table ---- */
    .table-wrapper {
      flex: 1;
      overflow-y: auto;
      min-height: 0;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    thead th {
      position: sticky;
      top: 0;
      background: var(--openfga-bg-secondary, #181825);
      color: var(--openfga-text-secondary, #a6adc8);
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      font-size: 10px;
      padding: 6px 10px;
      text-align: left;
      border-bottom: 1px solid var(--openfga-border, #313244);
      white-space: nowrap;
    }
    tbody tr {
      border-bottom: 1px solid var(--openfga-border, #313244);
    }
    tbody tr:hover {
      background: var(--openfga-bg-hover, #24273a);
    }
    tbody td {
      padding: 6px 10px;
      font-family: var(--openfga-font-mono, monospace);
      font-size: 11px;
      color: var(--openfga-text-primary, #cdd6f4);
      word-break: break-all;
    }
    tbody td.col-relation {
      color: var(--openfga-graph-node-relation, #20f1f5);
    }
    tbody td.col-actions {
      width: 36px;
      text-align: center;
      font-family: inherit;
    }

    /* ---- colored segments ---- */
    .seg-type { color: var(--openfga-graph-node-type, #79ed83); }
    .seg-id   { color: var(--openfga-text-primary, #cdd6f4); }
    .seg-rel  { color: var(--openfga-graph-node-relation, #20f1f5); }

    /* ---- empty state ---- */
    .empty-state {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 32px;
      color: var(--openfga-text-secondary, #a6adc8);
      opacity: 0.6;
    }

    /* ---- add form ---- */
    .add-form {
      flex-shrink: 0;
      border-top: 1px solid var(--openfga-border, #313244);
      padding: var(--openfga-spacing-sm, 8px) var(--openfga-spacing-md, 12px);
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .add-form-row {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr auto;
      gap: 6px;
      align-items: end;
    }
    label {
      display: flex;
      flex-direction: column;
      gap: 3px;
      font-size: 10px;
      color: var(--openfga-text-secondary, #a6adc8);
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    label.label-type { color: var(--openfga-graph-node-type, #79ed83); opacity: 0.8; }
    label.label-rel  { color: var(--openfga-graph-node-relation, #20f1f5); opacity: 0.8; }
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
    input:focus, select:focus {
      border-color: var(--openfga-accent, #cba6f7);
    }
    input.error, select.error {
      border-color: var(--openfga-error, #f38ba8);
    }
    select.has-value {
      color: var(--openfga-graph-node-relation, #20f1f5);
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
    button:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
    .btn-add {
      background: var(--openfga-accent, #cba6f7);
      color: var(--openfga-bg-primary, #1e1e2e);
      font-weight: 600;
      white-space: nowrap;
      align-self: flex-end;
    }
    .btn-add:hover:not(:disabled) { opacity: 0.85; }
    .btn-copy {
      background: transparent;
      color: var(--openfga-text-secondary, #a6adc8);
      padding: 3px 6px;
      font-size: 11px;
      line-height: 1;
      cursor: pointer;
      border: none;
      border-radius: 3px;
    }
    .btn-copy:hover { color: var(--openfga-accent, #89b4fa); background: var(--openfga-bg-hover, #24273a); }
    .btn-delete {
      background: transparent;
      color: var(--openfga-error, #f38ba8);
      padding: 3px 6px;
      font-size: 13px;
      line-height: 1;
    }
    .btn-delete:hover { background: var(--openfga-bg-hover, #24273a); }

    /* ---- validation error ---- */
    .form-error {
      color: var(--openfga-error, #f38ba8);
      font-size: 10px;
    }

    /* ---- live region ---- */
    .sr-live {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip: rect(0 0 0 0);
      white-space: nowrap;
    }
  `;

  @property({ type: Array }) tuples: TupleKey[] = [];
  @property({ type: Object }) model: object | null = null;

  @state() private _form = { ...EMPTY_FORM };
  @state() private _formError = '';
  @state() private _liveMsg = '';
  @state() private _filterText = '';

  private get _filteredTuples(): TupleKey[] {
    const q = this._filterText.toLowerCase().trim();
    if (!q) return this.tuples;
    return this.tuples.filter((t) =>
      t.user.toLowerCase().includes(q) ||
      t.relation.toLowerCase().includes(q) ||
      t.object.toLowerCase().includes(q),
    );
  }

  private get _typeHints() {
    return typeHintsFromModel(this.model);
  }

  private _filteredRelations(): string[] {
    return computeRelations(this.model, this._form.user, this._form.object);
  }

  private _validate(): string {
    const { user, relation, object } = this._form;
    if (!user.trim()) return 'User is required';
    if (!relation.trim()) return 'Relation is required';
    if (!object.trim()) return 'Object is required';
    return '';
  }

  private _submit(e: Event) {
    e.preventDefault();
    const err = this._validate();
    if (err) {
      this._formError = err;
      return;
    }
    const { user, relation, object } = this._form;
    this.dispatchEvent(
      new CustomEvent<TupleAddDetail>('tuple-add', {
        detail: { user: user.trim(), relation: relation.trim(), object: object.trim() },
        bubbles: true,
        composed: true,
      }),
    );
    this._liveMsg = `Tuple added: ${user.trim()} ${relation.trim()} ${object.trim()}`;
    this._form = { ...EMPTY_FORM };
    this._formError = '';
  }

  private _remove(tuple: TupleKey) {
    this.dispatchEvent(
      new CustomEvent<TupleRemoveDetail>('tuple-remove', {
        detail: { user: tuple.user, relation: tuple.relation, object: tuple.object },
        bubbles: true,
        composed: true,
      }),
    );
    this._liveMsg = `Tuple removed: ${tuple.user} ${tuple.relation} ${tuple.object}`;
  }

  private _copyTuple(t: TupleKey) {
    const cmd = `fga tuple write --user "${t.user}" --relation "${t.relation}" --object "${t.object}"`;
    navigator.clipboard.writeText(cmd).then(() => {
      this._liveMsg = 'Copied CLI command to clipboard';
    }).catch(() => {
      this._liveMsg = 'Copy failed';
    });
  }

  private _setField(field: keyof typeof EMPTY_FORM, value: string) {
    // When user or object changes, reset relation only if it's no longer in the filtered list
    const updated = { ...this._form, [field]: value };
    if (field === 'user' || field === 'object') {
      const newRels = computeRelations(this.model, updated.user, updated.object);
      if (newRels.length > 0 && this._form.relation && !newRels.includes(this._form.relation)) {
        updated.relation = '';
      }
    }
    this._form = updated;
    if (this._formError) this._formError = '';
  }

  override render() {
    const { user, relation, object } = this._form;
    const relations = this._filteredRelations();
    const typeHints = this._typeHints;
    const hasError = !!this._formError;
    const userListId = 'tm-user-hints';
    const objectListId = 'tm-object-hints';

    return html`
      <span class="sr-live" aria-live="polite" aria-atomic="true">${this._liveMsg}</span>

      <div class="header">
        <h2>Tuples</h2>
        <span class="count-badge" aria-label="${this.tuples.length} tuples">
          ${this.tuples.length}
        </span>
      </div>

      ${this.tuples.length > 0 ? html`
        <div class="filter-bar">
          <label>Filter</label>
          <input
            class="filter-input"
            type="text"
            placeholder="Search tuples..."
            .value=${this._filterText}
            @input=${(e: Event) => { this._filterText = (e.target as HTMLInputElement).value; }}
            aria-label="Filter tuples"
          />
          ${this._filterText ? html`
            <span class="filter-count">${this._filteredTuples.length} / ${this.tuples.length}</span>
          ` : nothing}
        </div>
      ` : nothing}

      <div class="table-wrapper" role="region" aria-label="Relationship tuples table">
        ${this.tuples.length === 0
          ? html`<div class="empty-state">No tuples yet — add one below</div>`
          : html`
              <table>
                <thead>
                  <tr>
                    <th scope="col">User</th>
                    <th scope="col">Relation</th>
                    <th scope="col">Object</th>
                    <th scope="col"><span class="sr-live">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  ${repeat(
                    this._filteredTuples,
                    (t) => `${t.user}|${t.relation}|${t.object}`,
                    (t) => html`
                      <tr>
                        <td>${renderTupleSegment(t.user)}</td>
                        <td class="col-relation">${t.relation}</td>
                        <td>${renderTupleSegment(t.object)}</td>
                        <td class="col-actions">
                          <button
                            class="btn-copy"
                            aria-label="Copy as CLI command"
                            title="Copy as CLI command"
                            @click=${(ev: Event) => { ev.stopPropagation(); this._copyTuple(t); }}
                          >
                            &#x2398;
                          </button>
                          <button
                            class="btn-delete"
                            aria-label="Delete tuple: ${t.user} ${t.relation} ${t.object}"
                            @click=${() => this._remove(t)}
                          >
                            ×
                          </button>
                        </td>
                      </tr>
                    `,
                  )}
                </tbody>
              </table>
            `}
      </div>

      <!-- type-hint datalists for user and object inputs -->
      ${typeHints.length > 0
        ? html`
            <datalist id=${userListId}>
              ${typeHints.map((h) => html`<option value=${h}></option>`)}
            </datalist>
            <datalist id=${objectListId}>
              ${typeHints.map((h) => html`<option value=${h}></option>`)}
            </datalist>
          `
        : nothing}

      <form
        class="add-form"
        @submit=${this._submit}
        aria-label="Add tuple"
        novalidate
      >
        <div class="add-form-row">
          <label class="label-type">
            User
            <input
              type="text"
              placeholder="user:anne"
              .value=${user}
              list=${typeHints.length > 0 ? userListId : nothing}
              class=${hasError && !user.trim() ? 'error' : ''}
              aria-required="true"
              aria-label="User"
              @input=${(e: Event) =>
                this._setField('user', (e.target as HTMLInputElement).value)}
            />
          </label>

          <label class="label-rel">
            Relation
            ${relations.length > 0
              ? html`
                  <select
                    .value=${relation}
                    class=${`${hasError && !relation.trim() ? 'error' : ''} ${relation ? 'has-value' : ''}`}
                    aria-required="true"
                    aria-label="Relation"
                    @change=${(e: Event) =>
                      this._setField('relation', (e.target as HTMLSelectElement).value)}
                  >
                    <option value="" disabled ?selected=${!relation}>— select —</option>
                    ${relations.map(
                      (r) => html`<option value=${r} ?selected=${relation === r}>${r}</option>`,
                    )}
                  </select>
                `
              : html`
                  <input
                    type="text"
                    placeholder="owner"
                    .value=${relation}
                    class=${hasError && !relation.trim() ? 'error' : ''}
                    aria-required="true"
                    aria-label="Relation"
                    @input=${(e: Event) =>
                      this._setField('relation', (e.target as HTMLInputElement).value)}
                  />
                `}
          </label>

          <label class="label-type">
            Object
            <input
              type="text"
              placeholder="document:budget"
              .value=${object}
              list=${typeHints.length > 0 ? objectListId : nothing}
              class=${hasError && !object.trim() ? 'error' : ''}
              aria-required="true"
              aria-label="Object"
              @input=${(e: Event) =>
                this._setField('object', (e.target as HTMLInputElement).value)}
            />
          </label>

          <button
            type="submit"
            class="btn-add"
            aria-label="Add tuple"
          >
            Add
          </button>
        </div>

        ${this._formError
          ? html`<div class="form-error" role="alert">${this._formError}</div>`
          : nothing}
      </form>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'openfga-tuple-manager': TupleManager;
  }
}
