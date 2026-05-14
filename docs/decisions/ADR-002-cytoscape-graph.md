# ADR-002: Cytoscape.js for Graph Visualization

## Status

Accepted

## Decision

Use [Cytoscape.js](https://js.cytoscape.org/) with the [cytoscape-dagre](https://github.com/cytoscape/cytoscape.js-dagre) layout plugin for the model graph (`<openfga-model-graph>`) and resolution path (`<openfga-resolution-path>`) components.

## Context

The authorization model visualization requires:

- Directed graph rendering (type nodes → relation nodes → edges)
- Deterministic hierarchical layout (same model = same node positions on every render)
- Interactivity: pan, zoom, node click/selection, keyboard navigation
- Theming via CSS custom properties
- Lazy-loadable so docs pages that only import `model-editor` do not pay the Cytoscape cost

## Rationale

- **Purpose-built**: Cytoscape.js is designed specifically for graph rendering and interaction. It handles pan, zoom, selection, and event handling out of the box.
- **Dagre layout**: The `cytoscape-dagre` plugin provides deterministic hierarchical layouts via the Dagre algorithm, well-suited for authorization model DAGs (directed acyclic graphs).
- **Existing OpenFGA usage**: The current playground at play.fga.dev uses Cytoscape. Reusing it preserves institutional knowledge.
- **Keyboard accessibility**: Cytoscape supports custom keyboard event handlers; we can implement arrow-key node navigation on top of it.
- **Size**: ~170KB gzipped. Heavy but justified. Isolated to the `model-graph` and `resolution-path` subpath exports so docs consumers importing only `model-editor` pay zero cost.

## Trade-offs

- Heavier than a custom SVG rendering solution.
- Less flexible than D3.js for custom visualizations, but D3 would require significantly more implementation effort for layout and interaction.
- Cytoscape uses its own canvas/SVG rendering; CSS custom property theming is applied by reading property values and passing them to Cytoscape's style API on mount and on property change.

## Alternatives Considered

- **D3.js**: Maximum flexibility, but implementing a well-behaved force-directed or hierarchical layout with pan/zoom/keyboard interaction would take significantly longer. Not worth it for this use case.
- **ELK.js + custom SVG**: ELK provides excellent layouts but adds another heavy dependency. Custom SVG rendering requires significant implementation effort.
- **Vis.js**: Alternative graph library. Less actively maintained than Cytoscape. No significant advantage.
- **React Flow / Xyflow**: React-specific. Not usable in a framework-agnostic Web Component.
