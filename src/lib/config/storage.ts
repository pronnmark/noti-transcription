/**
 * Storage Configuration Utility
 * Centralizes storage-related configuration to follow DRY principle
 */

export interface StorageConfig {
  audioBucket: string;
  transcriptsBucket: string;
  environment: 'test' | 'development' | 'production';
}

export class StorageConfigManager {
  private static instance: StorageConfigManager;
  private config!: StorageConfig; // Definite assignment assertion - set in updateConfig()
  private lastEnvironment: string | undefined;

  private constructor() {
    this.updateConfig();
  }

  private updateConfig() {
    const environment = this.determineEnvironment();

    this.config = {
      audioBucket: environment === 'test' ? 'test-audio-files' : 'audio-files',
      transcriptsBucket:
        environment === 'test' ? 'test-transcripts' : 'transcripts',
      environment,
    };

    this.lastEnvironment = process.env.NODE_ENV;
  }

  public static getInstance(): StorageConfigManager {
    if (!StorageConfigManager.instance) {
      StorageConfigManager.instance = new StorageConfigManager();
    } else {
      // Check if environment changed and update config if needed
      const currentEnv = process.env.NODE_ENV;
      if (currentEnv !== StorageConfigManager.instance.lastEnvironment) {
        StorageConfigManager.instance.updateConfig();
      }
    }
    return StorageConfigManager.instance;
  }

  private determineEnvironment(): 'test' | 'development' | 'production' {
    const nodeEnv = process.env.NODE_ENV;

    if (nodeEnv === 'test') return 'test';
    if (nodeEnv === 'production') return 'production';
    return 'development';
  }

  public getConfig(): StorageConfig {
    return { ...this.config };
  }

  public getAudioBucket(): string {
    return this.config.audioBucket;
  }

  public getTranscriptsBucket(): string {
    return this.config.transcriptsBucket;
  }

  public isTestEnvironment(): boolean {
    return this.config.environment === 'test';
  }

  public getAllBuckets(): Array<{ name: string; public: boolean }> {
    return [
      { name: this.config.audioBucket, public: false },
      { name: this.config.transcriptsBucket, public: false },
    ];
  }
}
