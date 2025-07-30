import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { DatabaseClient } from './interfaces/DatabaseClient';
import { SupabaseAdapter } from './adapters/SupabaseAdapter';

// Supabase configuration
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.TEST_SUPABASE_URL;
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY || process.env.TEST_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    'Missing Supabase configuration. Please set SUPABASE_URL and SUPABASE_ANON_KEY in your environment.'
  );
}

// Singleton instances
let supabaseClient: SupabaseClient | null = null;
let databaseClient: DatabaseClient | null = null;

function createSupabaseClient(): SupabaseClient {
  try {
    const client = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
      auth: {
        persistSession: false, // For server-side usage
      },
    });

    return client;
  } catch (error) {
    console.error('❌ Failed to create Supabase client:', error);
    console.error('Error details:', {
      supabaseUrl: SUPABASE_URL,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    if (process.env.NODE_ENV === 'development') {
      console.error('💡 To fix this, try:');
      console.error('   1. Ensure Supabase is running: npx supabase start');
      console.error(
        '   2. Check SUPABASE_URL and SUPABASE_ANON_KEY in .env.local'
      );
      console.error('   3. Verify Supabase service is accessible');
    }

    throw new Error(
      `Supabase client creation failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Get the abstracted database client (recommended)
 */
export function getDatabaseClient(): DatabaseClient {
  if (!databaseClient) {
    const supabaseClient = getSupabase(); // Use singleton client
    databaseClient = new SupabaseAdapter(supabaseClient);
  }
  return databaseClient;
}

/**
 * Get Supabase client instance (legacy - use getDatabaseClient() for new code)
 * @deprecated Use getDatabaseClient() instead for better abstraction
 */
export function getSupabase(): SupabaseClient {
  if (!supabaseClient) {
    supabaseClient = createSupabaseClient();
  }
  return supabaseClient;
}

/**
 * Export the client directly for convenience (legacy)
 * @deprecated Use getDatabaseClient() instead for better abstraction
 */
export const supabase = getSupabase();

// Database health check
export async function healthCheck(): Promise<boolean> {
  try {
    const client = getSupabase();
    
    // Try a simple query that should work even with empty database
    const { data, error } = await client
      .from('audio_files')
      .select('count')
      .limit(1);

    if (error) {
      if (error.code === 'PGRST116' || error.code === '42P01') {
        // Table doesn't exist but connection is working
        return true;
      }
      
      // Only log unexpected errors
      if (process.env.NODE_ENV === 'development') {
        console.error('❌ Database health check failed:', error);
      }
      return false;
    }

    return true;
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('❌ Database health check failed with exception:', error);
    }
    return false;
  }
}

// Enhanced connection validation for API routes
export async function ensureConnection(): Promise<boolean> {
  try {
    const isHealthy = await healthCheck();
    if (!isHealthy) {
      // Reset connection and try again
      supabaseClient = null;
      const newCheck = await healthCheck();

      if (!newCheck) {
        if (process.env.NODE_ENV === 'development') {
          console.error('Failed to restore database connection');
        }
        return false;
      }
    }

    return true;
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Connection validation failed:', error);
    }
    return false;
  }
}

// Graceful shutdown (not really needed for Supabase client but keeping for compatibility)
export function closeDatabase(): void {
  try {
    if (supabaseClient) {
      // Supabase client doesn't need explicit closing
      supabaseClient = null;
    }
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Error clearing Supabase client:', error);
    }
  }
}

// Database types
export interface AudioFile {
  id: number;
  file_name: string;
  original_file_name: string;
  original_file_type: string;
  file_size: number;
  file_hash?: string;
  duration?: number;
  title?: string;
  peaks?: string;
  latitude?: number;
  longitude?: number;
  location_accuracy?: number;
  location_timestamp?: string;
  location_provider?: string;
  uploaded_at: string;
  updated_at: string;
  recorded_at?: string;
}

export interface TranscriptionJob {
  id: number;
  file_id: number;
  language?: string;
  model_size?: string;
  threads?: number;
  processors?: number;
  diarization?: boolean;
  speaker_count?: number;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'draft';
  progress?: number;
  transcript?: any; // JSON data
  diarization_status?:
    | 'not_attempted'
    | 'in_progress'
    | 'success'
    | 'failed'
    | 'no_speakers_detected';
  diarization_error?: string;
  last_error?: string;
  started_at?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface SpeakerLabel {
  file_id: number;
  labels: Record<string, string>;
  created_at: string;
  updated_at: string;
}

export interface FileLabel {
  id: number;
  file_id: number;
  labels: string[];
  created_at: string;
  updated_at: string;
}
