// Removed logging dependency
import { BaseService } from './core/BaseService';
import { serviceContainer } from './ServiceContainer';
import { serviceConfigManager } from './ServiceConfig';
import type { ServiceEvent } from './core/interfaces';

export interface LifecycleEvent {
  type: 'startup' | 'shutdown' | 'restart' | 'health-check' | 'error';
  timestamp: Date;
  data?: any;
  error?: Error;
}

export class ServiceLifecycleManager extends BaseService {
  private healthCheckInterval?: NodeJS.Timeout;
  private eventHandlers: Map<string, Array<(event: LifecycleEvent) => void>> = new Map();
  private isShuttingDown = false;

  constructor() {
    super('ServiceLifecycleManager');
  }

  protected async onInitialize(): Promise<void> {
    // Set up process event handlers
    this.setupProcessHandlers();

    // Start health check monitoring
    this.startHealthCheckMonitoring();

    // Listen to service events
    this.setupServiceEventHandlers();

    this._logger.info('Service lifecycle manager initialized');
  }

  protected async onDestroy(): Promise<void> {
    this.stopHealthCheckMonitoring();
    this.removeProcessHandlers();
    this._logger.info('Service lifecycle manager destroyed');
  }

  private setupProcessHandlers(): void {
    // Graceful shutdown on SIGTERM
    process.on('SIGTERM', this.handleShutdown.bind(this));

    // Graceful shutdown on SIGINT (Ctrl+C)
    process.on('SIGINT', this.handleShutdown.bind(this));

    // Handle uncaught exceptions
    process.on('uncaughtException', this.handleUncaughtException.bind(this));

    // Handle unhandled promise rejections
    process.on('unhandledRejection', this.handleUnhandledRejection.bind(this));

    this._logger.info('Process event handlers set up');
  }

  private removeProcessHandlers(): void {
    process.removeAllListeners('SIGTERM');
    process.removeAllListeners('SIGINT');
    process.removeAllListeners('uncaughtException');
    process.removeAllListeners('unhandledRejection');
  }

  private setupServiceEventHandlers(): void {
    serviceContainer.onServiceEvent('error', (event: ServiceEvent) => {
      this.emit({
        type: 'error',
        timestamp: new Date(),
        data: event,
        error: event.data?.error,
      });
    });
  }

  private startHealthCheckMonitoring(): void {
    const config = serviceConfigManager.getConfiguration();
    const interval = config.system.healthCheckInterval;

    this.healthCheckInterval = setInterval(async () => {
      try {
        const health = await serviceContainer.healthCheck();

        this.emit({
          type: 'health-check',
          timestamp: new Date(),
          data: health,
        });

        if (!health.healthy) {
          this._logger.warn('Health check failed', health.errors);
        }
      } catch (error) {
        this._logger.error('Health check error',
          error instanceof Error ? error : new Error(String(error)));
        this.emit({
          type: 'error',
          timestamp: new Date(),
          error: error as Error,
        });
      }
    }, interval);

    this._logger.info(`Health check monitoring started (interval: ${interval}ms)`);
  }

  private stopHealthCheckMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
      this._logger.info('Health check monitoring stopped');
    }
  }

  private async handleShutdown(signal: string): Promise<void> {
    if (this.isShuttingDown) {
      this._logger.warn('Shutdown already in progress, forcing exit');
      process.exit(1);
    }

    this.isShuttingDown = true;
    this._logger.info(`Received ${signal}, starting graceful shutdown...`);

    this.emit({
      type: 'shutdown',
      timestamp: new Date(),
      data: { signal },
    });

    try {
      // Stop health monitoring first
      this.stopHealthCheckMonitoring();

      // Destroy all services
      await serviceContainer.destroy();

      this._logger.info('Graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      this._logger.error('Error during shutdown',
        error instanceof Error ? error : new Error(String(error)));
      process.exit(1);
    }
  }

  private handleUncaughtException(error: Error): void {
    this._logger.error('Uncaught exception', error);

    this.emit({
      type: 'error',
      timestamp: new Date(),
      error,
      data: { type: 'uncaughtException' },
    });

    // Attempt graceful shutdown
    this.handleShutdown('uncaughtException');
  }

  private handleUnhandledRejection(reason: any, promise: Promise<any>): void {
    this._logger.error('Unhandled promise rejection',
      reason instanceof Error ? reason : new Error(String(reason)),
      { promise: String(promise) });

    this.emit({
      type: 'error',
      timestamp: new Date(),
      error: reason instanceof Error ? reason : new Error(String(reason)),
      data: { type: 'unhandledRejection' },
    });
  }

  async startup(): Promise<void> {
    this._logger.info('Starting application services...');

    this.emit({
      type: 'startup',
      timestamp: new Date(),
    });

    try {
      // Initialize configuration manager first
      await serviceConfigManager.initialize();

      // Validate configuration
      const validation = serviceConfigManager.validateConfiguration();
      if (!validation.valid) {
        throw new Error(`Configuration validation failed: ${validation.errors.join(', ')}`);
      }

      // Initialize service container
      await serviceContainer.initialize();

      // Run initial health check
      const health = await serviceContainer.healthCheck();
      if (!health.healthy) {
        this._logger.warn('Some services are unhealthy after startup', health.errors);
      }

      this._logger.info('Application startup completed successfully');
    } catch (error) {
      this._logger.error('Application startup failed',
        error instanceof Error ? error : new Error(String(error)));
      this.emit({
        type: 'error',
        timestamp: new Date(),
        error: error as Error,
      });
      throw error;
    }
  }

  async shutdown(): Promise<void> {
    await this.handleShutdown('manual');
  }

  async restart(): Promise<void> {
    this._logger.info('Restarting application services...');

    this.emit({
      type: 'restart',
      timestamp: new Date(),
    });

    try {
      // Shutdown services
      await serviceContainer.destroy();

      // Wait a moment
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Restart services
      await this.startup();

      this._logger.info('Application restart completed successfully');
    } catch (error) {
      this._logger.error('Application restart failed',
        error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  // Event handling
  on(eventType: string, handler: (event: LifecycleEvent) => void): void {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, []);
    }
    this.eventHandlers.get(eventType)!.push(handler);
  }

  off(eventType: string, handler: (event: LifecycleEvent) => void): void {
    const handlers = this.eventHandlers.get(eventType);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  private emit(event: LifecycleEvent): void {
    const handlers = this.eventHandlers.get(event.type);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(event);
        } catch (error) {
          this._logger.error(`Error in lifecycle event handler for '${event.type}'`,
            error instanceof Error ? error : new Error(String(error)));
        }
      });
    }
  }

  // Status and metrics
  getStatus(): {
    isShuttingDown: boolean;
    healthCheckActive: boolean;
    uptime: number;
    lastHealthCheck?: Date;
    } {
    return {
      isShuttingDown: this.isShuttingDown,
      healthCheckActive: !!this.healthCheckInterval,
      uptime: process.uptime(),
      // lastHealthCheck would be tracked separately
    };
  }

  async getDetailedStatus(): Promise<{
    lifecycle: ReturnType<ServiceLifecycleManager['getStatus']>;
    services: Awaited<ReturnType<typeof serviceContainer.healthCheck>>;
    configuration: ReturnType<typeof serviceConfigManager.validateConfiguration>;
    metrics: ReturnType<typeof serviceContainer.getMetrics>;
  }> {
    return {
      lifecycle: this.getStatus(),
      services: await serviceContainer.healthCheck(),
      configuration: serviceConfigManager.validateConfiguration(),
      metrics: serviceContainer.getMetrics(),
    };
  }
}

// Lazy-loaded singleton instance
let _serviceLifecycleManager: ServiceLifecycleManager | null = null;

export function getServiceLifecycleManager(): ServiceLifecycleManager {
  if (!_serviceLifecycleManager) {
    _serviceLifecycleManager = new ServiceLifecycleManager();
  }
  return _serviceLifecycleManager;
}

// Export getter proxy for backward compatibility
export const serviceLifecycleManager = new Proxy({} as ServiceLifecycleManager, {
  get(target, prop, receiver) {
    const manager = getServiceLifecycleManager();
    return Reflect.get(manager, prop, receiver);
  },
});

// Convenience functions
export async function startApplication(): Promise<void> {
  await serviceLifecycleManager.initialize();
  await serviceLifecycleManager.startup();
}

export async function stopApplication(): Promise<void> {
  await serviceLifecycleManager.shutdown();
}

export async function restartApplication(): Promise<void> {
  await serviceLifecycleManager.restart();
}
