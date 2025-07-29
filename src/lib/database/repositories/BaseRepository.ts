import { getSupabase } from '../client';

export abstract class BaseRepository {
  protected supabase = getSupabase();
  
  // Common utility methods can be added here
  protected formatError(error: unknown, operation: string): Error {
    const message = error instanceof Error ? error.message : String(error);
    return new Error(`${operation}: ${message}`);
  }
  
  protected isNotFoundError(error: any): boolean {
    return error?.code === 'PGRST116'; // PostgreSQL error for no rows found
  }
}