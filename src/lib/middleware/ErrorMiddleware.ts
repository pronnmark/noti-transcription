import { NextRequest, NextResponse } from 'next/server';
import { ErrorMiddlewareHandler, RequestContext, ApiResponse } from './types';
import { errorHandler, AppError, ErrorCode } from '@/lib/errors';

export class ErrorMiddleware implements ErrorMiddlewareHandler {
  public readonly name = 'error';

  constructor(
    private options: {
      includeStackTrace?: boolean;
      sanitizeErrors?: boolean;
      reportErrors?: boolean;
    } = {},
  ) {}

  async execute(
    error: unknown,
    request: NextRequest,
    context: RequestContext,
  ): Promise<NextResponse> {
    const startTime = Date.now();

    try {
      // Handle the error using the centralized error handler
      const errorResponse = await errorHandler.handleError(
        error,
        context.requestId,
      );

      // Log the error
      context.logger.error(
        'Request failed with error',
        error instanceof Error ? error : new Error(String(error)),
        {
          method: context.method,
          path: context.path,
          statusCode: errorResponse.error.statusCode,
          errorCode: errorResponse.error.code,
          duration: Date.now() - context.startTime,
        },
      );

      // Create API response
      const apiResponse: ApiResponse = {
        success: false,
        error: {
          message: errorResponse.error.message,
          code: errorResponse.error.code,
          statusCode: errorResponse.error.statusCode,
          details: errorResponse.error.details,
          timestamp: errorResponse.error.timestamp,
          requestId: context.requestId,
        },
        meta: {
          requestId: context.requestId,
          timestamp: new Date().toISOString(),
          duration: Date.now() - context.startTime,
        },
      };

      // Add stack trace in development
      if (this.options.includeStackTrace && errorResponse.error.stackTrace) {
        apiResponse.error!.details = {
          ...apiResponse.error!.details,
          stackTrace: errorResponse.error.stackTrace,
        };
      }

      // Create response
      const response = NextResponse.json(apiResponse, {
        status: errorResponse.error.statusCode,
        headers: {
          'Content-Type': 'application/json',
          'X-Request-ID': context.requestId,
        },
      });

      return response;
    } catch (handlerError) {
      // Fallback error handling if the error handler itself fails
      context.logger.fatal(
        'Error handler failed',
        handlerError instanceof Error
          ? handlerError
          : new Error(String(handlerError)),
      );

      const fallbackResponse: ApiResponse = {
        success: false,
        error: {
          message: 'An unexpected error occurred',
          code: ErrorCode.INTERNAL_SERVER_ERROR,
          statusCode: 500,
          timestamp: new Date().toISOString(),
          requestId: context.requestId,
        },
        meta: {
          requestId: context.requestId,
          timestamp: new Date().toISOString(),
          duration: Date.now() - context.startTime,
        },
      };

      return NextResponse.json(fallbackResponse, {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'X-Request-ID': context.requestId,
        },
      });
    }
  }
}

// Specific error handlers for different types of errors
export class ValidationErrorMiddleware implements ErrorMiddlewareHandler {
  public readonly name = 'validation-error';

  async execute(
    error: unknown,
    request: NextRequest,
    context: RequestContext,
  ): Promise<NextResponse> {
    if (!(error instanceof Error) || !error.message.includes('validation')) {
      throw error; // Re-throw if not a validation error
    }

    context.logger.error('Validation error', error, {
      method: context.method,
      path: context.path,
      body: context.body,
    });

    const apiResponse: ApiResponse = {
      success: false,
      error: {
        message: 'Validation failed',
        code: ErrorCode.VALIDATION_ERROR,
        statusCode: 400,
        details: {
          validationErrors: this.parseValidationErrors(error.message),
        },
        timestamp: new Date().toISOString(),
        requestId: context.requestId,
      },
      meta: {
        requestId: context.requestId,
        timestamp: new Date().toISOString(),
        duration: Date.now() - context.startTime,
      },
    };

    return NextResponse.json(apiResponse, {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        'X-Request-ID': context.requestId,
      },
    });
  }

  private parseValidationErrors(message: string): Record<string, string[]> {
    // Simple validation error parsing - can be enhanced based on validation library
    return {
      general: [message],
    };
  }
}

export class NotFoundErrorMiddleware implements ErrorMiddlewareHandler {
  public readonly name = 'not-found-error';

  async execute(
    error: unknown,
    request: NextRequest,
    context: RequestContext,
  ): Promise<NextResponse> {
    if (!(error instanceof AppError) || error.code !== ErrorCode.NOT_FOUND) {
      throw error; // Re-throw if not a not found error
    }

    context.logger.info('Resource not found', {
      method: context.method,
      path: context.path,
      resource: error.metadata.context?.resource,
      id: error.metadata.context?.id,
    });

    const apiResponse: ApiResponse = {
      success: false,
      error: {
        message: error.message,
        code: error.code,
        statusCode: 404,
        timestamp: new Date().toISOString(),
        requestId: context.requestId,
      },
      meta: {
        requestId: context.requestId,
        timestamp: new Date().toISOString(),
        duration: Date.now() - context.startTime,
      },
    };

    return NextResponse.json(apiResponse, {
      status: 404,
      headers: {
        'Content-Type': 'application/json',
        'X-Request-ID': context.requestId,
      },
    });
  }
}

export class RateLimitErrorMiddleware implements ErrorMiddlewareHandler {
  public readonly name = 'rate-limit-error';

  async execute(
    error: unknown,
    request: NextRequest,
    context: RequestContext,
  ): Promise<NextResponse> {
    if (
      !(error instanceof AppError) ||
      error.code !== ErrorCode.RATE_LIMIT_EXCEEDED
    ) {
      throw error; // Re-throw if not a rate limit error
    }

    context.logger.warn('Rate limit exceeded', {
      method: context.method,
      path: context.path,
      ip: context.ip,
      userId: context.userId,
    });

    const apiResponse: ApiResponse = {
      success: false,
      error: {
        message: 'Rate limit exceeded. Please try again later.',
        code: error.code,
        statusCode: 429,
        timestamp: new Date().toISOString(),
        requestId: context.requestId,
      },
      meta: {
        requestId: context.requestId,
        timestamp: new Date().toISOString(),
        duration: Date.now() - context.startTime,
      },
    };

    return NextResponse.json(apiResponse, {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'X-Request-ID': context.requestId,
        'Retry-After': '60', // Suggest retry after 60 seconds
      },
    });
  }
}

// Error middleware factory
export function createErrorMiddleware(
  type: 'general' | 'validation' | 'not-found' | 'rate-limit' = 'general',
  options?: any,
): ErrorMiddlewareHandler {
  switch (type) {
    case 'validation':
      return new ValidationErrorMiddleware();
    case 'not-found':
      return new NotFoundErrorMiddleware();
    case 'rate-limit':
      return new RateLimitErrorMiddleware();
    case 'general':
    default:
      return new ErrorMiddleware(options);
  }
}
