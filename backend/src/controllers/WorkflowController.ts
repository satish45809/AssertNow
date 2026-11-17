/**
 * Workflow HTTP Controller
 * Manages test suites and visual studio graphs.
 */

import { Context } from 'hono';
import { WorkflowService } from '../services/WorkflowService.ts';

export class WorkflowController {
  public static async listWorkflows(c: Context) {
    const platform = c.req.query('platform');
    const workflows = await WorkflowService.listWorkflows(platform);
    return c.json({ success: true, count: workflows.length, data: workflows }, 200);
  }

  public static async getWorkflow(c: Context) {
    const id = c.req.param('id') || '';
    const workflow = await WorkflowService.getWorkflowById(id);
    return c.json({ success: true, data: workflow }, 200);
  }

  public static async createWorkflow(c: Context) {
    const body = await c.req.json();
    const workflow = await WorkflowService.createWorkflow(body);
    return c.json({ success: true, data: workflow }, 201);
  }

  public static async updateWorkflow(c: Context) {
    const id = c.req.param('id') || '';
    const body = await c.req.json();
    const updated = await WorkflowService.updateWorkflow(id, body);
    return c.json({ success: true, data: updated }, 200);
  }

  public static async deleteWorkflow(c: Context) {
    const id = c.req.param('id') || '';
    await WorkflowService.deleteWorkflow(id);
    return c.json({ success: true, message: `Workflow ${id} deleted successfully` }, 200);
  }
}
