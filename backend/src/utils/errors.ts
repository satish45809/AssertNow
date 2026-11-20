// Custom error classes for domain-specific failure categories.
// Guarantees consistent error codes and HTTP status codes across the application.

export abstract class AppError extends Error {
  public abstract readonly statusCode: number;
  public abstract readonly code: string;

  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class NotFoundError extends AppError {
  public readonly statusCode = 404;
  public readonly code = 'NOT_FOUND';
}

export class ValidationError extends AppError {
  public readonly statusCode = 400;
  public readonly code: string;

  constructor(message: string, code: string = 'VALIDATION_ERROR') {
    super(message);
    this.code = code;
  }
}

export class AssertionFailedError extends AppError {
  public readonly statusCode = 400;
  public readonly code = 'ASSERTION_FAILED';
}

export class SalesforceError extends AppError {
  public readonly statusCode = 502;
  public readonly code = 'SALESFORCE_ERROR';
  public readonly errorCode?: string;

  constructor(message: string, errorCode?: string) {
    super(message);
    this.errorCode = errorCode;
  }
}

export class ConnectionError extends AppError {
  public readonly statusCode = 502;
  public readonly code = 'CONNECTION_ERROR';
}

export class SystemError extends AppError {
  public readonly statusCode = 500;
  public readonly code = 'SYSTEM_ERROR';
}
