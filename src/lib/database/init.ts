import { getSupabase } from './client';

export interface DatabaseInitOptions {
  validateConnection?: boolean;
}

export class DatabaseInitializer {
  async initialize(options: DatabaseInitOptions = {}): Promise<void> {
    const { validateConnection = true } = options;

    console.log('🚀 Initializing Supabase connection...');

    try {
      // Test database connection
      if (validateConnection) {
        await this.testConnection();
      }

      console.log('✅ Supabase initialization completed successfully');
    } catch (error) {
      console.error('❌ Supabase initialization failed:', error);
      throw error;
    }
  }

  private async testConnection(): Promise<void> {
    console.log('🔌 Testing Supabase connection...');

    try {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('audio_files')
        .select('count', { count: 'exact', head: true });

      if (error) {
        throw error;
      }

      console.log('✅ Supabase connection successful');
    } catch (error) {
      console.error('❌ Supabase connection failed:', error);
      throw new Error(`Supabase connection failed: ${error}`);
    }
  }

  async getStatus(): Promise<{
    connected: boolean;
  }> {
    try {
      let connected = false;
      try {
        await this.testConnection();
        connected = true;
      } catch {
        connected = false;
      }

      return { connected };
    } catch (error) {
      console.error('Error getting database status:', error);
      return { connected: false };
    }
  }
}

// Export singleton instance
export const databaseInitializer = new DatabaseInitializer();
