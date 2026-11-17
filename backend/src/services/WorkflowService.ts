/**
 * Workflow Business Service
 * In-memory runtime store (zero file persistence, workflows stored in browser localStorage).
 */

import { Workflow, CreateWorkflowDto, UpdateWorkflowDto, WorkflowGraph } from '../models/Workflow.ts';
import { NotFoundError, ValidationError } from '../models/Error.ts';

export class WorkflowService {
  private static workflows: Workflow[] = [];

  public static async listWorkflows(platform?: string): Promise<Workflow[]> {
    if (!platform || platform === 'all') {
      return this.workflows;
    }
    return this.workflows.filter(w => w.platform === platform);
  }

  public static async getWorkflowById(id: string): Promise<Workflow> {
    const wf = this.workflows.find(w => w.id === id);
    if (!wf) {
      throw new NotFoundError('Workflow Suite', id);
    }
    return wf;
  }

  public static async createWorkflow(dto: CreateWorkflowDto): Promise<Workflow> {
    if (!dto.name) {
      throw new ValidationError('Workflow suite name is required.');
    }

    const defaultGraph: WorkflowGraph = dto.graph && dto.graph.nodes?.length > 0 ? dto.graph : {
      nodes: [
        {
          id: 'start-1',
          type: 'startNode',
          position: { x: 420, y: 60 },
          data: { label: 'Start', nodeType: 'START', config: { triggerType: 'MANUAL' } }
        },
        {
          id: 'end-1',
          type: 'endNode',
          position: { x: 420, y: 280 },
          data: { label: 'End', nodeType: 'END', config: { isFault: false } }
        }
      ],
      edges: [
        {
          id: 'e-start-end',
          source: 'start-1',
          target: 'end-1',
          sourceHandle: 'bottom',
          targetHandle: 'top',
          type: 'flowConnector',
          style: { stroke: '#94a3b8', strokeWidth: 2 }
        }
      ]
    };

    const newWf: Workflow = {
      id: `wf-${Date.now()}`,
      organizationId: 'org-enterprise-1',
      name: dto.name,
      description: dto.description || 'Custom regression suite created in AssertNow Studio',
      platform: dto.platform || 'salesforce',
      environmentId: dto.environmentId,
      status: 'DRAFT',
      version: 1,
      tags: dto.tags || ['Regression', 'Draft'],
      graph: defaultGraph,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.workflows.unshift(newWf);
    return newWf;
  }

  public static async updateWorkflow(id: string, dto: UpdateWorkflowDto): Promise<Workflow> {
    const wf = await this.getWorkflowById(id);

    if (dto.name) wf.name = dto.name;
    if (dto.description !== undefined) wf.description = dto.description;
    if (dto.status) wf.status = dto.status;
    if (dto.tags) wf.tags = dto.tags;
    if (dto.graph) {
      wf.graph = dto.graph;
      wf.version += 1;
    }
    wf.updatedAt = new Date().toISOString();

    return wf;
  }

  public static async deleteWorkflow(id: string): Promise<void> {
    const index = this.workflows.findIndex(w => w.id === id);
    if (index === -1) {
      throw new NotFoundError('Workflow Suite', id);
    }
    this.workflows.splice(index, 1);
  }
}
