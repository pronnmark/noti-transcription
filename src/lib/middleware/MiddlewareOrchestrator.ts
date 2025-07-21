import { NextRequest, NextResponse } from 'next/server';
import { 
  MiddlewareConfig, 
  MiddlewareHandler, 
  ErrorMiddlewareHandler, 
  ResponseMiddlewareHandler,
  RequestContext,
  ResponseContext 
} from './types';
import { RequestContextBuilder } from './RequestContext';
import { ErrorMiddleware } from './ErrorMiddleware';
import { RequestLoggingMiddleware, ResponseLoggingMiddleware, PerformanceLoggingMiddleware } from './LoggingMiddleware';
import { ResponseFormattingMiddleware, PaginationMiddleware, CacheControlMiddleware } from './ResponseMiddleware';

export class MiddlewareOrchestrator {
  private config: MiddlewareConfig;
  private contextBuilder: RequestContextBuilder;
  private requestHandlers: MiddlewareHandler[] = [];
  private errorHandlers: ErrorMiddlewareHandler[] = [];
  private responseHandlers: ResponseMiddlewareHandler[] = [];

  constructor(config: MiddlewareConfig = {}) {
    this.config = config;
    this.contextBuilder = new RequestContextBuilder(config);
    this.setupDefaultHandlers();
  }

  async execute(
    request: NextRequest,
    handler: (request: NextRequest, context: RequestContext) => Promise<NextResponse>
  ): Promise<NextResponse> {
    let context: RequestContext;

    try {
      // Build request context
      context = await this.contextBuilder.build(request);
      
      // Execute request middleware chain
      const response = await this.executeRequestChain(request, context, async () => {
        return await handler(request, context);
      });

      // Build response context
      const responseContext = await this.buildResponseContext(response, context);

      // Execute response middleware chain
      return await this.executeResponseChain(response, { ...context, ...responseContext });

    } catch (error) {
      // If context is not available, create a minimal one
      if (!context!) {
        context = await this.createFallbackContext(request);
      }

      // Execute error middleware chain
      return await this.executeErrorChain(error, request, context);
    }
  }

  private async executeRequestChain(
    request: NextRequest,
    context: RequestContext,
    finalHandler: () => Promise<NextResponse>
  ): Promise<NextResponse> {
    let index = 0;

    const next = async (): Promise<NextResponse> => {
      if (index >= this.requestHandlers.length) {
        return await finalHandler();
      }

      const handler = this.requestHandlers[index++];
      return await handler.execute(request, context, next);
    };

    return await next();
  }

  private async executeErrorChain(
    error: unknown,
    request: NextRequest,
    context: RequestContext
  ): Promise<NextResponse> {
    for (const handler of this.errorHandlers) {
      try {
        return await handler.execute(error, request, context);
      } catch (handlerError) {
        // If this handler can't handle the error, try the next one
        if (handlerError === error) {
          continue;
        }
        // If it's a new error, use it instead
        error = handlerError;
      }
    }

    // If no error handler could handle the error, use the default one
    const defaultHandler = new ErrorMiddleware();
    return await defaultHandler.execute(error, request, context);
  }

  private async executeResponseChain(
    response: NextResponse,
    context: RequestContext & ResponseContext
  ): Promise<NextResponse> {
    let currentResponse = response;

    for (const handler of this.responseHandlers) {
      try {
        currentResponse = await handler.execute(currentResponse, context);
      } catch (error) {
        context.logger.warn(`Response handler '${handler.name}' failed`, error instanceof Error ? error : new Error(String(error)));
        // Continue with other handlers even if one fails
      }
    }

    return currentResponse;
  }

  private async buildResponseContext(
    response: NextResponse,
    requestContext: RequestContext
  ): Promise<ResponseContext> {
    const duration = Date.now() - requestContext.startTime;
    const statusCode = response.status;
    
    // Extract response headers
    const headers: Record<string, string> = {};
    for (const [key, value] of Array.from(response.headers.entries())) {
      headers[key] = value;
    }

    // Try to get response size
    const contentLength = response.headers.get('content-length');
    const size = contentLength ? parseInt(contentLength, 10) : undefined;

    return {
      statusCode,
      headers,
      size,
      duration,
    };
  }

  private async createFallbackContext(request: NextRequest): Promise<RequestContext> {
    const { createServiceLogger } = await import('@/lib/logging');
    
    return {
      requestId: `fallback_${Date.now()}`,
      startTime: Date.now(),
      method: request.method,
      url: request.url,
      path: new URL(request.url).pathname,
      query: {},
      headers: {},
      logger: createServiceLogger('middleware-fallback'),
    };
  }

  private setupDefaultHandlers(): void {
    // Request handlers (executed in order)
    if (this.config.performance?.enabled !== false) {
      this.requestHandlers.push(new PerformanceLoggingMiddleware(this.config.performance));
    }

    if (this.config.logging?.logRequests !== false) {
      this.requestHandlers.push(new RequestLoggingMiddleware(this.config.logging));
    }

    // Error handlers (tried in order until one handles the error)
    this.errorHandlers.push(new ErrorMiddleware(this.config.errorHandling));

    // Response handlers (executed in order)
    if (this.config.logging?.logResponses !== false) {
      this.responseHandlers.push(new ResponseLoggingMiddleware(this.config.logging));
    }

    // Add response handlers based on configuration
    const responseConfig = (this.config as any).responseHandling || {};
    
    if (responseConfig.enableResponseFormatting !== false) {
      this.responseHandlers.push(new ResponseFormattingMiddleware());
    }
    
    if (responseConfig.enablePagination !== false) {
      this.responseHandlers.push(new PaginationMiddleware());
    }
    
    if (responseConfig.enableCacheControl !== false) {
      this.responseHandlers.push(new CacheControlMiddleware());
    }
  }

  // Add custom handlers
  addRequestHandler(handler: MiddlewareHandler): void {
    this.requestHandlers.push(handler);
  }

  addErrorHandler(handler: ErrorMiddlewareHandler): void {
    this.errorHandlers.push(handler);
  }

  addResponseHandler(handler: ResponseMiddlewareHandler): void {
    this.responseHandlers.push(handler);
  }

  // Remove handlers
  removeHandler(name: string): void {
    this.requestHandlers = this.requestHandlers.filter(h => h.name !== name);
    this.errorHandlers = this.errorHandlers.filter(h => h.name !== name);
    this.responseHandlers = this.responseHandlers.filter(h => h.name !== name);
  }

  // Get handler by name
  getHandler(name: string): MiddlewareHandler | ErrorMiddlewareHandler | ResponseMiddlewareHandler | undefined {
    return [
      ...this.requestHandlers,
      ...this.errorHandlers,
      ...this.responseHandlers,
    ].find(h => h.name === name);
  }

  // List all handlers
  listHandlers(): {
    request: string[];
    error: string[];
    response: string[];
  } {
    return {
      request: this.requestHandlers.map(h => h.name),
      error: this.errorHandlers.map(h => h.name),
      response: this.responseHandlers.map(h => h.name),
    };
  }

  // Update configuration
  updateConfig(config: Partial<MiddlewareConfig>): void {
    this.config = { ...this.config, ...config };
    this.contextBuilder = new RequestContextBuilder(this.config);
  }

  // Get current configuration
  getConfig(): MiddlewareConfig {
    return { ...this.config };
  }
}

// Default middleware configuration
export function createDefaultMiddlewareConfig(): MiddlewareConfig {
  return {
    logging: {
      enabled: true,
      logRequests: true,
      logResponses: true,
      logHeaders: false,
      logBody: false,
      logQuery: true,
      sensitiveHeaders: ['authorization', 'cookie', 'x-api-key'],
      sensitiveFields: ['password', 'token', 'secret'],
      maxBodySize: 10000,
    },
    errorHandling: {
      enabled: true,
      includeStackTrace: process.env.NODE_ENV === 'development',
      sanitizeErrors: process.env.NODE_ENV === 'production',
      reportErrors: true,
    },
    performance: {
      enabled: true,
      slowRequestThreshold: 1000,
      memoryUsageTracking: false,
    },
  };
}

// Singleton instance
let defaultOrchestrator: MiddlewareOrchestrator | undefined;

export function getDefaultOrchestrator(): MiddlewareOrchestrator {
  if (!defaultOrchestrator) {
    defaultOrchestrator = new MiddlewareOrchestrator(createDefaultMiddlewareConfig());
  }
  return defaultOrchestrator;
}

export function setDefaultOrchestrator(orchestrator: MiddlewareOrchestrator): void {
  defaultOrchestrator = orchestrator;
}
