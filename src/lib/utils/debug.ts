/**
 * Centralized debug logging utility
 * Replaces duplicated debugLog functions across the codebase
 */

const DEBUG_API = process.env.DEBUG_API !== 'false';
const DEBUG_WORKER = process.env.DEBUG_WORKER !== 'false';
const DEBUG_SERVICES = process.env.DEBUG_SERVICES !== 'false';

export type DebugContext = 'api' | 'worker' | 'services' | 'service' | 'dynamicPrompt' | 'general';

/**
 * Debug logger with context-based filtering
 * @param context - The context of the debug message (api, worker, services, general)
 * @param args - Arguments to log
 */
export function debugLog(
  context: DebugContext = 'general',
  ...args: unknown[]
): void {
  const shouldLog =
    context === 'api'
      ? DEBUG_API
      : context === 'worker'
        ? DEBUG_WORKER
        : context === 'services' || context === 'service' || context === 'dynamicPrompt'
          ? DEBUG_SERVICES
          : true; // general context always logs in debug mode

  if (shouldLog) {
    const prefix = `[${context.toUpperCase()}]`;
    console.log(prefix, ...args);
  }
}

/**
 * Creates a context-specific debug logger
 * @param context - The debug context
 * @returns A debug function for that specific context
 */
export function createDebugLogger(context: DebugContext) {
  return (...args: unknown[]) => debugLog(context, ...args);
}

// Pre-configured loggers for common contexts
export const apiDebug = createDebugLogger('api');
export const workerDebug = createDebugLogger('worker');
export const servicesDebug = createDebugLogger('services');

/**
 * Logs performance metrics
 * @param operation - Name of the operation
 * @param startTime - Start time from Date.now()
 * @param context - Debug context
 */
export function debugPerformance(
  operation: string,
  startTime: number,
  context: DebugContext = 'general'
): void {
  const duration = Date.now() - startTime;
  debugLog(context, `⏱️ ${operation} completed in ${duration}ms`);
}

/**
 * Logs error details with stack trace in debug mode
 * @param error - The error to log
 * @param context - Debug context
 * @param additionalInfo - Any additional information
 */
export function debugError(
  error: unknown,
  context: DebugContext = 'general',
  additionalInfo?: Record<string, unknown>
): void {
  if (error instanceof Error) {
    debugLog(context, '❌ Error:', error.message);
    debugLog(context, 'Stack:', error.stack);
  } else {
    debugLog(context, '❌ Error:', error);
  }

  if (additionalInfo) {
    debugLog(context, 'Additional Info:', additionalInfo);
  }
}
