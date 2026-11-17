/**
 * Execution & Test Run HTTP Controller
 */

import { Context } from 'hono';
import { ExecutionService } from '../services/ExecutionService.ts';

export class ExecutionController {
  public static async listExecutions(c: Context) {
    const workflowId = c.req.query('workflowId');
    const executions = await ExecutionService.listExecutions(workflowId);
    return c.json({ success: true, count: executions.length, data: executions }, 200);
  }

  public static async getExecution(c: Context) {
    const id = c.req.param('id') || '';
    const execution = await ExecutionService.getExecutionById(id);
    return c.json({ success: true, data: execution }, 200);
  }

  public static async triggerExecution(c: Context) {
    const body = await c.req.json();
    const execution = await ExecutionService.triggerExecution(body);
    return c.json({ success: true, data: execution }, 201);
  }
}
