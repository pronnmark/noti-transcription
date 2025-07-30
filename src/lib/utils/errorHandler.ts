import { ValidationError } from '../errors';

export interface ErrorContext {
  service?: string;
  operation?: string;
  metadata?: Record<string, any>;
  userId?: string;
  requestId?: string;
}

export interface ErrorDetails {
  code: string;
  message: string;
  context?: ErrorContext;
  timestamp: string;
  stack?: string;
}

/**
 * Centralized error handling utilities to eliminate repeated error handling patterns
 */
export class ErrorHandler {
  private static readonly ERROR_CODES = {
    VALIDATION_FAILED: 'VALIDATION_FAILED',
    CONFIGURATION_ERROR: 'CONFIGURATION_ERROR', 
    NETWORK_ERROR: 'NETWORK_ERROR',
    DATABASE_ERROR: 'DATABASE_ERROR',
    STORAGE_ERROR: 'STORAGE_ERROR',
    AI_SERVICE_ERROR: 'AI_SERVICE_ERROR',
    TRANSCRIPTION_ERROR: 'TRANSCRIPTION_ERROR',
    FILE_PROCESSING_ERROR: 'FILE_PROCESSING_ERROR',
    AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
    AUTHORIZATION_ERROR: 'AUTHORIZATION_ERROR',
    RATE_LIMIT_ERROR: 'RATE_LIMIT_ERROR',
    TIMEOUT_ERROR: 'TIMEOUT_ERROR',
    UNKNOWN_ERROR: 'UNKNOWN_ERROR',
  } as const;

  /**
   * Standardized error logging with consistent format
   */
  static logError(error: Error, context: ErrorContext = {}): ErrorDetails {
    const errorDetails: ErrorDetails = {
      code: this.getErrorCode(error),
      message: error.message,
      context,
      timestamp: new Date().toISOString(),
      stack: error.stack,
    };

    // Format log output
    const logContext = context.service 
      ? `[${context.service}${context.operation ? `:${context.operation}` : ''}]`
      : '[ErrorHandler]';

    console.error(`${logContext} ${errorDetails.code}:`, errorDetails.message);
    
    if (context.metadata) {
      console.error(`${logContext} Context:`, context.metadata);
    }

    if (process.env.NODE_ENV === 'development' && error.stack) {
      console.error(`${logContext} Stack:`, error.stack);
    }

    return errorDetails;
  }

  /**
   * Determine error code based on error type and message
   */
  private static getErrorCode(error: Error): string {
    if (error instanceof ValidationError) {
      return this.ERROR_CODES.VALIDATION_FAILED;
    }

    const message = error.message.toLowerCase();

    // Network-related errors
    if (message.includes('fetch') || 
        message.includes('network') || 
        message.includes('connection') ||
        message.includes('econnreset') ||
        message.includes('enotfound')) {
      return this.ERROR_CODES.NETWORK_ERROR;
    }

    // Timeout errors
    if (message.includes('timeout') || message.includes('timed out')) {
      return this.ERROR_CODES.TIMEOUT_ERROR;
    }

    // Rate limiting
    if (message.includes('rate limit') || message.includes('429')) {
      return this.ERROR_CODES.RATE_LIMIT_ERROR;
    }

    // Authentication/Authorization
    if (message.includes('unauthorized') || message.includes('401')) {
      return this.ERROR_CODES.AUTHENTICATION_ERROR;
    }

    if (message.includes('forbidden') || message.includes('403')) {
      return this.ERROR_CODES.AUTHORIZATION_ERROR;
    }

    // Database errors
    if (message.includes('database') || 
        message.includes('supabase') ||
        message.includes('sql') ||
        message.includes('query')) {
      return this.ERROR_CODES.DATABASE_ERROR;
    }

    // Storage errors
    if (message.includes('storage') || 
        message.includes('bucket') ||
        message.includes('upload') ||
        message.includes('download')) {
      return this.ERROR_CODES.STORAGE_ERROR;
    }

    // AI service errors
    if (message.includes('ai') || 
        message.includes('model') ||
        message.includes('llm') ||
        message.includes('anthropic') ||
        message.includes('openai')) {
      return this.ERROR_CODES.AI_SERVICE_ERROR;
    }

    // Transcription errors
    if (message.includes('transcription') || 
        message.includes('whisper') ||
        message.includes('audio processing')) {
      return this.ERROR_CODES.TRANSCRIPTION_ERROR;
    }

    // File processing errors
    if (message.includes('file') && 
        (message.includes('processing') || 
         message.includes('conversion') ||
         message.includes('invalid format'))) {
      return this.ERROR_CODES.FILE_PROCESSING_ERROR;
    }

    // Configuration errors
    if (message.includes('configuration') || 
        message.includes('environment') ||
        message.includes('config')) {
      return this.ERROR_CODES.CONFIGURATION_ERROR;
    }

    return this.ERROR_CODES.UNKNOWN_ERROR;
  }

  /**
   * Standardized async operation error handling with retries
   */
  static async handleWithRetry<T>(
    operation: () => Promise<T>,
    context: ErrorContext,
    maxRetries: number = 3,
    retryDelay: number = 1000
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        const errorDetails = this.logError(lastError, {
          ...context,
          metadata: { ...context.metadata, attempt, maxRetries }
        });

        // Don't retry certain error types
        if (!this.isRetryableError(errorDetails.code)) {
          throw lastError;
        }

        if (attempt === maxRetries) {
          break;
        }

        // Calculate delay with exponential backoff and jitter
        const delay = retryDelay * Math.pow(2, attempt - 1);
        const jitter = Math.random() * 0.1 * delay;
        const totalDelay = Math.floor(delay + jitter);

        console.warn(`[${context.service || 'ErrorHandler'}] Retrying in ${totalDelay}ms (attempt ${attempt}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, totalDelay));
      }
    }

    throw lastError!;
  }

  /**
   * Determine if an error should be retried
   */
  private static isRetryableError(errorCode: string): boolean {
    const retryableErrors = [
      this.ERROR_CODES.NETWORK_ERROR,
      this.ERROR_CODES.TIMEOUT_ERROR,
      this.ERROR_CODES.RATE_LIMIT_ERROR,
    ];

    return retryableErrors.includes(errorCode as any);
  }

  /**
   * Standardized service method wrapper with error handling
   */
  static async serviceMethod<T>(
    operation: () => Promise<T>,
    context: ErrorContext
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logError(err, context);
      throw err;
    }
  }

  /**
   * Create standardized error response for API endpoints
   */
  static createErrorResponse(
    error: Error, 
    context: ErrorContext = {}
  ): { error: string; code: string; timestamp: string; details?: any } {
    const errorDetails = this.logError(error, context);
    
    return {
      error: error.message,
      code: errorDetails.code,
      timestamp: errorDetails.timestamp,
      // Only include sensitive details in development
      ...(process.env.NODE_ENV === 'development' && {
        details: errorDetails.context?.metadata
      })
    };
  }

  /**
   * Check if error is a specific type
   */
  static isErrorType(error: Error, type: keyof typeof ErrorHandler.ERROR_CODES): boolean {
    return this.getErrorCode(error) === this.ERROR_CODES[type];
  }

  /**
   * Sanitize error message for client consumption (remove sensitive info)
   */
  static sanitizeErrorMessage(error: Error): string {
    let message = error.message;

    // Remove potential sensitive information
    const sensitivePatterns = [
      /api[_-]?key[=:\s]+[^\s\n]*/gi,
      /password[=:\s]+[^\s\n]*/gi,
      /token[=:\s]+[^\s\n]*/gi,
      /secret[=:\s]+[^\s\n]*/gi,
      /auth[=:\s]+[^\s\n]*/gi,
    ];

    sensitivePatterns.forEach(pattern => {
      message = message.replace(pattern, '[REDACTED]');
    });

    return message;
  }

  /**
   * Create user-friendly error messages
   */
  static getUserFriendlyMessage(error: Error): string {
    const code = this.getErrorCode(error);

    const friendlyMessages: Record<string, string> = {
      [this.ERROR_CODES.VALIDATION_FAILED]: 'The provided information is invalid. Please check your input and try again.',
      [this.ERROR_CODES.CONFIGURATION_ERROR]: 'There is a configuration issue. Please contact support.',
      [this.ERROR_CODES.NETWORK_ERROR]: 'Unable to connect to the service. Please check your internet connection and try again.',
      [this.ERROR_CODES.DATABASE_ERROR]: 'Database operation failed. Please try again later.',
      [this.ERROR_CODES.STORAGE_ERROR]: 'File storage operation failed. Please try again.',
      [this.ERROR_CODES.AI_SERVICE_ERROR]: 'AI service unavailable. Please try again later.',
      [this.ERROR_CODES.TRANSCRIPTION_ERROR]: 'Audio transcription failed. Please try with a different file.',
      [this.ERROR_CODES.FILE_PROCESSING_ERROR]: 'File processing failed. Please check the file format and try again.',
      [this.ERROR_CODES.AUTHENTICATION_ERROR]: 'Authentication failed. Please log in again.',
      [this.ERROR_CODES.AUTHORIZATION_ERROR]: 'You do not have permission to perform this action.',
      [this.ERROR_CODES.RATE_LIMIT_ERROR]: 'Too many requests. Please wait a moment and try again.',
      [this.ERROR_CODES.TIMEOUT_ERROR]: 'The operation timed out. Please try again.',
      [this.ERROR_CODES.UNKNOWN_ERROR]: 'An unexpected error occurred. Please try again later.',
    };

    return friendlyMessages[code] || friendlyMessages[this.ERROR_CODES.UNKNOWN_ERROR];
  }
}