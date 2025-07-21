// Core monitoring types and interfaces
export * from './types';

// Metrics collection
export * from './MetricsCollector';

// Health checking
export * from './HealthChecker';

// Main monitoring service
export * from './MonitoringService';

// Re-export commonly used items
export { MonitoringService } from './MonitoringService';

// Import for internal use
import { MonitoringService } from './MonitoringService';
export {
  SystemMetricsCollector,
  HttpMetricsCollector,
  DatabaseMetricsCollector,
  AIServiceMetricsCollector,
} from './MetricsCollector';
export {
  HealthCheckManager,
  DatabaseHealthChecker,
  ServiceHealthChecker,
  AIProviderHealthChecker,
  MemoryHealthChecker,
  DiskSpaceHealthChecker,
} from './HealthChecker';

// Default configuration
export function createDefaultMonitoringConfig(): import('./types').MonitoringConfig {
  return {
    enabled: true,
    metrics: {
      enabled: true,
      interval: 30000, // 30 seconds
      retention: 86400, // 24 hours
      collectors: ['system', 'http', 'database', 'ai_service'],
    },
    healthChecks: {
      enabled: true,
      interval: 60000, // 1 minute
      timeout: 5000, // 5 seconds
      checks: ['database', 'memory', 'disk_space', 'services', 'ai_providers'],
    },
    alerting: {
      enabled: false, // Disabled by default
      rules: [],
      channels: [],
    },
    export: {
      enabled: false, // Disabled by default
      interval: 60000, // 1 minute
      exporters: [],
    },
    performance: {
      enabled: true,
      trackRequests: true,
      trackMemory: true,
      trackCpu: false,
      slowRequestThreshold: 1000, // 1 second
    },
  };
}

// Singleton monitoring service
let monitoringService: MonitoringService | undefined;

export function getMonitoringService(): MonitoringService {
  if (!monitoringService) {
    const config = createDefaultMonitoringConfig();
    monitoringService = new MonitoringService(config);
  }
  return monitoringService;
}

export function setMonitoringService(service: MonitoringService): void {
  monitoringService = service;
}

// Convenience functions
export async function startMonitoring(): Promise<void> {
  const service = getMonitoringService();
  await service.initialize();
  await service.start();
}

export async function stopMonitoring(): Promise<void> {
  if (monitoringService) {
    await monitoringService.stop();
    await monitoringService.destroy();
  }
}

export async function getSystemHealth(): Promise<import('./types').SystemHealth> {
  const service = getMonitoringService();
  return await service.getHealth();
}

export async function getPerformanceMetrics(): Promise<import('./types').PerformanceMetrics> {
  const service = getMonitoringService();
  return await service.getPerformanceMetrics();
}

// Metric recording helpers
export function recordHttpRequest(
  method: string,
  path: string,
  statusCode: number,
  duration: number,
  requestSize?: number,
  responseSize?: number,
): void {
  const service = getMonitoringService();
  service.recordHttpRequest(method, path, statusCode, duration, requestSize, responseSize);
}

export function recordDatabaseQuery(
  operation: string,
  table: string,
  duration: number,
  success: boolean,
): void {
  const service = getMonitoringService();
  service.recordDatabaseQuery(operation, table, duration, success);
}

export function recordAIRequest(
  provider: string,
  model: string,
  operation: string,
  duration: number,
  success: boolean,
  errorType?: string,
): void {
  const service = getMonitoringService();
  service.recordAIRequest(provider, model, operation, duration, success, errorType);
}

export function recordAITokenUsage(
  provider: string,
  model: string,
  promptTokens: number,
  completionTokens: number,
): void {
  const service = getMonitoringService();
  service.recordAITokenUsage(provider, model, promptTokens, completionTokens);
}
