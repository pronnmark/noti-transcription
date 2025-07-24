import type { IService, ServiceEvent, ServiceConfig } from './interfaces';
import { createServiceLogger, ILogger } from '../../logging';
import { AppError, ValidationError, createError } from '../../errors';

export abstract class BaseService implements IService {
  public readonly name: string;
  protected _initialized: boolean = false;
  protected _destroyed: boolean = false;
  protected _logger: ILogger;
  protected _monitoring: any = null;

  constructor(name: string) {
    this.name = name;
    this._logger = createServiceLogger(name);
  }

  protected get monitoring(): any {
    if (!this._monitoring) {
      // If monitoring service isn't initialized, use a no-op
      this._monitoring = {
        recordHttpRequest: () => {},
        recordDatabaseQuery: () => {},
        recordAIRequest: () => {},
        recordAITokenUsage: () => {},
      };
    }
    return this._monitoring;
  }

  get initialized(): boolean {
    return this._initialized;
  }

  get destroyed(): boolean {
    return this._destroyed;
  }

  async initialize(): Promise<void> {
    if (this._initialized) {
      this._logger.warn('Service already initialized');
      return;
    }

    if (this._destroyed) {
      throw createError.internal(`Cannot initialize destroyed service: ${this.name}`);
    }

    try {
      this._logger.info('Initializing service');
      await this.onInitialize();
      this._initialized = true;
      this._logger.info('Service initialized successfully');
    } catch (error) {
      this._logger.error('Failed to initialize service', error instanceof Error ? error : new Error(String(error)));
      throw createError.internal(`Failed to initialize service ${this.name}`, error instanceof Error ? error : undefined);
    }
  }

  async destroy(): Promise<void> {
    if (this._destroyed) {
      this._logger.warn('Service already destroyed');
      return;
    }

    try {
      this._logger.info('Destroying service');
      await this.onDestroy();
      this._destroyed = true;
      this._initialized = false;
      this._logger.info('Service destroyed successfully');
    } catch (error) {
      this._logger.error('Failed to destroy service', error instanceof Error ? error : new Error(String(error)));
      throw createError.internal(`Failed to destroy service ${this.name}`, error instanceof Error ? error : undefined);
    }
  }

  protected abstract onInitialize(): Promise<void>;
  protected abstract onDestroy(): Promise<void>;

  protected ensureInitialized(): void {
    if (!this._initialized) {
      throw createError.internal(`Service ${this.name} is not initialized`);
    }

    if (this._destroyed) {
      throw createError.internal(`Service ${this.name} has been destroyed`);
    }
  }

  protected async executeWithErrorHandling<T>(
    operation: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    this.ensureInitialized();

    const startTime = Date.now();
    const operationLogger = this._logger.child({ operation, service: this.name });

    try {
      operationLogger.debug('Starting operation');

      const result = await fn();

      const duration = Date.now() - startTime;
      operationLogger.info('Operation completed successfully', { duration });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;

      // Convert to AppError if not already
      let appError: AppError;
      if (error instanceof AppError) {
        appError = error;
      } else if (error instanceof Error) {
        appError = createError.internal(`Operation '${operation}' failed in service '${this.name}'`, error);
      } else {
        appError = createError.internal(`Operation '${operation}' failed in service '${this.name}': ${String(error)}`);
      }

      // Add service context to error metadata
      appError.metadata.service = this.name;
      appError.metadata.operation = operation;
      appError.metadata.duration = duration;

      operationLogger.error('Operation failed', appError, { duration });

      throw appError;
    }
  }

  protected validateInput(input: any, rules: ValidationRule[]): void {
    const validationRules: Array<{ field: string; rule: string; message: string; value?: any }> = [];

    for (const rule of rules) {
      const value = this.getNestedValue(input, rule.field);
      if (!rule.validator(value)) {
        validationRules.push({
          field: rule.field,
          rule: 'custom',
          message: rule.message,
          value,
        });
      }
    }

    if (validationRules.length > 0) {
      throw ValidationError.multiple(validationRules);
    }
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }
}

// Legacy ServiceLogger removed - now using structured logging system

// Validation rule interface
export interface ValidationRule {
  field: string;
  validator(value: any): boolean;
  message: string;
}

// Common validation rules
export class ValidationRules {
  static required(field: string): ValidationRule {
    return {
      field,
      validator: (input: any) => input != null && input !== '',
      message: `${field} is required`,
    };
  }

  static isNumber(field: string): ValidationRule {
    return {
      field,
      validator: (input: any) => typeof input === 'number' && !isNaN(input),
      message: `${field} must be a valid number`,
    };
  }

  static isString(field: string): ValidationRule {
    return {
      field,
      validator: (input: any) => typeof input === 'string',
      message: `${field} must be a string`,
    };
  }

  static minLength(field: string, min: number): ValidationRule {
    return {
      field,
      validator: (input: any) => typeof input === 'string' && input.length >= min,
      message: `${field} must be at least ${min} characters long`,
    };
  }

  static maxLength(field: string, max: number): ValidationRule {
    return {
      field,
      validator: (input: any) => typeof input === 'string' && input.length <= max,
      message: `${field} must be no more than ${max} characters long`,
    };
  }

  static isPositive(field: string): ValidationRule {
    return {
      field,
      validator: (input: any) => typeof input === 'number' && input > 0,
      message: `${field} must be a positive number`,
    };
  }

  static isArray(field: string): ValidationRule {
    return {
      field,
      validator: (input: any) => Array.isArray(input),
      message: `${field} must be an array`,
    };
  }

  static isObject(field: string): ValidationRule {
    return {
      field,
      validator: (input: any) => typeof input === 'object' && input !== null && !Array.isArray(input),
      message: `${field} must be an object`,
    };
  }

  static oneOf(field: string, values: any[]): ValidationRule {
    return {
      field,
      validator: (input: any) => values.includes(input),
      message: `${field} must be one of: ${values.join(', ')}`,
    };
  }

  static custom(field: string, validatorFn: (input: any) => boolean, message: string): ValidationRule {
    return {
      field,
      validator: validatorFn,
      message: `${field} ${message}`,
    };
  }
}

// Service metrics for monitoring
export class ServiceMetrics {
  private metrics: Map<string, any> = new Map();

  increment(key: string, value: number = 1): void {
    const current = this.metrics.get(key) || 0;
    this.metrics.set(key, current + value);
  }

  set(key: string, value: any): void {
    this.metrics.set(key, value);
  }

  get(key: string): any {
    return this.metrics.get(key);
  }

  getAll(): Record<string, any> {
    return Object.fromEntries(this.metrics);
  }

  reset(): void {
    this.metrics.clear();
  }
}

// Abstract service with configuration support
export abstract class ConfigurableService extends BaseService {
  protected config: ServiceConfig;

  constructor(name: string, config: ServiceConfig = {}) {
    super(name);
    this.config = { ...this.getDefaultConfig(), ...config };
  }

  protected abstract getDefaultConfig(): ServiceConfig;

  updateConfig(newConfig: Partial<ServiceConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.onConfigUpdate(newConfig);
  }

  getConfig(): ServiceConfig {
    return { ...this.config };
  }

  protected onConfigUpdate(newConfig: Partial<ServiceConfig>): void {
    // Override in subclasses if needed
  }
}
