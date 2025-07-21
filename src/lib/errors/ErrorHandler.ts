import { AppError, ErrorCode, ErrorSeverity } from './AppError';
import { ValidationError } from './ValidationError';
import { DatabaseError } from './DatabaseError';
import { AIServiceError } from './AIServiceError';

export interface ErrorHandlerOptions {
  logErrors?: boolean;
  reportErrors?: boolean;
  includeStackTrace?: boolean;
  sanitizeErrors?: boolean;
  maxStackTraceLength?: number;
}

export interface ErrorResponse {
  error: {
    message: string;
    code: string;
    statusCode: number;
    severity: string;
    timestamp: string;
    requestId?: string;
    details?: any;
    stackTrace?: string;
  };
}

export class ErrorHandler {
  private options: Required<ErrorHandlerOptions>;
  private errorReporters: Array<(error: AppError) => Promise<void>> = [];

  constructor(options: ErrorHandlerOptions = {}) {
    this.options = {
      logErrors: true,
      reportErrors: true,
      includeStackTrace: process.env.NODE_ENV === 'development',
      sanitizeErrors: process.env.NODE_ENV === 'production',
      maxStackTraceLength: 2000,
      ...options,
    };
  }

  // Add error reporter (e.g., Sentry, custom logging service)
  addReporter(reporter: (error: AppError) => Promise<void>): void {
    this.errorReporters.push(reporter);
  }

  // Handle error and return formatted response
  async handleError(error: unknown, requestId?: string): Promise<ErrorResponse> {
    const appError = this.normalizeError(error, requestId);
    
    // Log error if enabled
    if (this.options.logErrors) {
      this.logError(appError);
    }

    // Report error if enabled and it's not operational
    if (this.options.reportErrors && (!appError.isOperational || appError.severity === ErrorSeverity.CRITICAL)) {
      await this.reportError(appError);
    }

    // Return formatted response
    return this.formatErrorResponse(appError);
  }

  // Normalize any error to AppError
  private normalizeError(error: unknown, requestId?: string): AppError {
    if (error instanceof AppError) {
      // Add request ID if not already present
      if (requestId && !error.metadata.requestId) {
        error.metadata.requestId = requestId;
      }
      return error;
    }

    if (error instanceof Error) {
      // Convert known error types
      if (error.name === 'ValidationError' || error.message.includes('validation')) {
        return new ValidationError(error.message, undefined, undefined, [], { requestId });
      }

      if (error.name === 'DatabaseError' || error.message.includes('database')) {
        return DatabaseError.query('Database operation failed', [], error);
      }

      if (error.name === 'TimeoutError' || error.message.includes('timeout')) {
        return AppError.timeout(error.message, { requestId });
      }

      // Generic error conversion
      return AppError.internal(
        error.message || 'An unexpected error occurred',
        error,
        { requestId }
      );
    }

    // Handle non-Error objects
    const message = typeof error === 'string' ? error : 'An unknown error occurred';
    return AppError.internal(message, undefined, { requestId, originalError: error });
  }

  // Log error with appropriate level
  private logError(error: AppError): void {
    const logData = {
      message: error.message,
      code: error.code,
      severity: error.severity,
      statusCode: error.statusCode,
      metadata: error.metadata,
      stack: error.stack,
    };

    switch (error.severity) {
      case ErrorSeverity.CRITICAL:
        console.error('🚨 CRITICAL ERROR:', logData);
        break;
      case ErrorSeverity.HIGH:
        console.error('❌ HIGH SEVERITY ERROR:', logData);
        break;
      case ErrorSeverity.MEDIUM:
        console.warn('⚠️ MEDIUM SEVERITY ERROR:', logData);
        break;
      case ErrorSeverity.LOW:
        console.info('ℹ️ LOW SEVERITY ERROR:', logData);
        break;
      default:
        console.log('📝 ERROR:', logData);
    }
  }

  // Report error to external services
  private async reportError(error: AppError): Promise<void> {
    const reportPromises = this.errorReporters.map(async (reporter) => {
      try {
        await reporter(error);
      } catch (reporterError) {
        console.error('Error reporter failed:', reporterError);
      }
    });

    await Promise.allSettled(reportPromises);
  }

  // Format error for API response
  private formatErrorResponse(error: AppError): ErrorResponse {
    const response: ErrorResponse = {
      error: {
        message: this.options.sanitizeErrors ? this.getSanitizedMessage(error) : error.message,
        code: error.code,
        statusCode: error.statusCode,
        severity: error.severity,
        timestamp: error.metadata.timestamp.toISOString(),
        requestId: error.metadata.requestId,
      },
    };

    // Add details for validation errors
    if (error instanceof ValidationError && error.rules.length > 0) {
      response.error.details = error.getValidationErrors();
    }

    // Add stack trace in development
    if (this.options.includeStackTrace && error.stack) {
      response.error.stackTrace = this.truncateStackTrace(error.stack);
    }

    return response;
  }

  // Get sanitized error message for production
  private getSanitizedMessage(error: AppError): string {
    // Return user-friendly messages for known error types
    if (error instanceof ValidationError) {
      return 'Invalid input provided. Please check your data and try again.';
    }

    if (error instanceof DatabaseError) {
      return error.getUserMessage();
    }

    if (error instanceof AIServiceError) {
      return error.getUserMessage();
    }

    // Generic messages based on error code
    switch (error.code) {
      case ErrorCode.NOT_FOUND:
        return 'The requested resource was not found.';
      case ErrorCode.UNAUTHORIZED:
        return 'Authentication required.';
      case ErrorCode.FORBIDDEN:
        return 'Access denied.';
      case ErrorCode.CONFLICT:
        return 'The request conflicts with the current state.';
      case ErrorCode.RATE_LIMIT_EXCEEDED:
        return 'Too many requests. Please try again later.';
      case ErrorCode.SERVICE_UNAVAILABLE:
        return 'Service temporarily unavailable. Please try again later.';
      default:
        return 'An error occurred. Please try again later.';
    }
  }

  // Truncate stack trace if too long
  private truncateStackTrace(stackTrace: string): string {
    if (stackTrace.length <= this.options.maxStackTraceLength) {
      return stackTrace;
    }

    return stackTrace.substring(0, this.options.maxStackTraceLength) + '\n... (truncated)';
  }

  // Static method for quick error handling
  static async handle(error: unknown, requestId?: string): Promise<ErrorResponse> {
    const handler = new ErrorHandler();
    return handler.handleError(error, requestId);
  }

  // Helper method to check if error should be retried
  static shouldRetry(error: unknown): boolean {
    if (error instanceof DatabaseError || error instanceof AIServiceError) {
      return error.isRetryable();
    }

    if (error instanceof AppError) {
      const retryableCodes = [
        ErrorCode.TIMEOUT_ERROR,
        ErrorCode.NETWORK_ERROR,
        ErrorCode.SERVICE_UNAVAILABLE,
        ErrorCode.RATE_LIMIT_EXCEEDED,
      ];
      return retryableCodes.includes(error.code);
    }

    return false;
  }

  // Helper method to get retry delay
  static getRetryDelay(error: unknown): number {
    if (error instanceof AIServiceError) {
      return error.getRetryDelay();
    }

    if (error instanceof AppError) {
      switch (error.code) {
        case ErrorCode.RATE_LIMIT_EXCEEDED:
          return 60000; // 1 minute
        case ErrorCode.TIMEOUT_ERROR:
          return 5000; // 5 seconds
        case ErrorCode.NETWORK_ERROR:
          return 2000; // 2 seconds
        case ErrorCode.SERVICE_UNAVAILABLE:
          return 30000; // 30 seconds
        default:
          return 1000; // 1 second
      }
    }

    return 1000; // Default 1 second
  }
}

// Export singleton instance
export const errorHandler = new ErrorHandler();
