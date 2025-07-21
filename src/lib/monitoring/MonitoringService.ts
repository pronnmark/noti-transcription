import { 
  IMonitoringService, 
  MonitoringConfig, 
  Metric, 
  SystemHealth, 
  PerformanceMetrics,
  MetricCollector,
  MetricExporter,
  IHealthChecker
} from './types';
import { BaseService } from '../services/core/BaseService';
import { 
  SystemMetricsCollector, 
  HttpMetricsCollector, 
  DatabaseMetricsCollector, 
  AIServiceMetricsCollector 
} from './MetricsCollector';
import { 
  HealthCheckManager,
  DatabaseHealthChecker,
  ServiceHealthChecker,
  AIProviderHealthChecker,
  MemoryHealthChecker,
  DiskSpaceHealthChecker
} from './HealthChecker';

export class MonitoringService extends BaseService implements IMonitoringService {
  private config: MonitoringConfig;
  private collectors: Map<string, MetricCollector> = new Map();
  private exporters: Map<string, MetricExporter> = new Map();
  private healthManager: HealthCheckManager;
  private metricsInterval?: NodeJS.Timeout;
  private healthInterval?: NodeJS.Timeout;
  private exportInterval?: NodeJS.Timeout;
  private isRunning = false;

  // Built-in collectors
  private systemCollector: SystemMetricsCollector;
  private httpCollector: HttpMetricsCollector;
  private databaseCollector: DatabaseMetricsCollector;
  private aiServiceCollector: AIServiceMetricsCollector;

  constructor(config: MonitoringConfig) {
    super('MonitoringService');
    this.config = config;
    this.healthManager = new HealthCheckManager();
    
    // Initialize built-in collectors
    this.systemCollector = new SystemMetricsCollector();
    this.httpCollector = new HttpMetricsCollector();
    this.databaseCollector = new DatabaseMetricsCollector();
    this.aiServiceCollector = new AIServiceMetricsCollector();
    
    this.setupDefaultCollectors();
    this.setupDefaultHealthChecks();
  }

  protected async onInitialize(): Promise<void> {
    this._logger.info('Monitoring service initialized');
  }

  protected async onDestroy(): Promise<void> {
    await this.stop();
    this._logger.info('Monitoring service destroyed');
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      this._logger.warn('Monitoring service is already running');
      return;
    }

    if (!this.config.enabled) {
      this._logger.info('Monitoring service is disabled');
      return;
    }

    this._logger.info('Starting monitoring service');

    // Start metrics collection
    if (this.config.metrics.enabled) {
      this.startMetricsCollection();
    }

    // Start health checks
    if (this.config.healthChecks.enabled) {
      this.startHealthChecks();
    }

    // Start metrics export
    if (this.config.export.enabled) {
      this.startMetricsExport();
    }

    this.isRunning = true;
    this._logger.info('Monitoring service started successfully');
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this._logger.info('Stopping monitoring service');

    // Clear intervals
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = undefined;
    }

    if (this.healthInterval) {
      clearInterval(this.healthInterval);
      this.healthInterval = undefined;
    }

    if (this.exportInterval) {
      clearInterval(this.exportInterval);
      this.exportInterval = undefined;
    }

    this.isRunning = false;
    this._logger.info('Monitoring service stopped');
  }

  async getMetrics(): Promise<Metric[]> {
    const allMetrics: Metric[] = [];

    // Collect from all registered collectors
    for (const [name, collector] of Array.from(this.collectors.entries())) {
      try {
        const metrics = await collector.collect();
        allMetrics.push(...metrics);
      } catch (error) {
        this._logger.error(`Failed to collect metrics from '${name}'`, error instanceof Error ? error : new Error(String(error)));
      }
    }

    return allMetrics;
  }

  async getHealth(): Promise<SystemHealth> {
    return await this.healthManager.checkAll();
  }

  async getPerformanceMetrics(): Promise<PerformanceMetrics> {
    const metrics = await this.getMetrics();
    return this.buildPerformanceMetrics(metrics);
  }

  addCollector(collector: MetricCollector): void {
    this.collectors.set(collector.name, collector);
    this._logger.info(`Added metrics collector: ${collector.name}`);
  }

  addExporter(exporter: MetricExporter): void {
    this.exporters.set(exporter.name, exporter);
    this._logger.info(`Added metrics exporter: ${exporter.name}`);
  }

  addHealthCheck(checker: IHealthChecker): void {
    this.healthManager.addChecker(checker);
    this._logger.info(`Added health checker`);
  }

  // Public methods for recording metrics
  recordHttpRequest(method: string, path: string, statusCode: number, duration: number, requestSize?: number, responseSize?: number): void {
    this.httpCollector.recordRequest(method, path, statusCode, duration, requestSize, responseSize);
  }

  recordDatabaseQuery(operation: string, table: string, duration: number, success: boolean): void {
    this.databaseCollector.recordQuery(operation, table, duration, success);
  }

  recordAIRequest(provider: string, model: string, operation: string, duration: number, success: boolean, errorType?: string): void {
    this.aiServiceCollector.recordRequest(provider, model, operation, duration, success, errorType);
  }

  recordAITokenUsage(provider: string, model: string, promptTokens: number, completionTokens: number): void {
    this.aiServiceCollector.recordTokenUsage(provider, model, promptTokens, completionTokens);
  }

  private setupDefaultCollectors(): void {
    this.addCollector(this.systemCollector);
    this.addCollector(this.httpCollector);
    this.addCollector(this.databaseCollector);
    this.addCollector(this.aiServiceCollector);
  }

  private setupDefaultHealthChecks(): void {
    // Database health check
    this.addHealthCheck(new DatabaseHealthChecker(this.config.healthChecks.timeout));
    
    // Memory health check
    this.addHealthCheck(new MemoryHealthChecker());
    
    // Disk space health check
    this.addHealthCheck(new DiskSpaceHealthChecker());
    
    // Service health checks
    const services = ['audioService', 'transcriptionService', 'extractionService', 'summarizationService'];
    for (const service of services) {
      this.addHealthCheck(new ServiceHealthChecker(service, this.config.healthChecks.timeout));
    }
    
    // AI provider health checks
    this.addHealthCheck(new AIProviderHealthChecker('gemini', this.config.healthChecks.timeout));
  }

  private startMetricsCollection(): void {
    this.metricsInterval = setInterval(async () => {
      try {
        await this.collectMetrics();
      } catch (error) {
        this._logger.error('Failed to collect metrics', error instanceof Error ? error : new Error(String(error)));
      }
    }, this.config.metrics.interval);

    this._logger.info(`Started metrics collection (interval: ${this.config.metrics.interval}ms)`);
  }

  private startHealthChecks(): void {
    this.healthInterval = setInterval(async () => {
      try {
        const health = await this.getHealth();
        this._logger.debug('Health check completed', {
          overall: health.overall,
          checksCount: health.checks.length,
        });
      } catch (error) {
        this._logger.error('Failed to perform health checks', error instanceof Error ? error : new Error(String(error)));
      }
    }, this.config.healthChecks.interval);

    this._logger.info(`Started health checks (interval: ${this.config.healthChecks.interval}ms)`);
  }

  private startMetricsExport(): void {
    this.exportInterval = setInterval(async () => {
      try {
        await this.exportMetrics();
      } catch (error) {
        this._logger.error('Failed to export metrics', error instanceof Error ? error : new Error(String(error)));
      }
    }, this.config.export.interval);

    this._logger.info(`Started metrics export (interval: ${this.config.export.interval}ms)`);
  }

  private async collectMetrics(): Promise<void> {
    // Metrics are collected on-demand when getMetrics() is called
    // This method can be used for any periodic collection tasks
  }

  private async exportMetrics(): Promise<void> {
    const metrics = await this.getMetrics();
    
    for (const [name, exporter] of Array.from(this.exporters.entries())) {
      try {
        await exporter.export(metrics);
      } catch (error) {
        this._logger.error(`Failed to export metrics via '${name}'`, error instanceof Error ? error : new Error(String(error)));
      }
    }
  }

  private buildPerformanceMetrics(metrics: Metric[]): PerformanceMetrics {
    // This is a simplified implementation
    // In a real system, you would aggregate the metrics properly
    
    const now = new Date();
    const memUsage = process.memoryUsage();
    const totalMemory = require('os').totalmem();
    
    return {
      requestCount: 0, // Would be calculated from http_requests_total
      requestDuration: {
        avg: 0,
        min: 0,
        max: 0,
        p50: 0,
        p95: 0,
        p99: 0,
      },
      requestsPerSecond: 0,
      errorCount: 0,
      errorRate: 0,
      errorsByType: {},
      memoryUsage: {
        used: memUsage.rss,
        total: totalMemory,
        percentage: (memUsage.rss / totalMemory) * 100,
        heap: {
          used: memUsage.heapUsed,
          total: memUsage.heapTotal,
        },
      },
      serviceHealth: {},
      serviceResponseTimes: {},
      timestamp: now,
    };
  }

  // Configuration management
  updateConfig(config: Partial<MonitoringConfig>): void {
    this.config = { ...this.config, ...config };
    this._logger.info('Monitoring configuration updated');
  }

  getConfig(): MonitoringConfig {
    return { ...this.config };
  }

  // Status information
  getStatus(): {
    isRunning: boolean;
    collectorsCount: number;
    exportersCount: number;
    healthCheckersCount: number;
  } {
    return {
      isRunning: this.isRunning,
      collectorsCount: this.collectors.size,
      exportersCount: this.exporters.size,
      healthCheckersCount: this.healthManager.getCheckers().length,
    };
  }
}
