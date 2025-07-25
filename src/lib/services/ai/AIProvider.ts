import { ConfigurableService, ValidationRules } from '../core/BaseService';
import { ValidationError } from '../../errors';
import type {
  IAIProvider,
  AIGenerationOptions,
  AIModelInfo,
  AIProviderConfig,
} from '../core/interfaces';

export abstract class AIProvider extends ConfigurableService implements IAIProvider {
  protected apiKey?: string;
  protected baseUrl?: string;
  protected defaultModel?: string;
  protected timeout: number = 120000;
  protected retries: number = 3;

  constructor(name: string, config: AIProviderConfig = {}) {
    super(name, config);
    this.configure(config);
  }

  protected getDefaultConfig(): any {
    return {
      timeout: 30000,
      retries: 3,
      temperature: 0.7,
      maxTokens: 4000,
    };
  }

  configure(config: AIProviderConfig): void {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl;
    this.defaultModel = config.model;

    if (config.timeout) this.timeout = config.timeout;
    if (config.retries) this.retries = config.retries;

    this.updateConfig(config);
  }

  protected async onInitialize(): Promise<void> {
    // Check if API key is provided
    if (!this.apiKey) {
      this._logger.warn(`No API key provided for ${this.name}. Service will be unavailable.`);
      // Don't throw error - just mark as initialized but unavailable
      return;
    }

    // Test connection
    try {
      const isAvailable = await this.isAvailable();
      if (!isAvailable) {
        this._logger.warn(`${this.name} provider is not available`);
        // Don't throw error - service is initialized but not available
        return;
      }
      this._logger.info('AI provider initialized successfully');
    } catch (error) {
      this._logger.warn(`${this.name} provider check failed`, error instanceof Error ? error : new Error(String(error)));
      // Don't throw error - service is initialized but not available
    }
  }

  protected async onDestroy(): Promise<void> {
    // Cleanup any resources
    this._logger.info('AI provider destroyed');
  }

  abstract generateText(prompt: string, options?: AIGenerationOptions): Promise<string>;
  abstract generateStructuredOutput(prompt: string, schema: any, options?: AIGenerationOptions): Promise<any>;
  abstract getModelInfo(): AIModelInfo;
  abstract isAvailable(): Promise<boolean>;

  protected validateGenerationOptions(options?: AIGenerationOptions): AIGenerationOptions {
    const validated: AIGenerationOptions = {
      model: options?.model || this.defaultModel,
      temperature: options?.temperature ?? this.config.temperature,
      maxTokens: options?.maxTokens ?? this.config.maxTokens,
      systemPrompt: options?.systemPrompt,
      jsonSchema: options?.jsonSchema,
      retryOnFailure: options?.retryOnFailure ?? true,
    };

    // Validate temperature
    if (validated.temperature !== undefined) {
      if (typeof validated.temperature !== 'number' || isNaN(validated.temperature)) {
        throw ValidationError.custom('temperature', 'must be a valid number', validated.temperature);
      }
      if (validated.temperature < 0 || validated.temperature > 2) {
        throw ValidationError.outOfRange('temperature', 0, 2, validated.temperature);
      }
    }

    // Validate maxTokens
    if (validated.maxTokens !== undefined) {
      if (typeof validated.maxTokens !== 'number' || isNaN(validated.maxTokens)) {
        throw ValidationError.custom('maxTokens', 'must be a valid number', validated.maxTokens);
      }
      if (validated.maxTokens <= 0) {
        throw ValidationError.outOfRange('maxTokens', 1, undefined, validated.maxTokens);
      }
    }

    return validated;
  }

  protected async executeWithRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = this.retries,
  ): Promise<T> {
    let lastError: any;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;

        if (attempt === maxRetries) {
          break;
        }

        // Check if error is retryable
        if (!this.isRetryableError(error)) {
          throw error;
        }

        const delay = this.calculateRetryDelay(attempt);
        this._logger.warn(`Attempt ${attempt} failed, retrying in ${delay}ms`, {
          error: error instanceof Error ? error.message : String(error),
        });

        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError;
  }

  protected isRetryableError(error: any): boolean {
    // Override in subclasses to define retryable errors
    // Common retryable errors: network timeouts, rate limits, temporary server errors
    if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
      return true;
    }

    if (error.status >= 500 && error.status < 600) {
      return true;
    }

    if (error.status === 429) { // Rate limit
      return true;
    }

    return false;
  }

  protected calculateRetryDelay(attempt: number): number {
    // Exponential backoff with jitter
    const baseDelay = 1000; // 1 second
    const maxDelay = 30000; // 30 seconds

    const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
    const jitter = Math.random() * 0.1 * delay; // 10% jitter

    return Math.floor(delay + jitter);
  }

  protected async makeRequest(
    url: string,
    options: RequestInit,
    timeout: number = this.timeout,
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  protected parseJSONResponse(text: string): any {
    try {
      // Try to extract JSON from response (handle cases where AI adds extra text)
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      // Try parsing the entire response as JSON
      return JSON.parse(text);
    } catch (error) {
      this._logger.warn('Failed to parse JSON response, returning raw text');
      return { content: text, parseError: true };
    }
  }

  // Health check implementation
  async healthCheck(): Promise<boolean> {
    try {
      return await this.isAvailable();
    } catch (error) {
      this._logger.error('Health check failed',
        error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }

  // Usage tracking
  protected trackUsage(operation: string, tokens?: number, cost?: number): void {
    // Override in subclasses to implement usage tracking
    this._logger.debug(`Usage: ${operation}`, { tokens, cost });
  }

  // Rate limiting
  protected async checkRateLimit(): Promise<void> {
    // Override in subclasses to implement rate limiting
  }

  // Token counting (approximate)
  protected estimateTokens(text: string): number {
    // Rough estimation: ~4 characters per token for English text
    return Math.ceil(text.length / 4);
  }
}
