// SPDX-License-Identifier: Apache-2.0

import { GraphDefinition, GraphEdgeGroup, GraphNode, GraphEdge, RelationType, ResolutionTree } from './types.js';

// ---------------------------------------------------------------------------
// Local type mirrors for UsersetTree nodes (Expand API response)
// ---------------------------------------------------------------------------

interface UsersetTreeNode {
  name?: string;
  leaf?: {
    users?: { users?: string[] };
    computed?: { userset?: string };
    tupleToUserset?: { tupleset?: string; computed?: Array<{ userset?: string }> };
  };
  union?: { nodes?: UsersetTreeNode[] };
}

interface ExpandResult {
  tree?: { root?: UsersetTreeNode } | null;
}

/** Async function that calls the Expand API for a given relation+object. */
export type ExpandFn = (relation: string, object: string) => Promise<ExpandResult>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getUserComponents(userString: string): { object: string; relation?: string; isWildcard: boolean } {
  const [obj, rel] = userString.split('#');
  const isWildcard = rel === '*' || userString === '*';
  return { object: obj, relation: isWildcard ? undefined : rel, isWildcard };
}

// ---------------------------------------------------------------------------
// TreeBuilder
// ---------------------------------------------------------------------------

/**
 * Builds a flat {@link ResolutionTree} by walking the Expand API recursively
 * (one API call per relation userset encountered), then converts it to a
 * {@link GraphDefinition} suitable for Cytoscape rendering.
 *
 * Ported from the original `@openfga/frontend-utils` JS implementation.
 */
export class TreeBuilder {
  private readonly capturedTuple: { relation: string; object: string };
  private readonly expandFn: ExpandFn;
  private readonly authorizationModelId?: string;
  private currentTree: ResolutionTree | undefined;
  private readonly expandedTuples: Record<string, boolean> = {};

  constructor(
    expandFn: ExpandFn,
    capturedTuple: { relation: string; object: string },
    existingTree?: ResolutionTree,
    authorizationModelId?: string,
  ) {
    this.expandFn = expandFn;
    this.capturedTuple = capturedTuple;
    this.authorizationModelId = authorizationModelId;
    if (existingTree) this.currentTree = existingTree;
  }

  get tree(): ResolutionTree | undefined {
    return this.currentTree;
  }

  private addParent(user: string, parent: string, type?: string, inActivePath?: boolean): void {
    if (!this.currentTree) return;
    if (!this.currentTree[user]) this.currentTree[user] = { parents: {} };
    this.currentTree[user].parents[parent] = { inActivePath, type };
    const capturedKey = `${this.capturedTuple.object}#${this.capturedTuple.relation}`;
    if (parent === capturedKey) {
      if (!this.currentTree[this.capturedTuple.object]) {
        this.currentTree[this.capturedTuple.object] = { parents: {}, inActivePath: true };
      }
      this.addParent(capturedKey, this.capturedTuple.object, undefined, true);
    }
  }

  private async walkDirectUser(node: UsersetTreeNode, user: string): Promise<void> {
    this.addParent(user, node.name ?? '', RelationType.DirectUsers);
    const tupleKey = getUserComponents(user);
    if (tupleKey.relation) await this.walk(tupleKey);
  }

  private async walkDirectUsers(node: UsersetTreeNode): Promise<void> {
    const users = node.leaf?.users?.users ?? [];
    await Promise.all(users.map((u) => this.walkDirectUser(node, u)));
  }

  private async walkComputedUserSet(
    node: UsersetTreeNode,
    computedUserSet: string | undefined,
    viaTupleToUserset = false,
  ): Promise<void> {
    if (!computedUserSet || computedUserSet.split(':').length !== 2) return;
    this.addParent(
      computedUserSet,
      node.name ?? '',
      viaTupleToUserset ? RelationType.TupleToUserset : RelationType.ComputedUserset,
    );
    await this.walk(getUserComponents(computedUserSet));
  }

  private async walkTupleToUserset(node: UsersetTreeNode): Promise<void> {
    const tupleset = node.leaf?.tupleToUserset?.tupleset;
    if (!tupleset) return;
    await this.walk(getUserComponents(tupleset));
  }

  private getNodeType(node: UsersetTreeNode): RelationType | undefined {
    if (node.leaf?.computed?.userset) return RelationType.ComputedUserset;
    if (node.leaf?.tupleToUserset?.computed) return RelationType.TupleToUserset;
    if (!node.union?.nodes?.length) return RelationType.DirectUsers;
    return undefined; // union with children
  }

  private async walkNode(node: UsersetTreeNode): Promise<void> {
    const type = this.getNodeType(node);
    const promises: Promise<void>[] = [];
    switch (type) {
      case RelationType.DirectUsers:
        promises.push(this.walkDirectUsers(node));
        break;
      case RelationType.ComputedUserset:
        promises.push(this.walkComputedUserSet(node, node.leaf?.computed?.userset));
        break;
      case RelationType.TupleToUserset:
        promises.push(this.walkTupleToUserset(node));
        for (const c of node.leaf?.tupleToUserset?.computed ?? []) {
          promises.push(this.walkComputedUserSet(node, c.userset, true));
        }
        break;
      default: // union: walk child nodes
        for (const child of node.union?.nodes ?? []) {
          promises.push(this.walkNode(child));
        }
    }
    await Promise.all(promises);
  }

  private async walk(tuple: { object: string; relation?: string }): Promise<void> {
    if (!tuple.relation) return;
    const key = `${tuple.object}#${tuple.relation}`;
    if (this.expandedTuples[key]) return;
    if (this.currentTree && !this.currentTree[key]) this.currentTree[key] = { parents: {} };
    this.expandedTuples[key] = true;
    const data = await this.expandFn(tuple.relation, tuple.object);
    const root = data.tree?.root;
    if (root) await this.walkNode(root);
  }

  /** Build the flat {@link ResolutionTree} by recursively calling the Expand API. */
  async buildTree(): Promise<void> {
    if (this.tree) return;
    this.currentTree = {};
    await this.walk(this.capturedTuple);
  }

  /**
   * Mark nodes in the active path leading from `targetUser` to the target
   * object. Returns a deep clone of the tree with `inActivePath` set.
   */
  fillActivePath(targetUser: string): ResolutionTree {
    const tree = this.tree ?? {};
    const full = JSON.parse(JSON.stringify(tree)) as ResolutionTree;
    const targetObject = this.capturedTuple.object;
    let nextPaths = ['*', targetUser];
    const traversed: Record<string, boolean> = {};
    while (nextPaths.length) {
      const nextObj: Record<string, boolean> = {};
      for (const path of nextPaths) {
        if (traversed[path]) continue;
        traversed[path] = true;
        if (!full[path]) continue;
        if (full[path].parents[targetObject]) {
          for (const p of Object.keys(full[path].parents)) {
            if (p !== targetObject) delete full[path].parents[p];
          }
        }
        for (const parent of Object.keys(full[path].parents)) {
          if (parent === path) continue;
          full[path].parents[parent].inActivePath = true;
          nextObj[parent] = true;
        }
      }
      nextPaths = Object.keys(nextObj);
    }
    return full;
  }

  /**
   * Remove nodes that have no parents and are not the root object.
   * These appear when a computed userset exists in the model but has no
   * members at query time.
   */
  deleteHangingNodes(): void {
    const tree = this.tree ?? {};
    for (const key of Object.keys(tree)) {
      if (!Object.keys(tree[key].parents).length && key !== this.capturedTuple.object) {
        delete tree[key];
      }
    }
  }

  /**
   * Convert the resolution tree to a {@link GraphDefinition} for rendering.
   *
   * @param targetUser - When provided, {@link fillActivePath} is called first
   *   and `isActive` is set on nodes/edges that form the access path.
   * @param onlyInActivePath - When true, only edges in the active path are
   *   included. Defaults to false.
   */
  buildGraph(targetUser?: string, onlyInActivePath = false): GraphDefinition {
    let tree = this.tree ?? {};
    const { capturedTuple } = this;
    const hasUser = !!targetUser;
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];

    this.deleteHangingNodes();
    if (targetUser) tree = this.fillActivePath(targetUser);

    for (const nodeKey of Object.keys(tree)) {
      const node = tree[nodeKey];
      const [object] = nodeKey.split('#');
      let hasFoundParentInActivePath = false;
      let shouldHideNode = false;

      for (const parentKey of Object.keys(node.parents)) {
        const parentNode = node.parents[parentKey];
        if (!tree[parentKey]) {
          shouldHideNode = true;
          continue;
        }
        if (onlyInActivePath && !parentNode.inActivePath) continue;
        hasFoundParentInActivePath = true;

        const type = parentNode.type?.replace(/\s/gu, '');
        if (type) {
          const intermediateId = `${parentKey}.${type}.${nodeKey}`;
          nodes.push({ id: intermediateId, label: parentNode.type ?? type });
          edges.push({
            from: parentKey,
            to: intermediateId,
            group: GraphEdgeGroup.Default,
            isActive: parentNode.inActivePath,
          });
        }
        const edgeFrom = type ? `${parentKey}.${type}.${nodeKey}` : parentKey;
        const [, rel] = nodeKey.split('#');
        edges.push({
          from: edgeFrom,
          to: nodeKey,
          label: parentKey === capturedTuple.object && rel ? `${rel} from` : '',
          group: GraphEdgeGroup.Default,
          isActive: parentNode.inActivePath,
        });
      }

      const isUserNode = nodeKey === targetUser || (nodeKey === '*' && hasUser);
      const isObjectNode = nodeKey === capturedTuple.object;
      if (isObjectNode || hasFoundParentInActivePath || !(onlyInActivePath || shouldHideNode)) {
        nodes.push({
          id: nodeKey,
          label: object === '*' && hasUser ? `${targetUser} via everyone (*)` : nodeKey,
          isActive: isObjectNode || isUserNode,
        });
      }
    }

    return { nodes, edges };
  }
}
