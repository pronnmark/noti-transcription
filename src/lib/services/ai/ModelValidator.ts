/**
 * ModelValidator - Single Responsibility: AI model validation and compatibility
 * Extracted from CustomAIService to follow SRP
 */
export class ModelValidator {
  private static readonly DDWRAPPY_MODELS = [
    'claude-sonnet-4-20250514',
    'claude-opus-4-20250514', 
    'claude-3-7-sonnet-20250219',
    'claude-3-5-sonnet-20241022',
    'claude-3-5-haiku-20241022',
  ];

  private static readonly MODEL_MAPPINGS: Record<string, string> = {
    'claude-sonnet-4': 'claude-sonnet-4-20250514',
    'anthropic/claude-sonnet-4': 'claude-sonnet-4-20250514',
  };

  /**
   * Check if provider is DDwrappy based on configuration
   */
  static isDDwrappy(settings: { baseUrl?: string; provider?: string }): boolean {
    return (
      settings.baseUrl?.includes('localhost:8000') ||
      settings.provider === 'ddwrappy'
    );
  }

  /**
   * Validate and normalize model name for specific provider
   */
  static validateModelForProvider(model: string, settings: { baseUrl?: string; provider?: string }): string {
    if (this.isDDwrappy(settings)) {
      return this.validateDDwrappyModel(model, settings);
    }

    // For other providers, return as-is for now
    // This is where we could add validation for OpenAI, Anthropic, etc.
    return model;
  }

  /**
   * Validate model specifically for DDwrappy provider
   */
  private static validateDDwrappyModel(model: string, settings: any): string {
    // Remove anthropic/ prefix if present
    let cleanModel = model.replace(/^anthropic\//, '');

    // Apply model mappings
    if (this.MODEL_MAPPINGS[cleanModel]) {
      cleanModel = this.MODEL_MAPPINGS[cleanModel];
    }
    if (this.MODEL_MAPPINGS[model]) {
      cleanModel = this.MODEL_MAPPINGS[model];
    }

    // Validate against known DDwrappy models
    if (!this.DDWRAPPY_MODELS.includes(cleanModel)) {
      console.warn(
        `Model ${model} not supported by DDwrappy, using fallback: ${settings.model || 'claude-sonnet-4-20250514'}`
      );
      return settings.model || 'claude-sonnet-4-20250514';
    }

    return cleanModel;
  }

  /**
   * Get available models for a provider
   */
  static getAvailableModels(provider: string): string[] {
    switch (provider.toLowerCase()) {
      case 'ddwrappy':
        return this.DDWRAPPY_MODELS;
      case 'openai':
        return ['gpt-4', 'gpt-3.5-turbo', 'gpt-4-turbo'];
      case 'anthropic':
        return ['claude-3-sonnet', 'claude-3-haiku', 'claude-3-opus'];
      default:
        return [];
    }
  }

  /**
   * Validate model exists for provider
   */
  static isModelSupported(model: string, provider: string): boolean {
    const availableModels = this.getAvailableModels(provider);
    if (availableModels.length === 0) {
      return true; // Unknown provider, assume supported
    }

    const normalizedModel = this.validateModelForProvider(model, { provider });
    return availableModels.includes(normalizedModel);
  }
}