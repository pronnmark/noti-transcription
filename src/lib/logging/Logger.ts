import { 
  ILogger, 
  LogLevel, 
  LogEntry, 
  LogContext, 
  LoggerConfig, 
  LogTransport,
  shouldLog 
} from './types';

export class Logger implements ILogger {
  private config: LoggerConfig;
  private timers: Map<string, number> = new Map();
  private defaultContext: LogContext;

  constructor(config: LoggerConfig) {
    this.config = config;
    this.defaultContext = config.context || {};
  }

  trace(message: string, context?: LogContext): void {
    this.log(LogLevel.TRACE, message, context);
  }

  debug(message: string, context?: LogContext): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  info(message: string, context?: LogContext): void {
    this.log(LogLevel.INFO, message, context);
  }

  warn(message: string, context?: LogContext): void {
    this.log(LogLevel.WARN, message, context);
  }

  error(message: string, error?: Error, context?: LogContext): void {
    this.log(LogLevel.ERROR, message, context, error);
  }

  fatal(message: string, error?: Error, context?: LogContext): void {
    this.log(LogLevel.FATAL, message, context, error);
  }

  log(level: LogLevel, message: string, context?: LogContext, error?: Error): void {
    if (!shouldLog(this.config.level, level)) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      message,
      context: { ...this.defaultContext, ...context },
      error,
      service: this.config.service,
      operation: context?.operation,
      requestId: context?.requestId,
      userId: context?.userId,
      sessionId: context?.sessionId,
      duration: context?.duration,
      metadata: context?.metadata,
    };

    // Write to all transports
    this.writeToTransports(entry);
  }

  child(context: LogContext): ILogger {
    return new Logger({
      ...this.config,
      context: { ...this.defaultContext, ...context },
    });
  }

  withContext(context: LogContext): ILogger {
    return this.child(context);
  }

  time(label: string): void {
    this.timers.set(label, Date.now());
  }

  timeEnd(label: string, context?: LogContext): void {
    const startTime = this.timers.get(label);
    if (startTime === undefined) {
      this.warn(`Timer '${label}' was not started`, context);
      return;
    }

    const duration = Date.now() - startTime;
    this.timers.delete(label);

    this.info(`Timer '${label}' completed`, {
      ...context,
      duration,
      timer: label,
    });
  }

  setLevel(level: LogLevel): void {
    this.config.level = level;
  }

  getLevel(): LogLevel {
    return this.config.level;
  }

  async flush(): Promise<void> {
    const flushPromises = this.config.transports
      .filter(transport => transport.flush)
      .map(transport => transport.flush!());

    await Promise.allSettled(flushPromises);
  }

  async close(): Promise<void> {
    const closePromises = this.config.transports
      .filter(transport => transport.close)
      .map(transport => transport.close!());

    await Promise.allSettled(closePromises);
  }

  // Add transport at runtime
  addTransport(transport: LogTransport): void {
    this.config.transports.push(transport);
  }

  // Remove transport at runtime
  removeTransport(name: string): void {
    this.config.transports = this.config.transports.filter(
      transport => transport.name !== name
    );
  }

  // Get transport by name
  getTransport(name: string): LogTransport | undefined {
    return this.config.transports.find(transport => transport.name === name);
  }

  // List all transports
  getTransports(): LogTransport[] {
    return [...this.config.transports];
  }

  private async writeToTransports(entry: LogEntry): Promise<void> {
    const writePromises = this.config.transports.map(async (transport) => {
      try {
        await transport.write(entry);
      } catch (error) {
        // Avoid infinite recursion by using console directly
        console.error(`Transport '${transport.name}' failed to write log:`, error);
      }
    });

    await Promise.allSettled(writePromises);
  }
}

// Performance logger for measuring operations
export class PerformanceLogger {
  private logger: ILogger;
  private startTimes: Map<string, number> = new Map();

  constructor(logger: ILogger) {
    this.logger = logger;
  }

  start(operation: string, context?: LogContext): void {
    this.startTimes.set(operation, Date.now());
    this.logger.debug(`Starting operation: ${operation}`, context);
  }

  end(operation: string, context?: LogContext): number {
    const startTime = this.startTimes.get(operation);
    if (startTime === undefined) {
      this.logger.warn(`Operation '${operation}' was not started`);
      return 0;
    }

    const duration = Date.now() - startTime;
    this.startTimes.delete(operation);

    this.logger.info(`Completed operation: ${operation}`, {
      ...context,
      duration,
      operation,
    });

    return duration;
  }

  measure<T>(operation: string, fn: () => T, context?: LogContext): T;
  measure<T>(operation: string, fn: () => Promise<T>, context?: LogContext): Promise<T>;
  measure<T>(operation: string, fn: () => T | Promise<T>, context?: LogContext): T | Promise<T> {
    this.start(operation, context);

    try {
      const result = fn();

      if (result instanceof Promise) {
        return result
          .then((value) => {
            this.end(operation, context);
            return value;
          })
          .catch((error) => {
            this.end(operation, { ...context, error: true });
            throw error;
          });
      } else {
        this.end(operation, context);
        return result;
      }
    } catch (error) {
      this.end(operation, { ...context, error: true });
      throw error;
    }
  }
}

// Request logger for HTTP requests
export class RequestLogger {
  private logger: ILogger;

  constructor(logger: ILogger) {
    this.logger = logger;
  }

  logRequest(
    method: string,
    url: string,
    context?: LogContext
  ): { requestId: string; startTime: number } {
    const requestId = this.generateRequestId();
    const startTime = Date.now();

    this.logger.info(`${method} ${url}`, {
      ...context,
      requestId,
      method,
      url,
      type: 'request_start',
    });

    return { requestId, startTime };
  }

  logResponse(
    method: string,
    url: string,
    statusCode: number,
    requestId: string,
    startTime: number,
    context?: LogContext
  ): void {
    const duration = Date.now() - startTime;

    this.logger.info(`${method} ${url} ${statusCode}`, {
      ...context,
      requestId,
      method,
      url,
      statusCode,
      duration,
      type: 'request_end',
    });
  }

  logError(
    method: string,
    url: string,
    error: Error,
    requestId: string,
    startTime: number,
    context?: LogContext
  ): void {
    const duration = Date.now() - startTime;

    this.logger.error(`${method} ${url} ERROR`, error, {
      ...context,
      requestId,
      method,
      url,
      duration,
      type: 'request_error',
    });
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
