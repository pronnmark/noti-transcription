// Core logging types and interfaces
export * from './types';

// Logger implementations
export * from './Logger';

// Formatters and transports
export * from './formatters';
export * from './transports';

// Logger factory and configuration
export * from './LoggerFactory';
import { LoggerFactory } from './LoggerFactory';

// Re-export commonly used items
export {
  LoggerFactory,
  initializeLogging,
  getGlobalLogger,
  setGlobalLogger,
  log,
} from './LoggerFactory';

export { Logger, PerformanceLogger, RequestLogger } from './Logger';
export { LogLevel, parseLogLevel, formatLogLevel } from './types';

// Utility functions
export function createServiceLogger(serviceName: string, context?: Record<string, any>) {
  let factory: LoggerFactory;
  try {
    factory = LoggerFactory.getInstance();
  } catch (error) {
    // Initialize with default config if not already initialized
    const { createDefaultConfig } = require('./LoggerFactory');
    factory = LoggerFactory.initialize(createDefaultConfig());
  }
  return factory.createChildLogger(serviceName, context || {});
}

export function withRequestId(requestId: string) {
  let factory: LoggerFactory;
  try {
    factory = LoggerFactory.getInstance();
  } catch (error) {
    const { createDefaultConfig } = require('./LoggerFactory');
    factory = LoggerFactory.initialize(createDefaultConfig());
  }
  const logger = factory.getLogger();
  return logger.child({ requestId });
}

export function withUserId(userId: string) {
  let factory: LoggerFactory;
  try {
    factory = LoggerFactory.getInstance();
  } catch (error) {
    const { createDefaultConfig } = require('./LoggerFactory');
    factory = LoggerFactory.initialize(createDefaultConfig());
  }
  const logger = factory.getLogger();
  return logger.child({ userId });
}

export function withContext(context: Record<string, any>) {
  let factory: LoggerFactory;
  try {
    factory = LoggerFactory.getInstance();
  } catch (error) {
    const { createDefaultConfig } = require('./LoggerFactory');
    factory = LoggerFactory.initialize(createDefaultConfig());
  }
  const logger = factory.getLogger();
  return logger.child(context);
}
