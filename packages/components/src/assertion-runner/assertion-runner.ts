// SPDX-License-Identifier: Apache-2.0
import { LitElement, html, css, nothing, TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import type {
  AssertionData,
  AssertionResult,
  AssertionAddDetail,
  AssertionRemoveDetail,
  AssertionRunDetail,
  AssertionExpandDetail,
} from '../shared/types.js';

// Must match assertionKey() in @openfga/playground-core so that the results
// map passed in as a prop lines up with the correct assertions.
function assertionKey(a: AssertionData): string {
  return `${a.user}#${a.relation}@${a.object}`;
}

// ---------------------------------------------------------------------------
// Model analysis (same logic as tuple-manager for consistency)
// ---------------------------------------------------------------------------

interface TypeDef {
  type: string;
  relations?: Record<string, unknown>;
}

function parseTypeFromString(str: string): string | null {
  const s = str.trim();
  const i = s.indexOf(':');
  return i > 0 ? s.substring(0, i) : null;
}


/**
 * For assertions (Check queries), show ALL relations for the object type —
 * including computed relations (permissions). Unlike tuples which can only
 * write to directly-assignable relations, Check can test any relation.
 */
function relationsForObjectType(model: object | null, object: string): string[] {
  if (!model) return [];
  const m = model as { type_definitions?: TypeDef[] };
  const typeDefs = m.type_definitions ?? [];
  const objectType = parseTypeFromString(object);
  const seen = new Set<string>();
  for (const td of typeDefs) {
    if (objectType && td.type !== objectType) continue;
    for (const relName of Object.keys(td.relations ?? {})) seen.add(relName);
  }
  return [...seen].sort();
}

function typeHintsFromModel(model: object | null): string[] {
  if (!model) return [];
  const m = model as { type_definitions?: Array<{ type: string }> };
  return (m.type_definitions ?? []).map((td) => `${td.type}:`).sort();
}

// ---------------------------------------------------------------------------
// Coloring helper
// ---------------------------------------------------------------------------

function renderTupleSegment(str: string): TemplateResult {
  const hashIdx = str.indexOf('#');
  const relation = hashIdx >= 0 ? str.substring(hashIdx + 1) : undefined;
  const obj = hashIdx >= 0 ? str.substring(0, hashIdx) : str;
  const colonIdx = obj.indexOf(':');
  if (colonIdx <= 0) return html`${str}`;
  const typePart = obj.substring(0, colonIdx);
  const idPart = obj.substring(colonIdx);
  return html`<span class="seg-type">${typePart}</span><span class="seg-id">${idPart}</span>${relation !== undefined
    ? html`<span class="seg-rel">#${relation}</span>`
    : nothing}`;
}

const EMPTY_FORM = { user: '', relation: '', object: '', expectation: true };

/**
 * `<openfga-assertion-runner>`
 *
 * Define Check assertions and run them individually or all at once.
 * Results show pass/fail/error with icon + color + text (never color alone).
 *
 * @prop {AssertionData[]}                assertions - Defined assertions.
 * @prop {Record<string, AssertionResult>} results   - Results keyed by assertionKey.
 * @prop {object | null}                  model      - Parsed model JSON for autocomplete.
 *
 * @fires {CustomEvent<AssertionAddDetail>}    assertion-add
 * @fires {CustomEvent<AssertionRemoveDetail>} assertion-remove
 * @fires {CustomEvent<AssertionRunDetail>}    assertion-run
 * @fires {CustomEvent}                           assertion-run-all
 * @fires {CustomEvent<AssertionExpandDetail>}    assertion-expand
 */
@customElement('openfga-assertion-runner')
export class AssertionRunner extends LitElement {
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

    /* ---- header ---- */
    .header {
      display: flex;
      align-items: center;
      gap: 8px;
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
      flex: 1;
    }
    .count-badge {
      background: var(--openfga-bg-secondary, #181825);
      color: var(--openfga-text-secondary, #a6adc8);
      border-radius: 10px;
      padding: 1px 7px;
      font-size: 10px;
    }

    /* ---- list ---- */
    .list-wrapper {
      flex: 1;
      overflow-y: auto;
      min-height: 0;
    }
    .empty-state {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 32px;
      color: var(--openfga-text-secondary, #a6adc8);
      opacity: 0.6;
    }
    .assertion-row {
      display: grid;
      grid-template-columns: 1fr auto auto;
      align-items: center;
      gap: 6px;
      padding: 7px 10px;
      border-bottom: 1px solid var(--openfga-border, #313244);
    }
    .assertion-row:hover {
      background: var(--openfga-bg-hover, #24273a);
    }
    .assertion-info {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }
    .assertion-tuple {
      font-family: var(--openfga-font-mono, monospace);
      font-size: 11px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .seg-type { color: var(--openfga-graph-node-type, #79ed83); }
    .seg-id   { color: var(--openfga-text-primary, #cdd6f4); }
    .seg-rel  { color: var(--openfga-graph-node-relation, #20f1f5); }
    .seg-relation-standalone { color: var(--openfga-graph-node-relation, #20f1f5); font-weight: 600; }
    .assertion-expectation {
      font-size: 10px;
      color: var(--openfga-text-secondary, #a6adc8);
    }
    .expectation-true {
      color: var(--openfga-success, #a6e3a1);
    }
    .expectation-false {
      color: var(--openfga-error, #f38ba8);
    }

    /* ---- result badge ---- */
    .result-badge {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 10px;
      white-space: nowrap;
      padding: 2px 7px;
      border-radius: 10px;
      font-weight: 600;
    }
    .result-pass {
      background: color-mix(in srgb, var(--openfga-success, #a6e3a1) 15%, transparent);
      color: var(--openfga-success, #a6e3a1);
    }
    .result-fail {
      background: color-mix(in srgb, var(--openfga-error, #f38ba8) 15%, transparent);
      color: var(--openfga-error, #f38ba8);
    }
    .result-error {
      background: color-mix(in srgb, var(--openfga-warning, #fab387) 15%, transparent);
      color: var(--openfga-warning, #fab387);
    }
    .result-pending {
      background: var(--openfga-bg-secondary, #181825);
      color: var(--openfga-text-secondary, #a6adc8);
    }

    /* ---- row actions ---- */
    .row-actions {
      display: flex;
      gap: 4px;
      align-items: center;
    }

    /* ---- buttons ---- */
    button {
      cursor: pointer;
      border: none;
      border-radius: var(--openfga-radius-sm, 4px);
      font-size: 11px;
      font-family: inherit;
      transition: opacity 0.1s;
    }
    button:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
    .btn-run-one {
      background: color-mix(in srgb, var(--openfga-accent, #cba6f7) 20%, transparent);
      color: var(--openfga-accent, #cba6f7);
      padding: 3px 8px;
    }
    .btn-run-one:hover:not(:disabled) { opacity: 0.8; }
    .btn-delete {
      background: transparent;
      color: var(--openfga-error, #f38ba8);
      padding: 3px 6px;
      font-size: 13px;
      line-height: 1;
    }
    .btn-delete:hover:not(:disabled) { background: var(--openfga-bg-hover, #24273a); }
    .btn-expand {
      background: transparent;
      color: var(--openfga-text-secondary, #a6adc8);
      padding: 3px 5px;
      font-size: 13px;
      line-height: 1;
    }
    .btn-expand:hover:not(:disabled) { color: var(--openfga-accent, #cba6f7); }
    .btn-run-all {
      background: var(--openfga-accent, #cba6f7);
      color: var(--openfga-bg-primary, #1e1e2e);
      font-weight: 600;
      padding: 4px 12px;
    }
    .btn-run-all:hover:not(:disabled) { opacity: 0.85; }

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
      grid-template-columns: 1fr 1fr 1fr auto auto;
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
    input:focus, select:focus { border-color: var(--openfga-accent, #cba6f7); }
    input.error, select.error { border-color: var(--openfga-error, #f38ba8); }
    select.has-value { color: var(--openfga-graph-node-relation, #20f1f5); }

    .toggle-expectation {
      display: flex;
      gap: 0;
      border: 1px solid var(--openfga-border, #313244);
      border-radius: var(--openfga-radius-sm, 4px);
      overflow: hidden;
      width: 100%;
    }
    .toggle-expectation button {
      flex: 1;
      padding: 5px 6px;
      font-size: 10px;
      font-weight: 600;
      border-radius: 0;
      background: transparent;
      color: var(--openfga-text-secondary, #a6adc8);
    }
    .toggle-expectation button.active-true {
      background: color-mix(in srgb, var(--openfga-success, #a6e3a1) 20%, transparent);
      color: var(--openfga-success, #a6e3a1);
    }
    .toggle-expectation button.active-false {
      background: color-mix(in srgb, var(--openfga-error, #f38ba8) 20%, transparent);
      color: var(--openfga-error, #f38ba8);
    }

    .btn-add {
      background: var(--openfga-accent, #cba6f7);
      color: var(--openfga-bg-primary, #1e1e2e);
      font-weight: 600;
      padding: 5px 10px;
      white-space: nowrap;
      align-self: flex-end;
    }
    .btn-add:hover:not(:disabled) { opacity: 0.85; }

    .form-error {
      color: var(--openfga-error, #f38ba8);
      font-size: 10px;
    }

    .sr-live {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip: rect(0 0 0 0);
      white-space: nowrap;
    }
  `;

  @property({ type: Array }) assertions: AssertionData[] = [];
  @property({ type: Object }) results: Record<string, AssertionResult> = {};
  @property({ type: Object }) model: object | null = null;

  @state() private _form = { ...EMPTY_FORM };
  @state() private _formError = '';
  @state() private _liveMsg = '';

  private _filteredRelations() { return relationsForObjectType(this.model, this._form.object); }
  private get _typeHints() { return typeHintsFromModel(this.model); }

  private _validate(): string {
    const { user, relation, object } = this._form;
    if (!user.trim()) return 'User is required';
    if (!relation.trim()) return 'Relation is required';
    if (!object.trim()) return 'Object is required';
    return '';
  }

  private _submitAdd(e: Event) {
    e.preventDefault();
    const err = this._validate();
    if (err) { this._formError = err; return; }
    const { user, relation, object, expectation } = this._form;
    this.dispatchEvent(
      new CustomEvent<AssertionAddDetail>('assertion-add', {
        detail: { user: user.trim(), relation: relation.trim(), object: object.trim(), expectation },
        bubbles: true,
        composed: true,
      }),
    );
    this._liveMsg = `Assertion added: ${user.trim()} ${relation.trim()} ${object.trim()} (expect ${expectation})`;
    this._form = { ...EMPTY_FORM };
    this._formError = '';
  }

  private _remove(a: AssertionData) {
    this.dispatchEvent(
      new CustomEvent<AssertionRemoveDetail>('assertion-remove', {
        detail: { user: a.user, relation: a.relation, object: a.object },
        bubbles: true,
        composed: true,
      }),
    );
    this._liveMsg = `Assertion removed: ${a.user} ${a.relation} ${a.object}`;
  }

  private _runOne(a: AssertionData) {
    this.dispatchEvent(
      new CustomEvent<AssertionRunDetail>('assertion-run', {
        detail: { assertion: a },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _runAll() {
    this.dispatchEvent(new CustomEvent('assertion-run-all', { bubbles: true, composed: true }));
  }

  private _expand(a: AssertionData) {
    this.dispatchEvent(
      new CustomEvent<AssertionExpandDetail>('assertion-expand', {
        detail: { assertion: a },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _setField(field: keyof typeof EMPTY_FORM, value: string | boolean) {
    const updated = { ...this._form, [field]: value };
    // When object type changes, reset relation if it's no longer in the list.
    // User changes don't affect which relations are available for assertions
    // (Check can test any relation, not just directly-assignable ones).
    if (field === 'object' && typeof value === 'string') {
      const newRels = relationsForObjectType(this.model, updated.object as string);
      if (newRels.length > 0 && this._form.relation && !newRels.includes(this._form.relation)) {
        updated.relation = '';
      }
    }
    this._form = updated;
    if (this._formError) this._formError = '';
  }

  private _renderResult(key: string) {
    const result = this.results[key];
    if (!result || result.status === 'pending') {
      return html`<span class="result-badge result-pending" aria-label="Pending">— pending</span>`;
    }
    if (result.status === 'pass') {
      return html`<span class="result-badge result-pass" role="img" aria-label="Pass">✓ pass</span>`;
    }
    if (result.status === 'fail') {
      return html`<span class="result-badge result-fail" role="img" aria-label="Fail">✗ fail</span>`;
    }
    // error
    return html`
      <span
        class="result-badge result-error"
        role="img"
        aria-label="Error: ${result.error ?? 'unknown'}"
        title=${result.error ?? 'unknown error'}
      >⚠ error</span>
    `;
  }

  override render() {
    const { user, relation, object, expectation } = this._form;
    const relations = this._filteredRelations();
    const typeHints = this._typeHints;
    const hasError = !!this._formError;
    const userListId = 'ar-user-hints';
    const objectListId = 'ar-object-hints';
    const hasAssertions = this.assertions.length > 0;

    return html`
      <span class="sr-live" aria-live="polite" aria-atomic="true">${this._liveMsg}</span>

      <div class="header">
        <h2>Assertions</h2>
        <span class="count-badge" aria-label="${this.assertions.length} assertions">
          ${this.assertions.length}
        </span>
        <button
          class="btn-run-all"
          ?disabled=${!hasAssertions}
          aria-label="Run all assertions"
          @click=${this._runAll}
        >
          Run all
        </button>
      </div>

      <div
        class="list-wrapper"
        role="list"
        aria-label="Assertions"
        aria-live="polite"
        aria-relevant="additions removals"
      >
        ${!hasAssertions
          ? html`<div class="empty-state">No assertions yet — add one below</div>`
          : repeat(
              this.assertions,
              (a) => assertionKey(a),
              (a) => {
                const key = assertionKey(a);
                return html`
                  <div class="assertion-row" role="listitem">
                    <div class="assertion-info">
                      <div class="assertion-tuple">
                        ${renderTupleSegment(a.user)}
                        <span class="seg-relation-standalone"> ${a.relation} </span>
                        ${renderTupleSegment(a.object)}
                      </div>
                      <div class="assertion-expectation">
                        expect:
                        <span class=${a.expectation ? 'expectation-true' : 'expectation-false'}>
                          ${a.expectation ? 'allowed' : 'not allowed'}
                        </span>
                      </div>
                    </div>
                    ${this._renderResult(key)}
                    <div class="row-actions">
                      <button
                        class="btn-run-one"
                        aria-label="Run assertion: ${a.user} ${a.relation} ${a.object}"
                        @click=${() => this._runOne(a)}
                      >
                        Run
                      </button>
                      ${(() => {
                        const r = this.results[key];
                        return r && (r.status === 'pass' || r.status === 'fail')
                          ? html`
                              <button
                                class="btn-expand"
                                aria-label="Show resolution path for: ${a.user} ${a.relation} ${a.object}"
                                title="Show resolution path"
                                @click=${() => this._expand(a)}
                              >⚡</button>
                            `
                          : nothing;
                      })()}
                      <button
                        class="btn-delete"
                        aria-label="Delete assertion: ${a.user} ${a.relation} ${a.object}"
                        @click=${() => this._remove(a)}
                      >
                        ×
                      </button>
                    </div>
                  </div>
                `;
              },
            )}
      </div>

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
        @submit=${this._submitAdd}
        aria-label="Add assertion"
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
                    @change=${(e: Event) =>
                      this._setField('relation', (e.target as HTMLSelectElement).value)}
                  >
                    <option value="" disabled ?selected=${!relation}>— select —</option>
                    ${relations.map(
                      (r) =>
                        html`<option value=${r} ?selected=${relation === r}>${r}</option>`,
                    )}
                  </select>
                `
              : html`
                  <input
                    type="text"
                    placeholder="viewer"
                    .value=${relation}
                    class=${hasError && !relation.trim() ? 'error' : ''}
                    aria-required="true"
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
              @input=${(e: Event) =>
                this._setField('object', (e.target as HTMLInputElement).value)}
            />
          </label>

          <label>
            Expect
            <div
              class="toggle-expectation"
              role="group"
              aria-label="Expected result"
            >
              <button
                type="button"
                class=${expectation ? 'active-true' : ''}
                aria-pressed=${expectation}
                aria-label="Expect allowed"
                @click=${() => this._setField('expectation', true)}
              >
                Allow
              </button>
              <button
                type="button"
                class=${!expectation ? 'active-false' : ''}
                aria-pressed=${!expectation}
                aria-label="Expect not allowed"
                @click=${() => this._setField('expectation', false)}
              >
                Deny
              </button>
            </div>
          </label>

          <button
            type="submit"
            class="btn-add"
            aria-label="Add assertion"
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
    'openfga-assertion-runner': AssertionRunner;
  }
}
