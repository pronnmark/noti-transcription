import { NextRequest, NextResponse } from 'next/server';
import { AppError } from '@/lib/errors';
// Simple logger interface
interface ILogger {
  info: (msg: string, ...args: any[]) => void;
  warn: (msg: string, ...args: any[]) => void;
  error: (msg: string, ...args: any[]) => void;
  debug: (msg: string, ...args: any[]) => void;
  fatal: (msg: string, ...args: any[]) => void;
}

export interface RequestContext {
  requestId: string;
  startTime: number;
  userId?: string;
  sessionId?: string;
  userAgent?: string;
  ip?: string;
  method: string;
  url: string;
  path: string;
  query: Record<string, string>;
  headers: Record<string, string>;
  body?: any;
  logger: ILogger;
}

export interface ResponseContext {
  statusCode: number;
  headers: Record<string, string>;
  body?: any;
  size?: number;
  duration: number;
  error?: AppError;
}

export interface MiddlewareConfig {
  // Logging configuration
  logging?: {
    enabled?: boolean;
    logRequests?: boolean;
    logResponses?: boolean;
    logHeaders?: boolean;
    logBody?: boolean;
    logQuery?: boolean;
    sensitiveHeaders?: string[];
    sensitiveFields?: string[];
    maxBodySize?: number;
  };

  // Error handling configuration
  errorHandling?: {
    enabled?: boolean;
    includeStackTrace?: boolean;
    sanitizeErrors?: boolean;
    reportErrors?: boolean;
  };

  // CORS configuration
  cors?: {
    enabled?: boolean;
    origin?: string | string[] | boolean;
    methods?: string[];
    allowedHeaders?: string[];
    exposedHeaders?: string[];
    credentials?: boolean;
    maxAge?: number;
  };

  // Rate limiting configuration
  rateLimit?: {
    enabled?: boolean;
    windowMs?: number;
    maxRequests?: number;
    skipSuccessfulRequests?: boolean;
    skipFailedRequests?: boolean;
    keyGenerator?: (request: NextRequest) => string;
  };

  // Security configuration
  security?: {
    enabled?: boolean;
    helmet?: boolean;
    contentSecurityPolicy?: boolean;
    xssProtection?: boolean;
    noSniff?: boolean;
    frameguard?: boolean;
    hsts?: boolean;
  };

  // Performance monitoring
  performance?: {
    enabled?: boolean;
    slowRequestThreshold?: number;
    memoryUsageTracking?: boolean;
  };
}

export interface MiddlewareHandler {
  name: string;
  execute(
    request: NextRequest,
    context: RequestContext,
    next: () => Promise<NextResponse>
  ): Promise<NextResponse>;
}

export interface ErrorMiddlewareHandler {
  name: string;
  execute(
    error: unknown,
    request: NextRequest,
    context: RequestContext
  ): Promise<NextResponse>;
}

export interface ResponseMiddlewareHandler {
  name: string;
  execute(
    response: NextResponse,
    context: RequestContext & ResponseContext
  ): Promise<NextResponse>;
}

// Standard API response format
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    code: string;
    statusCode: number;
    details?: any;
    timestamp: string;
    requestId: string;
  };
  meta?: {
    requestId: string;
    timestamp: string;
    duration: number;
    version?: string;
  };
}

// Pagination metadata
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// API response with pagination
export interface PaginatedApiResponse<T = any> extends ApiResponse<T[]> {
  pagination?: PaginationMeta;
}

// Request validation schema
export interface ValidationSchema {
  body?: any;
  query?: any;
  params?: any;
  headers?: any;
}

// Middleware execution context
export interface MiddlewareExecutionContext {
  request: NextRequest;
  requestContext: RequestContext;
  config: MiddlewareConfig;
  handlers: MiddlewareHandler[];
  errorHandlers: ErrorMiddlewareHandler[];
  responseHandlers: ResponseMiddlewareHandler[];
}

// Rate limiting store interface
export interface RateLimitStore {
  get(key: string): Promise<number | null>;
  set(key: string, value: number, ttl: number): Promise<void>;
  increment(key: string, ttl: number): Promise<number>;
  reset(key: string): Promise<void>;
}

// Security headers configuration
export interface SecurityHeaders {
  'Content-Security-Policy'?: string;
  'X-Content-Type-Options'?: string;
  'X-Frame-Options'?: string;
  'X-XSS-Protection'?: string;
  'Strict-Transport-Security'?: string;
  'Referrer-Policy'?: string;
  'Permissions-Policy'?: string;
}

// Performance metrics
export interface PerformanceMetrics {
  requestCount: number;
  averageResponseTime: number;
  errorRate: number;
  slowRequestCount: number;
  memoryUsage?: {
    used: number;
    total: number;
    percentage: number;
  };
  lastUpdated: Date;
}
