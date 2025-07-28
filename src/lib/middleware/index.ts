// Core middleware types and interfaces
export * from './types';

// Middleware implementations
export * from './RequestContext';
export * from './ErrorMiddleware';
export * from './LoggingMiddleware';
export * from './ResponseMiddleware';
export * from './MiddlewareOrchestrator';

// Re-export commonly used items
export {
  MiddlewareOrchestrator,
  getDefaultOrchestrator,
  setDefaultOrchestrator,
  createDefaultMiddlewareConfig,
} from './MiddlewareOrchestrator';

// Import for internal use
import { MiddlewareOrchestrator, getDefaultOrchestrator } from './MiddlewareOrchestrator';

export { RequestContextBuilder } from './RequestContext';
export { ErrorMiddleware, createErrorMiddleware } from './ErrorMiddleware';
export { AuthMiddleware, createAuthMiddleware, withAuth } from './AuthMiddleware';

// Utility functions for creating middleware
export function withMiddleware(
  handler: (request: import('next/server').NextRequest, context: import('./types').RequestContext) => Promise<import('next/server').NextResponse>,
  config?: import('./types').MiddlewareConfig,
) {
  const orchestrator = config
    ? new MiddlewareOrchestrator(config)
    : getDefaultOrchestrator();

  return async (request: import('next/server').NextRequest) => {
    return orchestrator.execute(request, handler);
  };
}

// Helper for API route error handling
export function withErrorHandling(
  handler: (request: import('next/server').NextRequest) => Promise<import('next/server').NextResponse>,
) {
  return withMiddleware(async (request, context) => {
    try {
      return await handler(request);
    } catch (error) {
      throw error; // Let middleware handle the error
    }
  });
}

// Helper for API route logging
export function withLogging(
  handler: (request: import('next/server').NextRequest, context: import('./types').RequestContext) => Promise<import('next/server').NextResponse>,
  options?: {
    logBody?: boolean;
    logHeaders?: boolean;
    skipPaths?: string[];
  },
) {
  const config = {
    logging: {
      enabled: true,
      logRequests: true,
      logResponses: true,
      logBody: options?.logBody || false,
      logHeaders: options?.logHeaders || false,
    },
  };

  return withMiddleware(handler, config);
}

// Helper for API route authentication
export function withAuthMiddleware(
  handler: (request: import('next/server').NextRequest, context: import('./types').RequestContext) => Promise<import('next/server').NextResponse>,
  config?: import('./types').MiddlewareConfig,
) {
  // Create a wrapped handler that includes auth check
  const authHandler = async (request: import('next/server').NextRequest, context: import('./types').RequestContext) => {
    // Import dynamically to avoid circular dependencies
    const { cookies } = await import('next/headers');
    const { validateSession } = await import('../auth');
    
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value;
    const isValid = await validateSession(token);

    if (!isValid) {
      const { NextResponse } = await import('next/server');
      return NextResponse.json(
        createErrorResponse(
          'Authentication required',
          'UNAUTHORIZED',
          401,
          { requestId: context.requestId }
        ),
        { status: 401 }
      );
    }

    return handler(request, context);
  };

  return withMiddleware(authHandler, config);
}

// Helper for standardized API responses
export function createApiResponse<T>(
  data: T,
  options?: {
    statusCode?: number;
    message?: string;
    meta?: Record<string, any>;
  },
): import('./types').ApiResponse<T> {
  return {
    success: true,
    data,
    meta: {
      requestId: options?.meta?.requestId || 'unknown',
      timestamp: new Date().toISOString(),
      duration: options?.meta?.duration || 0,
      ...options?.meta,
    },
  };
}

export function createErrorResponse(
  message: string,
  code: string,
  statusCode: number = 500,
  details?: any,
): import('./types').ApiResponse {
  return {
    success: false,
    error: {
      message,
      code,
      statusCode,
      details,
      timestamp: new Date().toISOString(),
      requestId: '', // Will be filled by middleware
    },
  };
}

// Helper for paginated responses
export function createPaginatedResponse<T>(
  data: T[],
  pagination: import('./types').PaginationMeta,
  meta?: Record<string, any>,
): import('./types').PaginatedApiResponse<T> {
  return {
    success: true,
    data,
    pagination,
    meta: {
      requestId: meta?.requestId || 'unknown',
      timestamp: new Date().toISOString(),
      duration: meta?.duration || 0,
      ...meta,
    },
  };
}
