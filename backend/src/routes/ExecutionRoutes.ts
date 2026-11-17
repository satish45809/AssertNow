/**
 * Execution & Test Run API Route Definitions (/api/v1/executions)
 */

import { Hono } from 'hono';
import { ExecutionController } from '../controllers/ExecutionController.ts';

export const ExecutionRoutes = new Hono();

ExecutionRoutes.get('/', ExecutionController.listExecutions);
ExecutionRoutes.get('/:id', ExecutionController.getExecution);
ExecutionRoutes.post('/trigger', ExecutionController.triggerExecution);

