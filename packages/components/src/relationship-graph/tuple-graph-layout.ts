// SPDX-License-Identifier: Apache-2.0

/**
 * Convert a list of tuples into Cytoscape elements for the relationship graph.
 *
 * Each unique user/object string becomes a node; each tuple becomes a labeled
 * edge from user → object. Nodes are classified by their OpenFGA type
 * (extracted from the `type:id` format) for per-type coloring.
 */

interface TupleKey {
  user: string;
  relation: string;
  object: string;
}

export interface RelGraphNode {
  group: 'nodes';
  data: { id: string; label: string; kind: string; typeName: string };
  classes: string;
}

export interface RelGraphEdge {
  group: 'edges';
  data: { id: string; source: string; target: string; label: string };
  classes: string;
}

export type RelGraphElement = RelGraphNode | RelGraphEdge;

/** Extract the type portion from a `type:id` or `type:id#relation` string. */
function extractType(str: string): string {
  const hashIdx = str.indexOf('#');
  const clean = hashIdx >= 0 ? str.substring(0, hashIdx) : str;
  const colonIdx = clean.indexOf(':');
  return colonIdx > 0 ? clean.substring(0, colonIdx) : clean;
}

/** Shorten a node label for display — keep type:id but trim very long IDs. */
function shortLabel(str: string): string {
  if (str.length <= 30) return str;
  const colonIdx = str.indexOf(':');
  if (colonIdx < 0) return str;
  const type = str.substring(0, colonIdx);
  const rest = str.substring(colonIdx + 1);
  const hashIdx = rest.indexOf('#');
  if (hashIdx >= 0) {
    const id = rest.substring(0, hashIdx);
    const rel = rest.substring(hashIdx);
    return `${type}:${id.length > 12 ? id.substring(0, 10) + '…' : id}${rel}`;
  }
  return `${type}:${rest.length > 16 ? rest.substring(0, 14) + '…' : rest}`;
}

/**
 * Build Cytoscape elements from tuples.
 *
 * @param tuples   Array of relationship tuples.
 * @param filter   Optional filter — only include tuples matching all non-empty fields.
 */
export function tuplesToElements(
  tuples: ReadonlyArray<TupleKey>,
  filter?: { user?: string; relation?: string; object?: string; type?: string },
): RelGraphElement[] {
  const nodes = new Map<string, RelGraphNode>();
  const edges: RelGraphEdge[] = [];

  const filtered = tuples.filter((t) => {
    if (!filter) return true;
    if (filter.user && !t.user.toLowerCase().includes(filter.user.toLowerCase())) return false;
    if (filter.relation && t.relation !== filter.relation) return false;
    if (filter.object && !t.object.toLowerCase().includes(filter.object.toLowerCase())) return false;
    if (filter.type) {
      const ft = filter.type.toLowerCase();
      if (extractType(t.user).toLowerCase() !== ft && extractType(t.object).toLowerCase() !== ft) return false;
    }
    return true;
  });

  for (const t of filtered) {
    // Ensure nodes exist for both user and object.
    for (const entity of [t.user, t.object]) {
      if (!nodes.has(entity)) {
        const typeName = extractType(entity);
        nodes.set(entity, {
          group: 'nodes',
          data: { id: entity, label: shortLabel(entity), kind: 'entity', typeName },
          classes: `entity-node type-${typeName}`,
        });
      }
    }

    // Add edge.
    const edgeId = `${t.user}|${t.relation}|${t.object}`;
    edges.push({
      group: 'edges',
      data: { id: edgeId, source: t.user, target: t.object, label: t.relation },
      classes: 'rel-edge',
    });
  }

  return [...nodes.values(), ...edges];
}

/**
 * Extract unique type names from tuples (for the type filter dropdown).
 */
export function uniqueTypes(tuples: ReadonlyArray<TupleKey>): string[] {
  const types = new Set<string>();
  for (const t of tuples) {
    types.add(extractType(t.user));
    types.add(extractType(t.object));
  }
  return [...types].sort();
}

/**
 * Extract unique relation names from tuples (for the relation filter dropdown).
 */
export function uniqueRelations(tuples: ReadonlyArray<TupleKey>): string[] {
  const rels = new Set<string>();
  for (const t of tuples) rels.add(t.relation);
  return [...rels].sort();
}
