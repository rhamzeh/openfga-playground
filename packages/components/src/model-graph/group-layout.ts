// SPDX-License-Identifier: Apache-2.0

/**
 * Alternative graph layout that groups relations by their assignability.
 *
 * Produces Cytoscape elements with the following node classes:
 *   - store-node          — root "store" node
 *   - type-node           — one per type_definition
 *   - assignable-node     — relation directly writable by an external user/object
 *   - permission-node     — computed relation (not directly assignable)
 *
 * Edges:
 *   - edge-store          — store → type
 *   - edge-type           — type → relation (parent grouping)
 *   - edge-computed       — computed relation reference (dashed)
 *   - edge-direct         — direct assignment source → relation (solid)
 */

// ---- Local type mirrors (no import from SDK) --------------------------------

interface DirectlyRelatedUserType {
  type: string;
  relation?: string;
  wildcard?: Record<string, unknown>;
}

interface RelationMetadata {
  directly_related_user_types?: DirectlyRelatedUserType[];
}

interface TypeMetadata {
  relations?: Record<string, RelationMetadata>;
}

interface RelationDef {
  this?: unknown;
  union?: { child?: RelationDef[] };
  intersection?: { child?: RelationDef[] };
  difference?: { base?: RelationDef; subtract?: RelationDef };
  computedUserset?: { object?: string; relation?: string };
  tupleToUserset?: { tupleset?: { relation?: string }; computedUserset?: { relation?: string } };
}

interface TypeDefinition {
  type: string;
  relations?: Record<string, RelationDef>;
  metadata?: TypeMetadata | null;
}

interface AuthorizationModel {
  schema_version?: string;
  type_definitions?: TypeDefinition[];
}

export interface GraphElement {
  data: Record<string, unknown>;
  classes?: string;
}

// ---- ID helpers -------------------------------------------------------------

function typeId(typeName: string) { return `grp:type:${typeName}`; }
function relId(typeName: string, relName: string) { return `grp:rel:${typeName}#${relName}`; }
const STORE_ID = 'grp:store';

// ---- Relation assignability check ------------------------------------------

function isAssignable(def: RelationDef): boolean {
  if (def.this) return true;
  if (def.difference) {
    return isAssignable(def.difference.base ?? {}) || isAssignable(def.difference.subtract ?? {});
  }
  if (def.union?.child?.some(isAssignable)) return true;
  if (def.intersection?.child?.some(isAssignable)) return true;
  return false;
}

// ---- Edge emission ----------------------------------------------------------

function emitComputedEdges(
  typeName: string,
  relName: string,
  def: RelationDef,
  elements: GraphElement[],
  seen: Set<string>,
): void {
  if (def.computedUserset?.relation) {
    const srcType = def.computedUserset.object || typeName;
    const src = relId(srcType, def.computedUserset.relation);
    const tgt = relId(typeName, relName);
    const id = `grp:computed:${src}->${tgt}`;
    if (!seen.has(id)) {
      seen.add(id);
      elements.push({ data: { id, source: src, target: tgt, kind: 'computed' }, classes: 'edge-computed' });
    }
    return;
  }
  if (def.tupleToUserset?.tupleset?.relation) {
    const src = relId(typeName, def.tupleToUserset.tupleset.relation);
    const tgt = relId(typeName, relName);
    const id = `grp:ttu:${src}->${tgt}`;
    if (!seen.has(id)) {
      seen.add(id);
      elements.push({ data: { id, source: src, target: tgt, kind: 'ttu' }, classes: 'edge-computed' });
    }
    return;
  }
  for (const key of ['union', 'intersection', 'exclusion'] as const) {
    const compound = (def as Record<string, unknown>)[key] as { child?: RelationDef[] } | undefined;
    if (compound?.child) {
      for (const child of compound.child) {
        emitComputedEdges(typeName, relName, child, elements, seen);
      }
    }
  }
  if (def.difference) {
    if (def.difference.base) emitComputedEdges(typeName, relName, def.difference.base, elements, seen);
    if (def.difference.subtract) emitComputedEdges(typeName, relName, def.difference.subtract, elements, seen);
  }
}

// ---- Main export -----------------------------------------------------------

/**
 * Convert a parsed OpenFGA authorization model to Cytoscape elements using
 * the grouped layout: type → [assignable-relation, permission-node].
 *
 * @param model   Parsed authorization model JSON
 * @param storeName  Label for the root store node (defaults to "Store")
 */
export function modelToGroupElements(model: object, storeName = 'Store'): GraphElement[] {
  const m = model as AuthorizationModel;
  const typeDefs = m.type_definitions ?? [];
  if (!typeDefs.length) return [];

  const elements: GraphElement[] = [];
  const seenEdges = new Set<string>();

  // Root store node
  elements.push({
    data: { id: STORE_ID, label: storeName, kind: 'store' },
    classes: 'store-node',
  });

  // Type nodes + store→type edges
  for (const td of typeDefs) {
    const tid = typeId(td.type);
    elements.push({
      data: { id: tid, label: td.type, kind: 'type' },
      classes: 'type-node',
    });
    elements.push({
      data: { id: `grp:s2t:${tid}`, source: STORE_ID, target: tid, kind: 'store' },
      classes: 'edge-store',
    });
  }

  // Relation nodes
  for (const td of typeDefs) {
    const relsMeta = td.metadata?.relations ?? {};
    const relationDefs = td.relations ?? {};

    for (const [relName, relDef] of Object.entries(relationDefs)) {
      const rid = relId(td.type, relName);
      const assignable = isAssignable(relDef);
      elements.push({
        data: { id: rid, label: relName, typeName: td.type, kind: 'relation', assignable },
        classes: assignable ? 'assignable-node' : 'permission-node',
      });
      // type → relation edge
      const t2rId = `grp:t2r:${rid}`;
      elements.push({
        data: { id: t2rId, source: typeId(td.type), target: rid, kind: 'type-relation' },
        classes: 'edge-type',
      });

      // Direct assignment source edges (from metadata)
      const meta = relsMeta[relName];
      for (const rut of meta?.directly_related_user_types ?? []) {
        const src = rut.relation
          ? relId(rut.type, rut.relation)
          : typeId(rut.type);
        const edgeId = `grp:direct:${src}->${rid}`;
        if (!seenEdges.has(edgeId)) {
          seenEdges.add(edgeId);
          elements.push({
            data: { id: edgeId, source: src, target: rid, kind: 'direct' },
            classes: 'edge-direct',
          });
        }
      }
    }

    // Computed relation edges
    for (const [relName, relDef] of Object.entries(relationDefs)) {
      emitComputedEdges(td.type, relName, relDef, elements, seenEdges);
    }
  }

  return elements;
}
