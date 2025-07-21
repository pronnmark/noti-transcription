/**
 * Automatic logger initialization module
 * Import this before any modules that use logging to ensure LoggerFactory is initialized
 */

import { LoggerFactory, createDefaultConfig } from './LoggerFactory';

// Initialize LoggerFactory with default config if not already initialized
try {
  LoggerFactory.getInstance();
} catch (error) {
  // LoggerFactory not initialized, initialize with default config
  const environment = process.env.NODE_ENV || 'development';
  const config = createDefaultConfig(environment);
  LoggerFactory.initialize(config);

  const logger = LoggerFactory.getInstance().getLogger('logging-init');
  logger.info('LoggerFactory initialized with default configuration', {
    environment,
    service: 'noti',
  });
}

// Export for convenience
export { LoggerFactory, createDefaultConfig };
