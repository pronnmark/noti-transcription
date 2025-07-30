import { AIProvider } from './ai/AIProvider';
import type {
  AIGenerationOptions,
  AIModelInfo,
  AIProviderConfig,
} from './ai/AIProvider';
import { AIConfigurationManager } from './ai/AIConfigurationManager';
import { ModelValidator } from './ai/ModelValidator';
import { ResponseParser } from './ai/ResponseParser';
import { ErrorHandler } from '../utils/errorHandler';
import { ValidationUtils } from '../utils/validation';

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
  private configManager: AIConfigurationManager;

  constructor(config: AIProviderConfig = {}) {
    super('CustomAIService', config);
    this.configManager = new AIConfigurationManager();
  }

  async initialize(): Promise<void> {
    return await ErrorHandler.serviceMethod(async () => {
      // Load configuration through configuration manager
      const aiConfig = await this.configManager.getConfiguration();
      
      // Set provider configuration
      this.configure({
        apiKey: aiConfig.apiKey,
        baseUrl: aiConfig.baseUrl,
        model: aiConfig.model,
        timeout: aiConfig.timeout,
        maxTokens: aiConfig.maxTokens,
        temperature: aiConfig.temperature,
      });

      // Call parent initialization
      await super.initialize();
    }, {
      service: 'CustomAIService',
      operation: 'initialize'
    });
  }

  async generateText(
    prompt: string,
    options?: AIGenerationOptions
  ): Promise<string> {
    return await ErrorHandler.serviceMethod(async () => {
      // Validate inputs
      ValidationUtils.validateRequiredString(prompt, 'prompt');
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
    }, {
      service: 'CustomAIService',
      operation: 'generateText',
      metadata: { promptLength: prompt.length, hasOptions: !!options }
    });
  }

  async generateStructuredOutput(
    prompt: string,
    schema: any,
    options?: AIGenerationOptions
  ): Promise<any> {
    return await ErrorHandler.serviceMethod(async () => {
      ValidationUtils.validateRequiredString(prompt, 'prompt');
      const validatedOptions = this.validateGenerationOptions(options);

      const response = await this.generateText(prompt, {
        ...validatedOptions,
        jsonSchema: schema,
      });

      return ResponseParser.parseJSONResponse(response);
    }, {
      service: 'CustomAIService',
      operation: 'generateStructuredOutput',
      metadata: { hasSchema: !!schema }
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
    return await ErrorHandler.serviceMethod(async () => {
      const config = await this.configManager.getConfiguration();
      return config.model;
    }, {
      service: 'CustomAIService',
      operation: 'getDefaultModel'
    });
  }

  async isAvailable(): Promise<boolean> {
    return await this.configManager.isConfigurationAvailable();
  }

  protected async makeRequest(
    url: string,
    options: RequestInit,
    timeout: number = 120000
  ): Promise<Response> {
    return await ErrorHandler.handleWithRetry(
      () => super.makeRequest(url, options, timeout),
      {
        service: 'CustomAIService',
        operation: 'makeRequest',
        metadata: { url, timeout }
      },
      3,
      1000
    );
  }

  // Removed old configuration methods - now handled by AIConfigurationManager

  async chat(
    messages: OpenAIMessage[],
    options: {
      model?: string;
      maxTokens?: number;
      temperature?: number;
      topP?: number;
      jsonMode?: boolean;
    } = {}
  ): Promise<string> {
    return await ErrorHandler.serviceMethod(async () => {
      ValidationUtils.validateArray(messages, 'messages', 1);
      
      const config = await this.configManager.getConfiguration();

      const {
        model = config.model,
        maxTokens = this.config.maxTokens || 4000,
        temperature = this.config.temperature || 0.7,
        topP = 0.9,
        jsonMode = false,
      } = options;

      // Validate model for provider compatibility
      const validatedModel = ModelValidator.validateModelForProvider(model, config);

      const request: OpenAIRequest = {
        model: validatedModel,
        messages,
        temperature,
        max_tokens: maxTokens,
        top_p: topP,
      };

      // Add JSON mode if requested
      if (jsonMode) {
        if (ModelValidator.isDDwrappy(config)) {
          request.response_format = { type: 'json_object' };
          // Add DDwrappy-specific optimizations if needed
        } else {
          request.response_format = { type: 'json_object' };
        }
      }

      const url = `${config.baseUrl}/chat/completions`;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      };

      // Add provider-specific headers
      if (ModelValidator.isDDwrappy(config) && jsonMode) {
        headers['X-Response-Format'] = 'json';
        headers['X-Claude-Allowed-Tools'] = '';
      }

      const response = await this.makeRequest(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(request),
      });

      const data: OpenAIResponse = await response.json();
      return ResponseParser.parseOpenAIResponse(data);
    }, {
      service: 'CustomAIService',
      operation: 'chat',
      metadata: { 
        messageCount: messages.length, 
        hasJsonMode: !!options.jsonMode,
        model: options.model 
      }
    });
  }

  // Legacy method for backward compatibility
  async extractFromTranscript(
    transcript: string,
    prompt: string = 'Summarize the key points from this transcript.',
    model?: string
  ): Promise<string> {
    return await ErrorHandler.serviceMethod(async () => {
      ValidationUtils.validateRequiredString(transcript, 'transcript');
      ValidationUtils.validateRequiredString(prompt, 'prompt');

      const systemPrompt = `You are an AI assistant specialized in analyzing audio transcripts.
You provide clear, structured summaries and extract key information as requested.
Always respond in Swedish when the transcript is in Swedish.
Focus on accuracy and relevance.`;

      const fullPrompt = `${prompt}\n\nTranscript:\n${transcript}`;

      return await this.generateText(fullPrompt, {
        model: model || this.config.model,
        maxTokens: this.config.maxTokens || 4000,
        temperature: 0.3, // Lower temperature for more consistent extraction
        systemPrompt,
      });
    }, {
      service: 'CustomAIService',
      operation: 'extractFromTranscript',
      metadata: { 
        transcriptLength: transcript.length,
        customModel: !!model 
      }
    });
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
    _customAIService = new CustomAIService({});

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

// Legacy AI Extraction function - removed (extractions feature deprecated)
export async function createAIExtract(
  fileId: number,
  transcript: string,
  prompt?: string,
  model?: string,
  templateId?: string
): Promise<string> {
  try {
    // Extractions feature has been removed
    throw new Error('Extractions feature is no longer available');
  } catch (error) {
    console.error('AI extraction error:', error);
    throw error;
  }
}

// Helper to get available models - returns empty array since models are user-configured
export function getAvailableModels() {
  return [];
}
