import '../logging/init';
import { aiExtractsService, settingsService } from '@/lib/db';
import { AIProvider } from './ai/AIProvider';
import type {
  AIGenerationOptions,
  AIModelInfo,
  AIProviderConfig,
  ServiceConfig,
} from './core/interfaces';

interface OpenAIMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface OpenAIRequest {
  model: string;
  messages: OpenAIMessage[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  response_format?: {
    type: 'json_object' | 'text';
  };
}

interface OpenAIResponse {
  choices: Array<{
    message: {
      content: string;
      role: string;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class CustomAIService extends AIProvider {
  constructor(config: AIProviderConfig = {}) {
    super('CustomAIService', {
      ...config,
    });
  }

  protected getDefaultConfig(): ServiceConfig {
    return {
      ...super.getDefaultConfig(),
      maxTokens: 4000,
      temperature: 0.7,
    };
  }

  protected async onInitialize(): Promise<void> {
    try {
      // Load settings first to populate apiKey, baseUrl, etc.
      const settings = await this.getCustomSettings();

      // Now call parent initialization which will have access to this.apiKey
      await super.onInitialize();
    } catch (error) {
      this._logger.warn('Failed to initialize CustomAI service settings', error instanceof Error ? error : new Error(String(error)));
      // Don't throw - allow service to initialize but mark as unavailable
    }
  }

  async generateText(prompt: string, options?: AIGenerationOptions): Promise<string> {
    return this.executeWithErrorHandling('generateText', async () => {
      const validatedOptions = this.validateGenerationOptions(options);

      const messages: OpenAIMessage[] = [];

      // Add system message if provided
      if (validatedOptions.systemPrompt) {
        messages.push({
          role: 'system',
          content: validatedOptions.systemPrompt,
        });
      }

      // Add user message
      messages.push({
        role: 'user',
        content: prompt,
      });

      return await this.chat(messages, {
        model: validatedOptions.model,
        maxTokens: validatedOptions.maxTokens,
        temperature: validatedOptions.temperature,
        jsonMode: !!validatedOptions.jsonSchema,
      });
    });
  }

  async generateStructuredOutput(prompt: string, schema: any, options?: AIGenerationOptions): Promise<any> {
    return this.executeWithErrorHandling('generateStructuredOutput', async () => {
      const validatedOptions = this.validateGenerationOptions(options);

      const response = await this.generateText(prompt, {
        ...validatedOptions,
        jsonSchema: schema,
      });

      return this.parseJSONResponse(response);
    });
  }

  getModelInfo(): AIModelInfo {
    return {
      name: this.config.model || this.defaultModel || 'Unknown Model',
      provider: 'Custom AI Endpoint',
      maxTokens: this.config.maxTokens || 4000,
      supportsStructuredOutput: true,
      supportsFunctionCalling: false,
    };
  }

  async getDefaultModel(): Promise<string> {
    try {
      const settings = await this.getCustomSettings();
      return settings.model;
    } catch (error) {
      this._logger.warn('Failed to get configured model, using fallback', error);
      return this.defaultModel || 'gpt-3.5-turbo';
    }
  }

  private isDDwrappy(settings: any): boolean {
    return settings.baseUrl?.includes('localhost:8000') || settings.provider === 'ddwrappy';
  }

  protected async makeRequest(url: string, options: RequestInit, timeout: number = 120000): Promise<Response> {
    try {
      return await super.makeRequest(url, options, timeout);
    } catch (error) {
      // Enhance error messages for DDwrappy
      if (error instanceof Error && error.message.includes('HTTP 422')) {
        const settings = await this.getCustomSettings().catch(() => ({}));
        if (this.isDDwrappy(settings)) {
          throw new Error(`DDwrappy rejected the request (HTTP 422). This often indicates:
            - Invalid model name (current: ${settings.model || 'unknown'})
            - Malformed JSON schema in request
            - DDwrappy service not running or misconfigured
            
            Try: curl http://localhost:8000/v1/models to verify DDwrappy is running.
            
            Original error: ${error.message}`);
        }
      }
      throw error;
    }
  }

  private validateModelForProvider(model: string, settings: any): string {
    // Check if this is DDwrappy based on base URL
    const isDDwrappy = this.isDDwrappy(settings);

    if (isDDwrappy) {
      // DDwrappy expects specific Claude model names without provider prefix
      const ddwrappyModels = [
        'claude-sonnet-4-20250514',
        'claude-opus-4-20250514',
        'claude-3-7-sonnet-20250219',
        'claude-3-5-sonnet-20241022',
        'claude-3-5-haiku-20241022',
      ];

      // Remove anthropic/ prefix if present
      let cleanModel = model.replace(/^anthropic\//, '');

      // Map common model names to DDwrappy equivalents
      if (cleanModel === 'claude-sonnet-4') {
        cleanModel = 'claude-sonnet-4-20250514';
      }

      // Validate against known DDwrappy models
      if (!ddwrappyModels.includes(cleanModel)) {
        this._logger.warn(`Model ${model} not supported by DDwrappy, using default: ${settings.model}`);
        return settings.model;
      }

      return cleanModel;
    }

    return model;
  }

  async isAvailable(): Promise<boolean> {
    try {
      const settings = await this.getCustomSettings();
      if (!settings.apiKey || !settings.baseUrl) {
        this._logger.warn('Custom AI service is not available: Missing API key or base URL');
        return false;
      }
      return true;
    } catch (error) {
      this._logger.warn('Custom AI service is not available', error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }

  private async getCustomSettings(): Promise<{
    apiKey: string;
    baseUrl: string;
    model: string;
    provider: string;
  }> {
    try {
      // First priority: Check environment variables
      const envApiKey = process.env.CUSTOM_AI_API_KEY;
      const envBaseUrl = process.env.CUSTOM_AI_BASE_URL;
      const envModel = process.env.CUSTOM_AI_MODEL;
      const envProvider = process.env.CUSTOM_AI_PROVIDER;

      if (envApiKey && envBaseUrl && envModel) {
        this._logger.debug('Using environment variable configuration');
        // Cache settings
        this.apiKey = envApiKey;
        this.baseUrl = envBaseUrl;
        this.defaultModel = envModel;

        return {
          apiKey: envApiKey,
          baseUrl: envBaseUrl,
          model: envModel,
          provider: envProvider || 'custom',
        };
      }

      // Second priority: Use inherited configuration if available
      if (this.apiKey && this.baseUrl && this.defaultModel) {
        return {
          apiKey: this.apiKey,
          baseUrl: this.baseUrl,
          model: this.defaultModel,
          provider: 'custom',
        };
      }

      // Third priority: Try database settings
      try {
        const settings = await settingsService.get();
        const dbApiKey = settings?.customAiApiKey;
        const dbBaseUrl = settings?.customAiBaseUrl;
        const dbModel = settings?.customAiModel;
        const dbProvider = settings?.customAiProvider;

        if (dbApiKey && dbBaseUrl && dbModel) {
          this._logger.debug('Using database configuration');
          // Cache settings
          this.apiKey = dbApiKey;
          this.baseUrl = dbBaseUrl;
          this.defaultModel = dbModel;

          return {
            apiKey: dbApiKey,
            baseUrl: dbBaseUrl,
            model: dbModel,
            provider: dbProvider || 'custom',
          };
        }
      } catch (dbError) {
        this._logger.warn('Could not read database settings', dbError instanceof Error ? dbError : new Error(String(dbError)));
      }

      // No configuration found - throw clear error
      throw new Error('Custom AI endpoint configuration is required. Please set CUSTOM_AI_API_KEY, CUSTOM_AI_BASE_URL, and CUSTOM_AI_MODEL environment variables, or configure in Settings.');
    } catch (error) {
      this._logger.error('Error getting custom AI settings', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  async chat(messages: OpenAIMessage[], options: {
    model?: string;
    maxTokens?: number;
    temperature?: number;
    topP?: number;
    jsonMode?: boolean;
  } = {}): Promise<string> {
    return this.executeWithErrorHandling('chat', async () => {
      const settings = await this.getCustomSettings();

      const {
        model = settings.model,
        maxTokens = this.config.maxTokens || 4000,
        temperature = this.config.temperature || 0.7,
        topP = 0.9,
        jsonMode = false,
      } = options;

      // Validate model for DDwrappy compatibility
      const validatedModel = this.validateModelForProvider(model, settings);

      const request: OpenAIRequest = {
        model: validatedModel,
        messages,
        temperature,
        max_tokens: maxTokens,
        top_p: topP,
      };

      // Add JSON mode if requested - with DDwrappy compatibility
      if (jsonMode) {
        if (this.isDDwrappy(settings)) {
          // DDwrappy-specific JSON mode configuration
          request.response_format = {
            type: 'json_object',
            // Potential DDwrappy-specific options (if supported)
            ...(settings.strictJson && { strict: true }),
          };
        } else {
          request.response_format = { type: 'json_object' };
        }
      }

      this._logger.info(`Making Custom AI request to ${model}`, {
        messageCount: messages.length,
        maxTokens,
        temperature,
        hasJsonMode: jsonMode,
        baseUrl: settings.baseUrl,
      });

      const url = `${settings.baseUrl}/chat/completions`;

      // Prepare headers with DDwrappy-specific optimizations
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.apiKey}`,
      };

      // Add DDwrappy-specific headers if applicable
      if (this.isDDwrappy(settings) && jsonMode) {
        // Potential DDwrappy-specific headers for JSON formatting
        headers['X-Response-Format'] = 'json';
        headers['X-Claude-Allowed-Tools'] = ''; // Disable tools to encourage pure JSON
      }

      const response = await this.makeRequest(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(request),
      });

      const data: OpenAIResponse = await response.json();

      // Validate response structure
      if (!data.choices || data.choices.length === 0) {
        this._logger.error('No choices in AI response', new Error(JSON.stringify(data)));
        throw new Error('No response choices from AI API');
      }

      const choice = data.choices[0];
      if (!choice?.message?.content) {
        this._logger.error('Invalid AI response structure', new Error(JSON.stringify(choice)));
        throw new Error('Invalid response structure from AI API');
      }

      const responseText = choice.message.content;

      // Track usage if available
      if (data.usage) {
        this.trackUsage('chat', data.usage.total_tokens);
      }

      this._logger.debug('Custom AI request completed successfully', {
        responseLength: responseText.length,
        finishReason: choice.finish_reason,
      });

      return responseText;
    });
  }

  // Legacy method for backward compatibility
  async extractFromTranscript(
    transcript: string,
    prompt: string = 'Summarize the key points from this transcript.',
    model?: string,
  ): Promise<string> {
    return this.executeWithErrorHandling('extractFromTranscript', async () => {
      if (!transcript || transcript.trim().length === 0) {
        throw new Error('Transcript is empty or invalid');
      }

      const systemPrompt = `You are an AI assistant specialized in analyzing audio transcripts.
You provide clear, structured summaries and extract key information as requested.
Always respond in Swedish when the transcript is in Swedish.
Focus on accuracy and relevance.`;

      const fullPrompt = `${prompt}\n\nTranscript:\n${transcript}`;

      // Calculate appropriate max tokens based on transcript length
      const transcriptTokens = this.estimateTokens(transcript);
      const maxTokens = Math.min(
        Math.max(1000, Math.ceil(transcriptTokens * 0.25)), // 25% of input tokens
        this.config.maxTokens || 4000,
      );

      this._logger.info('Processing transcript', {
        transcriptLength: transcript.length,
        estimatedTokens: transcriptTokens,
        maxOutputTokens: maxTokens,
      });

      return await this.generateText(fullPrompt, {
        model: model || this.config.model,
        maxTokens,
        temperature: 0.3, // Lower temperature for more consistent extraction
        systemPrompt,
      });
    });
  }

  // Override error handling for custom endpoint-specific errors
  protected isRetryableError(error: any): boolean {
    if (super.isRetryableError(error)) {
      return true;
    }

    // Don't retry authentication errors
    if (error.message?.includes('unauthorized') || error.message?.includes('invalid api key')) {
      return false;
    }

    return false;
  }
}

// Lazy-loaded singleton instance
let _customAIService: CustomAIService | null = null;
let _initializationPromise: Promise<void> | null = null;

export async function getCustomAIService(): Promise<CustomAIService> {
  if (_customAIService) {
    return _customAIService;
  }

  // Ensure service initialization happens only once
  if (!_initializationPromise) {
    _initializationPromise = initializeCustomAIService();
  }

  await _initializationPromise;
  return _customAIService!;
}

async function initializeCustomAIService(): Promise<void> {
  try {
    console.log('🚀 Initializing CustomAI service...');

    // Create service with proper configuration
    _customAIService = new CustomAIService({
      temperature: 0.7,
      maxTokens: 4000,
    });

    // Initialize the service
    await _customAIService.initialize();

    console.log('✅ CustomAI service initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize CustomAI service:', error);
    throw error;
  }
}

// Export getter proxy for backward compatibility
export const customAIService = new Proxy({} as CustomAIService, {
  get(target, prop, receiver) {
    // For async methods, we need to return a function that awaits initialization
    if (typeof prop === 'string') {
      return async (...args: any[]) => {
        const service = await getCustomAIService();
        const method = (service as any)[prop];
        if (typeof method === 'function') {
          return method.apply(service, args);
        }
        return method;
      };
    }
    // For non-string properties, return a function that gets the service first
    return async () => {
      const service = await getCustomAIService();
      return Reflect.get(service, prop, receiver);
    };
  },
});

// Legacy AI Extraction function for backward compatibility
export async function createAIExtract(
  fileId: number,
  transcript: string,
  prompt?: string,
  model?: string,
  templateId?: string,
): Promise<string> {
  try {
    const extractedContent = await customAIService.extractFromTranscript(
      transcript,
      prompt,
      model,
    );

    // Save to database
    await aiExtractsService.create({
      fileId,
      templateId: templateId || 'default',
      content: extractedContent,
      metadata: JSON.stringify({
        model: model || 'custom-model',
        prompt: prompt || 'Summarize the key points from this transcript.',
      }),
    });

    return extractedContent;
  } catch (error) {
    console.error('AI extraction error:', error);
    throw error;
  }
}

// Helper to get available models - returns empty array since models are user-configured
export function getAvailableModels() {
  return [];
}
