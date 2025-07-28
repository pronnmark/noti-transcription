import { NextRequest, NextResponse } from 'next/server';
import { MiddlewareHandler, RequestContext } from './types';
import { cookies } from 'next/headers';
import { validateSession } from '../auth';
import { createErrorResponse } from './index';

export class AuthMiddleware implements MiddlewareHandler {
  name = 'AuthMiddleware';

  async execute(
    request: NextRequest,
    context: RequestContext,
    next: () => Promise<NextResponse>
  ): Promise<NextResponse> {
    try {
      // Skip auth for certain paths if needed
      const skipPaths = ['/api/upload', '/api/health'];
      if (skipPaths.some(path => context.path.startsWith(path))) {
        return next();
      }

      // Get auth token from cookies
      const cookieStore = await cookies();
      const token = cookieStore.get('auth-token')?.value;

      // Validate session
      const isValid = await validateSession(token);

      if (!isValid) {
        context.logger.warn('Unauthorized request', {
          path: context.path,
          ip: context.ip,
        });

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

      // TODO: Add user info to context
      // context.userId = session.userId;
      // context.sessionId = session.id;

      return next();
    } catch (error) {
      context.logger.error('Auth middleware error', error);
      return NextResponse.json(
        createErrorResponse(
          'Authentication error',
          'AUTH_ERROR',
          500,
          { requestId: context.requestId }
        ),
        { status: 500 }
      );
    }
  }
}

export function createAuthMiddleware(): AuthMiddleware {
  return new AuthMiddleware();
}

/**
 * Helper to create a withAuth wrapper
 */
export function withAuth(
  handler: (request: NextRequest, context: RequestContext) => Promise<NextResponse>
) {
  return async (request: NextRequest) => {
    const authMiddleware = createAuthMiddleware();
    const context: RequestContext = {
      requestId: crypto.randomUUID(),
      startTime: Date.now(),
      method: request.method,
      url: request.url,
      path: new URL(request.url).pathname,
      query: Object.fromEntries(new URL(request.url).searchParams),
      headers: Object.fromEntries(request.headers.entries()),
      logger: console as any, // Simplified logger
    };

    return authMiddleware.execute(request, context, async () => {
      return handler(request, context);
    });
  };
}