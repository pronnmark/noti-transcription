import {
  HealthCheck,
  HealthStatus,
  SystemHealth,
  IHealthChecker,
} from './types';
import { totalmem } from 'os';

export abstract class BaseHealthChecker implements IHealthChecker {
  constructor(
    protected name: string,
    protected timeout: number = 5000,
  ) {}

  async check(): Promise<HealthCheck> {
    const startTime = Date.now();

    try {
      const result = await Promise.race([
        this.performCheck(),
        this.createTimeoutPromise(),
      ]);

      const duration = Date.now() - startTime;

      return {
        name: this.name,
        status: result.status,
        message: result.message,
        duration,
        timestamp: new Date(),
        metadata: result.metadata,
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      return {
        name: this.name,
        status: HealthStatus.UNHEALTHY,
        message: error instanceof Error ? error.message : 'Unknown error',
        duration,
        timestamp: new Date(),
        metadata: { error: String(error) },
      };
    }
  }

  protected abstract performCheck(): Promise<{
    status: HealthStatus;
    message?: string;
    metadata?: Record<string, any>;
  }>;

  private createTimeoutPromise(): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Health check timeout after ${this.timeout}ms`));
      }, this.timeout);
    });
  }
}

export class DatabaseHealthChecker extends BaseHealthChecker {
  constructor(timeout?: number) {
    super('database', timeout);
  }

  protected async performCheck(): Promise<{
    status: HealthStatus;
    message?: string;
    metadata?: Record<string, any>;
  }> {
    try {
      // Import database connection
      const { db } = await import('@/lib/db');

      // Perform a simple query to test connectivity
      const result = await db.all('SELECT 1 as test');

      if (result.length > 0) {
        return {
          status: HealthStatus.HEALTHY,
          message: 'Database connection is healthy',
          metadata: {
            connectionPool: 'active',
            queryTime: Date.now(),
          },
        };
      } else {
        return {
          status: HealthStatus.UNHEALTHY,
          message: 'Database query returned no results',
        };
      }
    } catch (error) {
      return {
        status: HealthStatus.UNHEALTHY,
        message: `Database connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        metadata: { error: String(error) },
      };
    }
  }
}

export class ServiceHealthChecker extends BaseHealthChecker {
  constructor(
    private serviceName: string,
    timeout?: number,
  ) {
    super(`service_${serviceName}`, timeout);
  }

  protected async performCheck(): Promise<{
    status: HealthStatus;
    message?: string;
    metadata?: Record<string, any>;
  }> {
    try {
      const { serviceContainer } = await import('@/lib/services');

      // Check if service exists and is initialized
      if (!serviceContainer.hasService(this.serviceName)) {
        return {
          status: HealthStatus.UNHEALTHY,
          message: `Service '${this.serviceName}' not found`,
        };
      }

      // Get service health from container
      const health = await serviceContainer.healthCheck();
      const serviceHealth = health.services[this.serviceName];

      if (serviceHealth === true) {
        return {
          status: HealthStatus.HEALTHY,
          message: `Service '${this.serviceName}' is healthy`,
          metadata: {
            initialized: true,
            lastCheck: new Date().toISOString(),
          },
        };
      } else {
        return {
          status: HealthStatus.UNHEALTHY,
          message: `Service '${this.serviceName}' is unhealthy`,
          metadata: {
            initialized: false,
          },
        };
      }
    } catch (error) {
      return {
        status: HealthStatus.UNHEALTHY,
        message: `Service check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        metadata: { error: String(error) },
      };
    }
  }
}

export class AIProviderHealthChecker extends BaseHealthChecker {
  constructor(
    private providerName: 'custom',
    timeout?: number,
  ) {
    super(`ai_provider_${providerName}`, timeout);
  }

  protected async performCheck(): Promise<{
    status: HealthStatus;
    message?: string;
    metadata?: Record<string, any>;
  }> {
    try {
      let provider: any;

      if (this.providerName === 'custom') {
        const { customAIService } = await import('@/lib/services/customAI');
        provider = customAIService;
      }

      if (!provider) {
        return {
          status: HealthStatus.UNHEALTHY,
          message: `AI provider '${this.providerName}' not available`,
        };
      }

      // Check if provider is available
      const isAvailable = await provider.isAvailable();

      if (isAvailable) {
        return {
          status: HealthStatus.HEALTHY,
          message: `AI provider '${this.providerName}' is healthy`,
          metadata: {
            provider: this.providerName,
            available: true,
          },
        };
      } else {
        return {
          status: HealthStatus.DEGRADED,
          message: `AI provider '${this.providerName}' is not available`,
          metadata: {
            provider: this.providerName,
            available: false,
          },
        };
      }
    } catch (error) {
      return {
        status: HealthStatus.UNHEALTHY,
        message: `AI provider check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        metadata: {
          provider: this.providerName,
          error: String(error),
        },
      };
    }
  }
}

export class MemoryHealthChecker extends BaseHealthChecker {
  constructor(
    private thresholds: {
      warning: number; // percentage
      critical: number; // percentage
    } = { warning: 80, critical: 90 },
    timeout?: number,
  ) {
    super('memory', timeout);
  }

  protected async performCheck(): Promise<{
    status: HealthStatus;
    message?: string;
    metadata?: Record<string, any>;
  }> {
    const memUsage = process.memoryUsage();
    const totalMemory = totalmem();
    const usedPercentage = (memUsage.rss / totalMemory) * 100;

    const metadata = {
      usedBytes: memUsage.rss,
      totalBytes: totalMemory,
      usedPercentage: Math.round(usedPercentage * 100) / 100,
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
    };

    if (usedPercentage >= this.thresholds.critical) {
      return {
        status: HealthStatus.UNHEALTHY,
        message: `Critical memory usage: ${usedPercentage.toFixed(1)}%`,
        metadata,
      };
    } else if (usedPercentage >= this.thresholds.warning) {
      return {
        status: HealthStatus.DEGRADED,
        message: `High memory usage: ${usedPercentage.toFixed(1)}%`,
        metadata,
      };
    } else {
      return {
        status: HealthStatus.HEALTHY,
        message: `Memory usage is normal: ${usedPercentage.toFixed(1)}%`,
        metadata,
      };
    }
  }
}

export class DiskSpaceHealthChecker extends BaseHealthChecker {
  constructor(
    private path: string = '.',
    private thresholds: {
      warning: number; // percentage
      critical: number; // percentage
    } = { warning: 80, critical: 90 },
    timeout?: number,
  ) {
    super('disk_space', timeout);
  }

  protected async performCheck(): Promise<{
    status: HealthStatus;
    message?: string;
    metadata?: Record<string, any>;
  }> {
    try {
      const fs = await import('fs/promises');
      const stats = await fs.statfs(this.path);

      const totalBytes = stats.blocks * stats.bsize;
      const freeBytes = stats.bavail * stats.bsize;
      const usedBytes = totalBytes - freeBytes;
      const usedPercentage = (usedBytes / totalBytes) * 100;

      const metadata = {
        path: this.path,
        totalBytes,
        usedBytes,
        freeBytes,
        usedPercentage: Math.round(usedPercentage * 100) / 100,
      };

      if (usedPercentage >= this.thresholds.critical) {
        return {
          status: HealthStatus.UNHEALTHY,
          message: `Critical disk usage: ${usedPercentage.toFixed(1)}%`,
          metadata,
        };
      } else if (usedPercentage >= this.thresholds.warning) {
        return {
          status: HealthStatus.DEGRADED,
          message: `High disk usage: ${usedPercentage.toFixed(1)}%`,
          metadata,
        };
      } else {
        return {
          status: HealthStatus.HEALTHY,
          message: `Disk usage is normal: ${usedPercentage.toFixed(1)}%`,
          metadata,
        };
      }
    } catch (error) {
      return {
        status: HealthStatus.UNKNOWN,
        message: `Unable to check disk space: ${error instanceof Error ? error.message : 'Unknown error'}`,
        metadata: { error: String(error) },
      };
    }
  }
}

export class HealthCheckManager {
  private checkers: IHealthChecker[] = [];

  addChecker(checker: IHealthChecker): void {
    this.checkers.push(checker);
  }

  removeChecker(name: string): void {
    this.checkers = this.checkers.filter(checker => checker.check().then(result => result.name !== name));
  }

  async checkAll(): Promise<SystemHealth> {
    const startTime = Date.now();

    const checkPromises = this.checkers.map(checker =>
      checker.check().catch(error => ({
        name: 'unknown',
        status: HealthStatus.UNKNOWN,
        message: `Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        duration: 0,
        timestamp: new Date(),
        metadata: { error: String(error) },
      })),
    );

    const checks = await Promise.all(checkPromises);

    // Determine overall health status
    const overall = this.determineOverallHealth(checks);

    return {
      overall,
      checks,
      uptime: process.uptime(),
      version: process.env.APP_VERSION || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date(),
    };
  }

  private determineOverallHealth(checks: HealthCheck[]): HealthStatus {
    if (checks.length === 0) {
      return HealthStatus.UNKNOWN;
    }

    const statuses = checks.map(check => check.status);

    if (statuses.includes(HealthStatus.UNHEALTHY)) {
      return HealthStatus.UNHEALTHY;
    }

    if (statuses.includes(HealthStatus.DEGRADED)) {
      return HealthStatus.DEGRADED;
    }

    if (statuses.every(status => status === HealthStatus.HEALTHY)) {
      return HealthStatus.HEALTHY;
    }

    return HealthStatus.UNKNOWN;
  }

  getCheckers(): string[] {
    return this.checkers.map(checker =>
      checker.check().then(result => result.name),
    ).map((promise, index) => `checker_${index}`); // Simplified for now
  }
}
