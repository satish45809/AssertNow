// Validates graph topology, edge rules, node settings, and variable reference scopes.
// Collects and returns all discovered problems in plain English without throwing errors.

import type { WorkflowGraph, WorkflowNode, WorkflowEdge, ValidationProblem, NodeType } from './types.js';
import { MAX_NODES_PER_WORKFLOW } from './limits.js';
import { extractVariableReferences, type VariableReference } from './references.js';
import {
  startNodeSettingsSchema,
  createRecordSettingsSchema,
  getRecordSettingsSchema,
  updateRecordSettingsSchema,
  deleteRecordSettingsSchema,
  decisionSettingsSchema,
  assertSettingsSchema
} from './nodeSettings.js';

const ALLOWED_REFERENCED_TYPES: ReadonlySet<NodeType> = new Set<NodeType>([
  'createRecord',
  'getRecord',
  'updateRecord'
]);

function checkNodeCount(graph: WorkflowGraph, problems: ValidationProblem[]): void {
  if (graph.nodes.length === 0) {
    problems.push({ message: 'Workflow graph must contain at least one node' });
    return;
  }
  if (graph.nodes.length > MAX_NODES_PER_WORKFLOW) {
    problems.push({
      message: `Workflow node count (${graph.nodes.length}) exceeds the maximum limit of ${MAX_NODES_PER_WORKFLOW}`
    });
  }
}

function checkUniqueNodeIds(graph: WorkflowGraph, problems: ValidationProblem[]): Set<string> {
  const seenIds = new Set<string>();
  for (const node of graph.nodes) {
    if (!node.id || node.id.trim() === '') {
      problems.push({ nodeId: node.id, message: 'Node ID cannot be empty' });
      continue;
    }
    if (seenIds.has(node.id)) {
      problems.push({ nodeId: node.id, message: `Duplicate node ID '${node.id}' found` });
    }
    seenIds.add(node.id);
  }
  return seenIds;
}

function checkStartNode(graph: WorkflowGraph, problems: ValidationProblem[]): WorkflowNode | null {
  const startNodes: WorkflowNode[] = [];
  for (const node of graph.nodes) {
    if (node.type === 'start') {
      startNodes.push(node);
    }
  }

  if (startNodes.length === 0) {
    problems.push({ message: 'Workflow must have exactly one start node, but none was found' });
    return null;
  }
  if (startNodes.length > 1) {
    problems.push({ message: `Workflow must have exactly one start node, but found ${startNodes.length}` });
    return null;
  }
  return startNodes[0] ?? null;
}

function checkEdgeEndpoints(graph: WorkflowGraph, validNodeIds: Set<string>, problems: ValidationProblem[]): void {
  for (const edge of graph.edges) {
    if (!validNodeIds.has(edge.source)) {
      problems.push({
        message: `Edge '${edge.id}' points from source node '${edge.source}', but that node does not exist`
      });
    }
    if (!validNodeIds.has(edge.target)) {
      problems.push({
        message: `Edge '${edge.id}' points to target node '${edge.target}', but that node does not exist`
      });
    }
  }
}

function checkEdgeRules(graph: WorkflowGraph, problems: ValidationProblem[]): void {
  const edgesBySource = new Map<string, WorkflowEdge[]>();
  for (const edge of graph.edges) {
    const list = edgesBySource.get(edge.source) ?? [];
    list.push(edge);
    edgesBySource.set(edge.source, list);
  }

  for (const node of graph.nodes) {
    const outgoing = edgesBySource.get(node.id) ?? [];
    if (node.type === 'decision') {
      let trueCount = 0;
      let falseCount = 0;
      for (const edge of outgoing) {
        if (edge.kind === 'true') trueCount++;
        else if (edge.kind === 'false') falseCount++;
        else {
          problems.push({
            nodeId: node.id,
            message: `Decision node '${node.id}' has invalid '${edge.kind}' outgoing edge. Only 'true' and 'false' edges are allowed`
          });
        }
      }
      if (trueCount !== 1 || falseCount !== 1) {
        problems.push({
          nodeId: node.id,
          message: `Decision node '${node.id}' must have exactly one 'true' edge and one 'false' edge`
        });
      }
    } else {
      let nextCount = 0;
      let faultCount = 0;
      for (const edge of outgoing) {
        if (edge.kind === 'next') nextCount++;
        else if (edge.kind === 'fault') {
          faultCount++;
          if (node.type === 'start') {
            problems.push({ nodeId: node.id, message: `Start node '${node.id}' cannot have a 'fault' edge` });
          }
        } else {
          problems.push({
            nodeId: node.id,
            message: `Node '${node.id}' cannot have a '${edge.kind}' edge. Only 'next' and 'fault' edges are allowed`
          });
        }
      }
      if (nextCount > 1) {
        problems.push({ nodeId: node.id, message: `Node '${node.id}' has more than one 'next' edge` });
      }
      if (faultCount > 1) {
        problems.push({ nodeId: node.id, message: `Node '${node.id}' has more than one 'fault' edge` });
      }
    }
  }
}

function checkReachabilityAndCycles(
  graph: WorkflowGraph,
  startNode: WorkflowNode,
  validNodeIds: Set<string>,
  problems: ValidationProblem[]
): void {
  const adjacency = new Map<string, string[]>();
  for (const nodeId of validNodeIds) {
    adjacency.set(nodeId, []);
  }
  for (const edge of graph.edges) {
    if (validNodeIds.has(edge.source) && validNodeIds.has(edge.target)) {
      adjacency.get(edge.source)?.push(edge.target);
    }
  }

  // Reachability check using BFS
  const visited = new Set<string>();
  const queue: string[] = [startNode.id];
  visited.add(startNode.id);

  while (queue.length > 0) {
    const current = queue.shift()!;
    const neighbors = adjacency.get(current) ?? [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push(neighbor);
      }
    }
  }

  for (const node of graph.nodes) {
    if (!visited.has(node.id)) {
      problems.push({
        nodeId: node.id,
        message: `Node '${node.id}' is an orphan and cannot be reached from the start node`
      });
    }
  }

  // Cycle check using DFS
  const state = new Map<string, 'unvisited' | 'visiting' | 'visited'>();
  for (const nodeId of validNodeIds) {
    state.set(nodeId, 'unvisited');
  }

  function detectCycle(currentId: string): void {
    state.set(currentId, 'visiting');
    const neighbors = adjacency.get(currentId) ?? [];
    for (const neighbor of neighbors) {
      const neighborState = state.get(neighbor);
      if (neighborState === 'visiting') {
        problems.push({
          nodeId: neighbor,
          message: `Cycle detected in workflow: node '${neighbor}' loops back to itself`
        });
      } else if (neighborState === 'unvisited') {
        detectCycle(neighbor);
      }
    }
    state.set(currentId, 'visited');
  }

  for (const nodeId of validNodeIds) {
    if (state.get(nodeId) === 'unvisited') {
      detectCycle(nodeId);
    }
  }
}

function checkNodeSettings(graph: WorkflowGraph, problems: ValidationProblem[]): void {
  for (const node of graph.nodes) {
    let result: { success: boolean; error?: { issues: { message: string; path: (string | number)[] }[] } };
    if (node.type === 'start') {
      result = startNodeSettingsSchema.safeParse(node.settings);
    } else if (node.type === 'createRecord') {
      result = createRecordSettingsSchema.safeParse(node.settings);
    } else if (node.type === 'getRecord') {
      result = getRecordSettingsSchema.safeParse(node.settings);
    } else if (node.type === 'updateRecord') {
      result = updateRecordSettingsSchema.safeParse(node.settings);
    } else if (node.type === 'deleteRecord') {
      result = deleteRecordSettingsSchema.safeParse(node.settings);
    } else if (node.type === 'decision') {
      result = decisionSettingsSchema.safeParse(node.settings);
    } else if (node.type === 'assert') {
      result = assertSettingsSchema.safeParse(node.settings);
    } else {
      problems.push({ nodeId: node.id, message: `Unknown node type '${node.type}' for node '${node.id}'` });
      continue;
    }

    if (!result.success && result.error) {
      for (const issue of result.error.issues) {
        const field = issue.path.length > 0 ? ` on '${issue.path.join('.')}'` : '';
        problems.push({
          nodeId: node.id,
          message: `Invalid settings for node '${node.id}' (${node.type})${field}: ${issue.message}`
        });
      }
    }
  }
}

function findVariableReferences(obj: unknown, refs: VariableReference[]): void {
  if (typeof obj === 'string') {
    const found = extractVariableReferences(obj);
    refs.push(...found);
  } else if (obj && typeof obj === 'object') {
    for (const value of Object.values(obj)) {
      findVariableReferences(value, refs);
    }
  }
}

function computeAllPaths(
  startId: string,
  targetId: string,
  adjacency: Map<string, string[]>,
  currentPath: string[],
  allPaths: string[][]
): void {
  currentPath.push(startId);
  if (startId === targetId) {
    allPaths.push([...currentPath]);
  } else {
    for (const neighbor of adjacency.get(startId) ?? []) {
      if (!currentPath.includes(neighbor)) {
        computeAllPaths(neighbor, targetId, adjacency, currentPath, allPaths);
      }
    }
  }
  currentPath.pop();
}

function checkVariableReferences(graph: WorkflowGraph, startNode: WorkflowNode, problems: ValidationProblem[]): void {
  const nodeMap = new Map<string, WorkflowNode>();
  for (const node of graph.nodes) {
    nodeMap.set(node.id, node);
  }

  const adjacency = new Map<string, string[]>();
  for (const node of graph.nodes) {
    adjacency.set(node.id, []);
  }
  for (const edge of graph.edges) {
    if (nodeMap.has(edge.source) && nodeMap.has(edge.target)) {
      adjacency.get(edge.source)?.push(edge.target);
    }
  }

  for (const node of graph.nodes) {
    const references: VariableReference[] = [];
    findVariableReferences(node.settings, references);

    for (const ref of references) {
      const referencedNode = nodeMap.get(ref.nodeId);
      if (!referencedNode) {
        problems.push({
          nodeId: node.id,
          message: `Node '${node.id}' uses a value from '${ref.nodeId}', but that node does not exist`
        });
        continue;
      }

      if (!ALLOWED_REFERENCED_TYPES.has(referencedNode.type)) {
        problems.push({
          nodeId: node.id,
          message: `Node '${node.id}' uses a value from '${ref.nodeId}', but node type '${referencedNode.type}' does not provide any output values`
        });
        continue;
      }

      const paths: string[][] = [];
      computeAllPaths(startNode.id, node.id, adjacency, [], paths);

      if (paths.length === 0) {
        continue;
      }

      let appearsOnAllPaths = true;
      for (const path of paths) {
        const index = path.indexOf(ref.nodeId);
        if (index === -1 || index >= path.indexOf(node.id)) {
          appearsOnAllPaths = false;
          break;
        }
      }

      if (!appearsOnAllPaths) {
        problems.push({
          nodeId: node.id,
          message: `Node '${node.id}' uses a value from '${ref.nodeId}', but '${ref.nodeId}' is not executed before '${node.id}' on every path from start`
        });
      }
    }
  }
}

export function validateGraph(graph: WorkflowGraph): ValidationProblem[] {
  const problems: ValidationProblem[] = [];

  checkNodeCount(graph, problems);
  if (graph.nodes.length === 0) {
    return problems;
  }

  const validNodeIds = checkUniqueNodeIds(graph, problems);
  const startNode = checkStartNode(graph, problems);
  checkEdgeEndpoints(graph, validNodeIds, problems);
  checkEdgeRules(graph, problems);
  checkNodeSettings(graph, problems);

  if (startNode) {
    checkReachabilityAndCycles(graph, startNode, validNodeIds, problems);
    checkVariableReferences(graph, startNode, problems);
  }

  return problems;
}
