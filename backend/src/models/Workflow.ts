/**
 * Visual Workflow & Regression Suite Contracts
 */

import { PlatformType } from './Environment.ts';

export type WorkflowStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

export type WorkflowNodeType = 
  | 'START' 
  | 'END' 
  | 'GET' 
  | 'CREATE' 
  | 'UPDATE' 
  | 'DELETE' 
  | 'DECISION' 
  | 'ASSIGNMENT' 
  | 'PAUSE';

export interface WorkflowNodeData {
  label: string;
  nodeType: WorkflowNodeType;
  platform?: PlatformType;
  config: Record<string, unknown>;
}

export interface WorkflowNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: WorkflowNodeData;
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  type?: string;
  style?: Record<string, unknown>;
  data?: Record<string, unknown>;
}

export interface WorkflowGraph {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

export interface Workflow {
  id: string;
  organizationId: string;
  name: string;
  description: string;
  platform: PlatformType;
  environmentId?: string;
  status: WorkflowStatus;
  version: number;
  tags: string[];
  graph: WorkflowGraph;
  lastExecutedAt?: string;
  lastExecutionStatus?: 'PASSED' | 'FAILED' | 'ERROR';
  createdAt: string;
  updatedAt: string;
}

export interface CreateWorkflowDto {
  name: string;
  description?: string;
  platform: PlatformType;
  environmentId?: string;
  tags?: string[];
  graph?: WorkflowGraph;
}

export interface UpdateWorkflowDto {
  name?: string;
  description?: string;
  status?: WorkflowStatus;
  tags?: string[];
  graph?: WorkflowGraph;
}

