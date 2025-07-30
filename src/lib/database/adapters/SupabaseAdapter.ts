import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { DatabaseClient, QueryBuilder, DatabaseResult, DatabaseError } from '../interfaces/DatabaseClient';

/**
 * Supabase Query Builder Adapter
 * 
 * Wraps Supabase's query builder to implement our database interface
 */
class SupabaseQueryBuilder<T = any> implements QueryBuilder<T> {
  constructor(private supabaseQuery: any) {}

  select(columns?: string, options?: { count?: 'exact' | 'planned' | 'estimated'; head?: boolean }): QueryBuilder<T> {
    return new SupabaseQueryBuilder(this.supabaseQuery.select(columns, options));
  }

  insert(data: Partial<T> | Partial<T>[]): QueryBuilder<T> {
    return new SupabaseQueryBuilder(this.supabaseQuery.insert(data));
  }

  update(data: Partial<T>): QueryBuilder<T> {
    return new SupabaseQueryBuilder(this.supabaseQuery.update(data));
  }

  delete(): QueryBuilder<T> {
    return new SupabaseQueryBuilder(this.supabaseQuery.delete());
  }

  eq(column: string, value: any): QueryBuilder<T> {
    return new SupabaseQueryBuilder(this.supabaseQuery.eq(column, value));
  }

  neq(column: string, value: any): QueryBuilder<T> {
    return new SupabaseQueryBuilder(this.supabaseQuery.neq(column, value));
  }

  gt(column: string, value: any): QueryBuilder<T> {
    return new SupabaseQueryBuilder(this.supabaseQuery.gt(column, value));
  }

  gte(column: string, value: any): QueryBuilder<T> {
    return new SupabaseQueryBuilder(this.supabaseQuery.gte(column, value));
  }

  lt(column: string, value: any): QueryBuilder<T> {
    return new SupabaseQueryBuilder(this.supabaseQuery.lt(column, value));
  }

  lte(column: string, value: any): QueryBuilder<T> {
    return new SupabaseQueryBuilder(this.supabaseQuery.lte(column, value));
  }

  or(query: string): QueryBuilder<T> {
    return new SupabaseQueryBuilder(this.supabaseQuery.or(query));
  }

  order(column: string, options?: { ascending?: boolean }): QueryBuilder<T> {
    return new SupabaseQueryBuilder(this.supabaseQuery.order(column, options));
  }

  limit(count: number): QueryBuilder<T> {
    return new SupabaseQueryBuilder(this.supabaseQuery.limit(count));
  }

  range(from: number, to: number): QueryBuilder<T> {
    return new SupabaseQueryBuilder(this.supabaseQuery.range(from, to));
  }

  single(): QueryBuilder<T> {
    return new SupabaseQueryBuilder(this.supabaseQuery.single());
  }

  // Execute the query and return the result
  async execute(): Promise<DatabaseResult<T>> {
    try {
      const result = await this.supabaseQuery;
      return {
        data: result.data,
        error: result.error ? this.mapSupabaseError(result.error) : null,
        count: result.count,
      };
    } catch (error) {
      return {
        data: null,
        error: {
          code: 'EXECUTION_ERROR',
          message: error instanceof Error ? error.message : String(error),
          details: error,
        },
      };
    }
  }

  private mapSupabaseError(error: any): DatabaseError {
    return {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    };
  }
}

/**
 * Supabase Database Client Adapter
 * 
 * Implements the DatabaseClient interface using Supabase as the backend
 */
export class SupabaseAdapter implements DatabaseClient {
  private client: SupabaseClient;

  constructor(url: string, key: string) {
    this.client = createClient(url, key, {
      auth: {
        persistSession: false, // For server-side usage
      },
    });
  }

  from<T = any>(table: string): QueryBuilder<T> {
    return new SupabaseQueryBuilder<T>(this.client.from(table));
  }

  async healthCheck(): Promise<boolean> {
    try {
      const { error } = await this.client
        .from('audio_files')
        .select('count')
        .limit(1);

      if (error) {
        // Table doesn't exist but connection is working
        if (error.code === 'PGRST116' || error.code === '42P01') {
          return true;
        }
        return false;
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get the underlying Supabase client (for operations not covered by the interface)
   */
  getClient(): SupabaseClient {
    return this.client;
  }
}