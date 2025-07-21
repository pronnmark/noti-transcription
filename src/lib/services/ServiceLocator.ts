// Service Locator Pattern to avoid circular dependencies
// This allows services to get other services without importing the container directly

import type { AudioService } from './core/AudioService';
import type { TranscriptionService } from './core/TranscriptionService';

export interface ServiceLocator {
  audioService: AudioService;
  transcriptionService: TranscriptionService;
}

let serviceLocator: ServiceLocator | null = null;

export function setServiceLocator(locator: ServiceLocator): void {
  serviceLocator = locator;
}

export function getServiceLocator(): ServiceLocator {
  if (!serviceLocator) {
    throw new Error('Service locator not initialized. Call setServiceLocator() first.');
  }
  return serviceLocator;
}

export function clearServiceLocator(): void {
  serviceLocator = null;
}
