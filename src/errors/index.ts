export class BadRequestError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string = 'Bad Request') {
    super(message);
    this.name = 'BadRequestError';
    this.statusCode = 400;
    this.isOperational = true;
  }
}

export class UnauthorizedError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string = 'Unauthorized') {
    super(message);
    this.name = 'UnauthorizedError';
    this.statusCode = 401;
    this.isOperational = true;
  }
}

export class ForbiddenError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string = 'Forbidden') {
    super(message);
    this.name = 'ForbiddenError';
    this.statusCode = 403;
    this.isOperational = true;
  }
}

export class NotFoundError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string = 'Resource not found') {
    super(message);
    this.name = 'NotFoundError';
    this.statusCode = 404;
    this.isOperational = true;
  }
}

export class ConflictError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string = 'Conflict') {
    super(message);
    this.name = 'ConflictError';
    this.statusCode = 409;
    this.isOperational = true;
  }
}

export class ValidationError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly errors?: Record<string, string>;

  constructor(message: string = 'Validation failed', errors?: Record<string, string>) {
    super(message);
    this.name = 'ValidationError';
    this.statusCode = 422;
    this.isOperational = true;
    this.errors = errors;
  }
}

export class TooManyRequestsError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string = 'Too many requests') {
    super(message);
    this.name = 'TooManyRequestsError';
    this.statusCode = 429;
    this.isOperational = true;
  }
}

export class InternalServerError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string = 'Internal server error') {
    super(message);
    this.name = 'InternalServerError';
    this.statusCode = 500;
    this.isOperational = false;
  }
}

export class ServiceUnavailableError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string = 'Service unavailable') {
    super(message);
    this.name = 'ServiceUnavailableError';
    this.statusCode = 503;
    this.isOperational = true;
  }
}
