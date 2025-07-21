import {
  LogEntry,
  LogFormatter,
  LogLevel,
  LOG_COLORS,
  LOG_ICONS,
  RESET_COLOR,
  formatLogLevel,
} from './types';

export class JsonFormatter implements LogFormatter {
  constructor(
    private options: {
      pretty?: boolean;
      includeStackTrace?: boolean;
    } = {},
  ) {}

  format(entry: LogEntry): string {
    const logObject = {
      timestamp: entry.timestamp.toISOString(),
      level: formatLogLevel(entry.level),
      message: entry.message,
      service: entry.service,
      operation: entry.operation,
      requestId: entry.requestId,
      userId: entry.userId,
      sessionId: entry.sessionId,
      duration: entry.duration,
      context: entry.context,
      metadata: entry.metadata,
      ...(entry.error && {
        error: {
          name: entry.error.name,
          message: entry.error.message,
          ...(this.options.includeStackTrace && { stack: entry.error.stack }),
        },
      }),
    };

    // Remove undefined values
    const cleanObject = Object.fromEntries(
      Object.entries(logObject).filter(([_, value]) => value !== undefined),
    );

    return this.options.pretty
      ? JSON.stringify(cleanObject, null, 2)
      : JSON.stringify(cleanObject);
  }
}

export class ConsoleFormatter implements LogFormatter {
  constructor(
    private options: {
      colors?: boolean;
      icons?: boolean;
      timestamp?: boolean;
      includeContext?: boolean;
      includeStackTrace?: boolean;
    } = {},
  ) {
    this.options = {
      colors: true,
      icons: true,
      timestamp: true,
      includeContext: true,
      includeStackTrace: false,
      ...options,
    };
  }

  format(entry: LogEntry): string {
    const parts: string[] = [];

    // Timestamp
    if (this.options.timestamp) {
      const timestamp = entry.timestamp.toISOString();
      parts.push(`[${timestamp}]`);
    }

    // Level with color and icon
    const levelStr = formatLogLevel(entry.level).toUpperCase();
    let levelPart = levelStr;

    if (this.options.icons) {
      levelPart = `${LOG_ICONS[entry.level]} ${levelPart}`;
    }

    if (this.options.colors) {
      levelPart = `${LOG_COLORS[entry.level]}${levelPart}${RESET_COLOR}`;
    }

    parts.push(`[${levelPart}]`);

    // Service and operation
    if (entry.service) {
      parts.push(`[${entry.service}${entry.operation ? `:${entry.operation}` : ''}]`);
    }

    // Request ID
    if (entry.requestId) {
      parts.push(`[${entry.requestId.substring(0, 8)}]`);
    }

    // Duration
    if (entry.duration !== undefined) {
      parts.push(`[${entry.duration}ms]`);
    }

    // Message
    parts.push(entry.message);

    let result = parts.join(' ');

    // Context
    if (this.options.includeContext && entry.context && Object.keys(entry.context).length > 0) {
      result += `\n  Context: ${JSON.stringify(entry.context, null, 2)}`;
    }

    // Metadata
    if (entry.metadata && Object.keys(entry.metadata).length > 0) {
      result += `\n  Metadata: ${JSON.stringify(entry.metadata, null, 2)}`;
    }

    // Error
    if (entry.error) {
      result += `\n  Error: ${entry.error.name}: ${entry.error.message}`;

      if (this.options.includeStackTrace && entry.error.stack) {
        result += `\n  Stack: ${entry.error.stack}`;
      }
    }

    return result;
  }
}

export class SimpleFormatter implements LogFormatter {
  format(entry: LogEntry): string {
    const timestamp = entry.timestamp.toISOString();
    const level = formatLogLevel(entry.level).toUpperCase();
    const service = entry.service ? `[${entry.service}]` : '';
    const requestId = entry.requestId ? `[${entry.requestId.substring(0, 8)}]` : '';

    return `${timestamp} ${level} ${service}${requestId} ${entry.message}`;
  }
}

export class DevFormatter implements LogFormatter {
  format(entry: LogEntry): string {
    const time = entry.timestamp.toLocaleTimeString();
    const level = formatLogLevel(entry.level).toUpperCase();
    const icon = LOG_ICONS[entry.level];
    const color = LOG_COLORS[entry.level];

    let result = `${color}${icon} ${time} [${level}]${RESET_COLOR}`;

    if (entry.service) {
      result += ` ${entry.service}`;
      if (entry.operation) {
        result += `.${entry.operation}`;
      }
    }

    result += ` ${entry.message}`;

    if (entry.duration !== undefined) {
      result += ` ${color}(${entry.duration}ms)${RESET_COLOR}`;
    }

    if (entry.context && Object.keys(entry.context).length > 0) {
      const contextStr = Object.entries(entry.context)
        .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
        .join(' ');
      result += ` ${contextStr}`;
    }

    if (entry.error) {
      result += `\n  ${LOG_COLORS[LogLevel.ERROR]}Error: ${entry.error.message}${RESET_COLOR}`;
    }

    return result;
  }
}

export class StructuredFormatter implements LogFormatter {
  constructor(
    private options: {
      separator?: string;
      keyValueSeparator?: string;
      includeEmpty?: boolean;
    } = {},
  ) {
    this.options = {
      separator: ' ',
      keyValueSeparator: '=',
      includeEmpty: false,
      ...options,
    };
  }

  format(entry: LogEntry): string {
    const fields: string[] = [];

    // Core fields
    fields.push(`timestamp${this.options.keyValueSeparator}${entry.timestamp.toISOString()}`);
    fields.push(`level${this.options.keyValueSeparator}${formatLogLevel(entry.level)}`);
    fields.push(`message${this.options.keyValueSeparator}"${entry.message}"`);

    // Optional fields
    if (entry.service || this.options.includeEmpty) {
      fields.push(`service${this.options.keyValueSeparator}${entry.service || 'null'}`);
    }

    if (entry.operation || this.options.includeEmpty) {
      fields.push(`operation${this.options.keyValueSeparator}${entry.operation || 'null'}`);
    }

    if (entry.requestId || this.options.includeEmpty) {
      fields.push(`requestId${this.options.keyValueSeparator}${entry.requestId || 'null'}`);
    }

    if (entry.userId || this.options.includeEmpty) {
      fields.push(`userId${this.options.keyValueSeparator}${entry.userId || 'null'}`);
    }

    if (entry.duration !== undefined || this.options.includeEmpty) {
      fields.push(`duration${this.options.keyValueSeparator}${entry.duration ?? 'null'}`);
    }

    // Context fields
    if (entry.context) {
      for (const [key, value] of Object.entries(entry.context)) {
        fields.push(`${key}${this.options.keyValueSeparator}${JSON.stringify(value)}`);
      }
    }

    // Error fields
    if (entry.error) {
      fields.push(`error.name${this.options.keyValueSeparator}${entry.error.name}`);
      fields.push(`error.message${this.options.keyValueSeparator}"${entry.error.message}"`);
    }

    return fields.join(this.options.separator);
  }
}

// Factory function to create formatters
export function createFormatter(
  type: 'json' | 'console' | 'simple' | 'dev' | 'structured',
  options?: any,
): LogFormatter {
  switch (type) {
    case 'json':
      return new JsonFormatter(options);
    case 'console':
      return new ConsoleFormatter(options);
    case 'simple':
      return new SimpleFormatter();
    case 'dev':
      return new DevFormatter();
    case 'structured':
      return new StructuredFormatter(options);
    default:
      return new ConsoleFormatter();
  }
}
