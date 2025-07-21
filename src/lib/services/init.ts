import { startApplication, serviceLifecycleManager } from './ServiceLifecycle';

let isInitialized = false;
let initializationPromise: Promise<void> | null = null;

/**
 * Initialize services if not already initialized
 * This function is safe to call multiple times
 */
export async function initializeServicesOnce(): Promise<void> {
  if (isInitialized) {
    return;
  }

  if (initializationPromise) {
    return initializationPromise;
  }

  initializationPromise = (async () => {
    try {
      console.log('🚀 Starting service initialization...');
      
      await startApplication();
      
      isInitialized = true;
      console.log('✅ Services initialized successfully');
      
      // Set up error handlers
      serviceLifecycleManager.on('error', (event) => {
        console.error('🚨 Service error:', event.error);
      });
      
      serviceLifecycleManager.on('shutdown', (event) => {
        console.log('🛑 Service shutdown initiated:', event.data);
        isInitialized = false;
      });
      
    } catch (error) {
      console.error('❌ Service initialization failed:', error);
      isInitialized = false;
      initializationPromise = null;
      throw error;
    }
  })();

  return initializationPromise;
}

/**
 * Check if services are initialized
 */
export function areServicesInitialized(): boolean {
  return isInitialized;
}

/**
 * Force re-initialization of services
 */
export async function reinitializeServices(): Promise<void> {
  isInitialized = false;
  initializationPromise = null;
  await initializeServicesOnce();
}

/**
 * Gracefully shutdown services
 */
export async function shutdownServices(): Promise<void> {
  if (!isInitialized) {
    return;
  }

  try {
    await serviceLifecycleManager.shutdown();
    isInitialized = false;
    initializationPromise = null;
  } catch (error) {
    console.error('Error during service shutdown:', error);
    throw error;
  }
}
