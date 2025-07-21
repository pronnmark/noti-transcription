import { Logger, PerformanceLogger, RequestLogger } from './Logger';
import { createTransport } from './transports';
import { createFormatter } from './formatters';
import { 
  ILogger, 
  LogLevel, 
  LoggerConfig, 
  LogTransport, 
  parseLogLevel 
} from './types';

export interface LoggerFactoryConfig {
  level: string | LogLevel;
  service?: string;
  environment?: string;
  transports: TransportConfig[];
  defaultContext?: Record<string, any>;
}

export interface TransportConfig {
  type: 'console' | 'file' | 'http' | 'memory';
  level?: string | LogLevel;
  options?: any;
}

export class LoggerFactory {
  private static instance: LoggerFactory;
  private loggers: Map<string, ILogger> = new Map();
  private config: LoggerFactoryConfig;

  private constructor(config: LoggerFactoryConfig) {
    this.config = config;
  }

  static getInstance(config?: LoggerFactoryConfig): LoggerFactory {
    if (!LoggerFactory.instance) {
      if (!config) {
        throw new Error('LoggerFactory must be initialized with config');
      }
      LoggerFactory.instance = new LoggerFactory(config);
    }
    return LoggerFactory.instance;
  }

  static initialize(config: LoggerFactoryConfig): LoggerFactory {
    LoggerFactory.instance = new LoggerFactory(config);
    return LoggerFactory.instance;
  }

  getLogger(name?: string): ILogger {
    const loggerName = name || 'default';
    
    if (!this.loggers.has(loggerName)) {
      const logger = this.createLogger(loggerName);
      this.loggers.set(loggerName, logger);
    }

    return this.loggers.get(loggerName)!;
  }

  getPerformanceLogger(name?: string): PerformanceLogger {
    const logger = this.getLogger(name);
    return new PerformanceLogger(logger);
  }

  getRequestLogger(name?: string): RequestLogger {
    const logger = this.getLogger(name);
    return new RequestLogger(logger);
  }

  createChildLogger(name: string, context: Record<string, any>): ILogger {
    const parentLogger = this.getLogger();
    return parentLogger.child({ service: name, ...context });
  }

  private createLogger(name: string): ILogger {
    const transports = this.createTransports();
    
    const config: LoggerConfig = {
      level: parseLogLevel(this.config.level),
      service: name === 'default' ? this.config.service : name,
      transports,
      context: this.config.defaultContext,
    };

    return new Logger(config);
  }

  private createTransports(): LogTransport[] {
    return this.config.transports.map(transportConfig => {
      const level = transportConfig.level 
        ? parseLogLevel(transportConfig.level)
        : parseLogLevel(this.config.level);

      return createTransport(transportConfig.type, level, transportConfig.options);
    });
  }

  // Update configuration at runtime
  updateConfig(config: Partial<LoggerFactoryConfig>): void {
    this.config = { ...this.config, ...config };
    
    // Clear existing loggers to force recreation with new config
    this.loggers.clear();
  }

  // Get all active loggers
  getActiveLoggers(): string[] {
    return Array.from(this.loggers.keys());
  }

  // Flush all loggers
  async flushAll(): Promise<void> {
    const flushPromises = Array.from(this.loggers.values()).map(logger => 
      logger.flush()
    );
    await Promise.allSettled(flushPromises);
  }

  // Close all loggers
  async closeAll(): Promise<void> {
    const closePromises = Array.from(this.loggers.values()).map(logger => 
      logger.close()
    );
    await Promise.allSettled(closePromises);
    this.loggers.clear();
  }
}

// Default configuration factory
export function createDefaultConfig(environment: string = 'development'): LoggerFactoryConfig {
  const isDevelopment = environment === 'development';
  const isProduction = environment === 'production';

  const config: LoggerFactoryConfig = {
    level: process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info'),
    service: process.env.SERVICE_NAME || 'noti',
    environment,
    transports: [],
    defaultContext: {
      environment,
      version: process.env.APP_VERSION || '1.0.0',
    },
  };

  // Console transport (always present)
  config.transports.push({
    type: 'console',
    level: isDevelopment ? 'debug' : 'info',
    options: {
      formatter: createFormatter(isDevelopment ? 'dev' : 'simple'),
    },
  });

  // File transport for production
  if (isProduction) {
    config.transports.push({
      type: 'file',
      level: 'info',
      options: {
        filePath: process.env.LOG_FILE || './logs/app.log',
        formatter: createFormatter('json'),
        maxSize: 10 * 1024 * 1024, // 10MB
        maxFiles: 5,
      },
    });

    // Error file transport
    config.transports.push({
      type: 'file',
      level: 'error',
      options: {
        filePath: process.env.ERROR_LOG_FILE || './logs/error.log',
        formatter: createFormatter('json', { includeStackTrace: true }),
        maxSize: 10 * 1024 * 1024, // 10MB
        maxFiles: 5,
      },
    });
  }

  // HTTP transport if configured
  if (process.env.LOG_ENDPOINT) {
    config.transports.push({
      type: 'http',
      level: 'warn',
      options: {
        endpoint: process.env.LOG_ENDPOINT,
        apiKey: process.env.LOG_API_KEY,
        batchSize: 10,
        flushInterval: 5000,
      },
    });
  }

  // Memory transport for development (useful for debugging)
  if (isDevelopment) {
    config.transports.push({
      type: 'memory',
      level: 'debug',
      options: {
        maxEntries: 1000,
      },
    });
  }

  return config;
}

// Convenience function to initialize logging
export function initializeLogging(environment?: string): LoggerFactory {
  const config = createDefaultConfig(environment);
  return LoggerFactory.initialize(config);
}

// Global logger instance
let globalLogger: ILogger | undefined;

export function getGlobalLogger(): ILogger {
  if (!globalLogger) {
    let factory: LoggerFactory;
    try {
      factory = LoggerFactory.getInstance();
    } catch (error) {
      // Auto-initialize with default config if not initialized
      factory = LoggerFactory.initialize(createDefaultConfig());
    }
    globalLogger = factory.getLogger('global');
  }
  return globalLogger;
}

export function setGlobalLogger(logger: ILogger): void {
  globalLogger = logger;
}

// Convenience logging functions
export const log = {
  trace: (message: string, context?: Record<string, any>) => 
    getGlobalLogger().trace(message, context),
  
  debug: (message: string, context?: Record<string, any>) => 
    getGlobalLogger().debug(message, context),
  
  info: (message: string, context?: Record<string, any>) => 
    getGlobalLogger().info(message, context),
  
  warn: (message: string, context?: Record<string, any>) => 
    getGlobalLogger().warn(message, context),
  
  error: (message: string, error?: Error, context?: Record<string, any>) => 
    getGlobalLogger().error(message, error, context),
  
  fatal: (message: string, error?: Error, context?: Record<string, any>) => 
    getGlobalLogger().fatal(message, error, context),
};
