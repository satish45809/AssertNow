// Catches any HTTP request that does not match an existing endpoint.
// Forwards a clean NotFoundError with a 404 status code to the error handler.

import type { Request, Response, NextFunction } from 'express';
import { NotFoundError } from '../utils/errors.js';

export function notFound(
  request: Request,
  _response: Response,
  next: NextFunction
): void {
  const path = request.originalUrl || request.url;
  next(new NotFoundError(`Route ${request.method} ${path} not found`));
}
