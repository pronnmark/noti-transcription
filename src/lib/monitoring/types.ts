export enum MetricType {
  COUNTER = 'counter',
  GAUGE = 'gauge',
  HISTOGRAM = 'histogram',
  SUMMARY = 'summary',
}

export interface MetricLabels {
  [key: string]: string | number;
}

export interface MetricValue {
  value: number;
  timestamp: Date;
  labels?: MetricLabels;
}

export interface Metric {
  name: string;
  type: MetricType;
  description: string;
  unit?: string;
  values: MetricValue[];
  labels?: string[];
}

export interface MetricCollector {
  name: string;
  collect(): Promise<Metric[]>;
}

export interface MetricExporter {
  name: string;
  export(metrics: Metric[]): Promise<void>;
}

// Performance metrics
export interface PerformanceMetrics {
  // Request metrics
  requestCount: number;
  requestDuration: {
    avg: number;
    min: number;
    max: number;
    p50: number;
    p95: number;
    p99: number;
  };
  requestsPerSecond: number;

  // Error metrics
  errorCount: number;
  errorRate: number;
  errorsByType: Record<string, number>;

  // System metrics
  memoryUsage: {
    used: number;
    total: number;
    percentage: number;
    heap: {
      used: number;
      total: number;
    };
  };

  cpuUsage?: {
    percentage: number;
    loadAverage: number[];
  };

  // Service metrics
  serviceHealth: Record<string, boolean>;
  serviceResponseTimes: Record<string, number>;

  // Database metrics
  databaseConnections?: {
    active: number;
    idle: number;
    total: number;
  };

  databaseQueries?: {
    count: number;
    avgDuration: number;
    slowQueries: number;
  };

  // AI service metrics
  aiRequests?: {
    count: number;
    avgDuration: number;
    tokenUsage: number;
    cost: number;
  };

  timestamp: Date;
}

// Health check status
export enum HealthStatus {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  UNHEALTHY = 'unhealthy',
  UNKNOWN = 'unknown',
}

export interface HealthCheck {
  name: string;
  status: HealthStatus;
  message?: string;
  duration: number;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface SystemHealth {
  overall: HealthStatus;
  checks: HealthCheck[];
  uptime: number;
  version: string;
  environment: string;
  timestamp: Date;
}

// Alert configuration
export enum AlertSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical',
}

export interface AlertRule {
  id: string;
  name: string;
  description: string;
  metric: string;
  condition: 'gt' | 'lt' | 'eq' | 'ne' | 'gte' | 'lte';
  threshold: number;
  severity: AlertSeverity;
  enabled: boolean;
  cooldown: number; // seconds
  labels?: MetricLabels;
}

export interface Alert {
  id: string;
  rule: AlertRule;
  value: number;
  severity: AlertSeverity;
  message: string;
  timestamp: Date;
  resolved?: Date;
  metadata?: Record<string, any>;
}

// Monitoring configuration
export interface MonitoringConfig {
  enabled: boolean;

  // Metrics collection
  metrics: {
    enabled: boolean;
    interval: number; // milliseconds
    retention: number; // seconds
    collectors: string[];
  };

  // Health checks
  healthChecks: {
    enabled: boolean;
    interval: number; // milliseconds
    timeout: number; // milliseconds
    checks: string[];
  };

  // Alerting
  alerting: {
    enabled: boolean;
    rules: AlertRule[];
    channels: string[];
  };

  // Export configuration
  export: {
    enabled: boolean;
    interval: number; // milliseconds
    exporters: string[];
  };

  // Performance tracking
  performance: {
    enabled: boolean;
    trackRequests: boolean;
    trackMemory: boolean;
    trackCpu: boolean;
    slowRequestThreshold: number; // milliseconds
  };
}

// Monitoring interfaces
export interface IMetricsCollector {
  collect(): Promise<Metric[]>;
  reset?(): void;
}

export interface IHealthChecker {
  check(): Promise<HealthCheck>;
}

export interface IAlertManager {
  evaluate(metrics: Metric[]): Promise<Alert[]>;
  resolve(alertId: string): Promise<void>;
  getActiveAlerts(): Promise<Alert[]>;
}

export interface IMonitoringService {
  start(): Promise<void>;
  stop(): Promise<void>;
  getMetrics(): Promise<Metric[]>;
  getHealth(): Promise<SystemHealth>;
  getPerformanceMetrics(): Promise<PerformanceMetrics>;
  addCollector(collector: MetricCollector): void;
  addExporter(exporter: MetricExporter): void;
  addHealthCheck(checker: IHealthChecker): void;
}

// Time series data point
export interface TimeSeriesPoint {
  timestamp: Date;
  value: number;
  labels?: MetricLabels;
}

export interface TimeSeries {
  metric: string;
  points: TimeSeriesPoint[];
  labels?: MetricLabels;
}

// Dashboard data
export interface DashboardWidget {
  id: string;
  type: 'chart' | 'gauge' | 'counter' | 'table' | 'status';
  title: string;
  metric: string;
  timeRange: string;
  refreshInterval: number;
  config?: Record<string, any>;
}

export interface Dashboard {
  id: string;
  name: string;
  description: string;
  widgets: DashboardWidget[];
  layout: {
    rows: number;
    columns: number;
    positions: Record<string, { x: number; y: number; w: number; h: number }>;
  };
}
