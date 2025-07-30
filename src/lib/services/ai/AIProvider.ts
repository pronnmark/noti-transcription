import { ValidationError } from '../../errors';

export interface AIGenerationOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  jsonSchema?: any;
  retryOnFailure?: boolean;
}

export interface AIModelInfo {
  name: string;
  provider: string;
  maxTokens: number;
  supportsStructuredOutput: boolean;
  supportsFunctionCalling: boolean;
}

export interface AIProviderConfig {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  timeout?: number;
  retries?: number;
  temperature?: number;
  maxTokens?: number;
}

export abstract class AIProvider {
  protected apiKey?: string;
  protected baseUrl?: string;
  protected defaultModel?: string;
  protected timeout: number = 120000;
  protected retries: number = 3;
  protected config: AIProviderConfig;
  protected name: string;

  constructor(name: string, config: AIProviderConfig = {}) {
    this.name = name;
    this.config = {
      timeout: 30000,
      retries: 3,
      temperature: 0.7,
      maxTokens: 4000,
      ...config,
    };
    this.configure(config);
  }

  async initialize(): Promise<void> {
    // Check if API key is provided
    if (!this.apiKey) {
      console.warn(
        `[${this.name}] No API key provided. Service will be unavailable.`
      );
      return;
    }

    // Test connection
    try {
      const isAvailable = await this.isAvailable();
      if (!isAvailable) {
        console.warn(`[${this.name}] Provider is not available`);
        return;
      }
      console.log(`[${this.name}] AI provider initialized successfully`);
    } catch (error) {
      console.warn(`[${this.name}] Provider check failed:`, error);
    }
  }

  configure(config: AIProviderConfig): void {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl;
    this.defaultModel = config.model;

    if (config.timeout) this.timeout = config.timeout;
    if (config.retries) this.retries = config.retries;

    this.config = { ...this.config, ...config };
  }

  abstract generateText(
    prompt: string,
    options?: AIGenerationOptions
  ): Promise<string>;
  abstract generateStructuredOutput(
    prompt: string,
    schema: any,
    options?: AIGenerationOptions
  ): Promise<any>;
  abstract getModelInfo(): AIModelInfo;
  abstract isAvailable(): Promise<boolean>;

  protected validateGenerationOptions(
    options?: AIGenerationOptions
  ): AIGenerationOptions {
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
      if (
        typeof validated.temperature !== 'number' ||
        isNaN(validated.temperature)
      ) {
        throw new ValidationError('temperature must be a valid number');
      }
      if (validated.temperature < 0 || validated.temperature > 2) {
        throw new ValidationError('temperature must be between 0 and 2');
      }
    }

    // Validate maxTokens
    if (validated.maxTokens !== undefined) {
      if (
        typeof validated.maxTokens !== 'number' ||
        isNaN(validated.maxTokens)
      ) {
        throw new ValidationError('maxTokens must be a valid number');
      }
      if (validated.maxTokens <= 0) {
        throw new ValidationError('maxTokens must be positive');
      }
    }

    return validated;
  }

  protected async executeWithRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = this.retries
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
        console.warn(
          `[${this.name}] Attempt ${attempt} failed, retrying in ${delay}ms:`,
          error instanceof Error ? error.message : String(error)
        );

        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError;
  }

  protected isRetryableError(error: any): boolean {
    // Common retryable errors: network timeouts, rate limits, temporary server errors
    if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
      return true;
    }

    if (error.status >= 500 && error.status < 600) {
      return true;
    }

    if (error.status === 429) {
      // Rate limit
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
    timeout: number = this.timeout
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
      console.warn(
        `[${this.name}] Failed to parse JSON response, returning raw text`
      );
      return { content: text, parseError: true };
    }
  }

  // Health check implementation
  async healthCheck(): Promise<boolean> {
    try {
      return await this.isAvailable();
    } catch (error) {
      console.error(`[${this.name}] Health check failed:`, error);
      return false;
    }
  }

  // Usage tracking
  protected trackUsage(
    operation: string,
    tokens?: number,
    cost?: number
  ): void {
    console.debug(`[${this.name}] Usage: ${operation}`, { tokens, cost });
  }

  // Rate limiting placeholder
  protected async checkRateLimit(): Promise<void> {
    // Override in subclasses to implement rate limiting
  }

  // Token counting (approximate)
  protected estimateTokens(text: string): number {
    // Rough estimation: ~4 characters per token for English text
    return Math.ceil(text.length / 4);
  }
}
