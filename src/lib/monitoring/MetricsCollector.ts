import { 
  Metric, 
  MetricType, 
  MetricValue, 
  MetricLabels, 
  IMetricsCollector,
  MetricCollector 
} from './types';

export class BaseMetricsCollector implements IMetricsCollector {
  protected metrics: Map<string, Metric> = new Map();

  async collect(): Promise<Metric[]> {
    return Array.from(this.metrics.values());
  }

  reset(): void {
    this.metrics.clear();
  }

  protected createMetric(
    name: string,
    type: MetricType,
    description: string,
    unit?: string,
    labels?: string[]
  ): void {
    this.metrics.set(name, {
      name,
      type,
      description,
      unit,
      values: [],
      labels,
    });
  }

  protected addValue(name: string, value: number, labels?: MetricLabels): void {
    const metric = this.metrics.get(name);
    if (!metric) {
      throw new Error(`Metric '${name}' not found`);
    }

    metric.values.push({
      value,
      timestamp: new Date(),
      labels,
    });

    // Keep only last 1000 values to prevent memory issues
    if (metric.values.length > 1000) {
      metric.values = metric.values.slice(-1000);
    }
  }

  protected incrementCounter(name: string, labels?: MetricLabels): void {
    const metric = this.metrics.get(name);
    if (!metric || metric.type !== MetricType.COUNTER) {
      throw new Error(`Counter metric '${name}' not found`);
    }

    const lastValue = metric.values[metric.values.length - 1];
    const newValue = lastValue ? lastValue.value + 1 : 1;
    
    this.addValue(name, newValue, labels);
  }

  protected setGauge(name: string, value: number, labels?: MetricLabels): void {
    const metric = this.metrics.get(name);
    if (!metric || metric.type !== MetricType.GAUGE) {
      throw new Error(`Gauge metric '${name}' not found`);
    }

    this.addValue(name, value, labels);
  }

  protected observeHistogram(name: string, value: number, labels?: MetricLabels): void {
    const metric = this.metrics.get(name);
    if (!metric || metric.type !== MetricType.HISTOGRAM) {
      throw new Error(`Histogram metric '${name}' not found`);
    }

    this.addValue(name, value, labels);
  }
}

export class SystemMetricsCollector extends BaseMetricsCollector implements MetricCollector {
  public readonly name = 'system';

  constructor() {
    super();
    this.setupMetrics();
  }

  private setupMetrics(): void {
    // Memory metrics
    this.createMetric('memory_usage_bytes', MetricType.GAUGE, 'Memory usage in bytes', 'bytes');
    this.createMetric('memory_usage_percentage', MetricType.GAUGE, 'Memory usage percentage', 'percent');
    this.createMetric('heap_used_bytes', MetricType.GAUGE, 'Heap memory used in bytes', 'bytes');
    this.createMetric('heap_total_bytes', MetricType.GAUGE, 'Heap memory total in bytes', 'bytes');

    // Process metrics
    this.createMetric('process_uptime_seconds', MetricType.GAUGE, 'Process uptime in seconds', 'seconds');
    this.createMetric('process_cpu_usage_percentage', MetricType.GAUGE, 'Process CPU usage percentage', 'percent');

    // Event loop metrics
    this.createMetric('event_loop_lag_milliseconds', MetricType.GAUGE, 'Event loop lag in milliseconds', 'milliseconds');
  }

  async collect(): Promise<Metric[]> {
    this.collectMemoryMetrics();
    this.collectProcessMetrics();
    this.collectEventLoopMetrics();

    return super.collect();
  }

  private collectMemoryMetrics(): void {
    const memUsage = process.memoryUsage();
    
    this.setGauge('memory_usage_bytes', memUsage.rss);
    this.setGauge('heap_used_bytes', memUsage.heapUsed);
    this.setGauge('heap_total_bytes', memUsage.heapTotal);
    
    // Calculate memory usage percentage (rough estimate)
    const totalMemory = require('os').totalmem();
    const memoryPercentage = (memUsage.rss / totalMemory) * 100;
    this.setGauge('memory_usage_percentage', memoryPercentage);
  }

  private collectProcessMetrics(): void {
    this.setGauge('process_uptime_seconds', process.uptime());
    
    // CPU usage (simplified)
    const cpuUsage = process.cpuUsage();
    const totalCpuTime = cpuUsage.user + cpuUsage.system;
    const cpuPercentage = (totalCpuTime / (process.uptime() * 1000000)) * 100;
    this.setGauge('process_cpu_usage_percentage', cpuPercentage);
  }

  private collectEventLoopMetrics(): void {
    const start = process.hrtime.bigint();
    setImmediate(() => {
      const lag = Number(process.hrtime.bigint() - start) / 1000000; // Convert to milliseconds
      this.setGauge('event_loop_lag_milliseconds', lag);
    });
  }
}

export class HttpMetricsCollector extends BaseMetricsCollector implements MetricCollector {
  public readonly name = 'http';

  constructor() {
    super();
    this.setupMetrics();
  }

  private setupMetrics(): void {
    // Request metrics
    this.createMetric('http_requests_total', MetricType.COUNTER, 'Total HTTP requests', 'requests', ['method', 'status', 'path']);
    this.createMetric('http_request_duration_milliseconds', MetricType.HISTOGRAM, 'HTTP request duration', 'milliseconds', ['method', 'status', 'path']);
    this.createMetric('http_request_size_bytes', MetricType.HISTOGRAM, 'HTTP request size', 'bytes', ['method', 'path']);
    this.createMetric('http_response_size_bytes', MetricType.HISTOGRAM, 'HTTP response size', 'bytes', ['method', 'status', 'path']);
    
    // Error metrics
    this.createMetric('http_errors_total', MetricType.COUNTER, 'Total HTTP errors', 'errors', ['method', 'status', 'path']);
    
    // Active connections
    this.createMetric('http_active_requests', MetricType.GAUGE, 'Active HTTP requests', 'requests');
  }

  recordRequest(method: string, path: string, statusCode: number, duration: number, requestSize?: number, responseSize?: number): void {
    const labels = { method, status: statusCode.toString(), path };
    
    this.incrementCounter('http_requests_total', labels);
    this.observeHistogram('http_request_duration_milliseconds', duration, labels);
    
    if (requestSize) {
      this.observeHistogram('http_request_size_bytes', requestSize, { method, path });
    }
    
    if (responseSize) {
      this.observeHistogram('http_response_size_bytes', responseSize, labels);
    }
    
    if (statusCode >= 400) {
      this.incrementCounter('http_errors_total', labels);
    }
  }

  setActiveRequests(count: number): void {
    this.setGauge('http_active_requests', count);
  }
}

export class DatabaseMetricsCollector extends BaseMetricsCollector implements MetricCollector {
  public readonly name = 'database';

  constructor() {
    super();
    this.setupMetrics();
  }

  private setupMetrics(): void {
    // Query metrics
    this.createMetric('database_queries_total', MetricType.COUNTER, 'Total database queries', 'queries', ['operation', 'table']);
    this.createMetric('database_query_duration_milliseconds', MetricType.HISTOGRAM, 'Database query duration', 'milliseconds', ['operation', 'table']);
    
    // Connection metrics
    this.createMetric('database_connections_active', MetricType.GAUGE, 'Active database connections', 'connections');
    this.createMetric('database_connections_idle', MetricType.GAUGE, 'Idle database connections', 'connections');
    
    // Error metrics
    this.createMetric('database_errors_total', MetricType.COUNTER, 'Total database errors', 'errors', ['operation', 'table']);
    
    // Transaction metrics
    this.createMetric('database_transactions_total', MetricType.COUNTER, 'Total database transactions', 'transactions', ['status']);
  }

  recordQuery(operation: string, table: string, duration: number, success: boolean): void {
    const labels = { operation, table };
    
    this.incrementCounter('database_queries_total', labels);
    this.observeHistogram('database_query_duration_milliseconds', duration, labels);
    
    if (!success) {
      this.incrementCounter('database_errors_total', labels);
    }
  }

  setConnectionCounts(active: number, idle: number): void {
    this.setGauge('database_connections_active', active);
    this.setGauge('database_connections_idle', idle);
  }

  recordTransaction(status: 'committed' | 'rolled_back'): void {
    this.incrementCounter('database_transactions_total', { status });
  }
}

export class AIServiceMetricsCollector extends BaseMetricsCollector implements MetricCollector {
  public readonly name = 'ai_service';

  constructor() {
    super();
    this.setupMetrics();
  }

  private setupMetrics(): void {
    // Request metrics
    this.createMetric('ai_requests_total', MetricType.COUNTER, 'Total AI service requests', 'requests', ['provider', 'model', 'operation']);
    this.createMetric('ai_request_duration_milliseconds', MetricType.HISTOGRAM, 'AI request duration', 'milliseconds', ['provider', 'model', 'operation']);
    
    // Token metrics
    this.createMetric('ai_tokens_used_total', MetricType.COUNTER, 'Total tokens used', 'tokens', ['provider', 'model', 'type']);
    this.createMetric('ai_cost_total', MetricType.COUNTER, 'Total AI service cost', 'currency', ['provider', 'model']);
    
    // Error metrics
    this.createMetric('ai_errors_total', MetricType.COUNTER, 'Total AI service errors', 'errors', ['provider', 'model', 'error_type']);
    
    // Rate limiting
    this.createMetric('ai_rate_limit_hits_total', MetricType.COUNTER, 'Total rate limit hits', 'hits', ['provider']);
  }

  recordRequest(provider: string, model: string, operation: string, duration: number, success: boolean, errorType?: string): void {
    const labels = { provider, model, operation };
    
    this.incrementCounter('ai_requests_total', labels);
    this.observeHistogram('ai_request_duration_milliseconds', duration, labels);
    
    if (!success && errorType) {
      this.incrementCounter('ai_errors_total', { provider, model, error_type: errorType });
    }
  }

  recordTokenUsage(provider: string, model: string, promptTokens: number, completionTokens: number): void {
    this.addValue('ai_tokens_used_total', promptTokens, { provider, model, type: 'prompt' });
    this.addValue('ai_tokens_used_total', completionTokens, { provider, model, type: 'completion' });
  }

  recordCost(provider: string, model: string, cost: number): void {
    this.addValue('ai_cost_total', cost, { provider, model });
  }

  recordRateLimitHit(provider: string): void {
    this.incrementCounter('ai_rate_limit_hits_total', { provider });
  }
}
