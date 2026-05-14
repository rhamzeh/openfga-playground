// SPDX-License-Identifier: Apache-2.0
import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

/** Mirrors ApiLogEntry from core. */
export interface DevConsoleEntry {
  id: number;
  timestamp: number;
  method: string;
  path: string;
  query: string;
  requestBody: unknown;
  statusCode: number;
  responseBody: unknown;
  durationMs: number;
  requestHeaders: Record<string, string>;
  responseHeaders: Record<string, string>;
}

/**
 * `<openfga-dev-console>`
 *
 * Displays a chronological log of OpenFGA API requests/responses with
 * method, path, status, timing, and expandable body/header details.
 *
 * @prop {DevConsoleEntry[]} entries - API log entries to display.
 */
@customElement('openfga-dev-console')
export class DevConsole extends LitElement {
  static override styles = css`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      background: var(--openfga-bg-primary, #1e1e2e);
      color: var(--openfga-text-primary, #cdd6f4);
      font-family: var(--openfga-font-mono, monospace);
      font-size: 11px;
      overflow: hidden;
    }

    .toolbar {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 4px 8px;
      background: var(--openfga-bg-secondary, #181825);
      border-bottom: 1px solid var(--openfga-border, #45475a);
      flex-shrink: 0;
      font-family: var(--openfga-font-family, sans-serif);
      font-size: 11px;
    }
    .toolbar-label {
      color: var(--openfga-text-secondary, #a6adc8);
    }
    .toolbar-count {
      color: var(--openfga-text-primary, #cdd6f4);
      font-weight: 600;
    }
    .toolbar-spacer { flex: 1; }
    .btn-clear {
      cursor: pointer;
      background: transparent;
      color: var(--openfga-text-secondary, #a6adc8);
      border: 1px solid var(--openfga-border, #313244);
      border-radius: 3px;
      font-size: 10px;
      font-family: inherit;
      padding: 2px 8px;
    }
    .btn-clear:hover { color: var(--openfga-text-primary, #cdd6f4); }

    .log-scroll {
      flex: 1;
      overflow-y: auto;
      min-height: 0;
    }

    .empty-state {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100%;
      color: var(--openfga-text-secondary, #a6adc8);
      opacity: 0.5;
      font-family: var(--openfga-font-family, sans-serif);
      font-size: 12px;
    }

    /* ---- log entry rows ---- */
    .entry {
      border-bottom: 1px solid var(--openfga-border, #313244);
      cursor: pointer;
      transition: background 0.08s;
    }
    .entry:hover { background: var(--openfga-bg-elevated, #313244); }

    .entry-row {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 5px 8px;
      line-height: 1.4;
    }

    .method {
      font-weight: 700;
      min-width: 42px;
      text-align: center;
    }
    .method-get { color: var(--openfga-success, #a6e3a1); }
    .method-post { color: #89b4fa; }
    .method-put { color: var(--openfga-warning, #fab387); }
    .method-delete { color: var(--openfga-error, #f38ba8); }

    .path {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      color: var(--openfga-text-primary, #cdd6f4);
    }
    .query {
      color: var(--openfga-text-secondary, #a6adc8);
    }

    .status {
      min-width: 28px;
      text-align: right;
      font-weight: 600;
    }
    .status-2xx { color: var(--openfga-success, #a6e3a1); }
    .status-4xx { color: var(--openfga-warning, #fab387); }
    .status-5xx { color: var(--openfga-error, #f38ba8); }
    .status-0 { color: var(--openfga-error, #f38ba8); }

    .duration {
      min-width: 48px;
      text-align: right;
      color: var(--openfga-text-secondary, #a6adc8);
    }

    .time {
      min-width: 60px;
      text-align: right;
      color: var(--openfga-text-secondary, #a6adc8);
      font-size: 10px;
    }

    /* ---- expanded detail ---- */
    .detail {
      padding: 6px 8px 8px 58px;
      background: var(--openfga-bg-secondary, #181825);
      border-top: 1px solid var(--openfga-border, #313244);
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .detail-section {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .detail-label {
      color: var(--openfga-text-secondary, #a6adc8);
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .detail-body {
      background: var(--openfga-bg-primary, #1e1e2e);
      border: 1px solid var(--openfga-border, #313244);
      border-radius: 3px;
      padding: 4px 6px;
      max-height: 200px;
      overflow: auto;
      white-space: pre-wrap;
      word-break: break-all;
      color: var(--openfga-text-primary, #cdd6f4);
      font-size: 11px;
      line-height: 1.4;
    }
    .detail-headers {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 1px 8px;
    }
    .header-name {
      color: var(--openfga-text-secondary, #a6adc8);
    }
  `;

  @property({ type: Array }) entries: DevConsoleEntry[] = [];

  @state() private _expandedId: number | null = null;

  override render() {
    return html`
      <div class="toolbar">
        <span class="toolbar-label">API Log</span>
        <span class="toolbar-count">${this.entries.length}</span>
        <span class="toolbar-spacer"></span>
        <button class="btn-clear" @click=${this._fireClear}>Clear</button>
      </div>

      <div class="log-scroll">
        ${this.entries.length === 0
          ? html`<div class="empty-state">No API requests yet</div>`
          : this.entries.map((e) => this._renderEntry(e))}
      </div>
    `;
  }

  override updated() {
    // Auto-scroll to bottom when new entries arrive.
    const scroll = this.shadowRoot?.querySelector('.log-scroll');
    if (scroll) {
      scroll.scrollTop = scroll.scrollHeight;
    }
  }

  private _renderEntry(e: DevConsoleEntry) {
    const expanded = this._expandedId === e.id;
    const methodClass = `method method-${e.method.toLowerCase()}`;
    const statusClass = `status ${e.statusCode === 0 ? 'status-0' : e.statusCode < 300 ? 'status-2xx' : e.statusCode < 500 ? 'status-4xx' : 'status-5xx'}`;

    return html`
      <div class="entry" @click=${() => { this._expandedId = expanded ? null : e.id; }}>
        <div class="entry-row">
          <span class=${methodClass}>${e.method}</span>
          <span class="path">${e.path}${e.query ? html`<span class="query">?${e.query}</span>` : nothing}</span>
          <span class=${statusClass}>${e.statusCode || 'ERR'}</span>
          <span class="duration">${e.durationMs}ms</span>
          <span class="time">${this._formatTime(e.timestamp)}</span>
        </div>
        ${expanded ? this._renderDetail(e) : nothing}
      </div>
    `;
  }

  private _renderDetail(e: DevConsoleEntry) {
    const hasReqHeaders = Object.keys(e.requestHeaders).length > 0;
    const hasResHeaders = Object.keys(e.responseHeaders).length > 0;

    return html`
      <div class="detail" @click=${(ev: Event) => ev.stopPropagation()}>
        ${hasReqHeaders ? html`
          <div class="detail-section">
            <span class="detail-label">Request Headers</span>
            <div class="detail-body">
              <div class="detail-headers">
                ${Object.entries(e.requestHeaders).map(([k, v]) => html`
                  <span class="header-name">${k}:</span><span>${v}</span>
                `)}
              </div>
            </div>
          </div>
        ` : nothing}
        ${e.requestBody != null ? html`
          <div class="detail-section">
            <span class="detail-label">Request Body</span>
            <div class="detail-body">${this._formatBody(e.requestBody)}</div>
          </div>
        ` : nothing}
        ${hasResHeaders ? html`
          <div class="detail-section">
            <span class="detail-label">Response Headers</span>
            <div class="detail-body">
              <div class="detail-headers">
                ${Object.entries(e.responseHeaders).map(([k, v]) => html`
                  <span class="header-name">${k}:</span><span>${v}</span>
                `)}
              </div>
            </div>
          </div>
        ` : nothing}
        ${e.responseBody != null ? html`
          <div class="detail-section">
            <span class="detail-label">Response ${e.statusCode}</span>
            <div class="detail-body">${this._formatBody(e.responseBody)}</div>
          </div>
        ` : nothing}
      </div>
    `;
  }

  private _formatBody(body: unknown): string {
    if (typeof body === 'string') {
      try { return JSON.stringify(JSON.parse(body), null, 2); } catch { return body; }
    }
    if (body == null) return '';
    return JSON.stringify(body, null, 2);
  }

  private _formatTime(ts: number): string {
    const d = new Date(ts);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}.${d.getMilliseconds().toString().padStart(3, '0')}`;
  }

  private _fireClear() {
    this.dispatchEvent(new CustomEvent('clear-log', { bubbles: true, composed: true }));
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'openfga-dev-console': DevConsole;
  }
}
