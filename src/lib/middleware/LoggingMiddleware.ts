import { NextRequest, NextResponse } from 'next/server';
import { MiddlewareHandler, RequestContext, ResponseMiddlewareHandler, ResponseContext } from './types';

export class RequestLoggingMiddleware implements MiddlewareHandler {
  public readonly name = 'request-logging';

  constructor(
    private options: {
      logHeaders?: boolean;
      logBody?: boolean;
      logQuery?: boolean;
      skipPaths?: string[];
      skipMethods?: string[];
    } = {}
  ) {}

  async execute(
    request: NextRequest,
    context: RequestContext,
    next: () => Promise<NextResponse>
  ): Promise<NextResponse> {
    // Skip logging for certain paths or methods
    if (this.shouldSkip(context)) {
      return next();
    }

    // Log incoming request
    this.logRequest(context);

    // Continue to next middleware
    const response = await next();

    return response;
  }

  private shouldSkip(context: RequestContext): boolean {
    const { skipPaths = [], skipMethods = [] } = this.options;

    // Skip health check and static assets
    const defaultSkipPaths = ['/health', '/favicon.ico', '/_next/', '/api/health'];
    const allSkipPaths = [...defaultSkipPaths, ...skipPaths];

    if (allSkipPaths.some(path => context.path.startsWith(path))) {
      return true;
    }

    if (skipMethods.includes(context.method)) {
      return true;
    }

    return false;
  }

  private logRequest(context: RequestContext): void {
    const logData: Record<string, any> = {
      method: context.method,
      path: context.path,
      userAgent: context.userAgent,
      ip: context.ip,
    };

    if (context.userId) {
      logData.userId = context.userId;
    }

    if (context.sessionId) {
      logData.sessionId = context.sessionId;
    }

    if (this.options.logQuery && Object.keys(context.query).length > 0) {
      logData.query = context.query;
    }

    if (this.options.logHeaders && Object.keys(context.headers).length > 0) {
      logData.headers = context.headers;
    }

    if (this.options.logBody && context.body) {
      logData.body = context.body;
    }

    context.logger.info('Incoming request', logData);
  }
}

export class ResponseLoggingMiddleware implements ResponseMiddlewareHandler {
  public readonly name = 'response-logging';

  constructor(
    private options: {
      logHeaders?: boolean;
      logBody?: boolean;
      skipPaths?: string[];
      skipSuccessful?: boolean;
      slowRequestThreshold?: number;
    } = {}
  ) {}

  async execute(
    response: NextResponse,
    context: RequestContext & ResponseContext
  ): Promise<NextResponse> {
    // Skip logging for certain paths
    if (this.shouldSkip(context)) {
      return response;
    }

    // Log response
    this.logResponse(response, context);

    return response;
  }

  private shouldSkip(context: RequestContext | (RequestContext & ResponseContext)): boolean {
    const { skipPaths = [] } = this.options;

    // Skip health check and static assets
    const defaultSkipPaths = ['/health', '/favicon.ico', '/_next/', '/api/health'];
    const allSkipPaths = [...defaultSkipPaths, ...skipPaths];

    if (allSkipPaths.some(path => context.path.startsWith(path))) {
      return true;
    }

    // Skip successful requests if configured (only if we have response context)
    if (this.options.skipSuccessful && 'statusCode' in context &&
        context.statusCode >= 200 && context.statusCode < 400) {
      return true;
    }

    return false;
  }

  private logResponse(response: NextResponse, context: RequestContext & ResponseContext): void {
    const logData: Record<string, any> = {
      method: context.method,
      path: context.path,
      statusCode: context.statusCode,
      duration: context.duration,
    };

    if (context.userId) {
      logData.userId = context.userId;
    }

    if (context.size) {
      logData.responseSize = context.size;
    }

    if (this.options.logHeaders && Object.keys(context.headers).length > 0) {
      logData.responseHeaders = context.headers;
    }

    if (this.options.logBody && context.body) {
      logData.responseBody = context.body;
    }

    // Determine log level based on status code and duration
    const logLevel = this.getLogLevel(context);
    const message = `${context.method} ${context.path} ${context.statusCode}`;

    if (context.error) {
      logData.error = {
        code: context.error.code,
        message: context.error.message,
      };
    }

    switch (logLevel) {
      case 'error':
        context.logger.error(message, context.error, logData);
        break;
      case 'warn':
        context.logger.warn(message, logData);
        break;
      case 'info':
        context.logger.info(message, logData);
        break;
      case 'debug':
        context.logger.debug(message, logData);
        break;
    }
  }

  private getLogLevel(context: RequestContext & ResponseContext): 'error' | 'warn' | 'info' | 'debug' {
    // Error responses
    if (context.statusCode >= 500) {
      return 'error';
    }

    // Client errors
    if (context.statusCode >= 400) {
      return 'warn';
    }

    // Slow requests
    const slowThreshold = this.options.slowRequestThreshold || 1000; // 1 second
    if (context.duration > slowThreshold) {
      return 'warn';
    }

    // Successful responses
    if (context.statusCode >= 200 && context.statusCode < 300) {
      return 'info';
    }

    // Redirects and other responses
    return 'debug';
  }
}

export class PerformanceLoggingMiddleware implements MiddlewareHandler {
  public readonly name = 'performance-logging';
  private metrics: Map<string, number[]> = new Map();

  constructor(
    private options: {
      slowRequestThreshold?: number;
      trackMemoryUsage?: boolean;
      reportInterval?: number;
    } = {}
  ) {
    this.options = {
      slowRequestThreshold: 1000, // 1 second
      trackMemoryUsage: false,
      reportInterval: 60000, // 1 minute
      ...options,
    };

    // Start periodic reporting
    if (this.options.reportInterval) {
      setInterval(() => this.reportMetrics(), this.options.reportInterval);
    }
  }

  async execute(
    request: NextRequest,
    context: RequestContext,
    next: () => Promise<NextResponse>
  ): Promise<NextResponse> {
    const startTime = Date.now();
    const startMemory = this.options.trackMemoryUsage ? process.memoryUsage() : null;

    try {
      const response = await next();
      const duration = Date.now() - startTime;

      // Track metrics
      this.trackMetrics(context.path, duration);

      // Log slow requests
      if (duration > this.options.slowRequestThreshold!) {
        const logData: Record<string, any> = {
          method: context.method,
          path: context.path,
          duration,
          threshold: this.options.slowRequestThreshold,
        };

        if (startMemory && this.options.trackMemoryUsage) {
          const endMemory = process.memoryUsage();
          logData.memoryUsage = {
            heapUsedDelta: endMemory.heapUsed - startMemory.heapUsed,
            heapTotalDelta: endMemory.heapTotal - startMemory.heapTotal,
            externalDelta: endMemory.external - startMemory.external,
          };
        }

        context.logger.warn('Slow request detected', logData);
      }

      return response;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.trackMetrics(context.path, duration);
      throw error;
    }
  }

  private trackMetrics(path: string, duration: number): void {
    if (!this.metrics.has(path)) {
      this.metrics.set(path, []);
    }

    const pathMetrics = this.metrics.get(path)!;
    pathMetrics.push(duration);

    // Keep only last 100 requests per path
    if (pathMetrics.length > 100) {
      pathMetrics.shift();
    }
  }

  private reportMetrics(): void {
    const report: Record<string, any> = {};

    for (const [path, durations] of Array.from(this.metrics.entries())) {
      if (durations.length === 0) continue;

      const avg = durations.reduce((sum, d) => sum + d, 0) / durations.length;
      const min = Math.min(...durations);
      const max = Math.max(...durations);
      const p95 = this.percentile(durations, 0.95);

      report[path] = {
        count: durations.length,
        avg: Math.round(avg),
        min,
        max,
        p95: Math.round(p95),
      };
    }

    if (Object.keys(report).length > 0) {
      console.log('📊 Performance metrics:', report);
    }
  }

  private percentile(values: number[], p: number): number {
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * p) - 1;
    return sorted[index] || 0;
  }
}
