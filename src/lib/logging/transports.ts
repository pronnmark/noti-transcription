import { LogEntry, LogTransport, LogLevel, LogFormatter } from './types';
import { createFormatter } from './formatters';

export class ConsoleTransport implements LogTransport {
  public readonly name = 'console';
  
  constructor(
    public readonly level: LogLevel = LogLevel.INFO,
    private formatter: LogFormatter = createFormatter('console')
  ) {}

  async write(entry: LogEntry): Promise<void> {
    if (entry.level < this.level) {
      return;
    }

    const formatted = this.formatter.format(entry);
    
    // Use appropriate console method based on log level
    switch (entry.level) {
      case LogLevel.TRACE:
      case LogLevel.DEBUG:
        console.debug(formatted);
        break;
      case LogLevel.INFO:
        console.info(formatted);
        break;
      case LogLevel.WARN:
        console.warn(formatted);
        break;
      case LogLevel.ERROR:
      case LogLevel.FATAL:
        console.error(formatted);
        break;
      default:
        console.log(formatted);
    }
  }
}

export class FileTransport implements LogTransport {
  public readonly name = 'file';
  private writeQueue: string[] = [];
  private isWriting = false;
  private writeTimer?: NodeJS.Timeout;

  constructor(
    public readonly level: LogLevel,
    private filePath: string,
    private formatter: LogFormatter = createFormatter('json'),
    private options: {
      maxSize?: number;
      maxFiles?: number;
      flushInterval?: number;
      autoFlush?: boolean;
    } = {}
  ) {
    this.options = {
      maxSize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
      flushInterval: 5000, // 5 seconds
      autoFlush: true,
      ...options,
    };

    if (this.options.autoFlush && this.options.flushInterval) {
      this.startFlushTimer();
    }
  }

  async write(entry: LogEntry): Promise<void> {
    if (entry.level < this.level) {
      return;
    }

    const formatted = this.formatter.format(entry);
    this.writeQueue.push(formatted + '\n');

    if (this.options.autoFlush) {
      this.scheduleFlush();
    }
  }

  async flush(): Promise<void> {
    if (this.writeQueue.length === 0 || this.isWriting) {
      return;
    }

    this.isWriting = true;

    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      
      // Ensure directory exists
      const dir = path.dirname(this.filePath);
      await fs.mkdir(dir, { recursive: true });

      // Check file size and rotate if necessary
      await this.rotateIfNeeded();

      // Write queued entries
      const content = this.writeQueue.join('');
      await fs.appendFile(this.filePath, content);
      
      this.writeQueue = [];
    } catch (error) {
      console.error('Failed to write to log file:', error);
    } finally {
      this.isWriting = false;
    }
  }

  async close(): Promise<void> {
    if (this.writeTimer) {
      clearInterval(this.writeTimer);
    }
    await this.flush();
  }

  private async rotateIfNeeded(): Promise<void> {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      
      const stats = await fs.stat(this.filePath).catch(() => null);
      
      if (!stats || stats.size < (this.options.maxSize || 0)) {
        return;
      }

      // Rotate files
      const ext = path.extname(this.filePath);
      const base = this.filePath.slice(0, -ext.length);
      
      // Remove oldest file if we have too many
      const oldestFile = `${base}.${this.options.maxFiles}${ext}`;
      await fs.unlink(oldestFile).catch(() => {});

      // Shift existing files
      for (let i = (this.options.maxFiles || 1) - 1; i > 0; i--) {
        const oldFile = i === 1 ? this.filePath : `${base}.${i}${ext}`;
        const newFile = `${base}.${i + 1}${ext}`;
        
        await fs.rename(oldFile, newFile).catch(() => {});
      }

      // Move current file to .1
      await fs.rename(this.filePath, `${base}.1${ext}`).catch(() => {});
    } catch (error) {
      console.error('Failed to rotate log file:', error);
    }
  }

  private scheduleFlush(): void {
    if (!this.writeTimer) {
      this.writeTimer = setTimeout(() => {
        this.flush().catch(console.error);
        this.writeTimer = undefined;
      }, 100); // Small delay to batch writes
    }
  }

  private startFlushTimer(): void {
    setInterval(() => {
      this.flush().catch(console.error);
    }, this.options.flushInterval);
  }
}

export class HttpTransport implements LogTransport {
  public readonly name = 'http';
  private logQueue: LogEntry[] = [];
  private flushTimer?: NodeJS.Timeout;

  constructor(
    public readonly level: LogLevel,
    private endpoint: string,
    private options: {
      apiKey?: string;
      batchSize?: number;
      flushInterval?: number;
      timeout?: number;
      headers?: Record<string, string>;
    } = {}
  ) {
    this.options = {
      batchSize: 10,
      flushInterval: 5000,
      timeout: 10000,
      ...options,
    };

    if (this.options.flushInterval) {
      this.startFlushTimer();
    }
  }

  async write(entry: LogEntry): Promise<void> {
    if (entry.level < this.level) {
      return;
    }

    this.logQueue.push(entry);

    if (this.logQueue.length >= (this.options.batchSize || 10)) {
      await this.flush();
    }
  }

  async flush(): Promise<void> {
    if (this.logQueue.length === 0) {
      return;
    }

    const entries = [...this.logQueue];
    this.logQueue = [];

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.options.timeout);

      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.options.apiKey && { 'Authorization': `Bearer ${this.options.apiKey}` }),
          ...this.options.headers,
        },
        body: JSON.stringify({
          logs: entries.map(entry => ({
            timestamp: entry.timestamp.toISOString(),
            level: entry.level,
            message: entry.message,
            service: entry.service,
            operation: entry.operation,
            requestId: entry.requestId,
            userId: entry.userId,
            context: entry.context,
            error: entry.error ? {
              name: entry.error.name,
              message: entry.error.message,
              stack: entry.error.stack,
            } : undefined,
          })),
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Failed to send logs to HTTP endpoint:', error);
      // Re-queue failed logs (with limit to prevent infinite growth)
      if (this.logQueue.length < 1000) {
        this.logQueue.unshift(...entries);
      }
    }
  }

  async close(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    await this.flush();
  }

  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      this.flush().catch(console.error);
    }, this.options.flushInterval);
  }
}

export class MemoryTransport implements LogTransport {
  public readonly name = 'memory';
  private logs: LogEntry[] = [];

  constructor(
    public readonly level: LogLevel,
    private maxEntries: number = 1000
  ) {}

  async write(entry: LogEntry): Promise<void> {
    if (entry.level < this.level) {
      return;
    }

    this.logs.push(entry);

    // Remove oldest entries if we exceed the limit
    if (this.logs.length > this.maxEntries) {
      this.logs = this.logs.slice(-this.maxEntries);
    }
  }

  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  getLogsByLevel(level: LogLevel): LogEntry[] {
    return this.logs.filter(log => log.level === level);
  }

  getLogsSince(timestamp: Date): LogEntry[] {
    return this.logs.filter(log => log.timestamp >= timestamp);
  }

  clear(): void {
    this.logs = [];
  }

  getStats(): {
    total: number;
    byLevel: Record<string, number>;
    oldest?: Date;
    newest?: Date;
  } {
    const byLevel: Record<string, number> = {};
    
    for (const log of this.logs) {
      const levelName = LogLevel[log.level].toLowerCase();
      byLevel[levelName] = (byLevel[levelName] || 0) + 1;
    }

    return {
      total: this.logs.length,
      byLevel,
      oldest: this.logs.length > 0 ? this.logs[0].timestamp : undefined,
      newest: this.logs.length > 0 ? this.logs[this.logs.length - 1].timestamp : undefined,
    };
  }
}

// Factory function to create transports
export function createTransport(
  type: 'console' | 'file' | 'http' | 'memory',
  level: LogLevel,
  options?: any
): LogTransport {
  switch (type) {
    case 'console':
      return new ConsoleTransport(level, options?.formatter);
    case 'file':
      return new FileTransport(level, options.filePath, options?.formatter, options);
    case 'http':
      return new HttpTransport(level, options.endpoint, options);
    case 'memory':
      return new MemoryTransport(level, options?.maxEntries);
    default:
      return new ConsoleTransport(level);
  }
}
