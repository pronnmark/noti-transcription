import { FullConfig } from '@playwright/test';
import { config as dotenvConfig } from 'dotenv';
import { setupTestEnvironment } from './test-helpers';

async function globalSetup(config: FullConfig) {
  console.log('🚀 Setting up e2e test environment...');

  // Load environment variables from .env.local
  dotenvConfig({ path: '.env.local' });

  // Set test environment variables
  process.env.DATABASE_PATH = './test-e2e.db';

  // Set up test Supabase configuration with better fallbacks
  const testSupabaseUrl =
    process.env.TEST_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    'http://127.0.0.1:54321';
  const testSupabaseAnon =
    process.env.TEST_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  const testSupabaseService =
    process.env.TEST_SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  // Log configuration for debugging
  console.log(`📍 Test Supabase URL: ${testSupabaseUrl}`);
  console.log(`🔑 Anon key present: ${testSupabaseAnon ? 'YES' : 'NO'}`);
  console.log(`🔐 Service key present: ${testSupabaseService ? 'YES' : 'NO'}`);

  if (!testSupabaseAnon || !testSupabaseService) {
    console.error(
      '❌ Missing Supabase keys. Please check your .env.local file.'
    );
    console.error('Required environment variables:');
    console.error('- TEST_SUPABASE_ANON_KEY or SUPABASE_ANON_KEY');
    console.error(
      '- TEST_SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SERVICE_ROLE_KEY'
    );
    throw new Error('Missing required Supabase environment variables');
  }

  // Set environment variables for the test run
  // Note: NODE_ENV is read-only in TypeScript, but this works at runtime
  (process.env as any).NODE_ENV = 'test';
  process.env.SUPABASE_URL = testSupabaseUrl;
  process.env.SUPABASE_ANON_KEY = testSupabaseAnon;
  process.env.SUPABASE_SERVICE_ROLE_KEY = testSupabaseService;

  try {
    await setupTestEnvironment();
    console.log('✅ Test environment setup complete');
  } catch (error) {
    console.error('❌ Test environment setup failed:', error);
    throw error;
  }
}

export default globalSetup;
