// SPDX-License-Identifier: Apache-2.0
import { LitElement, html, css, nothing, TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';

export interface ChangelogEntry {
  tuple_key: { user: string; relation: string; object: string };
  operation: string;
  timestamp: string;
}

export interface ChangelogLoadDetail {
  type: string;
  startTime: string;
}

// ---------------------------------------------------------------------------
// Coloring helper (same as tuple-manager)
// ---------------------------------------------------------------------------

function renderSeg(str: string): TemplateResult {
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

function formatTimestamp(ts: string): string {
  try {
    const d = new Date(ts);
    return d.toLocaleString(undefined, {
      month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
  } catch {
    return ts;
  }
}

/**
 * `<openfga-changelog>`
 *
 * Displays the store changelog (ReadChanges API) as a paginated table.
 * Supports filtering by type and start time.
 *
 * @prop {ChangelogEntry[]} entries   - Changelog entries to display.
 * @prop {boolean}          hasMore   - Whether more entries can be loaded.
 * @prop {boolean}          loading   - Whether a load is in progress.
 *
 * @fires {CustomEvent<ChangelogLoadDetail>} changelog-load      - Load (or reload) with given filters.
 * @fires {CustomEvent}                      changelog-load-more - Load next page.
 */
@customElement('openfga-changelog')
export class Changelog extends LitElement {
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
      padding: 6px 12px;
      background: var(--openfga-bg-secondary, #181825);
      border-bottom: 1px solid var(--openfga-border, #313244);
      flex-shrink: 0;
      flex-wrap: wrap;
    }
    .filter-bar h2 {
      margin: 0;
      font-size: 12px;
      font-weight: 600;
      color: var(--openfga-text-secondary, #a6adc8);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      flex-shrink: 0;
      margin-right: 4px;
    }
    .filter-input {
      background: var(--openfga-bg-primary, #1e1e2e);
      color: var(--openfga-text-primary, #cdd6f4);
      border: 1px solid var(--openfga-border, #313244);
      border-radius: var(--openfga-radius-sm, 4px);
      padding: 4px 8px;
      font-size: 11px;
      font-family: var(--openfga-font-mono, monospace);
      outline: none;
    }
    .filter-input:focus { border-color: var(--openfga-accent, #cba6f7); }
    .filter-label {
      font-size: 10px;
      color: var(--openfga-text-secondary, #a6adc8);
      white-space: nowrap;
    }
    .btn-load {
      cursor: pointer;
      background: var(--openfga-accent, #cba6f7);
      color: var(--openfga-bg-primary, #1e1e2e);
      border: none;
      border-radius: var(--openfga-radius-sm, 4px);
      font-size: 11px;
      font-family: inherit;
      font-weight: 600;
      padding: 4px 10px;
      white-space: nowrap;
    }
    .btn-load:hover:not(:disabled) { opacity: 0.85; }
    .btn-load:disabled { opacity: 0.4; cursor: not-allowed; }
    .count-badge {
      background: var(--openfga-bg-secondary, #181825);
      color: var(--openfga-text-secondary, #a6adc8);
      border-radius: 10px;
      padding: 1px 7px;
      font-size: 10px;
      flex-shrink: 0;
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
    tbody tr:hover { background: var(--openfga-bg-hover, #24273a); }
    tbody td {
      padding: 5px 10px;
      font-family: var(--openfga-font-mono, monospace);
      font-size: 11px;
      color: var(--openfga-text-primary, #cdd6f4);
      word-break: break-all;
    }
    tbody td.col-op {
      font-size: 10px;
      font-weight: 700;
      white-space: nowrap;
    }
    td.col-op.write { color: var(--openfga-success, #a6e3a1); }
    td.col-op.delete { color: var(--openfga-error, #f38ba8); }
    tbody td.col-ts {
      font-size: 10px;
      color: var(--openfga-text-secondary, #a6adc8);
      white-space: nowrap;
    }
    tbody td.col-rel {
      color: var(--openfga-graph-node-relation, #20f1f5);
    }
    .seg-type { color: var(--openfga-graph-node-type, #79ed83); }
    .seg-id   { color: var(--openfga-text-primary, #cdd6f4); }
    .seg-rel  { color: var(--openfga-graph-node-relation, #20f1f5); }

    /* ---- empty / loading states ---- */
    .empty-state, .loading-state {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 40px;
      color: var(--openfga-text-secondary, #a6adc8);
      opacity: 0.6;
    }

    /* ---- load more footer ---- */
    .footer {
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 8px;
      border-top: 1px solid var(--openfga-border, #313244);
    }
    .btn-load-more {
      cursor: pointer;
      background: transparent;
      color: var(--openfga-accent, #cba6f7);
      border: 1px solid var(--openfga-accent, #cba6f7);
      border-radius: var(--openfga-radius-sm, 4px);
      font-size: 11px;
      font-family: inherit;
      padding: 4px 14px;
    }
    .btn-load-more:hover:not(:disabled) { opacity: 0.8; }
    .btn-load-more:disabled { opacity: 0.4; cursor: not-allowed; }
  `;

  @property({ type: Array }) entries: ChangelogEntry[] = [];
  @property({ type: Boolean }) hasMore = false;
  @property({ type: Boolean }) loading = false;

  @state() private _typeFilter = '';
  @state() private _startTime = '';

  private _load() {
    this.dispatchEvent(
      new CustomEvent<ChangelogLoadDetail>('changelog-load', {
        detail: { type: this._typeFilter.trim(), startTime: this._startTime.trim() },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _loadMore() {
    this.dispatchEvent(new CustomEvent('changelog-load-more', { bubbles: true, composed: true }));
  }

  private _opClass(op: string): string {
    if (op.includes('WRITE') || op === 'write') return 'write';
    if (op.includes('DELETE') || op === 'delete') return 'delete';
    return '';
  }

  private _opLabel(op: string): string {
    if (op.includes('WRITE') || op === 'write') return '+write';
    if (op.includes('DELETE') || op === 'delete') return '−delete';
    return op;
  }

  override render() {
    return html`
      <div class="filter-bar">
        <h2>Changelog</h2>
        <span class="count-badge">${this.entries.length}${this.hasMore ? '+' : ''}</span>

        <span class="filter-label">Type:</span>
        <input
          class="filter-input"
          type="text"
          placeholder="document"
          aria-label="Filter by type"
          .value=${this._typeFilter}
          @input=${(e: Event) => { this._typeFilter = (e.target as HTMLInputElement).value; }}
          @keydown=${(e: KeyboardEvent) => { if (e.key === 'Enter') this._load(); }}
          style="width: 100px"
        />

        <span class="filter-label">Since:</span>
        <input
          class="filter-input"
          type="datetime-local"
          aria-label="Start time filter"
          .value=${this._startTime}
          @input=${(e: Event) => { this._startTime = (e.target as HTMLInputElement).value; }}
          style="width: 170px"
        />

        <button
          class="btn-load"
          ?disabled=${this.loading}
          aria-label="Load changelog"
          @click=${this._load}
        >
          ${this.loading ? 'Loading…' : 'Load'}
        </button>
      </div>

      <div class="table-wrapper">
        ${this.loading && this.entries.length === 0
          ? html`<div class="loading-state">Loading…</div>`
          : this.entries.length === 0
          ? html`<div class="empty-state">No changes — click Load to fetch the changelog</div>`
          : html`
              <table>
                <thead>
                  <tr>
                    <th scope="col">Op</th>
                    <th scope="col">User</th>
                    <th scope="col">Relation</th>
                    <th scope="col">Object</th>
                    <th scope="col">Time</th>
                  </tr>
                </thead>
                <tbody>
                  ${repeat(
                    this.entries,
                    (e, i) => `${i}-${e.timestamp}-${e.tuple_key.user}`,
                    (e) => html`
                      <tr>
                        <td class="col-op ${this._opClass(e.operation)}">${this._opLabel(e.operation)}</td>
                        <td>${renderSeg(e.tuple_key.user)}</td>
                        <td class="col-rel">${e.tuple_key.relation}</td>
                        <td>${renderSeg(e.tuple_key.object)}</td>
                        <td class="col-ts">${formatTimestamp(e.timestamp)}</td>
                      </tr>
                    `,
                  )}
                </tbody>
              </table>
            `}
      </div>

      ${this.hasMore
        ? html`
            <div class="footer">
              <button
                class="btn-load-more"
                ?disabled=${this.loading}
                aria-label="Load more changelog entries"
                @click=${this._loadMore}
              >
                ${this.loading ? 'Loading…' : 'Load more'}
              </button>
            </div>
          `
        : nothing}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'openfga-changelog': Changelog;
  }
}
