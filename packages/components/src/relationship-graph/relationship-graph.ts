// SPDX-License-Identifier: Apache-2.0
import { LitElement, html, css } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';
import cytoscape from 'cytoscape';
import dagre from 'cytoscape-dagre';
import { tuplesToElements, uniqueTypes, uniqueRelations } from './tuple-graph-layout.js';

cytoscape.use(dagre);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const LAYOUT: any = { name: 'dagre', rankDir: 'LR', nodeSep: 50, rankSep: 100, padding: 30 };

// Deterministic palette — up to 10 distinct type colors.
const TYPE_COLORS = [
  '#89b4fa', '#a6e3a1', '#f9e2af', '#f38ba8', '#cba6f7',
  '#fab387', '#94e2d5', '#74c7ec', '#f2cdcd', '#b4befe',
];

interface TupleKey { user: string; relation: string; object: string }

export interface RelNodeClickDetail { id: string; type: string }
export interface RelEdgeClickDetail { user: string; relation: string; object: string }

/**
 * `<openfga-relationship-graph>`
 *
 * Visualizes actual tuples as a directed graph — nodes are concrete objects
 * (e.g. `user:anne`, `document:budget`), edges are labeled relationships.
 *
 * @prop {TupleKey[]} tuples - Relationship tuples to render.
 * @fires {CustomEvent<RelNodeClickDetail>} node-click
 * @fires {CustomEvent<RelEdgeClickDetail>} edge-click
 */
@customElement('openfga-relationship-graph')
export class RelationshipGraph extends LitElement {
  static override styles = css`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      background: var(--openfga-graph-bg, #181825);
      font-family: var(--openfga-font-family, sans-serif);
      overflow: hidden;
    }

    .filter-bar {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 4px 8px;
      background: var(--openfga-bg-secondary, #181825);
      border-bottom: 1px solid var(--openfga-border, #313244);
      flex-shrink: 0;
      font-size: 11px;
    }
    .filter-bar label {
      color: var(--openfga-text-secondary, #a6adc8);
      white-space: nowrap;
    }
    .filter-bar input, .filter-bar select {
      font-size: 11px;
      font-family: var(--openfga-font-mono, monospace);
      background: var(--openfga-bg-primary, #1e1e2e);
      color: var(--openfga-text-primary, #cdd6f4);
      border: 1px solid var(--openfga-border, #313244);
      border-radius: 3px;
      padding: 2px 6px;
      outline: none;
    }
    .filter-bar input { width: 100px; }
    .filter-bar input:focus, .filter-bar select:focus {
      border-color: var(--openfga-accent, #89b4fa);
    }
    .filter-spacer { flex: 1; }
    .count {
      color: var(--openfga-text-secondary, #a6adc8);
      font-size: 10px;
    }

    #graph {
      flex: 1;
      min-height: 0;
      outline: none;
    }

    .empty-state {
      display: flex;
      align-items: center;
      justify-content: center;
      flex: 1;
      color: var(--openfga-text-secondary, #a6adc8);
      opacity: 0.5;
      font-size: 12px;
    }
  `;

  @property({ type: Array }) tuples: TupleKey[] = [];

  @query('#graph') private _graphEl!: HTMLDivElement;

  @state() private _filterUser = '';
  @state() private _filterRelation = '';
  @state() private _filterObject = '';
  @state() private _filterType = '';

  private _cy: cytoscape.Core | null = null;
  private _typeColorMap = new Map<string, string>();

  override disconnectedCallback() {
    super.disconnectedCallback();
    this._cy?.destroy();
    this._cy = null;
  }

  override updated(changed: Map<string, unknown>) {
    if (changed.has('tuples') || changed.has('_filterUser') ||
        changed.has('_filterRelation') || changed.has('_filterObject') ||
        changed.has('_filterType')) {
      this._rebuildGraph();
    }
  }

  override render() {
    const types = uniqueTypes(this.tuples);
    const relations = uniqueRelations(this.tuples);
    const elements = this._filteredElements();

    return html`
      <div class="filter-bar">
        <label>Filter:</label>
        <select
          aria-label="Filter by type"
          .value=${this._filterType}
          @change=${(e: Event) => { this._filterType = (e.target as HTMLSelectElement).value; }}
        >
          <option value="">All types</option>
          ${types.map((t) => html`<option value=${t}>${t}</option>`)}
        </select>
        <select
          aria-label="Filter by relation"
          .value=${this._filterRelation}
          @change=${(e: Event) => { this._filterRelation = (e.target as HTMLSelectElement).value; }}
        >
          <option value="">All relations</option>
          ${relations.map((r) => html`<option value=${r}>${r}</option>`)}
        </select>
        <input
          type="text"
          placeholder="user..."
          aria-label="Filter by user"
          .value=${this._filterUser}
          @input=${(e: Event) => { this._filterUser = (e.target as HTMLInputElement).value; }}
        />
        <input
          type="text"
          placeholder="object..."
          aria-label="Filter by object"
          .value=${this._filterObject}
          @input=${(e: Event) => { this._filterObject = (e.target as HTMLInputElement).value; }}
        />
        <span class="filter-spacer"></span>
        <span class="count">${elements.filter((e) => e.group === 'nodes').length} nodes, ${elements.filter((e) => e.group === 'edges').length} edges</span>
      </div>

      ${this.tuples.length === 0
        ? html`<div class="empty-state">No tuples to visualize</div>`
        : html`<div id="graph" tabindex="0" role="img" aria-label="Relationship graph"></div>`}
    `;
  }

  private _filteredElements() {
    const filter = {
      user: this._filterUser || undefined,
      relation: this._filterRelation || undefined,
      object: this._filterObject || undefined,
      type: this._filterType || undefined,
    };
    return tuplesToElements(this.tuples, filter);
  }

  private _rebuildGraph() {
    if (!this._graphEl || this.tuples.length === 0) {
      this._cy?.destroy();
      this._cy = null;
      return;
    }

    const elements = this._filteredElements();
    this._buildTypeColorMap();

    const s = window.getComputedStyle(this);
    const get = (prop: string, fallback: string) => s.getPropertyValue(prop).trim() || fallback;
    const accentColor = get('--openfga-accent', '#89b4fa');
    const fontFamily = get('--openfga-font-family', 'sans-serif');
    const fontMono = get('--openfga-font-mono', 'monospace');
    const edgeColor = get('--openfga-graph-edge', '#6c7086');

    if (this._cy) {
      this._cy.elements().remove();
      this._cy.add(elements as cytoscape.ElementDefinition[]);
      // Re-apply node colors for new type assignments.
      this._applyNodeColors();
      this._cy.layout(LAYOUT).run();
      return;
    }

    this._cy = cytoscape({
      container: this._graphEl,
      elements: elements as cytoscape.ElementDefinition[],
      style: [
        {
          selector: 'node.entity-node',
          style: {
            'background-color': '#313244',
            'border-color': '#89b4fa',
            'border-width': 2,
            color: '#cdd6f4',
            'text-valign': 'center',
            'text-halign': 'center',
            label: 'data(label)',
            'font-family': fontMono,
            'font-size': 11,
            shape: 'round-rectangle',
            width: 'label',
            height: 'label',
            'padding-top': '6px',
            'padding-bottom': '6px',
            'padding-left': '10px',
            'padding-right': '10px',
          } as cytoscape.Css.Node,
        },
        {
          selector: 'node.highlighted',
          style: {
            'border-width': 3,
            'border-color': accentColor,
          } as cytoscape.Css.Node,
        },
        {
          selector: 'edge.rel-edge',
          style: {
            'line-color': edgeColor,
            'target-arrow-color': edgeColor,
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            width: 1.5,
            label: 'data(label)',
            'font-family': fontFamily,
            'font-size': 9,
            color: '#a6adc8',
            'text-rotation': 'autorotate',
            'text-margin-y': -8,
          } as cytoscape.Css.Edge,
        },
        {
          selector: 'edge.highlighted',
          style: {
            'line-color': accentColor,
            'target-arrow-color': accentColor,
            width: 2.5,
            color: accentColor,
          } as cytoscape.Css.Edge,
        },
      ],
      layout: LAYOUT,
      userZoomingEnabled: true,
      userPanningEnabled: true,
      boxSelectionEnabled: false,
    });

    this._applyNodeColors();

    // Click interactions.
    this._cy.on('tap', 'node', (evt) => {
      const data = evt.target.data();
      this.dispatchEvent(new CustomEvent<RelNodeClickDetail>('node-click', {
        detail: { id: data.id, type: data.typeName },
        bubbles: true, composed: true,
      }));
    });

    this._cy.on('tap', 'edge', (evt) => {
      const data = evt.target.data();
      this.dispatchEvent(new CustomEvent<RelEdgeClickDetail>('edge-click', {
        detail: { user: data.source, relation: data.label, object: data.target },
        bubbles: true, composed: true,
      }));
    });

    // Hover highlighting.
    this._cy.on('mouseover', 'node', (evt) => {
      evt.target.addClass('highlighted');
      evt.target.connectedEdges().addClass('highlighted');
    });
    this._cy.on('mouseout', 'node', (evt) => {
      evt.target.removeClass('highlighted');
      evt.target.connectedEdges().removeClass('highlighted');
    });
  }

  /** Build a stable type→color mapping from the current tuples. */
  private _buildTypeColorMap() {
    const types = uniqueTypes(this.tuples);
    this._typeColorMap.clear();
    types.forEach((t, i) => {
      this._typeColorMap.set(t, TYPE_COLORS[i % TYPE_COLORS.length]);
    });
  }

  /** Apply per-type border colors to nodes after they've been added to the graph. */
  private _applyNodeColors() {
    if (!this._cy) return;
    this._cy.nodes().forEach((node) => {
      const typeName = node.data('typeName') as string;
      const color = this._typeColorMap.get(typeName) ?? '#89b4fa';
      node.style('border-color', color);
      node.style('color', color);
    });
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'openfga-relationship-graph': RelationshipGraph;
  }
}
