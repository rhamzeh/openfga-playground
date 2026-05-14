// SPDX-License-Identifier: Apache-2.0
import { LitElement, html, css } from 'lit';
import { customElement, property, query } from 'lit/decorators.js';
import cytoscape from 'cytoscape';
import dagre from 'cytoscape-dagre';
import type { GraphDefinition } from '@openfga/frontend-utils/graph';

cytoscape.use(dagre);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const DAGRE_LAYOUT: any = { name: 'dagre', rankDir: 'TB', nodeSep: 30, rankSep: 60, padding: 24 };

// ---------------------------------------------------------------------------
// GraphDefinition → Cytoscape elements
// ---------------------------------------------------------------------------

function graphToElements(graph: GraphDefinition): cytoscape.ElementDefinition[] {
  const elements: cytoscape.ElementDefinition[] = [];
  const seenNodes = new Set<string>();
  for (const node of graph.nodes) {
    if (seenNodes.has(node.id)) continue;
    seenNodes.add(node.id);
    elements.push({
      data: { id: node.id, label: node.label },
      classes: node.isActive ? 'active-node' : 'graph-node',
    });
  }
  const seenEdges = new Set<string>();
  for (const edge of graph.edges) {
    const edgeId = `${edge.from}-->${edge.to}`;
    if (seenEdges.has(edgeId)) continue;
    seenEdges.add(edgeId);
    // Only emit edge if both endpoints exist
    if (!seenNodes.has(edge.from) || !seenNodes.has(edge.to)) continue;
    elements.push({
      data: { id: edgeId, source: edge.from, target: edge.to, label: edge.label ?? '' },
      classes: edge.isActive ? 'active-edge' : '',
    });
  }
  return elements;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * `<openfga-resolution-path>`
 *
 * Renders an OpenFGA access resolution graph (from the Expand API) as a
 * directed graph using Cytoscape.js with the dagre top-down layout.
 *
 * Node types:
 *   - active-node  — the check object or the target user (highlighted)
 *   - graph-node   — intermediate userset nodes (standard)
 *
 * Edges:
 *   - active-edge  — edges in the active access path (highlighted)
 *   - (default)    — other edges
 *
 * @prop {GraphDefinition | null} graph - Resolution graph from {@link TreeBuilder.buildGraph}.
 */
@customElement('openfga-resolution-path')
export class ResolutionPath extends LitElement {
  static override styles = css`
    :host {
      display: block;
      height: 100%;
      background: var(--openfga-graph-bg, #181825);
      position: relative;
      font-family: var(--openfga-font-family, sans-serif);
    }

    #graph {
      width: 100%;
      height: 100%;
      outline: none;
    }

    #graph:focus-visible {
      box-shadow: inset 0 0 0 2px var(--openfga-accent, #cba6f7);
    }

    .empty-state {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100%;
      color: var(--openfga-text-secondary, #a6adc8);
      font-size: var(--openfga-font-size-sm, 12px);
      opacity: 0.6;
      pointer-events: none;
    }
  `;

  @property({ type: Object }) graph: GraphDefinition | null = null;
  @query('#graph') private _graphEl!: HTMLDivElement;

  private _cy: cytoscape.Core | null = null;

  override firstUpdated() {
    if (this.graph) this._initGraph();
  }

  override updated(changed: Map<string, unknown>) {
    if (!changed.has('graph')) return;
    if (this._cy) {
      this._cy.destroy();
      this._cy = null;
    }
    if (this.graph && this._graphEl) this._initGraph();
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this._cy?.destroy();
    this._cy = null;
  }

  override render() {
    return html`
      ${this.graph
        ? html`<div id="graph" tabindex="0" role="img" aria-label="Resolution path graph"></div>`
        : html`<div class="empty-state">No resolution path — run an assertion and click ⚡</div>`}
    `;
  }

  private _initGraph() {
    if (!this.graph || !this._graphEl) return;

    const host = this as HTMLElement;
    const s = window.getComputedStyle(host);
    const get = (prop: string, fallback: string) => s.getPropertyValue(prop).trim() || fallback;

    const activeNodeFg = get('--openfga-accent', '#cba6f7');
    const activeNodeBg = '#2a2040';
    const graphNodeFg = get('--openfga-graph-node-type', '#89b4fa');
    const graphNodeBg = get('--openfga-graph-node-type-bg', '#1e3a5f');
    const activeEdgeColor = get('--openfga-accent', '#cba6f7');
    const edgeColor = get('--openfga-graph-edge', '#585b70');
    const fontFamily = get('--openfga-font-family', 'sans-serif');

    const elements = graphToElements(this.graph);

    this._cy = cytoscape({
      container: this._graphEl,
      elements,
      style: [
        {
          selector: 'node.active-node',
          style: {
            'background-color': activeNodeBg,
            'border-color': activeNodeFg,
            'border-width': 3,
            color: activeNodeFg,
            label: 'data(label)',
            'text-valign': 'center',
            'text-halign': 'center',
            'text-wrap': 'wrap',
            'font-family': fontFamily,
            'font-size': 12,
            'font-weight': 'bold',
            shape: 'round-rectangle',
            width: 'label',
            height: 'label',
            'padding-top': '8px',
            'padding-bottom': '8px',
            'padding-left': '14px',
            'padding-right': '14px',
          } as cytoscape.Css.Node,
        },
        {
          selector: 'node.graph-node',
          style: {
            'background-color': graphNodeBg,
            'border-color': graphNodeFg,
            'border-width': 1,
            color: graphNodeFg,
            label: 'data(label)',
            'text-valign': 'center',
            'text-halign': 'center',
            'text-wrap': 'wrap',
            'font-family': fontFamily,
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
          selector: 'edge',
          style: {
            width: 1,
            'line-color': edgeColor,
            'target-arrow-color': edgeColor,
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            label: 'data(label)',
            'font-size': 9,
            color: edgeColor,
            'text-background-color': get('--openfga-graph-bg', '#181825'),
            'text-background-opacity': 0.8,
            'text-background-padding': '2px',
          } as cytoscape.Css.Edge,
        },
        {
          selector: 'edge.active-edge',
          style: {
            width: 2,
            'line-color': activeEdgeColor,
            'target-arrow-color': activeEdgeColor,
            color: activeEdgeColor,
          } as cytoscape.Css.Edge,
        },
      ],
      layout: DAGRE_LAYOUT,
      userZoomingEnabled: true,
      userPanningEnabled: true,
    });
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'openfga-resolution-path': ResolutionPath;
  }
}
