// Simplified API Handler following SOLID principles
// Single Responsibility: Handle HTTP concerns only
// Open/Closed: Extensible through middleware
// Dependency Inversion: Depends on abstractions

import { NextRequest, NextResponse } from 'next/server';
import { serviceContainer, areServicesInitialized, initializeServicesOnce } from '../services';
import { errorHandler } from '../errors';
import '../logging/init'; // Ensure logger is initialized
import { createServiceLogger } from '../logging';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: {
    timestamp: string;
    requestId: string;
    executionTime: number;
  };
}

export interface ApiContext {
  requestId: string;
  startTime: number;
  logger: any;
}

export type ApiHandler<T = any> = (
  request: NextRequest,
  context: ApiContext
) => Promise<T>;

// KISS principle - Simple, focused API handler
export class ApiHandlerBuilder {
  private static _logger: any;

  private static get logger() {
    if (!this._logger) {
      this._logger = createServiceLogger('ApiHandler');
    }
    return this._logger;
  }

  static create<T>(handler: ApiHandler<T>) {
    return async (request: NextRequest): Promise<NextResponse> => {
      const requestId = this.generateRequestId();
      const startTime = Date.now();
      const logger = this.logger.child({ requestId });

      const context: ApiContext = {
        requestId,
        startTime,
        logger,
      };

      try {
        logger.info('API request started', {
          method: request.method,
          url: request.url,
        });

        // Ensure services are initialized
        await this.ensureServicesReady();

        // Execute handler
        const result = await handler(request, context);

        // Create success response
        const response = this.createSuccessResponse(result, context);

        logger.info('API request completed', {
          executionTime: Date.now() - startTime,
          status: 'success',
        });

        return NextResponse.json(response);

      } catch (error) {
        // Log full error details
        logger.error('API request failed', error instanceof Error ? error : new Error(String(error)));
        if (error instanceof Error) {
          logger.error('Detailed error info:', {
            message: error.message,
            stack: error.stack,
            name: error.name,
            cause: (error as any).cause,
            code: (error as any).code,
          });
        }

        // Handle error through centralized error handler
        const handledError = await errorHandler.handleError(error instanceof Error ? error : new Error(String(error)));

        const response = this.createErrorResponse(handledError, context);

        return NextResponse.json(response, {
          status: handledError.error.statusCode || 500,
        });
      }
    };
  }

  private static async ensureServicesReady(): Promise<void> {
    if (!areServicesInitialized()) {
      await initializeServicesOnce();
    }
  }

  private static createSuccessResponse<T>(data: T, context: ApiContext): ApiResponse<T> {
    return {
      success: true,
      data,
      meta: {
        timestamp: new Date().toISOString(),
        requestId: context.requestId,
        executionTime: Date.now() - context.startTime,
      },
    };
  }

  private static createErrorResponse(error: any, context: ApiContext): ApiResponse {
    return {
      success: false,
      error: {
        code: error.code || 'INTERNAL_ERROR',
        message: error.message || 'An unexpected error occurred',
        details: process.env.NODE_ENV === 'development' ? error.details : undefined,
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: context.requestId,
        executionTime: Date.now() - context.startTime,
      },
    };
  }

  private static generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }
}

// Convenience function for creating API handlers (DRY principle)
export const createApiHandler = <T>(handler: ApiHandler<T>) => {
  return ApiHandlerBuilder.create(handler);
};

// Common validation helpers (DRY principle)
export class ApiValidation {
  static requireMethod(request: NextRequest, method: string): void {
    if (request.method !== method) {
      throw new Error(`Method ${request.method} not allowed. Expected ${method}.`);
    }
  }

  static async parseJsonBody<T = any>(request: NextRequest): Promise<T> {
    try {
      return await request.json() as T;
    } catch (error) {
      throw new Error('Invalid JSON in request body');
    }
  }

  static getQueryParam(request: NextRequest, param: string, required = false): string | null {
    const url = new URL(request.url);
    const value = url.searchParams.get(param);

    if (required && !value) {
      throw new Error(`Missing required query parameter: ${param}`);
    }

    return value;
  }

  static getPathParam(request: NextRequest, param: string): string {
    // Extract from URL path - simplified implementation
    const url = new URL(request.url);
    const pathSegments = url.pathname.split('/').filter(Boolean);

    // This is a simplified implementation - in a real app you'd use a proper router
    const paramIndex = pathSegments.findIndex(segment => segment.startsWith(':'));
    if (paramIndex === -1) {
      throw new Error(`Path parameter ${param} not found`);
    }

    return pathSegments[paramIndex + 1] || '';
  }
}

// Service access helpers (DRY principle)
export class ApiServices {
  static get audio() {
    return serviceContainer.audioService;
  }

  static get transcription() {
    return serviceContainer.transcriptionService;
  }

  static get extraction() {
    return serviceContainer.extractionService;
  }

  static get summarization() {
    return serviceContainer.summarizationService;
  }

  static get fileUpload() {
    return serviceContainer.fileUploadService;
  }

  static get customAI() {
    return serviceContainer.customAIService;
  }

  static get storage() {
    return serviceContainer.storageService;
  }

}
