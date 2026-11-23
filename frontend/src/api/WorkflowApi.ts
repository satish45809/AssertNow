/**
 * Workflow API Service
 * Communicates with the backend PostgreSQL-persisted workflows via REST API.
 * Single Source of Truth: POST /api/salesforce/workflows (create & update)
 */

import { ApiClient } from './ApiClient';
import { WorkflowDefinition, FlowResource } from '../types';
import type {
  BackendWorkflow,
  WorkflowsListResponse,
  WorkflowResponse,
} from '../types/api';

// ── Default Nodes & Edges ─────────────────────────────────────────────────────

export const DEFAULT_START_NODE = {
  id: 'start-1',
  type: 'startNode',
  position: { x: 420, y: 60 },
  data: { label: 'Start', nodeType: 'START', config: { triggerType: 'MANUAL' } }
};

export const DEFAULT_END_NODE = {
  id: 'end-1',
  type: 'endNode',
  position: { x: 420, y: 400 },
  data: { label: 'End', nodeType: 'END', config: { isFault: false } }
};

export const DEFAULT_START_END_EDGE = {
  id: 'e-start-end',
  source: 'start-1',
  target: 'end-1',
  sourceHandle: 'bottom',
  targetHandle: 'top',
  type: 'flowConnector',
  style: { stroke: '#94a3b8', strokeWidth: 2 }
};

/**
 * Ensures that any workflow graph has both a START node and an END node,
 * plus connecting edges to intermediate nodes.
 */
export function ensureStartAndEndNodes(loadedNodes: any[] = [], loadedEdges: any[] = []): { nodes: any[]; edges: any[] } {
  let nodes = Array.isArray(loadedNodes) ? [...loadedNodes] : [];
  let edges = Array.isArray(loadedEdges) ? [...loadedEdges] : [];

  const hasStart = nodes.some(n => n.type === 'startNode' || n.data?.nodeType === 'START');
  const hasEnd = nodes.some(n => n.type === 'endNode' || n.data?.nodeType === 'END');

  // If completely empty, return the default start -> end
  if (nodes.length === 0) {
    return {
      nodes: [
        { ...DEFAULT_START_NODE, position: { x: 420, y: 60 } },
        { ...DEFAULT_END_NODE, position: { x: 420, y: 280 } }
      ],
      edges: [{ ...DEFAULT_START_END_EDGE }]
    };
  }

  // 1. If missing Start node, prepend it at y = 60
  let startNodeId = 'start-1';
  if (!hasStart) {
    const minY = Math.min(...nodes.map(n => n.position?.y ?? 200));
    const startY = Math.min(60, minY - 150);
    const startNode = {
      id: startNodeId,
      type: 'startNode',
      position: { x: 420, y: startY },
      data: { label: 'Start', nodeType: 'START', config: { triggerType: 'MANUAL' } }
    };
    nodes = [startNode, ...nodes];
  } else {
    const existingStart = nodes.find(n => n.type === 'startNode' || n.data?.nodeType === 'START');
    if (existingStart) startNodeId = existingStart.id;
  }

  // 2. If missing End node, append it below the lowest node
  let endNodeId = 'end-1';
  if (!hasEnd) {
    const maxY = Math.max(...nodes.map(n => n.position?.y ?? 60));
    const endY = maxY + 170;
    const endNode = {
      id: endNodeId,
      type: 'endNode',
      position: { x: 420, y: endY },
      data: { label: 'End', nodeType: 'END', config: { isFault: false } }
    };
    nodes = [...nodes, endNode];
  } else {
    const existingEnd = nodes.find(n => n.type === 'endNode' || n.data?.nodeType === 'END');
    if (existingEnd) endNodeId = existingEnd.id;
  }

  // 3. Connect Start -> intermediate -> End if missing connections
  const middleNodes = nodes.filter(n => n.id !== startNodeId && n.id !== endNodeId);
  if (middleNodes.length === 0 && edges.length === 0) {
    edges.push({
      id: `e-${startNodeId}-${endNodeId}`,
      source: startNodeId,
      target: endNodeId,
      sourceHandle: 'bottom',
      targetHandle: 'top',
      type: 'flowConnector',
      style: { stroke: '#94a3b8', strokeWidth: 2 }
    });
  } else if (middleNodes.length > 0) {
    const hasStartOut = edges.some(e => e.source === startNodeId);
    if (!hasStartOut) {
      const sorted = [...middleNodes].sort((a, b) => (a.position?.y ?? 0) - (b.position?.y ?? 0));
      edges.push({
        id: `e-${startNodeId}-${sorted[0].id}`,
        source: startNodeId,
        target: sorted[0].id,
        sourceHandle: 'bottom',
        targetHandle: 'top',
        type: 'flowConnector',
        style: { stroke: '#94a3b8', strokeWidth: 2 }
      });
    }

    const hasEndIn = edges.some(e => e.target === endNodeId);
    if (!hasEndIn) {
      const sorted = [...middleNodes].sort((a, b) => (a.position?.y ?? 0) - (b.position?.y ?? 0));
      const lastMiddle = sorted[sorted.length - 1];
      edges.push({
        id: `e-${lastMiddle.id}-${endNodeId}`,
        source: lastMiddle.id,
        target: endNodeId,
        sourceHandle: 'bottom',
        targetHandle: 'top',
        type: 'flowConnector',
        style: { stroke: '#94a3b8', strokeWidth: 2 }
      });
    }
  }

  return { nodes, edges };
}

// ── Adapter: Backend -> Frontend ──────────────────────────────────────────────

function mapBackendToFrontend(bw: BackendWorkflow): WorkflowDefinition {
  const rawDef = bw.definition || { nodes: [], edges: [] };
  const ensured = ensureStartAndEndNodes(rawDef.nodes, rawDef.edges);

  return {
    id: String(bw.id),
    organizationId: 'org-enterprise-1',
    name: bw.name,
    description: bw.description || '',
    platform: 'salesforce',
    status: 'DRAFT',
    version: bw.version,
    tags: ['Salesforce'],
    createdAt: bw.created_at,
    updatedAt: bw.updated_at,
    resources: (rawDef as any).resources || [],
    graph: {
      nodes: ensured.nodes,
      edges: ensured.edges,
    },
  };
}

// ── Public API ───────────────────────────────────────────────────────────────

export class WorkflowApi {
  /**
   * GET /api/salesforce/workflows
   * Returns all saved workflows from PostgreSQL.
   */
  public static async getWorkflows(_platform?: string): Promise<WorkflowDefinition[]> {
    const res = await ApiClient.get<WorkflowsListResponse>('/workflows');
    return (res.workflows || []).map(mapBackendToFrontend);
  }

  /**
   * GET /api/salesforce/workflows/:id
   * Returns a single workflow by its numeric database ID.
   */
  public static async getWorkflowById(id: string): Promise<WorkflowDefinition> {
    const res = await ApiClient.get<WorkflowResponse>(`/workflows/${id}`);
    if (!res.workflow) {
      throw new Error(`Workflow with ID "${id}" was not found.`);
    }
    return mapBackendToFrontend(res.workflow);
  }

  /**
   * POST /api/salesforce/workflows (without id -> INSERT)
   * Creates a brand new workflow. Returns the created workflow with its new DB id and version 1.
   * Ensures Start and End nodes exist by default.
   */
  public static async createWorkflow(payload: Partial<WorkflowDefinition>): Promise<WorkflowDefinition> {
    const rawNodes = payload.graph?.nodes || [];
    const rawEdges = payload.graph?.edges || [];
    const ensured = ensureStartAndEndNodes(rawNodes, rawEdges);

    const definition: any = {
      nodes: ensured.nodes,
      edges: ensured.edges,
    };
    if (payload.resources && payload.resources.length > 0) {
      definition.resources = payload.resources;
    }

    const res = await ApiClient.post<WorkflowResponse>('/workflows', {
      name: payload.name || 'Untitled Workflow',
      description: payload.description || '',
      definition,
    });
    return mapBackendToFrontend(res.workflow);
  }

  /**
   * POST /api/salesforce/workflows (with id -> UPDATE)
   * Updates an existing workflow. Version auto-increments on the backend.
   */
  public static async updateWorkflow(
    id: string,
    updates: Partial<WorkflowDefinition & { resources?: FlowResource[] }>
  ): Promise<WorkflowDefinition> {
    let nameToSend = updates.name;
    if (!nameToSend) {
      try {
        const current = await this.getWorkflowById(id);
        nameToSend = current.name;
      } catch {
        nameToSend = 'Untitled Workflow';
      }
    }

    const body: Record<string, any> = {
      id: Number(id),
      name: nameToSend,
    };

    if (updates.description !== undefined) {
      body.description = updates.description;
    }

    if (updates.graph || updates.resources !== undefined) {
      const rawNodes = updates.graph?.nodes || [];
      const rawEdges = updates.graph?.edges || [];
      const ensured = ensureStartAndEndNodes(rawNodes, rawEdges);

      const definition: any = {
        nodes: ensured.nodes,
        edges: ensured.edges,
      };
      if (updates.resources !== undefined) {
        definition.resources = updates.resources;
      }
      body.definition = definition;
    }

    const res = await ApiClient.post<WorkflowResponse>('/workflows', body);
    return mapBackendToFrontend(res.workflow);
  }

  /**
   * DELETE /api/salesforce/workflows/:id
   * Permanently removes the workflow from PostgreSQL.
   */
  public static async deleteWorkflow(id: string): Promise<{ success: boolean; message: string }> {
    const res = await ApiClient.delete<{ success: boolean; message: string }>(`/workflows/${id}`);
    return res;
  }
}
