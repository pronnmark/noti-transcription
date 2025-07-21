// Core service infrastructure
export * from './core';

// Service container and lifecycle management
export * from './ServiceContainer';
export * from './ServiceConfig';
export * from './ServiceLifecycle';

// AI services
export * from './ai';

// Storage services
export * from './storage/StorageService';

// Legacy service exports for backward compatibility
export { customAIService, createAIExtract as createCustomAIExtract } from './customAI';
// Gemini service removed - using flexible custom AI endpoints

// Re-export commonly used services
export { serviceContainer, initializeServices, destroyServices } from './ServiceContainer';
export { serviceConfigManager } from './ServiceConfig';
export { serviceLifecycleManager, startApplication, stopApplication } from './ServiceLifecycle';

// Service initialization utilities
export {
  initializeServicesOnce,
  areServicesInitialized,
  reinitializeServices,
  shutdownServices,
} from './init';
