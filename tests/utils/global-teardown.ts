import { FullConfig } from '@playwright/test';
import { cleanupTestEnvironment } from './test-helpers';

async function globalTeardown(config: FullConfig) {
  console.log('🧹 Cleaning up e2e test environment...');
  
  try {
    await cleanupTestEnvironment();
    console.log('✅ Test environment cleanup complete');
  } catch (error) {
    console.error('❌ Test environment cleanup failed:', error);
    // Don't throw here - we want tests to complete even if cleanup fails
  }
}

export default globalTeardown;