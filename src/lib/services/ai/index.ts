// AI Provider exports
export * from './AIProvider';

// Concrete AI provider implementations
export { CustomAIService, customAIService } from '../customAI';
// Gemini service removed - using flexible custom AI endpoints

// AI provider factory
import type { IAIProvider, AIProviderConfig } from '../core/interfaces';
import { CustomAIService } from '../customAI';
export type AIProviderType = 'custom';

export class AIProviderFactory {
  static create(type: AIProviderType, config?: AIProviderConfig): IAIProvider {
    switch (type) {
      case 'custom':
        return new CustomAIService(config);
      default:
        throw new Error(`Unknown AI provider type: ${type}`);
    }
  }

  static getAvailableProviders(): Array<{
    type: AIProviderType;
    name: string;
    description: string;
    models: string[];
  }> {
    return [
      {
        type: 'custom',
        name: 'Custom AI Endpoint',
        description: 'Configurable AI endpoint supporting OpenAI-compatible APIs',
        models: ['gpt-3.5-turbo', 'gpt-4', 'claude-3-sonnet', 'llama-3.1-70b']
      }
    ];
  }
}
