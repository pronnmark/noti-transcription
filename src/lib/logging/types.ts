export enum LogLevel {
  TRACE = 0,
  DEBUG = 1,
  INFO = 2,
  WARN = 3,
  ERROR = 4,
  FATAL = 5,
}

export interface LogContext {
  [key: string]: any;
}

export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  message: string;
  context?: LogContext;
  error?: Error;
  service?: string;
  operation?: string;
  requestId?: string;
  userId?: string;
  sessionId?: string;
  duration?: number;
  metadata?: Record<string, any>;
}

export interface LogFormatter {
  format(entry: LogEntry): string;
}

export interface LogTransport {
  name: string;
  level: LogLevel;
  write(entry: LogEntry): Promise<void>;
  flush?(): Promise<void>;
  close?(): Promise<void>;
}

export interface LoggerConfig {
  level: LogLevel;
  service?: string;
  transports: LogTransport[];
  context?: LogContext;
  enableStackTrace?: boolean;
  enableTimestamp?: boolean;
  enableColors?: boolean;
}

export interface ILogger {
  trace(message: string, context?: LogContext): void;
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, error?: Error, context?: LogContext): void;
  fatal(message: string, error?: Error, context?: LogContext): void;

  // Contextual logging
  child(context: LogContext): ILogger;
  withContext(context: LogContext): ILogger;

  // Performance logging
  time(label: string): void;
  timeEnd(label: string, context?: LogContext): void;

  // Structured logging
  log(level: LogLevel, message: string, context?: LogContext, error?: Error): void;

  // Configuration
  setLevel(level: LogLevel): void;
  getLevel(): LogLevel;

  // Lifecycle
  flush(): Promise<void>;
  close(): Promise<void>;
}

// Utility types
export type LogLevelString = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export const LOG_LEVEL_NAMES: Record<LogLevel, LogLevelString> = {
  [LogLevel.TRACE]: 'trace',
  [LogLevel.DEBUG]: 'debug',
  [LogLevel.INFO]: 'info',
  [LogLevel.WARN]: 'warn',
  [LogLevel.ERROR]: 'error',
  [LogLevel.FATAL]: 'fatal',
};

export const LOG_LEVEL_VALUES: Record<LogLevelString, LogLevel> = {
  trace: LogLevel.TRACE,
  debug: LogLevel.DEBUG,
  info: LogLevel.INFO,
  warn: LogLevel.WARN,
  error: LogLevel.ERROR,
  fatal: LogLevel.FATAL,
};

// Color codes for console output
export const LOG_COLORS: Record<LogLevel, string> = {
  [LogLevel.TRACE]: '\x1b[90m', // Gray
  [LogLevel.DEBUG]: '\x1b[36m', // Cyan
  [LogLevel.INFO]: '\x1b[32m',  // Green
  [LogLevel.WARN]: '\x1b[33m',  // Yellow
  [LogLevel.ERROR]: '\x1b[31m', // Red
  [LogLevel.FATAL]: '\x1b[35m', // Magenta
};

export const RESET_COLOR = '\x1b[0m';

// Log level icons
export const LOG_ICONS: Record<LogLevel, string> = {
  [LogLevel.TRACE]: '🔍',
  [LogLevel.DEBUG]: '🐛',
  [LogLevel.INFO]: 'ℹ️',
  [LogLevel.WARN]: '⚠️',
  [LogLevel.ERROR]: '❌',
  [LogLevel.FATAL]: '💀',
};

// Helper functions
export function parseLogLevel(level: string | number): LogLevel {
  if (typeof level === 'number') {
    return level as LogLevel;
  }

  const normalizedLevel = level.toLowerCase() as LogLevelString;
  return LOG_LEVEL_VALUES[normalizedLevel] ?? LogLevel.INFO;
}

export function formatLogLevel(level: LogLevel): string {
  return LOG_LEVEL_NAMES[level] || 'unknown';
}

export function shouldLog(currentLevel: LogLevel, targetLevel: LogLevel): boolean {
  return targetLevel >= currentLevel;
}
