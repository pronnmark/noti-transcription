/**
 * Error Handling Service
 * 
 * Centralizes error handling patterns to eliminate DRY violations in API routes.
 * Provides consistent error response formatting and logging.
 */

import { NextResponse } from 'next/server';
import { debugLog } from '@/lib/utils';

export interface ErrorResponse {
  success: false;
  error: string;
  code?: string;
  details?: any;
  timestamp: string;
}

export interface SuccessResponse<T = any> {
  success: true;
  data: T;
  timestamp: string;
}

export type ApiResponse<T = any> = ErrorResponse | SuccessResponse<T>;

export enum ErrorCode {
  // Validation errors (400)
  INVALID_INPUT = 'INVALID_INPUT',
  MISSING_FIELD = 'MISSING_FIELD',
  INVALID_FILE_FORMAT = 'INVALID_FILE_FORMAT',
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',
  
  // Authentication/Authorization errors (401/403)
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  INVALID_TOKEN = 'INVALID_TOKEN',
  
  // Resource errors (404/409)
  NOT_FOUND = 'NOT_FOUND',
  ALREADY_EXISTS = 'ALREADY_EXISTS',
  RESOURCE_CONFLICT = 'RESOURCE_CONFLICT',
  
  // Server errors (500)
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
  
  // Business logic errors (422)
  BUSINESS_RULE_VIOLATION = 'BUSINESS_RULE_VIOLATION',
  INVALID_STATE = 'INVALID_STATE',
}

export class ErrorHandlingService {
  /**
   * Create a standardized error response
   */
  createErrorResponse(
    message: string,
    code: ErrorCode = ErrorCode.INTERNAL_ERROR,
    details?: any
  ): ErrorResponse {
    return {
      success: false,
      error: message,
      code,
      details,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Create a standardized success response
   */
  createSuccessResponse<T>(data: T): SuccessResponse<T> {
    return {
      success: true,
      data,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get HTTP status code for error code
   */
  getStatusCode(code: ErrorCode): number {
    switch (code) {
      case ErrorCode.INVALID_INPUT:
      case ErrorCode.MISSING_FIELD:
      case ErrorCode.INVALID_FILE_FORMAT:
      case ErrorCode.FILE_TOO_LARGE:
        return 400;
        
      case ErrorCode.UNAUTHORIZED:
      case ErrorCode.INVALID_TOKEN:
        return 401;
        
      case ErrorCode.FORBIDDEN:
        return 403;
        
      case ErrorCode.NOT_FOUND:
        return 404;
        
      case ErrorCode.ALREADY_EXISTS:
      case ErrorCode.RESOURCE_CONFLICT:
        return 409;
        
      case ErrorCode.BUSINESS_RULE_VIOLATION:
      case ErrorCode.INVALID_STATE:
        return 422;
        
      case ErrorCode.INTERNAL_ERROR:
      case ErrorCode.DATABASE_ERROR:
      case ErrorCode.EXTERNAL_SERVICE_ERROR:
      default:
        return 500;
    }
  }

  /**
   * Handle and format API errors consistently
   */
  handleApiError(
    code: ErrorCode | unknown,
    message: string,
    details?: any
  ): NextResponse<ErrorResponse>;
  handleApiError(
    error: unknown,
    operation: string,
    defaultMessage?: string
  ): NextResponse<ErrorResponse>;
  handleApiError(
    codeOrError: ErrorCode | unknown,
    messageOrOperation: string,
    detailsOrDefaultMessage?: any
  ): NextResponse<ErrorResponse> {
    // Overload 1: handleApiError(code, message, details?)
    if (typeof codeOrError === 'string' && Object.values(ErrorCode).includes(codeOrError as ErrorCode)) {
      const code = codeOrError as ErrorCode;
      const message = messageOrOperation;
      const details = detailsOrDefaultMessage;
      
      const errorResponse = this.createErrorResponse(message, code, details);
      const statusCode = this.getStatusCode(code);
      
      debugLog('api', `❌ API error [${code}]:`, message);
      
      return NextResponse.json(errorResponse, { status: statusCode });
    }
    
    // Overload 2: handleApiError(error, operation, defaultMessage?)
    const error = codeOrError;
    const operation = messageOrOperation;
    const defaultMessage = detailsOrDefaultMessage || 'An unexpected error occurred';
    let errorResponse: ErrorResponse;
    let statusCode: number;

    if (error instanceof Error) {
      // Check for specific error patterns
      if (error.message.includes('validation')) {
        errorResponse = this.createErrorResponse(
          error.message,
          ErrorCode.INVALID_INPUT,
          { operation }
        );
        statusCode = 400;
      } else if (error.message.includes('not found')) {
        errorResponse = this.createErrorResponse(
          error.message,
          ErrorCode.NOT_FOUND,
          { operation }
        );
        statusCode = 404;
      } else if (error.message.includes('already exists')) {
        errorResponse = this.createErrorResponse(
          error.message,
          ErrorCode.ALREADY_EXISTS,
          { operation }
        );
        statusCode = 409;
      } else if (error.message.includes('database') || error.message.includes('Database')) {
        errorResponse = this.createErrorResponse(
          'Database operation failed',
          ErrorCode.DATABASE_ERROR,
          { operation, originalError: error.message }
        );
        statusCode = 500;
      } else {
        errorResponse = this.createErrorResponse(
          error.message,
          ErrorCode.INTERNAL_ERROR,
          { operation }
        );
        statusCode = 500;
      }
    } else {
      errorResponse = this.createErrorResponse(
        defaultMessage,
        ErrorCode.INTERNAL_ERROR,
        { operation, error: String(error) }
      );
      statusCode = 500;
    }

    // Log error for debugging
    debugLog('api', `❌ ${operation} error:`, error);

    return NextResponse.json(errorResponse, { status: statusCode });
  }

  /**
   * Handle validation errors specifically
   */
  handleValidationError(
    errors: string[],
    operation: string = 'validation'
  ): NextResponse<ErrorResponse> {
    const errorResponse = this.createErrorResponse(
      `Validation failed: ${errors.join(', ')}`,
      ErrorCode.INVALID_INPUT,
      { operation, validationErrors: errors }
    );

    debugLog('api', `❌ ${operation} validation error:`, errors);

    return NextResponse.json(errorResponse, { status: 400 });
  }

  /**
   * Handle authentication errors
   */
  handleAuthError(
    message: string = 'Authentication required',
    operation: string
  ): NextResponse<ErrorResponse> {
    const errorResponse = this.createErrorResponse(
      message,
      ErrorCode.UNAUTHORIZED,
      { operation }
    );

    debugLog('api', `❌ ${operation} auth error:`, message);

    return NextResponse.json(errorResponse, { status: 401 });
  }

  /**
   * Handle not found errors
   */
  handleNotFoundError(
    resource: string,
    identifier: string | number,
    operation: string
  ): NextResponse<ErrorResponse> {
    const message = `${resource} with ID ${identifier} not found`;
    const errorResponse = this.createErrorResponse(
      message,
      ErrorCode.NOT_FOUND,
      { operation, resource, identifier }
    );

    debugLog('api', `❌ ${operation} not found:`, message);

    return NextResponse.json(errorResponse, { status: 404 });
  }

  /**
   * Create success response with proper formatting
   */
  handleSuccess<T>(
    data: T,
    operation: string,
    message?: string
  ): NextResponse<SuccessResponse<T>> {
    const successResponse = this.createSuccessResponse(data);
    
    if (message) {
      debugLog('api', `✅ ${operation}: ${message}`);
    } else {
      debugLog('api', `✅ ${operation} completed successfully`);
    }

    return NextResponse.json(successResponse);
  }

  /**
   * Async error handler wrapper for API routes
   */
  async handleAsync<T>(
    operation: string,
    handler: () => Promise<T>
  ): Promise<NextResponse<ApiResponse<T>>> {
    try {
      const result = await handler();
      return this.handleSuccess(result, operation);
    } catch (error) {
      return this.handleApiError(error, operation);
    }
  }

  /**
   * Extract and validate ID from URL parameters
   */
  extractAndValidateId(
    pathSegments: string[],
    paramName: string = 'id'
  ): { id: number; error?: NextResponse<ErrorResponse> } {
    // Find the ID in path segments (usually the last segment before any additional paths)
    const idStr = pathSegments[pathSegments.length - 1];
    
    if (!idStr) {
      return {
        id: 0,
        error: NextResponse.json(
          this.createErrorResponse(
            `Missing ${paramName} parameter`,
            ErrorCode.MISSING_FIELD
          ),
          { status: 400 }
        )
      };
    }

    const id = parseInt(idStr);
    if (isNaN(id) || id <= 0) {
      return {
        id: 0,
        error: NextResponse.json(
          this.createErrorResponse(
            `Invalid ${paramName}: must be a positive integer`,
            ErrorCode.INVALID_INPUT
          ),
          { status: 400 }
        )
      };
    }

    return { id };
  }

  /**
   * Validate request body exists
   */
  async validateRequestBody(
    request: Request,
    operation: string
  ): Promise<{ body: any; error?: NextResponse<ErrorResponse> }> {
    try {
      const body = await request.json();
      
      if (!body || Object.keys(body).length === 0) {
        return {
          body,
          error: NextResponse.json(
            this.createErrorResponse(
              'Request body is required',
              ErrorCode.MISSING_FIELD,
              { operation }
            ),
            { status: 400 }
          )
        };
      }

      return { body };
    } catch (error) {
      return {
        body: null,
        error: NextResponse.json(
          this.createErrorResponse(
            'Invalid JSON in request body',
            ErrorCode.INVALID_INPUT,
            { operation }
          ),
          { status: 400 }
        )
      };
    }
  }
}