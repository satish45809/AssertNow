/**
 * Centralized Application Error Middleware
 * Prevents error swallowing and surfaces exact, typed failure details to clients.
 */

import { Context } from 'hono';
import { AppError } from '../models/Error.ts';

export class ErrorHandler {
  public static handle(err: Error, c: Context) {
    console.error(`[AssertNow Error] ${err.name}: ${err.message}`, {
      stack: err.stack,
    });

    if (err instanceof AppError) {
      return c.json(
        {
          success: false,
          error: {
            code: err.errorCode,
            message: err.message,
            details: err.details,
          },
        },
        err.statusCode as any
      );
    }

    // Unhandled / system errors
    return c.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: err.message || 'An unexpected internal server error occurred',
        },
      },
      500
    );
  }
}

