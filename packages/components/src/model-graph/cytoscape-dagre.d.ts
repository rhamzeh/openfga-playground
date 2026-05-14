// SPDX-License-Identifier: Apache-2.0
// Minimal type declaration for cytoscape-dagre (no @types package available).
declare module 'cytoscape-dagre' {
  import type cytoscape from 'cytoscape';
  const dagre: cytoscape.Ext;
  export default dagre;
}
