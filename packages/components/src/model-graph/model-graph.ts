// SPDX-License-Identifier: Apache-2.0
import { LitElement, html, css } from 'lit';
import { customElement, property, query } from 'lit/decorators.js';
import cytoscape from 'cytoscape';
import dagre from 'cytoscape-dagre';
import type { NodeSelectDetail } from '../shared/types.js';
import { modelToElements } from './graph-layout.js';
import { modelToGroupElements } from './group-layout.js';

// Register dagre layout once at module level
cytoscape.use(dagre);

// cytoscape.LayoutOptions only knows BaseLayoutOptions; cast to any for dagre-specific keys.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const DAGRE_LAYOUT: any = { name: 'dagre', rankDir: 'LR', nodeSep: 40, rankSep: 80, padding: 30 };

/**
 * `<openfga-model-graph>`
 *
 * Renders an OpenFGA authorization model as a directed graph using Cytoscape.js
 * with the dagre hierarchical layout.
 *
 * - Type nodes (filled, larger) and relation nodes (outlined, smaller)
 * - Solid edges for direct assignments, dashed for computed relations
 * - Click or keyboard (Tab + arrows + Enter) to select nodes
 *
 * @prop {object | null} model - Parsed authorization model JSON.
 * @fires {CustomEvent<NodeSelectDetail>} node-select - When a node is selected.
 */
@customElement('openfga-model-graph')
export class ModelGraph extends LitElement {
  static override styles = css`
    :host {
      display: block;
      height: 100%;
      background: var(--openfga-graph-bg, #141517);
      position: relative;
      font-family: var(--openfga-font-family, sans-serif);
    }

    #graph {
      width: 100%;
      height: calc(100% - 32px);
      outline: none;
    }

    #graph:focus-visible {
      box-shadow: inset 0 0 0 2px var(--openfga-accent, #cba6f7);
    }

    .graph-toolbar {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 4px 8px;
      height: 32px;
      box-sizing: border-box;
      border-bottom: 1px solid var(--openfga-border, #313244);
    }

    .graph-toolbar label {
      font-size: var(--openfga-font-size-sm, 11px);
      color: var(--openfga-text-secondary, #a6adc8);
      white-space: nowrap;
    }

    .graph-toolbar select {
      font-size: var(--openfga-font-size-sm, 11px);
      font-family: inherit;
      background: var(--openfga-bg-secondary, #1e1e2e);
      color: var(--openfga-text-primary, #cdd6f4);
      border: 1px solid var(--openfga-border, #313244);
      border-radius: 4px;
      padding: 2px 6px;
      cursor: pointer;
      outline: none;
    }

    .graph-toolbar select:focus-visible {
      border-color: var(--openfga-accent, #cba6f7);
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

  @property({ type: Object }) model: object | null = null;
  /** Controls the graph layout style. 'simple' shows type+relation nodes; 'grouped' shows assignable/permission semantics. */
  @property({ type: String, attribute: 'graph-type' }) graphType: 'simple' | 'grouped' = 'simple';
  /** Current app theme. When it changes, Cytoscape is re-initialized to pick up new CSS token values. */
  @property({ type: String }) theme: 'dark' | 'light' = 'dark';

  @query('#graph') private _graphEl!: HTMLDivElement;

  private _cy: cytoscape.Core | null = null;
  private _focusedIdx = 0;

  override firstUpdated() {
    if (this.model) {
      this._initGraph();
    }
  }

  override updated(changed: Map<string, unknown>) {
    const modelChanged = changed.has('model');
    const typeChanged = changed.has('graphType');
    const themeChanged = changed.has('theme');

    if (!modelChanged && !typeChanged && !themeChanged) return;

    if (themeChanged && this._cy && !modelChanged && !typeChanged) {
      // Theme-only change: destroy and recreate so _initGraph() re-reads CSS
      // token values, which have been updated by applyGraphTheme() before
      // this._theme state change triggered the re-render.
      this._cy.destroy();
      this._cy = null;
      if (this.model && this._graphEl) this._initGraph();
      return;
    }

    if (this._cy) {
      if (this.model) {
        this._cy.elements().remove();
        this._cy.add(this._buildElements() as cytoscape.ElementDefinition[]);
        this._cy.layout(DAGRE_LAYOUT).run();
      } else {
        this._cy.destroy();
        this._cy = null;
      }
    } else if (this.model && this._graphEl) {
      this._initGraph();
    }
  }

  private _buildElements() {
    if (!this.model) return [];
    return this.graphType === 'grouped'
      ? modelToGroupElements(this.model)
      : modelToElements(this.model);
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this._cy?.destroy();
    this._cy = null;
  }

  private _initGraph() {
    if (!this.model || !this._graphEl) return;

    const host = this as HTMLElement;
    const s = window.getComputedStyle(host);
    const get = (prop: string, fallback: string) => s.getPropertyValue(prop).trim() || fallback;

    const typeNodeFg = get('--openfga-graph-node-type', '#79ed83');
    const typeNodeBg = get('--openfga-graph-node-type-bg', '#1a2e1c');
    const relNodeFg = get('--openfga-graph-node-relation', '#20f1f5');
    const relNodeBg = get('--openfga-graph-node-relation-bg', '#0e2627');
    const edgeColor = get('--openfga-graph-edge', '#ceec93');
    const edgeComputedColor = get('--openfga-graph-edge-computed', '#737981');
    const accentColor = get('--openfga-accent', '#cba6f7');
    const fontFamily = get('--openfga-font-family', 'sans-serif');
    const fontMono = get('--openfga-font-mono', 'monospace');

    this._cy = cytoscape({
      container: this._graphEl,
      elements: this._buildElements() as cytoscape.ElementDefinition[],
      style: [
        {
          selector: 'node.type-node',
          style: {
            'background-color': typeNodeBg,
            'border-color': typeNodeFg,
            'border-width': 2,
            color: typeNodeFg,
            'text-valign': 'center',
            'text-halign': 'center',
            label: 'data(label)',
            'font-family': fontFamily,
            'font-size': 13,
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
          selector: 'node.relation-node',
          style: {
            'background-color': relNodeBg,
            'border-color': relNodeFg,
            'border-width': 1,
            color: relNodeFg,
            'text-valign': 'center',
            'text-halign': 'center',
            label: 'data(label)',
            'font-family': fontMono,
            'font-size': 11,
            shape: 'round-rectangle',
            width: 'label',
            height: 'label',
            'padding-top': '5px',
            'padding-bottom': '5px',
            'padding-left': '10px',
            'padding-right': '10px',
          } as cytoscape.Css.Node,
        },
        {
          selector: 'node.focused',
          style: {
            'border-width': 3,
            'border-color': accentColor,
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
          selector: 'edge.edge-direct',
          style: {
            'line-color': edgeColor,
            'target-arrow-color': edgeColor,
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            width: 1.5,
            'line-style': 'solid',
          } as cytoscape.Css.Edge,
        },
        {
          selector: 'edge.edge-computed',
          style: {
            'line-color': edgeComputedColor,
            'target-arrow-color': edgeComputedColor,
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            width: 1.5,
            'line-style': 'dashed',
          } as cytoscape.Css.Edge,
        },
        {
          selector: 'edge.highlighted',
          style: {
            'line-color': accentColor,
            'target-arrow-color': accentColor,
            width: 2.5,
          } as cytoscape.Css.Edge,
        },
        // ---- Grouped layout extra styles ----
        {
          selector: 'node.store-node',
          style: {
            'background-color': typeNodeBg,
            'border-color': accentColor,
            'border-width': 2,
            'border-style': 'dashed',
            color: accentColor,
            'text-valign': 'center',
            'text-halign': 'center',
            label: 'data(label)',
            'font-family': fontFamily,
            'font-size': 12,
            shape: 'round-rectangle',
            width: 'label',
            height: 'label',
            'padding-top': '6px',
            'padding-bottom': '6px',
            'padding-left': '12px',
            'padding-right': '12px',
          } as cytoscape.Css.Node,
        },
        {
          selector: 'node.assignable-node',
          style: {
            'background-color': relNodeBg,
            'border-color': edgeColor,
            'border-width': 2,
            color: edgeColor,
            'text-valign': 'center',
            'text-halign': 'center',
            label: 'data(label)',
            'font-family': fontMono,
            'font-size': 11,
            shape: 'round-rectangle',
            width: 'label',
            height: 'label',
            'padding-top': '5px',
            'padding-bottom': '5px',
            'padding-left': '10px',
            'padding-right': '10px',
          } as cytoscape.Css.Node,
        },
        {
          selector: 'node.permission-node',
          style: {
            'background-color': relNodeBg,
            'border-color': edgeComputedColor,
            'border-width': 1,
            'border-style': 'dashed',
            color: edgeComputedColor,
            'text-valign': 'center',
            'text-halign': 'center',
            label: 'data(label)',
            'font-family': fontMono,
            'font-size': 11,
            shape: 'round-rectangle',
            width: 'label',
            height: 'label',
            'padding-top': '5px',
            'padding-bottom': '5px',
            'padding-left': '10px',
            'padding-right': '10px',
          } as cytoscape.Css.Node,
        },
        {
          selector: 'edge.edge-store',
          style: {
            'line-color': edgeComputedColor,
            'target-arrow-color': edgeComputedColor,
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            width: 1,
            'line-style': 'dotted',
            opacity: 0.4,
          } as cytoscape.Css.Edge,
        },
        {
          selector: 'edge.edge-type',
          style: {
            'line-color': typeNodeFg,
            'target-arrow-color': typeNodeFg,
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            width: 1,
            'line-style': 'solid',
            opacity: 0.5,
          } as cytoscape.Css.Edge,
        },
      ],
      layout: DAGRE_LAYOUT,
      userZoomingEnabled: true,
      userPanningEnabled: true,
      boxSelectionEnabled: false,
    });

    // Click → node-select event
    this._cy.on('tap', 'node', (evt) => {
      const data = evt.target.data() as { kind: string; typeName?: string; label: string };
      if (data.kind === 'store') return; // store root has no meaningful selection
      this._fireNodeSelect(
        data.typeName ?? data.label,
        data.kind === 'relation' ? data.label : undefined,
      );
    });

    // Hover highlights connected edges
    this._cy.on('mouseover', 'node', (evt) => {
      evt.target.addClass('highlighted');
      evt.target.connectedEdges().addClass('highlighted');
    });
    this._cy.on('mouseout', 'node', (evt) => {
      evt.target.removeClass('highlighted');
      evt.target.connectedEdges().removeClass('highlighted');
    });
  }

  private _handleKeydown(e: KeyboardEvent) {
    if (!this._cy) return;
    const nodes = this._cy.nodes().toArray();
    if (!nodes.length) return;

    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        e.preventDefault();
        this._focusedIdx = (this._focusedIdx + 1) % nodes.length;
        this._focusNode(nodes[this._focusedIdx]);
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        e.preventDefault();
        this._focusedIdx = (this._focusedIdx - 1 + nodes.length) % nodes.length;
        this._focusNode(nodes[this._focusedIdx]);
        break;
      case 'Enter':
      case ' ': {
        e.preventDefault();
        const node = nodes[this._focusedIdx];
        if (node) {
          const data = node.data() as { kind: string; typeName?: string; label: string };
          this._fireNodeSelect(
            data.typeName ?? data.label,
            data.kind === 'relation' ? data.label : undefined,
          );
        }
        break;
      }
    }
  }

  private _focusNode(node: cytoscape.NodeSingular) {
    this._cy?.nodes().removeClass('focused');
    node.addClass('focused');
    this._cy?.animate({ center: { eles: node } } as cytoscape.AnimationOptions);
  }

  private _fireNodeSelect(type: string, relation?: string) {
    this.dispatchEvent(
      new CustomEvent<NodeSelectDetail>('node-select', {
        detail: { type, relation },
        bubbles: true,
        composed: true,
      }),
    );
  }

  override render() {
    if (!this.model) {
      return html`
        <div class="empty-state" role="img" aria-label="No model loaded — graph is empty">
          <span>No model to display</span>
        </div>
      `;
    }
    return html`
      <div class="graph-toolbar">
        <label for="graph-type-select">View:</label>
        <select
          id="graph-type-select"
          aria-label="Graph view type"
          .value=${this.graphType}
          @change=${(e: Event) => {
            const v = (e.target as HTMLSelectElement).value as 'simple' | 'grouped';
            this.graphType = v;
          }}
        >
          <option value="simple">Type &amp; Relation</option>
          <option value="grouped">Assignable &amp; Permission</option>
        </select>
      </div>
      <div
        id="graph"
        role="img"
        aria-label="Authorization model graph. Use arrow keys to navigate nodes, Enter or Space to select."
        tabindex="0"
        @keydown=${this._handleKeydown}
        @focus=${() => {
          if (this._cy && this._cy.nodes().length > 0 && this._focusedIdx === 0) {
            this._focusNode(this._cy.nodes()[0]);
          }
        }}
      ></div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'openfga-model-graph': ModelGraph;
  }
}
