import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import { AIProvider, AIGenerationOptions, AIModelInfo } from './AIProvider';
import { ValidationError } from '../../errors';

export class GeminiProvider extends AIProvider {
  private client?: GoogleGenerativeAI;
  private model?: GenerativeModel;

  constructor(config: { apiKey?: string; model?: string } = {}) {
    super('Gemini', {
      model: config.model || 'gemini-1.5-flash',
      temperature: 0.7,
      maxTokens: 4000,
      ...config,
    });

    if (config.apiKey) {
      this.client = new GoogleGenerativeAI(config.apiKey);
      this.model = this.client.getGenerativeModel({ 
        model: this.defaultModel || 'gemini-1.5-flash' 
      });
    }
  }

  async initialize(): Promise<void> {
    if (!this.apiKey) {
      console.warn('[Gemini] No API key provided. Service will be unavailable.');
      return;
    }

    if (!this.client) {
      this.client = new GoogleGenerativeAI(this.apiKey);
      this.model = this.client.getGenerativeModel({ 
        model: this.defaultModel || 'gemini-1.5-flash' 
      });
    }

    await super.initialize();
  }

  async generateText(prompt: string, options?: AIGenerationOptions): Promise<string> {
    if (!this.client || !this.model) {
      throw new ValidationError('Gemini client not initialized. Please provide an API key.');
    }

    const validatedOptions = this.validateGenerationOptions(options);

    return this.executeWithRetry(async () => {
      try {
        // Create model with generation config
        const model = this.client!.getGenerativeModel({
          model: validatedOptions.model || this.defaultModel || 'gemini-1.5-flash',
          generationConfig: {
            temperature: validatedOptions.temperature,
            maxOutputTokens: validatedOptions.maxTokens,
          },
        });

        // Build the full prompt with system prompt if provided
        let fullPrompt = prompt;
        if (validatedOptions.systemPrompt) {
          fullPrompt = `${validatedOptions.systemPrompt}\n\n${prompt}`;
        }

        const result = await model.generateContent(fullPrompt);
        const response = await result.response;
        const text = response.text();

        if (!text) {
          throw new Error('Empty response from Gemini API');
        }

        this.trackUsage('generateText', this.estimateTokens(prompt + text));
        return text.trim();
      } catch (error: any) {
        console.error('[Gemini] Text generation failed:', error);
        
        if (error.message?.includes('API_KEY_INVALID')) {
          throw new ValidationError('Invalid Gemini API key');
        }
        if (error.message?.includes('RATE_LIMIT_EXCEEDED')) {
          throw new Error('Rate limit exceeded. Please try again later.');
        }
        if (error.message?.includes('SAFETY')) {
          throw new Error('Content was blocked by safety filters');
        }

        throw new Error(`Gemini API error: ${error.message || 'Unknown error'}`);
      }
    });
  }

  async generateStructuredOutput(
    prompt: string,
    schema: any,
    options?: AIGenerationOptions
  ): Promise<any> {
    // For now, use text generation with JSON formatting instructions
    // Gemini doesn't have built-in structured output like OpenAI
    const structurePrompt = `${prompt}

Please respond with valid JSON that matches this schema:
${JSON.stringify(schema, null, 2)}

Return only the JSON object, no additional text or explanation.`;

    const response = await this.generateText(structurePrompt, options);
    return this.parseJSONResponse(response);
  }

  getModelInfo(): AIModelInfo {
    return {
      name: this.defaultModel || 'gemini-1.5-flash',
      provider: 'Google Gemini',
      maxTokens: 1048576, // Gemini 1.5 Flash context length
      supportsStructuredOutput: false,
      supportsFunctionCalling: true,
    };
  }

  async isAvailable(): Promise<boolean> {
    if (!this.client || !this.model) {
      return false;
    }

    try {
      // Simple test to check if the API is working
      const result = await this.model.generateContent('Hello');
      const response = await result.response;
      return !!response.text();
    } catch (error) {
      console.warn('[Gemini] Availability check failed:', error);
      return false;
    }
  }

  protected isRetryableError(error: any): boolean {
    // Gemini-specific retryable errors
    if (error.message?.includes('RATE_LIMIT_EXCEEDED')) {
      return true;
    }
    if (error.message?.includes('INTERNAL_ERROR')) {
      return true;
    }
    if (error.message?.includes('SERVICE_UNAVAILABLE')) {
      return true;
    }

    return super.isRetryableError(error);
  }
}

// Export singleton instance for easy use
export const geminiProvider = new GeminiProvider({
  apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY,
  model: process.env.GEMINI_MODEL || 'gemini-1.5-flash',
});