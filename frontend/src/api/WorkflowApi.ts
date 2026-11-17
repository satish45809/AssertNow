/**
 * Workflow API Service
 * Stores and manages workflows in browser localStorage (no database or file dependencies).
 */

import { WorkflowDefinition } from '../types';

const STORAGE_KEY = 'assertnow_workflows';

export class WorkflowApi {
  private static getStoredWorkflows(): WorkflowDefinition[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Normalize legacy labels: "Workflow Trigger" -> "Start", "Regression Complete (End)" -> "End"
          return parsed.map((wf: WorkflowDefinition) => ({
            ...wf,
            graph: wf.graph ? {
              ...wf.graph,
              nodes: (wf.graph.nodes || []).map((n: any) => {
                let lbl = n.data?.label;
                if (n.data?.nodeType === 'START' && (!lbl || lbl === 'Workflow Trigger')) {
                  lbl = 'Start';
                }
                if (n.data?.nodeType === 'END' && (!lbl || lbl.includes('Regression Complete'))) {
                  lbl = 'End';
                }
                return { ...n, data: { ...(n.data || {}), label: lbl } };
              })
            } : wf.graph
          }));
        }
      }
    } catch {
      // ignore
    }
    return [];
  }

  private static setStoredWorkflows(workflows: WorkflowDefinition[]): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(workflows));
    } catch (err) {
      console.error('Failed to save workflows to localStorage:', err);
    }
  }

  public static async getWorkflows(_platform?: string): Promise<WorkflowDefinition[]> {
    return this.getStoredWorkflows();
  }

  public static async getWorkflowById(id: string): Promise<WorkflowDefinition> {
    const list = this.getStoredWorkflows();
    const wf = list.find(w => w.id === id);
    if (!wf) {
      throw new Error(`Workflow suite with ID "${id}" was not found in localStorage.`);
    }
    return wf;
  }

  public static async createWorkflow(payload: Partial<WorkflowDefinition>): Promise<WorkflowDefinition> {
    const list = this.getStoredWorkflows();
    const newWf: WorkflowDefinition = {
      id: `wf-${Date.now()}`,
      organizationId: 'org-enterprise-1',
      name: payload.name || 'Salesforce Regression Workflow',
      description: payload.description || 'Custom regression suite created in Studio',
      platform: 'salesforce',
      status: 'DRAFT',
      version: 1,
      tags: payload.tags || ['Salesforce', 'Draft'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      graph: payload.graph || {
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
      }
    };

    list.unshift(newWf);
    this.setStoredWorkflows(list);
    return newWf;
  }

  public static async updateWorkflow(id: string, payload: Partial<WorkflowDefinition>): Promise<WorkflowDefinition> {
    const list = this.getStoredWorkflows();
    const index = list.findIndex(w => w.id === id);
    if (index === -1) {
      throw new Error(`Workflow with ID "${id}" was not found.`);
    }

    const current = list[index];
    const updated: WorkflowDefinition = {
      ...current,
      ...payload,
      updatedAt: new Date().toISOString(),
      version: payload.graph ? current.version + 1 : current.version,
    };

    list[index] = updated;
    this.setStoredWorkflows(list);
    return updated;
  }

  public static async deleteWorkflow(id: string): Promise<{ success: boolean; message: string }> {
    const list = this.getStoredWorkflows();
    const filtered = list.filter(w => w.id !== id);
    this.setStoredWorkflows(filtered);
    return { success: true, message: 'Workflow removed from localStorage successfully' };
  }
}
