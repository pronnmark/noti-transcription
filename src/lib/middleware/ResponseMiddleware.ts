import { NextRequest, NextResponse } from 'next/server';
import { ResponseMiddlewareHandler, RequestContext, ResponseContext, ApiResponse, PaginatedApiResponse } from './types';

export class ResponseFormattingMiddleware implements ResponseMiddlewareHandler {
  public readonly name = 'response-formatting';

  constructor(
    private options: {
      wrapResponses?: boolean;
      includeMetadata?: boolean;
      includeTimestamp?: boolean;
      includeDuration?: boolean;
      includeRequestId?: boolean;
      includeVersion?: boolean;
      version?: string;
    } = {},
  ) {
    this.options = {
      wrapResponses: true,
      includeMetadata: true,
      includeTimestamp: true,
      includeDuration: true,
      includeRequestId: true,
      includeVersion: false,
      version: '1.0.0',
      ...options,
    };
  }

  async execute(
    response: NextResponse,
    context: RequestContext & ResponseContext,
  ): Promise<NextResponse> {
    // Skip formatting for non-JSON responses
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return this.addHeaders(response, context);
    }

    // Skip formatting if already wrapped or if it's an error response
    if (!this.options.wrapResponses || context.statusCode >= 400) {
      return this.addHeaders(response, context);
    }

    try {
      // Get the response body
      const body = await response.json();

      // Check if response is already in API format
      if (this.isApiResponse(body)) {
        return this.addHeaders(response, context);
      }

      // Wrap the response
      const wrappedResponse = this.wrapResponse(body, context);

      // Create new response with wrapped data
      const newResponse = NextResponse.json(wrappedResponse, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });

      return this.addHeaders(newResponse, context);
    } catch (error) {
      // If we can't parse the response, return it as-is
      return this.addHeaders(response, context);
    }
  }

  private isApiResponse(body: any): boolean {
    return (
      typeof body === 'object' &&
      body !== null &&
      ('success' in body || 'error' in body)
    );
  }

  private wrapResponse(data: any, context: RequestContext & ResponseContext): ApiResponse {
    const response: ApiResponse = {
      success: true,
      data,
    };

    if (this.options.includeMetadata) {
      response.meta = {
        requestId: context.requestId,
        timestamp: new Date().toISOString(),
        duration: context.duration,
      };

      if (this.options.includeVersion) {
        response.meta.version = this.options.version;
      }
    }

    return response;
  }

  private addHeaders(response: NextResponse, context: RequestContext & ResponseContext): NextResponse {
    // Add standard headers
    response.headers.set('X-Request-ID', context.requestId);
    response.headers.set('X-Response-Time', `${context.duration}ms`);

    // Add CORS headers if needed
    response.headers.set('Access-Control-Expose-Headers', 'X-Request-ID, X-Response-Time');

    return response;
  }
}

export class PaginationMiddleware implements ResponseMiddlewareHandler {
  public readonly name = 'pagination';

  async execute(
    response: NextResponse,
    context: RequestContext & ResponseContext,
  ): Promise<NextResponse> {
    // Only process successful JSON responses
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json') || context.statusCode >= 400) {
      return response;
    }

    // Check if pagination parameters are present in query
    const { page, limit, total } = this.extractPaginationParams(context);
    if (!page || !limit) {
      return response;
    }

    try {
      const body = await response.json();

      // Check if response contains array data
      if (!Array.isArray(body.data) && !Array.isArray(body)) {
        return response;
      }

      const data = Array.isArray(body) ? body : body.data;
      const paginatedResponse = this.createPaginatedResponse(data, page, limit, total, context);

      return NextResponse.json(paginatedResponse, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
    } catch (error) {
      return response;
    }
  }

  private extractPaginationParams(context: RequestContext): {
    page?: number;
    limit?: number;
    total?: number;
  } {
    const page = context.query.page ? parseInt(context.query.page, 10) : undefined;
    const limit = context.query.limit ? parseInt(context.query.limit, 10) : undefined;
    const total = context.query.total ? parseInt(context.query.total, 10) : undefined;

    return { page, limit, total };
  }

  private createPaginatedResponse(
    data: any[],
    page: number,
    limit: number,
    total: number | undefined,
    context: RequestContext & ResponseContext,
  ): PaginatedApiResponse {
    const totalItems = total || data.length;
    const totalPages = Math.ceil(totalItems / limit);

    return {
      success: true,
      data,
      pagination: {
        page,
        limit,
        total: totalItems,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
      meta: {
        requestId: context.requestId,
        timestamp: new Date().toISOString(),
        duration: context.duration,
      },
    };
  }
}

export class CompressionMiddleware implements ResponseMiddlewareHandler {
  public readonly name = 'compression';

  constructor(
    private options: {
      threshold?: number;
      level?: number;
      types?: string[];
    } = {},
  ) {
    this.options = {
      threshold: 1024, // 1KB
      level: 6, // Default compression level
      types: ['application/json', 'text/plain', 'text/html', 'text/css', 'application/javascript'],
      ...options,
    };
  }

  async execute(
    response: NextResponse,
    context: RequestContext & ResponseContext,
  ): Promise<NextResponse> {
    const contentType = response.headers.get('content-type') || '';
    const contentLength = context.size || 0;

    // Skip compression for small responses or unsupported types
    if (contentLength < this.options.threshold! || !this.shouldCompress(contentType)) {
      return response;
    }

    // Check if client accepts compression
    const acceptEncoding = context.headers['accept-encoding'] || '';
    if (!acceptEncoding.includes('gzip') && !acceptEncoding.includes('deflate')) {
      return response;
    }

    try {
      // For now, just add the header indicating compression support
      // In a real implementation, you would compress the response body
      response.headers.set('Vary', 'Accept-Encoding');

      return response;
    } catch (error) {
      context.logger.warn('Failed to compress response', error instanceof Error ? error : new Error(String(error)));
      return response;
    }
  }

  private shouldCompress(contentType: string): boolean {
    return this.options.types!.some(type => contentType.includes(type));
  }
}

export class CacheControlMiddleware implements ResponseMiddlewareHandler {
  public readonly name = 'cache-control';

  constructor(
    private options: {
      defaultMaxAge?: number;
      staticMaxAge?: number;
      apiMaxAge?: number;
      noCache?: string[];
      mustRevalidate?: string[];
    } = {},
  ) {
    this.options = {
      defaultMaxAge: 0,
      staticMaxAge: 86400, // 1 day
      apiMaxAge: 300, // 5 minutes
      noCache: ['/api/auth', '/api/user'],
      mustRevalidate: ['/api/'],
      ...options,
    };
  }

  async execute(
    response: NextResponse,
    context: RequestContext & ResponseContext,
  ): Promise<NextResponse> {
    // Skip if cache-control header is already set
    if (response.headers.has('cache-control')) {
      return response;
    }

    const cacheControl = this.getCacheControl(context);
    if (cacheControl) {
      response.headers.set('Cache-Control', cacheControl);
    }

    return response;
  }

  private getCacheControl(context: RequestContext & ResponseContext): string | null {
    const path = context.path;

    // No cache for specific paths
    if (this.options.noCache!.some(pattern => path.startsWith(pattern))) {
      return 'no-cache, no-store, must-revalidate';
    }

    // Static assets
    if (path.startsWith('/_next/') || path.includes('.')) {
      return `public, max-age=${this.options.staticMaxAge}`;
    }

    // API endpoints
    if (path.startsWith('/api/')) {
      const mustRevalidate = this.options.mustRevalidate!.some(pattern => path.startsWith(pattern));
      const maxAge = this.options.apiMaxAge;

      return mustRevalidate
        ? `public, max-age=${maxAge}, must-revalidate`
        : `public, max-age=${maxAge}`;
    }

    // Default caching
    return `public, max-age=${this.options.defaultMaxAge}`;
  }
}
