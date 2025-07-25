import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db, audioFiles, eq } from '@/lib/db';

/**
 * Creates a debug logger for a specific module
 * Centralizes debug logging configuration and eliminates duplication
 */
export const createDebugLogger = (moduleName: string) => {
  const DEBUG_API = process.env.DEBUG_API !== 'false';
  return (...args: unknown[]) => {
    if (DEBUG_API) {
      console.log(`[${moduleName}]`, ...args);
    }
  };
};

/**
 * Handles authentication check with consistent error response
 * Returns null on success, NextResponse on failure
 */
export const handleAuthCheck = async (request: NextRequest): Promise<NextResponse | null> => {
  const isAuthenticated = await requireAuth(request);
  if (!isAuthenticated) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return null;
};

/**
 * Updates file timestamp in database
 * Consolidates the repeated database operation
 */
export const updateFileTimestamp = async (fileId: number): Promise<void> => {
  await db.update(audioFiles)
    .set({ updatedAt: new Date() })
    .where(eq(audioFiles.id, fileId));
};

/**
 * Interface for file parameter extraction
 */
export interface FileParams {
  fileId: string;
}

/**
 * Parses and validates file ID from route parameters
 * Throws error if invalid, returns parsed integer if valid
 */
export const parseFileParams = async (params: Promise<FileParams>): Promise<number> => {
  const { fileId } = await params;
  const fileIdInt = parseInt(fileId);
  if (isNaN(fileIdInt) || fileIdInt <= 0) {
    throw new Error(`Invalid file ID: ${fileId}`);
  }
  return fileIdInt;
};

/**
 * Creates standardized error response
 */
export const createErrorResponse = (
  message: string,
  status: number = 500,
  details?: any,
): NextResponse => {
  const responseBody: any = { error: message };
  if (details !== undefined) {
    responseBody.details = details;
  }
  return NextResponse.json(responseBody, { status });
};

/**
 * Creates standardized success response
 */
export const createSuccessResponse = (data: any = {}, status: number = 200): NextResponse => {
  return NextResponse.json({
    success: true,
    ...data,
  }, { status });
};

/**
 * Validates database query results and returns standardized not found response
 */
export const validateQueryResult = <T>(
  result: T[],
  entityName: string = 'Resource',
): T | NextResponse => {
  if (!result || result.length === 0) {
    return createErrorResponse(`${entityName} not found`, 404);
  }
  return result[0];
};

/**
 * Wraps async route handlers with standardized error handling
 */
export const withErrorHandler = (
  handler: (request: NextRequest, context?: any) => Promise<NextResponse>,
) => {
  return async (request: NextRequest, context?: any): Promise<NextResponse> => {
    try {
      return await handler(request, context);
    } catch (error) {
      console.error('API route error:', error);
      return createErrorResponse(
        'Internal server error',
        500,
        error instanceof Error ? error.message : String(error),
      );
    }
  };
};

/**
 * Common request body validation
 */
export const validateRequestBody = async <T>(
  request: NextRequest,
  validator?: (body: any) => body is T,
): Promise<T> => {
  const body = await request.json();

  if (validator && !validator(body)) {
    throw new Error('Invalid request body format');
  }

  return body as T;
};
