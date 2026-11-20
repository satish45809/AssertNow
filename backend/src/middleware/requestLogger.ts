// Logs every incoming HTTP request and records how long it took to finish.
// Gives visibility into API traffic while keeping private data safe.

import type { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';

export function requestLogger(
  request: Request,
  response: Response,
  next: NextFunction
): void {
  const startTime = Date.now();

  response.on('finish', () => {
    const durationMilliseconds = Date.now() - startTime;
    logger.info(
      {
        method: request.method,
        url: request.originalUrl || request.url,
        statusCode: response.statusCode,
        durationMs: durationMilliseconds
      },
      'HTTP request completed'
    );
  });

  next();
}
