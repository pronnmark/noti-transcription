import { AppError, ErrorSeverity } from './AppError';

export interface ErrorReport {
  id: string;
  timestamp: Date;
  error: AppError;
  environment: string;
  version: string;
  userId?: string;
  sessionId?: string;
  userAgent?: string;
  url?: string;
  additionalContext?: Record<string, any>;
}

export interface ErrorReporterConfig {
  enabled: boolean;
  environment: string;
  version: string;
  apiKey?: string;
  endpoint?: string;
  batchSize?: number;
  flushInterval?: number;
  minSeverity?: ErrorSeverity;
}

export abstract class ErrorReporter {
  protected config: ErrorReporterConfig;
  protected errorQueue: ErrorReport[] = [];
  private flushTimer?: NodeJS.Timeout;

  constructor(config: ErrorReporterConfig) {
    this.config = config;

    if (config.flushInterval && config.flushInterval > 0) {
      this.startFlushTimer();
    }
  }

  async report(error: AppError): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    // Check minimum severity
    if (this.config.minSeverity && !this.shouldReport(error)) {
      return;
    }

    const report = this.createReport(error);

    if (this.config.batchSize && this.config.batchSize > 1) {
      this.errorQueue.push(report);

      if (this.errorQueue.length >= this.config.batchSize) {
        await this.flush();
      }
    } else {
      await this.sendReport(report);
    }
  }

  async flush(): Promise<void> {
    if (this.errorQueue.length === 0) {
      return;
    }

    const reports = [...this.errorQueue];
    this.errorQueue = [];

    try {
      await this.sendBatch(reports);
    } catch (error) {
      console.error('Failed to send error reports:', error);
      // Re-queue failed reports (with limit to prevent infinite growth)
      if (this.errorQueue.length < 1000) {
        this.errorQueue.unshift(...reports);
      }
    }
  }

  destroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    // Flush remaining errors
    this.flush().catch(console.error);
  }

  protected abstract sendReport(report: ErrorReport): Promise<void>;
  protected abstract sendBatch(reports: ErrorReport[]): Promise<void>;

  private createReport(error: AppError): ErrorReport {
    return {
      id: this.generateId(),
      timestamp: new Date(),
      error,
      environment: this.config.environment,
      version: this.config.version,
      userId: error.metadata.userId,
      sessionId: error.metadata.sessionId,
      userAgent: error.metadata.userAgent,
      url: error.metadata.url,
      additionalContext: {
        service: error.metadata.service,
        operation: error.metadata.operation,
        duration: error.metadata.duration,
      },
    };
  }

  private shouldReport(error: AppError): boolean {
    if (!this.config.minSeverity) {
      return true;
    }

    const severityLevels = {
      [ErrorSeverity.LOW]: 1,
      [ErrorSeverity.MEDIUM]: 2,
      [ErrorSeverity.HIGH]: 3,
      [ErrorSeverity.CRITICAL]: 4,
    };

    return severityLevels[error.severity] >= severityLevels[this.config.minSeverity];
  }

  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      this.flush().catch(console.error);
    }, this.config.flushInterval);
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Console error reporter for development
export class ConsoleErrorReporter extends ErrorReporter {
  protected async sendReport(report: ErrorReport): Promise<void> {
    console.error('🚨 Error Report:', {
      id: report.id,
      timestamp: report.timestamp.toISOString(),
      message: report.error.message,
      code: report.error.code,
      severity: report.error.severity,
      metadata: report.error.metadata,
      stack: report.error.stack,
    });
  }

  protected async sendBatch(reports: ErrorReport[]): Promise<void> {
    console.error(`🚨 Batch Error Report (${reports.length} errors):`);
    for (const report of reports) {
      await this.sendReport(report);
    }
  }
}

// HTTP error reporter for external services
export class HttpErrorReporter extends ErrorReporter {
  protected async sendReport(report: ErrorReport): Promise<void> {
    if (!this.config.endpoint) {
      throw new Error('HTTP endpoint not configured');
    }

    const response = await fetch(this.config.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.config.apiKey && { 'Authorization': `Bearer ${this.config.apiKey}` }),
      },
      body: JSON.stringify(this.formatReport(report)),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
  }

  protected async sendBatch(reports: ErrorReport[]): Promise<void> {
    if (!this.config.endpoint) {
      throw new Error('HTTP endpoint not configured');
    }

    const response = await fetch(`${this.config.endpoint}/batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.config.apiKey && { 'Authorization': `Bearer ${this.config.apiKey}` }),
      },
      body: JSON.stringify({
        reports: reports.map(report => this.formatReport(report)),
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
  }

  private formatReport(report: ErrorReport): any {
    return {
      id: report.id,
      timestamp: report.timestamp.toISOString(),
      environment: report.environment,
      version: report.version,
      error: {
        message: report.error.message,
        code: report.error.code,
        severity: report.error.severity,
        statusCode: report.error.statusCode,
        stack: report.error.stack,
        metadata: report.error.metadata,
      },
      user: {
        id: report.userId,
        sessionId: report.sessionId,
        userAgent: report.userAgent,
      },
      request: {
        url: report.url,
        method: report.error.metadata.method,
      },
      context: report.additionalContext,
    };
  }
}

// File-based error reporter for local logging
export class FileErrorReporter extends ErrorReporter {
  private logFile: string;

  constructor(config: ErrorReporterConfig & { logFile: string }) {
    super(config);
    this.logFile = config.logFile;
  }

  protected async sendReport(report: ErrorReport): Promise<void> {
    const fs = await import('fs/promises');
    const logEntry = JSON.stringify(this.formatReport(report)) + '\n';

    try {
      await fs.appendFile(this.logFile, logEntry);
    } catch (error) {
      console.error('Failed to write error to log file:', error);
    }
  }

  protected async sendBatch(reports: ErrorReport[]): Promise<void> {
    const fs = await import('fs/promises');
    const logEntries = reports.map(report =>
      JSON.stringify(this.formatReport(report)),
    ).join('\n') + '\n';

    try {
      await fs.appendFile(this.logFile, logEntries);
    } catch (error) {
      console.error('Failed to write errors to log file:', error);
    }
  }

  private formatReport(report: ErrorReport): any {
    return {
      timestamp: report.timestamp.toISOString(),
      level: 'error',
      message: report.error.message,
      code: report.error.code,
      severity: report.error.severity,
      metadata: report.error.metadata,
      stack: report.error.stack,
    };
  }
}
