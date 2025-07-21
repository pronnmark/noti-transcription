// Core error classes
export * from './AppError';
export * from './ValidationError';
export * from './DatabaseError';
export * from './AIServiceError';

// Error handling infrastructure
export * from './ErrorHandler';
export * from './ErrorReporter';

// Re-export commonly used items
export { errorHandler } from './ErrorHandler';

// Utility functions for error handling
export function isAppError(error: unknown): error is import('./AppError').AppError {
  return error instanceof Error && 'code' in error && 'severity' in error;
}

export function isValidationError(error: unknown): error is import('./ValidationError').ValidationError {
  return error instanceof Error && error.name === 'ValidationError';
}

export function isDatabaseError(error: unknown): error is import('./DatabaseError').DatabaseError {
  return error instanceof Error && error.name === 'DatabaseError';
}

export function isAIServiceError(error: unknown): error is import('./AIServiceError').AIServiceError {
  return error instanceof Error && error.name === 'AIServiceError';
}

// Error factory functions for common scenarios
export const createError = {
  validation: (message: string, field?: string, value?: any) => {
    const { ValidationError } = require('./ValidationError');
    return new ValidationError(message, field, value);
  },

  notFound: (resource: string, id?: string | number) => {
    const { AppError } = require('./AppError');
    return AppError.notFound(resource, id);
  },

  unauthorized: (message?: string) => {
    const { AppError } = require('./AppError');
    return AppError.unauthorized(message);
  },

  forbidden: (message?: string) => {
    const { AppError } = require('./AppError');
    return AppError.forbidden(message);
  },

  conflict: (message: string) => {
    const { AppError } = require('./AppError');
    return AppError.conflict(message);
  },

  internal: (message: string, cause?: Error) => {
    const { AppError } = require('./AppError');
    return AppError.internal(message, cause);
  },

  database: (message: string, cause?: Error) => {
    const { DatabaseError } = require('./DatabaseError');
    return new DatabaseError(message, undefined, cause);
  },

  aiService: (message: string, provider?: string, cause?: Error) => {
    const { AIServiceError } = require('./AIServiceError');
    return new AIServiceError(message, undefined, undefined, cause, { provider });
  },
};
