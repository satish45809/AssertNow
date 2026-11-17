/**
 * Workflow Suite API Route Definitions (/api/v1/workflows)
 */

import { Hono } from 'hono';
import { WorkflowController } from '../controllers/WorkflowController.ts';

export const WorkflowRoutes = new Hono();

WorkflowRoutes.get('/', WorkflowController.listWorkflows);
WorkflowRoutes.get('/:id', WorkflowController.getWorkflow);
WorkflowRoutes.post('/', WorkflowController.createWorkflow);
WorkflowRoutes.put('/:id', WorkflowController.updateWorkflow);
WorkflowRoutes.delete('/:id', WorkflowController.deleteWorkflow);

