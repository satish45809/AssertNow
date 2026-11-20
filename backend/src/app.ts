// Configures the Express application with security headers, routes, and error handling.
// Health check is served outside /api/v1 so load balancers can monitor it directly.
import express, { type Express, type Request, type Response, type NextFunction } from 'express';
import { env } from './config/env.js';
import { requestLogger } from './middleware/requestLogger.js';
import { notFound } from './middleware/notFound.js';
import { errorHandler } from './middleware/errorHandler.js';

// Handles Cross-Origin Resource Sharing (CORS) headers for browsers
function handleCors(request: Request, response: Response, next: NextFunction): void {
  const incomingOrigin = request.headers.origin;

  if (incomingOrigin && env.CORS_ORIGINS.includes(incomingOrigin)) {
    response.setHeader('Access-Control-Allow-Origin', incomingOrigin);
  }

  response.setHeader(
    'Access-Control-Allow-Methods',
    'GET, POST, PUT, PATCH, DELETE, OPTIONS'
  );
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (request.method === 'OPTIONS') {
    response.sendStatus(204);
    return;
  }

  next();
}

export function createApp(): Express {
  const application = express();

  application.use(handleCors);
  application.use(express.json());
  application.use(requestLogger);

  application.get('/health', (_request: Request, response: Response) => {
    response.status(200).json({
      success: true,
      data: {
        status: 'ok',
        timestamp: new Date().toISOString()
      }
    });
  });

  application.use(notFound);
  application.use(errorHandler);

  return application;
}
