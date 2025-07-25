import { serviceRegistry } from './core/ServiceRegistry';
import { AudioService } from './core/AudioService';
import { TranscriptionService } from './core/TranscriptionService';
import { ExtractionService } from './core/ExtractionService';
import { SummarizationService } from './core/SummarizationService';
import { CustomAIService } from './customAI';
import { SimpleFileUploadService } from './core/SimpleFileUploadService';
import { setServiceLocator, clearServiceLocator } from './ServiceLocator';

import { LocalStorageService } from './storage/StorageService';
import { PromptEngine } from './ai/PromptEngine';
import type { IService } from './core/interfaces';

export class ServiceContainer {
  private static instance: ServiceContainer;
  private initialized = false;

  private constructor() {}

  static getInstance(): ServiceContainer {
    if (!ServiceContainer.instance) {
      ServiceContainer.instance = new ServiceContainer();
    }
    return ServiceContainer.instance;
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      console.log('🔄 Service container already initialized');
      return;
    }

    console.log('🚀 Initializing service container...');

    try {
      // Register core business services
      this.registerCoreServices();

      // Register AI services
      this.registerAIServices();

      // Register storage services
      this.registerStorageServices();

      // Register utility services
      this.registerUtilityServices();

      // Initialize all services
      await serviceRegistry.initializeAll();

      // Set up service locator after all services are initialized
      setServiceLocator({
        audioService: this.audioService,
        transcriptionService: this.transcriptionService,
      });

      this.initialized = true;
      console.log('✅ Service container initialized successfully');

      // Log service status
      this.logServiceStatus();
    } catch (error) {
      console.error('❌ Failed to initialize service container:', error);
      throw error;
    }
  }

  async destroy(): Promise<void> {
    if (!this.initialized) {
      console.log('🔄 Service container not initialized');
      return;
    }

    console.log('🛑 Destroying service container...');

    try {
      await serviceRegistry.destroyAll();
      clearServiceLocator();
      this.initialized = false;
      console.log('✅ Service container destroyed successfully');
    } catch (error) {
      console.error('❌ Failed to destroy service container:', error);
      throw error;
    }
  }

  private registerCoreServices(): void {
    console.log('📋 Registering core business services...');

    // Audio management service
    serviceRegistry.register('audioService', new AudioService());

    // Transcription service
    serviceRegistry.register('transcriptionService', new TranscriptionService());

    // Extraction service
    serviceRegistry.register('extractionService', new ExtractionService());

    // Summarization service
    serviceRegistry.register('summarizationService', new SummarizationService());

    // File upload service (DRY principle - centralize upload logic)
    serviceRegistry.register('fileUploadService', new SimpleFileUploadService());

    console.log('✅ Core business services registered');
  }

  private registerAIServices(): void {
    console.log('📋 Registering AI services...');

    // Custom AI provider
    serviceRegistry.register('customAIService', new CustomAIService());

    console.log('✅ AI services registered');
  }

  private registerStorageServices(): void {
    console.log('📋 Registering storage services...');

    // Local file storage service
    const dataDir = process.env.DATA_DIR || './data';
    serviceRegistry.register('storageService', new LocalStorageService(dataDir));

    console.log('✅ Storage services registered');
  }

  private registerUtilityServices(): void {
    console.log('📋 Registering utility services...');

    // Prompt engine for AI prompt management
    serviceRegistry.register('promptEngine', new PromptEngine());

    console.log('✅ Utility services registered');
  }

  private logServiceStatus(): void {
    const status = serviceRegistry.getServiceStatus();
    console.log('📊 Service Status:');

    for (const [name, info] of Object.entries(status)) {
      const statusIcon = info.initialized ? '✅' : '❌';
      console.log(`  ${statusIcon} ${name}: ${info.initialized ? 'Ready' : 'Not Ready'}`);
    }
  }

  // Service getters for easy access
  get audioService(): AudioService {
    return serviceRegistry.resolve<AudioService>('audioService');
  }

  get transcriptionService(): TranscriptionService {
    return serviceRegistry.resolve<TranscriptionService>('transcriptionService');
  }

  get extractionService(): ExtractionService {
    return serviceRegistry.resolve<ExtractionService>('extractionService');
  }

  get summarizationService(): SummarizationService {
    return serviceRegistry.resolve<SummarizationService>('summarizationService');
  }

  get customAIService(): CustomAIService {
    return serviceRegistry.resolve<CustomAIService>('customAIService');
  }

  get storageService(): LocalStorageService {
    return serviceRegistry.resolve<LocalStorageService>('storageService');
  }

  get promptEngine(): PromptEngine {
    return serviceRegistry.resolve<PromptEngine>('promptEngine');
  }

  get fileUploadService(): SimpleFileUploadService {
    return serviceRegistry.resolve<SimpleFileUploadService>('fileUploadService');
  }

  // Health check for all services
  async healthCheck(): Promise<{
    healthy: boolean;
    services: Record<string, boolean>;
    errors: string[];
  }> {
    console.log('🔍 Running service health check...');

    const serviceHealth = await serviceRegistry.healthCheck();
    const errors: string[] = [];
    let healthyCount = 0;

    for (const [name, isHealthy] of Object.entries(serviceHealth)) {
      if (isHealthy) {
        healthyCount++;
      } else {
        errors.push(`Service '${name}' is unhealthy`);
      }
    }

    const totalServices = Object.keys(serviceHealth).length;
    const healthy = healthyCount === totalServices;

    console.log(`🏥 Health check complete: ${healthyCount}/${totalServices} services healthy`);

    return {
      healthy,
      services: serviceHealth,
      errors,
    };
  }

  // Get service metrics
  getMetrics(): {
    totalServices: number;
    initializedServices: number;
    healthyServices: number;
    initializationOrder: string[];
    } {
    const status = serviceRegistry.getServiceStatus();
    const totalServices = Object.keys(status).length;
    const initializedServices = Object.values(status).filter(s => s.initialized).length;

    return {
      totalServices,
      initializedServices,
      healthyServices: initializedServices, // Simplified for now
      initializationOrder: serviceRegistry.getInitializationOrder(),
    };
  }

  // Service event handling
  onServiceEvent(eventType: string, handler: (event: any) => void): void {
    serviceRegistry.on(eventType, handler);
  }

  offServiceEvent(eventType: string, handler: (event: any) => void): void {
    serviceRegistry.off(eventType, handler);
  }

  // Dynamic service registration
  registerService<T extends IService>(name: string, service: T): void {
    if (this.initialized) {
      throw new Error('Cannot register services after container initialization');
    }
    serviceRegistry.register(name, service);
  }

  // Check if service exists
  hasService(name: string): boolean {
    return serviceRegistry.has(name);
  }

  // Get service by name (generic)
  getService<T extends IService>(name: string): T {
    return serviceRegistry.resolve<T>(name);
  }

  // List all registered services
  listServices(): string[] {
    return Array.from(serviceRegistry.getAll().keys());
  }
}

// Export singleton instance
export const serviceContainer = ServiceContainer.getInstance();

// Convenience function to initialize services
export async function initializeServices(): Promise<void> {
  await serviceContainer.initialize();
}

// Convenience function to destroy services
export async function destroyServices(): Promise<void> {
  await serviceContainer.destroy();
}

// Convenience function for health check
export async function checkServiceHealth(): Promise<boolean> {
  const health = await serviceContainer.healthCheck();
  return health.healthy;
}
