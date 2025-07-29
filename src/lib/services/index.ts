// Core service infrastructure
export * from './core';

// AI services
export * from './ai';

// Legacy service exports for backward compatibility
export {
  customAIService,
  createAIExtract as createCustomAIExtract,
} from './customAI';
