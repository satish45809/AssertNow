// Defines the core data structures for workflow graphs, nodes, and edges.
// Written in plain TypeScript without framework or database dependencies.

export type NodeType =
  | 'start'
  | 'createRecord'
  | 'getRecord'
  | 'updateRecord'
  | 'deleteRecord'
  | 'decision'
  | 'assert';

export type EdgeKind = 'next' | 'true' | 'false' | 'fault';

export interface WorkflowNode {
  id: string;
  type: NodeType;
  settings: unknown;
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  kind: EdgeKind;
}

export interface WorkflowGraph {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

export interface ValidationProblem {
  nodeId?: string;
  message: string;
}
