// Catches all errors and sends back a standardized JSON error response.
// Masks internal server error details when running in production mode.

import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { env } from '../config/env.js';

export function errorHandler(
  error: Error,
  _request: Request,
  response: Response,
  // Express requires all 4 parameters to recognize this as error middleware
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  if (error instanceof AppError) {
    logger.warn({ code: error.code, message: error.message }, 'Application error handled');
    response.status(error.statusCode).json({
      success: false,
      error: {
        code: error.code,
        message: error.message
      }
    });
    return;
  }

  logger.error({ err: error }, 'Unhandled server error');

  let safeMessage = error.message;
  if (env.NODE_ENV === 'production') {
    safeMessage = 'Internal server error';
  }

  response.status(500).json({
    success: false,
    error: {
      code: 'SYSTEM_ERROR',
      message: safeMessage
    }
  });
}
