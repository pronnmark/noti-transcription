// Core error classes
export * from './AppError';
export * from './ValidationError';

// Error handling infrastructure
export * from './ErrorHandler';

// Import the classes for use in factory functions
import { AppError } from './AppError';
import { ValidationError } from './ValidationError';

// Re-export commonly used items
export { errorHandler } from './ErrorHandler';

// Utility functions for error handling
export function isAppError(
  error: unknown
): error is import('./AppError').AppError {
  return error instanceof Error && 'code' in error && 'severity' in error;
}

export function isValidationError(
  error: unknown
): error is import('./ValidationError').ValidationError {
  return error instanceof Error && error.name === 'ValidationError';
}

// Error factory functions for common scenarios
export const createError = {
  validation: (message: string, field?: string, value?: any) => {
    return new ValidationError(message, field, value);
  },

  notFound: (resource: string, id?: string | number) => {
    return AppError.notFound(resource, id);
  },

  unauthorized: (message?: string) => {
    return AppError.unauthorized(message);
  },

  forbidden: (message?: string) => {
    return AppError.forbidden(message);
  },

  conflict: (message: string) => {
    return AppError.conflict(message);
  },

  internal: (message: string, cause?: Error) => {
    return AppError.internal(message, cause);
  },
};
