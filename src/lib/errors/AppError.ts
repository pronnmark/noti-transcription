export enum ErrorCode {
  // General errors
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',

  // Validation errors
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_INPUT = 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
  INVALID_FORMAT = 'INVALID_FORMAT',

  // Authentication/Authorization errors
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',

  // Resource errors
  NOT_FOUND = 'NOT_FOUND',
  ALREADY_EXISTS = 'ALREADY_EXISTS',
  CONFLICT = 'CONFLICT',
  RESOURCE_LOCKED = 'RESOURCE_LOCKED',

  // Database errors
  DATABASE_ERROR = 'DATABASE_ERROR',
  DATABASE_CONNECTION_ERROR = 'DATABASE_CONNECTION_ERROR',
  TRANSACTION_ERROR = 'TRANSACTION_ERROR',
  CONSTRAINT_VIOLATION = 'CONSTRAINT_VIOLATION',

  // File/Storage errors
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',
  INVALID_FILE_TYPE = 'INVALID_FILE_TYPE',
  STORAGE_ERROR = 'STORAGE_ERROR',
  UPLOAD_ERROR = 'UPLOAD_ERROR',

  // AI/Processing errors
  AI_SERVICE_ERROR = 'AI_SERVICE_ERROR',
  AI_QUOTA_EXCEEDED = 'AI_QUOTA_EXCEEDED',
  AI_INVALID_RESPONSE = 'AI_INVALID_RESPONSE',
  TRANSCRIPTION_ERROR = 'TRANSCRIPTION_ERROR',
  EXTRACTION_ERROR = 'EXTRACTION_ERROR',

  // Network/External errors
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',

  // Configuration errors
  CONFIGURATION_ERROR = 'CONFIGURATION_ERROR',
  MISSING_CONFIGURATION = 'MISSING_CONFIGURATION',
  INVALID_CONFIGURATION = 'INVALID_CONFIGURATION',
}

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export interface ErrorContext {
  [key: string]: any;
}

export interface ErrorMetadata {
  timestamp: Date;
  requestId?: string;
  userId?: string;
  sessionId?: string;
  userAgent?: string;
  ip?: string;
  url?: string;
  method?: string;
  service?: string;
  operation?: string;
  duration?: number;
  stackTrace?: string;
  context?: ErrorContext;
}

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly severity: ErrorSeverity;
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly metadata: ErrorMetadata;
  public readonly cause?: Error;

  constructor(
    message: string,
    code: ErrorCode = ErrorCode.UNKNOWN_ERROR,
    statusCode: number = 500,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    isOperational: boolean = true,
    metadata: Partial<ErrorMetadata> = {},
    cause?: Error
  ) {
    super(message);

    this.name = this.constructor.name;
    this.code = code;
    this.severity = severity;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.cause = cause;

    this.metadata = {
      timestamp: new Date(),
      stackTrace: this.stack,
      ...metadata,
    };

    // Maintain proper stack trace for V8
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  toJSON(): object {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      severity: this.severity,
      statusCode: this.statusCode,
      isOperational: this.isOperational,
      metadata: this.metadata,
      cause: this.cause
        ? {
            name: this.cause.name,
            message: this.cause.message,
            stack: this.cause.stack,
          }
        : undefined,
    };
  }

  toString(): string {
    return `${this.name}: ${this.message} (${this.code})`;
  }

  // Static factory methods for common error types
  static validation(message: string, context?: ErrorContext): AppError {
    return new AppError(
      message,
      ErrorCode.VALIDATION_ERROR,
      400,
      ErrorSeverity.LOW,
      true,
      { context }
    );
  }

  static notFound(resource: string, id?: string | number): AppError {
    const message = id
      ? `${resource} with id '${id}' not found`
      : `${resource} not found`;
    return new AppError(
      message,
      ErrorCode.NOT_FOUND,
      404,
      ErrorSeverity.LOW,
      true,
      { context: { resource, id } }
    );
  }

  static unauthorized(message: string = 'Unauthorized access'): AppError {
    return new AppError(
      message,
      ErrorCode.UNAUTHORIZED,
      401,
      ErrorSeverity.MEDIUM,
      true
    );
  }

  static forbidden(message: string = 'Access forbidden'): AppError {
    return new AppError(
      message,
      ErrorCode.FORBIDDEN,
      403,
      ErrorSeverity.MEDIUM,
      true
    );
  }

  static conflict(message: string, context?: ErrorContext): AppError {
    return new AppError(
      message,
      ErrorCode.CONFLICT,
      409,
      ErrorSeverity.LOW,
      true,
      { context }
    );
  }

  static internal(
    message: string,
    cause?: Error,
    context?: ErrorContext
  ): AppError {
    return new AppError(
      message,
      ErrorCode.INTERNAL_SERVER_ERROR,
      500,
      ErrorSeverity.HIGH,
      false,
      { context },
      cause
    );
  }

  static database(
    message: string,
    cause?: Error,
    context?: ErrorContext
  ): AppError {
    return new AppError(
      message,
      ErrorCode.DATABASE_ERROR,
      500,
      ErrorSeverity.HIGH,
      true,
      { context },
      cause
    );
  }

  static aiService(
    message: string,
    cause?: Error,
    context?: ErrorContext
  ): AppError {
    return new AppError(
      message,
      ErrorCode.AI_SERVICE_ERROR,
      502,
      ErrorSeverity.MEDIUM,
      true,
      { context },
      cause
    );
  }

  static timeout(message: string, context?: ErrorContext): AppError {
    return new AppError(
      message,
      ErrorCode.TIMEOUT_ERROR,
      408,
      ErrorSeverity.MEDIUM,
      true,
      { context }
    );
  }

  static rateLimit(message: string = 'Rate limit exceeded'): AppError {
    return new AppError(
      message,
      ErrorCode.RATE_LIMIT_EXCEEDED,
      429,
      ErrorSeverity.LOW,
      true
    );
  }

  static configuration(message: string, context?: ErrorContext): AppError {
    return new AppError(
      message,
      ErrorCode.CONFIGURATION_ERROR,
      500,
      ErrorSeverity.HIGH,
      false,
      { context }
    );
  }
}
