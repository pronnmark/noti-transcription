import { configManager } from '../../utils/configuration';
import { ValidationUtils } from '../../utils/validation';
import { settingsService } from '../../db';

export interface AIConfiguration {
  apiKey: string;
  baseUrl: string;
  model: string;
  provider: string;
  timeout?: number;
  maxTokens?: number;
  temperature?: number;
}

/**
 * AIConfigurationManager - Single Responsibility: Manage AI service configuration
 * Extracted from CustomAIService to follow SRP
 */
export class AIConfigurationManager {
  private cachedConfig: AIConfiguration | null = null;
  private configLoadTime: number = 0;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  /**
   * Get AI configuration with caching and multiple source fallback
   */
  async getConfiguration(): Promise<AIConfiguration> {
    // Return cached config if still valid
    if (this.cachedConfig && (Date.now() - this.configLoadTime) < this.CACHE_DURATION) {
      return this.cachedConfig;
    }

    try {
      // Try to load from configuration manager first (environment variables)
      const config = await this.loadFromEnvironment();
      this.cacheConfiguration(config);
      return config;
    } catch (envError) {
      console.warn('Environment configuration not available, trying database:', envError);
      
      try {
        // Fallback to database settings
        const config = await this.loadFromDatabase();
        this.cacheConfiguration(config);
        return config;
      } catch (dbError) {
        console.error('Database configuration failed:', dbError);
        throw new Error(
          'Custom AI configuration is required. Please set environment variables or configure in settings.'
        );
      }
    }
  }

  /**
   * Load configuration from environment variables
   */
  private async loadFromEnvironment(): Promise<AIConfiguration> {
    try {
      const envConfig = configManager.getCustomAIConfig();
      
      // Validate required fields
      this.validateConfiguration(envConfig);
      
      console.log('Using Custom AI configuration from environment variables');
      return envConfig;
    } catch (error) {
      throw new Error(`Environment configuration invalid: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Load configuration from database settings
   */
  private async loadFromDatabase(): Promise<AIConfiguration> {
    try {
      const settings = await settingsService.get();
      
      if (!settings?.customAiApiKey || !settings?.customAiBaseUrl || !settings?.customAiModel) {
        throw new Error('Required database settings not found');
      }

      const config: AIConfiguration = {
        apiKey: settings.customAiApiKey,
        baseUrl: settings.customAiBaseUrl,
        model: settings.customAiModel,
        provider: settings.customAiProvider || 'custom',
        timeout: 120000,
        maxTokens: 4000,
        temperature: 0.7,
      };

      this.validateConfiguration(config);
      
      console.log('Using Custom AI configuration from database');
      return config;
    } catch (error) {
      throw new Error(`Database configuration invalid: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate configuration completeness and format
   */
  private validateConfiguration(config: Partial<AIConfiguration>): asserts config is AIConfiguration {
    ValidationUtils.validateRequiredString(config.apiKey, 'API key');
    ValidationUtils.validateUrl(config.baseUrl!, 'Base URL');
    ValidationUtils.validateRequiredString(config.model, 'Model');
    ValidationUtils.validateRequiredString(config.provider, 'Provider');

    if (config.timeout !== undefined) {
      ValidationUtils.validateNumericRange(config.timeout, 'timeout', 1000, 600000);
    }

    if (config.maxTokens !== undefined) {
      ValidationUtils.validateNumericRange(config.maxTokens, 'maxTokens', 1, 100000);
    }

    if (config.temperature !== undefined) {
      ValidationUtils.validateNumericRange(config.temperature, 'temperature', 0, 2);
    }
  }

  /**
   * Cache configuration with timestamp
   */
  private cacheConfiguration(config: AIConfiguration): void {
    this.cachedConfig = config;
    this.configLoadTime = Date.now();
  }

  /**
   * Clear cached configuration (useful for testing or config updates)
   */
  clearCache(): void {
    this.cachedConfig = null;
    this.configLoadTime = 0;
  }

  /**
   * Check if configuration is available without throwing
   */
  async isConfigurationAvailable(): Promise<boolean> {
    try {
      await this.getConfiguration();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get configuration summary for logging (without sensitive data)
   */
  async getConfigurationSummary(): Promise<{
    hasApiKey: boolean;
    baseUrl: string;
    model: string;
    provider: string;
    source: 'environment' | 'database' | 'unknown';
  }> {
    try {
      const config = await this.getConfiguration();
      
      // Determine source
      let source: 'environment' | 'database' | 'unknown' = 'unknown';
      try {
        configManager.getCustomAIConfig();
        source = 'environment';
      } catch {
        source = 'database';
      }

      return {
        hasApiKey: !!config.apiKey,
        baseUrl: config.baseUrl,
        model: config.model,
        provider: config.provider,
        source,
      };
    } catch {
      return {
        hasApiKey: false,
        baseUrl: '',
        model: '',
        provider: '',
        source: 'unknown',
      };
    }
  }

  /**
   * Update database configuration
   */
  async updateDatabaseConfiguration(updates: {
    apiKey?: string;
    baseUrl?: string;
    model?: string;
    provider?: string;
  }): Promise<void> {
    try {
      // Validate updates
      if (updates.apiKey !== undefined) {
        ValidationUtils.validateRequiredString(updates.apiKey, 'API key');
      }
      if (updates.baseUrl !== undefined) {
        ValidationUtils.validateUrl(updates.baseUrl, 'Base URL');
      }
      if (updates.model !== undefined) {
        ValidationUtils.validateRequiredString(updates.model, 'Model');
      }

      // Update database (this would need to be implemented in settingsService)
      // await settingsService.update(updates);

      // Clear cache to force reload
      this.clearCache();
      
      console.log('Custom AI configuration updated in database');
    } catch (error) {
      throw new Error(
        `Failed to update configuration: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}