/**
 * Central Hono Application Setup
 * Configures middleware, error handlers, and route aggregation.
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { ErrorHandler } from './middleware/ErrorHandler.ts';
import { RequestLogger } from './middleware/RequestLogger.ts';
import { SalesforceRoutes } from './routes/SalesforceRoutes.ts';
import { WorkflowRoutes } from './routes/WorkflowRoutes.ts';
import { ExecutionRoutes } from './routes/ExecutionRoutes.ts';

export const App = new Hono();

// Global Middleware
App.use('*', cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

App.use('*', RequestLogger.log);

// System Health Endpoint
App.get('/health', (c) => c.json({
  status: 'healthy',
  service: 'AssertNow Engine API',
  runtime: 'Deno 2.9.8',
  timestamp: new Date().toISOString(),
}, 200));

// API v1 Routes
App.route('/api/v1/salesforce', SalesforceRoutes);
App.route('/api/v1/workflows', WorkflowRoutes);
App.route('/api/v1/executions', ExecutionRoutes);

// Explicit 404 Route Handler (No Fallbacks!)
App.notFound((c) => {
  return c.json(
    {
      success: false,
      error: {
        code: 'ROUTE_NOT_FOUND',
        message: `Endpoint ${c.req.method} ${c.req.path} does not exist on AssertNow API.`,
      },
    },
    404
  );
});

// Centralized Error Boundary
App.onError((err, c) => ErrorHandler.handle(err, c));

