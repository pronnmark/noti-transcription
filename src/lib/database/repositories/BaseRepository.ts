import { DatabaseClient, DatabaseResult, DatabaseError } from '../interfaces/DatabaseClient';
import { IBaseRepository } from '../interfaces/repositories';

/**
 * Enhanced Base Repository
 * 
 * Implements common database operations and error handling patterns
 * to eliminate DRY violations across repository implementations.
 */
export abstract class BaseRepository implements IBaseRepository {
  constructor(protected db: DatabaseClient) {}

  /**
   * Execute a database operation with standardized error handling
   */
  protected async executeQuery<T>(
    operation: string,
    queryFn: () => Promise<DatabaseResult<T>>
  ): Promise<T> {
    try {
      const result = await queryFn();
      
      if (result.error) {
        throw this.createDatabaseError(result.error, operation);
      }

      if (result.data === null && !this.isNotFoundAllowed(operation)) {
        throw new Error(`${operation}: No data returned`);
      }

      return result.data as T;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw this.formatError(error, operation);
    }
  }

  /**
   * Execute a query that may return null (for find operations)
   */
  protected async executeQueryWithNull<T>(
    operation: string,
    queryFn: () => Promise<DatabaseResult<T>>
  ): Promise<T | null> {
    try {
      const result = await queryFn();
      
      if (result.error) {
        // Handle "not found" errors gracefully
        if (this.isNotFoundError(result.error)) {
          return null;
        }
        throw this.createDatabaseError(result.error, operation);
      }

      return result.data;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw this.formatError(error, operation);
    }
  }

  /**
   * Execute a count query
   */
  protected async executeCountQuery(
    operation: string,
    queryFn: () => Promise<DatabaseResult<any>>
  ): Promise<number> {
    try {
      const result = await queryFn();
      
      if (result.error) {
        throw this.createDatabaseError(result.error, operation);
      }

      return result.count || 0;
    } catch (error) {
      throw this.formatError(error, operation);
    }
  }

  /**
   * Execute a boolean operation (like delete)
   */
  protected async executeBooleanQuery(
    operation: string,
    queryFn: () => Promise<DatabaseResult<any>>
  ): Promise<boolean> {
    try {
      const result = await queryFn();
      
      if (result.error) {
        throw this.createDatabaseError(result.error, operation);
      }

      return true;
    } catch (error) {
      throw this.formatError(error, operation);
    }
  }

  /**
   * Common error formatting
   */
  protected formatError(error: unknown, operation: string): Error {
    const message = error instanceof Error ? error.message : String(error);
    return new Error(`${operation}: ${message}`);
  }

  /**
   * Create a standardized database error
   */
  protected createDatabaseError(error: DatabaseError, operation: string): Error {
    const message = error.message || 'Unknown database error';
    const errorWithContext = new Error(`${operation}: ${message}`);
    
    // Preserve error code for specific error handling
    (errorWithContext as any).code = error.code;
    (errorWithContext as any).details = error.details;
    
    return errorWithContext;
  }

  /**
   * Check if an error is a "not found" error
   */
  protected isNotFoundError(error: DatabaseError): boolean {
    return error?.code === 'PGRST116' || error?.code === '42P01';
  }

  /**
   * Check if null return is allowed for specific operations
   */
  private isNotFoundAllowed(operation: string): boolean {
    const allowedOperations = ['find', 'get', 'select'];
    return allowedOperations.some(allowed => 
      operation.toLowerCase().includes(allowed)
    );
  }

  /**
   * Generate timestamp for updates
   */
  protected getCurrentTimestamp(): string {
    return new Date().toISOString();
  }

  /**
   * Validate ID parameter
   */
  protected validateId(id: number, operation: string): void {
    if (!id || id <= 0 || !Number.isInteger(id)) {
      throw new Error(`${operation}: Invalid ID provided: ${id}`);
    }
  }

  /**
   * Validate required data
   */
  protected validateRequired<T>(data: T, operation: string): void {
    if (!data) {
      throw new Error(`${operation}: Required data is missing`);
    }
  }
}
