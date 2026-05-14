// SPDX-License-Identifier: Apache-2.0

export enum GraphNodeGroup {
  AssignableRelation = 'assignable-relation',
  NonassignableRelation = 'nonassignable-relation',
  Type = 'type',
  StoreName = 'store-name',
  Default = 'default',
  Check = 'check',
}

export enum GraphEdgeGroup {
  StoreToType = 'store-to-type',
  TypeToRelation = 'type-to-relation',
  RelationToRelation = 'relation-to-relation',
  AssignableSourceToRelation = 'assignable-source-to-relation',
  Default = 'default',
}

export interface GraphNode {
  id: string;
  label: string;
  type?: string;
  group?: GraphNodeGroup;
  isActive?: boolean;
}

export interface GraphEdge {
  from: string;
  to: string;
  label?: string;
  group: GraphEdgeGroup;
  dashes?: boolean;
  isActive?: boolean;
}

export interface GraphDefinition {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export type ResolutionTree = Record<
  string,
  {
    inActivePath?: boolean;
    parents: Record<string, { inActivePath?: boolean; type?: string }>;
  }
>;

export enum RelationType {
  DirectUsers = 'Direct Users',
  ComputedUserset = 'Related From Same Object',
  TupleToUserset = 'Related From Related Objects',
}
