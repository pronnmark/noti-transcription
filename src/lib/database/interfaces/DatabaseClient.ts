/**
 * Database Client Abstraction Layer
 * 
 * This interface provides an abstraction over the underlying database client,
 * allowing for dependency inversion and easier testing/mocking.
 */

export interface QueryBuilder<T = any> {
  select(columns?: string, options?: { count?: 'exact' | 'planned' | 'estimated'; head?: boolean }): QueryBuilder<T>;
  insert(data: Partial<T> | Partial<T>[]): QueryBuilder<T>;
  update(data: Partial<T>): QueryBuilder<T>;
  delete(): QueryBuilder<T>;
  eq(column: string, value: any): QueryBuilder<T>;
  neq(column: string, value: any): QueryBuilder<T>;
  gt(column: string, value: any): QueryBuilder<T>;
  gte(column: string, value: any): QueryBuilder<T>;
  lt(column: string, value: any): QueryBuilder<T>;
  lte(column: string, value: any): QueryBuilder<T>;
  or(query: string): QueryBuilder<T>;
  order(column: string, options?: { ascending?: boolean }): QueryBuilder<T>;
  limit(count: number): QueryBuilder<T>;
  range(from: number, to: number): QueryBuilder<T>;
  single(): QueryBuilder<T>;
  execute(): Promise<DatabaseResult<T>>;
}

export interface DatabaseResult<T = any> {
  data: T | null;
  error: DatabaseError | null;
  count?: number | null;
}

export interface DatabaseError {
  code?: string;
  message: string;
  details?: any;
  hint?: string;
}

export interface DatabaseClient {
  /**
   * Get a query builder for the specified table
   */
  from<T = any>(table: string): QueryBuilder<T>;

  /**
   * Execute a raw query (if supported by the database)
   */
  query?<T = any>(sql: string, params?: any[]): Promise<DatabaseResult<T[]>>;

  /**
   * Health check for the database connection
   */
  healthCheck(): Promise<boolean>;
}

/**
 * Base interface for all database operations
 */
export interface DatabaseOperation<T = any> {
  execute(): Promise<DatabaseResult<T>>;
}

/**
 * Common database operation types
 */
export type CreateOperation<T> = DatabaseOperation<T>;
export type ReadOperation<T> = DatabaseOperation<T>;
export type UpdateOperation<T> = DatabaseOperation<T>;
export type DeleteOperation<T> = DatabaseOperation<boolean>;
export type ListOperation<T> = DatabaseOperation<T[]>;
export type CountOperation = DatabaseOperation<number>;