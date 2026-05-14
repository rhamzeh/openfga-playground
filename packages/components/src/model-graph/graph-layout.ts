// SPDX-License-Identifier: Apache-2.0

/**
 * Converts a parsed OpenFGA authorization model JSON object into an array of
 * Cytoscape element definitions suitable for graph rendering.
 *
 * Nodes:
 *   - type-node  — one per type_definition (id: "type:<name>")
 *   - relation-node — one per relation per type (id: "rel:<type>#<relation>")
 *
 * Edges:
 *   - edge-direct   — direct assignment (from metadata.directly_related_user_types)
 *   - edge-computed — computed relation (computedUserset / tupleToUserset)
 */

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

interface TypeDefinition {
  type: string;
  relations?: Record<string, unknown>;
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

export function modelToElements(model: object): GraphElement[] {
  const m = model as AuthorizationModel;
  const typeDefs = m.type_definitions ?? [];
  if (!typeDefs.length) return [];

  const elements: GraphElement[] = [];
  const addedEdges = new Set<string>();

  // --- Nodes ---
  for (const td of typeDefs) {
    elements.push({
      data: { id: `type:${td.type}`, label: td.type, kind: 'type' },
      classes: 'type-node',
    });

    for (const rel of Object.keys(td.relations ?? {})) {
      elements.push({
        data: {
          id: `rel:${td.type}#${rel}`,
          label: `${td.type}#${rel}`,
          typeName: td.type,
          kind: 'relation',
        },
        classes: 'relation-node',
      });
    }
  }

  // --- Direct assignment edges (from metadata) ---
  for (const td of typeDefs) {
    const relsMeta = td.metadata?.relations ?? {};
    for (const [rel, meta] of Object.entries(relsMeta)) {
      for (const rut of meta.directly_related_user_types ?? []) {
        // rut.relation means "group#member"-style userset — point to the relation node
        const sourceId = rut.relation
          ? `rel:${rut.type}#${rut.relation}`
          : `type:${rut.type}`;
        const targetId = `rel:${td.type}#${rel}`;
        const edgeId = `edge:direct:${sourceId}->${targetId}`;
        if (!addedEdges.has(edgeId)) {
          addedEdges.add(edgeId);
          elements.push({
            data: { id: edgeId, source: sourceId, target: targetId, kind: 'direct' },
            classes: 'edge-direct',
          });
        }
      }
    }
  }

  // --- Computed edges (from relation definitions) ---
  for (const td of typeDefs) {
    for (const [rel, relDef] of Object.entries(td.relations ?? {})) {
      extractComputedEdges(td.type, rel, relDef as object, elements, addedEdges);
    }
  }

  return elements;
}

/**
 * Recursively walks a relation definition and emits computed edges.
 */
function extractComputedEdges(
  typeName: string,
  relName: string,
  def: object,
  elements: GraphElement[],
  addedEdges: Set<string>,
): void {
  if (!def || typeof def !== 'object') return;
  const d = def as Record<string, unknown>;

  // computedUserset: points to another relation (same or different type)
  if (d.computedUserset) {
    const cu = d.computedUserset as { object?: string; relation?: string };
    if (cu.relation) {
      const sourceType = cu.object || typeName;
      const sourceId = `rel:${sourceType}#${cu.relation}`;
      const targetId = `rel:${typeName}#${relName}`;
      const edgeId = `edge:computed:${sourceId}->${targetId}`;
      if (!addedEdges.has(edgeId)) {
        addedEdges.add(edgeId);
        elements.push({
          data: { id: edgeId, source: sourceId, target: targetId, kind: 'computed' },
          classes: 'edge-computed',
        });
      }
    }
    return;
  }

  // tupleToUserset: "users who have relation X on the object that this object is in"
  if (d.tupleToUserset) {
    const ttu = d.tupleToUserset as {
      tupleset?: { relation?: string };
      computedUserset?: { relation?: string };
    };
    const tuplesetRel = ttu.tupleset?.relation;
    if (tuplesetRel) {
      const sourceId = `rel:${typeName}#${tuplesetRel}`;
      const targetId = `rel:${typeName}#${relName}`;
      const edgeId = `edge:ttu:${sourceId}->${targetId}`;
      if (!addedEdges.has(edgeId)) {
        addedEdges.add(edgeId);
        elements.push({
          data: { id: edgeId, source: sourceId, target: targetId, kind: 'ttu' },
          classes: 'edge-computed',
        });
      }
    }
    return;
  }

  // Compound operators — recurse into children
  for (const key of ['union', 'intersection', 'exclusion']) {
    const compound = d[key] as { child?: unknown[] } | undefined;
    if (compound?.child && Array.isArray(compound.child)) {
      for (const child of compound.child) {
        extractComputedEdges(typeName, relName, child as object, elements, addedEdges);
      }
    }
  }
}
