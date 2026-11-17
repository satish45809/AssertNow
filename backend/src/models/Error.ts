/**
 * Application Error Hierarchy
 * Enforces strict fail-fast error handling with ZERO silent fallbacks.
 */

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly errorCode: string;
  public readonly details?: unknown;

  constructor(message: string, statusCode = 500, errorCode = 'INTERNAL_ERROR', details?: unknown) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
    (Error as any).captureStackTrace?.(this, this.constructor);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, identifier: string) {
    super(`${resource} with identifier "${identifier}" was not found`, 404, 'RESOURCE_NOT_FOUND', {
      resource,
      identifier,
    });
  }
}

export class ValidationError extends AppError {
  constructor(message: string, validationErrors?: Record<string, string[]>) {
    super(message, 400, 'VALIDATION_FAILED', validationErrors);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required or invalid credentials provided') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

export class SalesforceError extends AppError {
  public readonly salesforceErrorCode?: string;

  constructor(message: string, salesforceErrorCode?: string, rawDetails?: unknown) {
    super(
      `Salesforce Operation Failed: ${message}`,
      502,
      'SALESFORCE_INTEGRATION_ERROR',
      { salesforceErrorCode, rawDetails }
    );
    this.salesforceErrorCode = salesforceErrorCode;
  }
}

