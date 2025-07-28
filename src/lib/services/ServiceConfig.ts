// Removed logging dependency
import { BaseService } from './core/BaseService';

export interface ServiceConfiguration {
  // Core service configurations
  audio: {
    maxFileSize: number;
    supportedFormats: string[];
    uploadPath: string;
  };

  transcription: {
    defaultModel: string;
    maxConcurrentJobs: number;
    timeout: number;
    retryAttempts: number;
  };

  extraction: {
    defaultTemplates: string[];
    maxConcurrentExtractions: number;
    timeout: number;
  };

  summarization: {
    defaultModel: string;
    maxTokens: number;
    temperature: number;
  };

  // AI provider configurations
  ai: {
    gemini: {
      apiKey?: string;
      model: string;
      maxTokens: number;
      temperature: number;
      timeout: number;
    };

    defaultProvider: 'gemini';
  };

  // Storage configurations
  storage: {
    basePath: string;
    maxStorageSize: number;
    cleanupInterval: number;
    backupEnabled: boolean;
  };

  // System configurations
  system: {
    logLevel: 'debug' | 'info' | 'warn' | 'error';
    enableMetrics: boolean;
    healthCheckInterval: number;
  };
}

export class ServiceConfigManager extends BaseService {
  private config: ServiceConfiguration;

  constructor() {
    super('ServiceConfigManager');
    this.config = this.getDefaultConfiguration();
  }

  protected async onInitialize(): Promise<void> {
    // Load configuration from environment variables and database
    await this.loadConfiguration();
    this._logger.info('Service configuration manager initialized');
  }

  protected async onDestroy(): Promise<void> {
    this._logger.info('Service configuration manager destroyed');
  }

  private getDefaultConfiguration(): ServiceConfiguration {
    return {
      audio: {
        maxFileSize: 100 * 1024 * 1024, // 100MB
        supportedFormats: ['.mp3', '.wav', '.m4a', '.flac', '.ogg'],
        uploadPath: './data/uploads',
      },

      transcription: {
        defaultModel: 'large-v3',
        maxConcurrentJobs: 3,
        timeout: 300000, // 5 minutes
        retryAttempts: 3,
      },

      extraction: {
        defaultTemplates: ['transcript-summary', 'extract-tasks', 'extract-decisions'],
        maxConcurrentExtractions: 5,
        timeout: 120000, // 2 minutes
      },

      summarization: {
        defaultModel: 'anthropic/claude-sonnet-4',
        maxTokens: 4000,
        temperature: 0.7,
      },

      ai: {
        gemini: {
          apiKey: process.env.GEMINI_API_KEY,
          model: 'models/gemini-2.5-flash',
          maxTokens: 8192,
          temperature: 0.7,
          timeout: 30000,
        },

        defaultProvider: 'gemini',
      },

      storage: {
        basePath: process.env.DATA_DIR || './data',
        maxStorageSize: 10 * 1024 * 1024 * 1024, // 10GB
        cleanupInterval: 24 * 60 * 60 * 1000, // 24 hours
        backupEnabled: false,
      },

      system: {
        logLevel: (process.env.LOG_LEVEL as any) || 'info',
        enableMetrics: process.env.ENABLE_METRICS === 'true',
        healthCheckInterval: 60000, // 1 minute
      },
    };
  }

  private async loadConfiguration(): Promise<void> {
    try {
      // Load from database settings if available
      const { settingsService } = await import('@/lib/db');
      const dbSettings = await settingsService.get();

      if (dbSettings) {
        // Update AI configurations with database values - placeholder for future implementation

        // OpenRouter removed - using only Gemini

        // Update other settings as needed
        this._logger.info('Configuration loaded from database');
      }
    } catch (error) {
      this._logger.warn('Could not load configuration from database, using defaults', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  getConfiguration(): ServiceConfiguration {
    return { ...this.config };
  }

  getServiceConfig(serviceName: string): any {
    switch (serviceName) {
      case 'audioService':
        return this.config.audio;

      case 'transcriptionService':
        return this.config.transcription;

      case 'extractionService':
        return this.config.extraction;

      case 'summarizationService':
        return this.config.summarization;

      case 'customAIService':
        return this.config.ai.gemini;

        // OpenRouter and Gemini services removed - using customAI

      case 'storageService':
        return this.config.storage;

      default:
        return {};
    }
  }

  updateConfiguration(updates: Partial<ServiceConfiguration>): void {
    this.config = { ...this.config, ...updates };
    this._logger.info('Configuration updated', updates);
  }

  updateServiceConfig(serviceName: string, config: Partial<any>): void {
    const currentConfig = this.getServiceConfig(serviceName);
    const updatedConfig = { ...currentConfig, ...config };

    // Update the specific service configuration
    switch (serviceName) {
      case 'audioService':
        this.config.audio = { ...this.config.audio, ...config };
        break;
      case 'transcriptionService':
        this.config.transcription = { ...this.config.transcription, ...config };
        break;
      case 'extractionService':
        this.config.extraction = { ...this.config.extraction, ...config };
        break;
      case 'summarizationService':
        this.config.summarization = { ...this.config.summarization, ...config };
        break;
      case 'customAIService':
        this.config.ai.gemini = { ...this.config.ai.gemini, ...config };
        break;
      // OpenRouter and Gemini services removed - using customAI
      case 'storageService':
        this.config.storage = { ...this.config.storage, ...config };
        break;
    }

    this._logger.info(`Configuration updated for ${serviceName}`, config);
  }

  validateConfiguration(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate audio configuration
    if (this.config.audio.maxFileSize <= 0) {
      errors.push('Audio max file size must be positive');
    }

    if (this.config.audio.supportedFormats.length === 0) {
      errors.push('At least one audio format must be supported');
    }

    // Validate transcription configuration
    if (this.config.transcription.maxConcurrentJobs <= 0) {
      errors.push('Max concurrent transcription jobs must be positive');
    }

    if (this.config.transcription.timeout <= 0) {
      errors.push('Transcription timeout must be positive');
    }

    // Validate AI configuration
    if (!this.config.ai.gemini.apiKey) {
      errors.push('Gemini API key must be configured');
    }

    // Validate storage configuration
    if (this.config.storage.maxStorageSize <= 0) {
      errors.push('Max storage size must be positive');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  async saveConfiguration(): Promise<void> {
    try {
      const { settingsService } = await import('@/lib/db');

      // Save relevant configuration to database
      await settingsService.update({
        geminiApiKey: this.config.ai.gemini.apiKey,
        // Add other settings as needed
      });

      this._logger.info('Configuration saved to database');
    } catch (error) {
      this._logger.error('Failed to save configuration to database',
        error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  getEnvironmentOverrides(): Record<string, any> {
    return {
      GEMINI_API_KEY: this.config.ai.gemini.apiKey,
      DATA_DIR: this.config.storage.basePath,
      LOG_LEVEL: this.config.system.logLevel,
      ENABLE_METRICS: this.config.system.enableMetrics.toString(),
    };
  }
}

// Lazy-loaded singleton instance
let _serviceConfigManager: ServiceConfigManager | null = null;

export function getServiceConfigManager(): ServiceConfigManager {
  if (!_serviceConfigManager) {
    _serviceConfigManager = new ServiceConfigManager();
  }
  return _serviceConfigManager;
}

// Export getter proxy for backward compatibility
export const serviceConfigManager = new Proxy({} as ServiceConfigManager, {
  get(target, prop, receiver) {
    const manager = getServiceConfigManager();
    return Reflect.get(manager, prop, receiver);
  },
});
