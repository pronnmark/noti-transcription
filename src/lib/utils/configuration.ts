import { ValidationUtils } from './validation';

export interface AIProviderConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  provider?: string;
  timeout?: number;
  maxTokens?: number;
  temperature?: number;
}

export interface DatabaseConfig {
  url: string;
  apiKey: string;
  serviceRoleKey?: string;
}

export interface StorageConfig {
  url: string;
  apiKey: string;
  buckets: {
    audioFiles: string;
    transcripts: string;
  };
}

/**
 * Centralized configuration management to eliminate repeated environment variable access
 */
export class ConfigurationManager {
  private static instance: ConfigurationManager;
  private cachedConfigs: Map<string, any> = new Map();

  private constructor() {}

  static getInstance(): ConfigurationManager {
    if (!ConfigurationManager.instance) {
      ConfigurationManager.instance = new ConfigurationManager();
    }
    return ConfigurationManager.instance;
  }

  /**
   * Get environment variable with validation and default value
   */
  private getEnvVar(key: string, defaultValue?: string, required: boolean = false): string {
    const value = process.env[key] || defaultValue;
    
    if (required && !value) {
      throw new Error(`Required environment variable ${key} is not set`);
    }
    
    return value || '';
  }

  /**
   * Get environment variable as number
   */
  private getEnvNumber(key: string, defaultValue?: number, min?: number, max?: number): number {
    const strValue = this.getEnvVar(key);
    if (!strValue && defaultValue !== undefined) {
      return defaultValue;
    }
    
    const numValue = parseInt(strValue, 10);
    if (isNaN(numValue)) {
      if (defaultValue !== undefined) {
        return defaultValue;
      }
      throw new Error(`Environment variable ${key} must be a valid number`);
    }
    
    if (min !== undefined && numValue < min) {
      throw new Error(`Environment variable ${key} must be >= ${min}`);
    }
    
    if (max !== undefined && numValue > max) {
      throw new Error(`Environment variable ${key} must be <= ${max}`);
    }
    
    return numValue;
  }

  /**
   * Get environment variable as boolean
   */
  private getEnvBoolean(key: string, defaultValue: boolean = false): boolean {
    const value = this.getEnvVar(key);
    if (!value) return defaultValue;
    
    return value.toLowerCase() === 'true' || value === '1';
  }

  /**
   * Get Custom AI configuration with caching
   */
  getCustomAIConfig(): AIProviderConfig {
    const cacheKey = 'customAI';
    
    if (!this.cachedConfigs.has(cacheKey)) {
      const config: AIProviderConfig = {
        apiKey: this.getEnvVar('CUSTOM_AI_API_KEY', '', true),
        baseUrl: this.getEnvVar('CUSTOM_AI_BASE_URL', '', true),
        model: this.getEnvVar('CUSTOM_AI_MODEL', 'gpt-3.5-turbo'),
        provider: this.getEnvVar('CUSTOM_AI_PROVIDER', 'custom'),
        timeout: this.getEnvNumber('CUSTOM_AI_TIMEOUT', 120000, 1000, 600000),
        maxTokens: this.getEnvNumber('CUSTOM_AI_MAX_TOKENS', 4000, 1, 100000),
        temperature: parseFloat(this.getEnvVar('CUSTOM_AI_TEMPERATURE', '0.7')),
      };

      // Validate configuration
      ValidationUtils.validateUrl(config.baseUrl, 'Custom AI base URL');
      ValidationUtils.validateRequiredString(config.apiKey, 'Custom AI API key');
      ValidationUtils.validateRequiredString(config.model, 'Custom AI model');
      ValidationUtils.validateNumericRange(config.temperature, 'temperature', 0, 2);

      this.cachedConfigs.set(cacheKey, config);
    }

    return this.cachedConfigs.get(cacheKey);
  }

  /**
   * Get Supabase database configuration
   */
  getDatabaseConfig(): DatabaseConfig {
    const cacheKey = 'database';
    
    if (!this.cachedConfigs.has(cacheKey)) {
      const config: DatabaseConfig = {
        url: this.getEnvVar('SUPABASE_URL', 'http://127.0.0.1:54321'),
        apiKey: this.getEnvVar('SUPABASE_ANON_KEY', '', true),
        serviceRoleKey: this.getEnvVar('SUPABASE_SERVICE_ROLE_KEY'),
      };

      // Validate configuration
      ValidationUtils.validateUrl(config.url, 'Supabase URL');
      ValidationUtils.validateRequiredString(config.apiKey, 'Supabase API key');

      this.cachedConfigs.set(cacheKey, config);
    }

    return this.cachedConfigs.get(cacheKey);
  }

  /**
   * Get Supabase storage configuration
   */
  getStorageConfig(): StorageConfig {
    const cacheKey = 'storage';
    
    if (!this.cachedConfigs.has(cacheKey)) {
      const dbConfig = this.getDatabaseConfig();
      
      const config: StorageConfig = {
        url: dbConfig.url,
        apiKey: dbConfig.serviceRoleKey || dbConfig.apiKey,
        buckets: {
          audioFiles: this.getEnvVar('SUPABASE_AUDIO_BUCKET', 'audio-files'),
          transcripts: this.getEnvVar('SUPABASE_TRANSCRIPTS_BUCKET', 'transcripts'),
        },
      };

      this.cachedConfigs.set(cacheKey, config);
    }

    return this.cachedConfigs.get(cacheKey);
  }

  /**
   * Get Whisper API configuration
   */
  getWhisperConfig(): { url: string; timeout: number } {
    const cacheKey = 'whisper';
    
    if (!this.cachedConfigs.has(cacheKey)) {
      const config = {
        url: this.getEnvVar('WHISPER_API_URL', 'http://localhost:8080'),
        timeout: this.getEnvNumber('WHISPER_TIMEOUT', 600000, 30000, 1800000), // 30s to 30min
      };

      ValidationUtils.validateUrl(config.url, 'Whisper API URL');

      this.cachedConfigs.set(cacheKey, config);
    }

    return this.cachedConfigs.get(cacheKey);
  }

  /**
   * Get application-wide settings
   */
  getAppConfig(): {
    environment: string;
    debug: boolean;
    logLevel: string;
    maxFileSize: number;
    enableDiarization: boolean;
  } {
    const cacheKey = 'app';
    
    if (!this.cachedConfigs.has(cacheKey)) {
      const config = {
        environment: this.getEnvVar('NODE_ENV', 'development'),
        debug: this.getEnvBoolean('DEBUG', false),
        logLevel: this.getEnvVar('LOG_LEVEL', 'info'),
        maxFileSize: this.getEnvNumber('MAX_FILE_SIZE', 100 * 1024 * 1024, 1024 * 1024), // Default 100MB, min 1MB
        enableDiarization: this.getEnvBoolean('ENABLE_DIARIZATION', true),
      };

      this.cachedConfigs.set(cacheKey, config);
    }

    return this.cachedConfigs.get(cacheKey);
  }

  /**
   * Clear cached configuration (useful for testing or config reload)
   */
  clearCache(configType?: string): void {
    if (configType) {
      this.cachedConfigs.delete(configType);
    } else {
      this.cachedConfigs.clear();
    }
  }

  /**
   * Validate all configurations at startup
   */
  async validateAllConfigs(): Promise<void> {
    try {
      // Load and validate all configs
      this.getAppConfig();
      this.getDatabaseConfig();
      this.getStorageConfig();
      this.getWhisperConfig();
      
      // Only validate Custom AI if keys are provided
      try {
        this.getCustomAIConfig();
      } catch (error) {
        if (error instanceof Error && error.message.includes('Required environment variable')) {
          console.warn('Custom AI configuration not available - service will be disabled');
        } else {
          throw error;
        }
      }

      console.log('✅ All configurations validated successfully');
    } catch (error) {
      console.error('❌ Configuration validation failed:', error);
      throw error;
    }
  }

  /**
   * Get configuration summary for logging/debugging
   */
  getConfigSummary(): Record<string, any> {
    const app = this.getAppConfig();
    const db = this.getDatabaseConfig();
    const storage = this.getStorageConfig();
    const whisper = this.getWhisperConfig();

    return {
      environment: app.environment,
      debug: app.debug,
      database: {
        url: db.url,
        hasApiKey: !!db.apiKey,
        hasServiceKey: !!db.serviceRoleKey,
      },
      storage: {
        url: storage.url,
        buckets: storage.buckets,
        hasApiKey: !!storage.apiKey,
      },
      whisper: {
        url: whisper.url,
        timeout: whisper.timeout,
      },
      customAI: this.cachedConfigs.has('customAI') ? {
        hasApiKey: !!this.cachedConfigs.get('customAI')?.apiKey,
        baseUrl: this.cachedConfigs.get('customAI')?.baseUrl,
        model: this.cachedConfigs.get('customAI')?.model,
      } : { available: false },
    };
  }
}

// Export singleton instance
export const configManager = ConfigurationManager.getInstance();