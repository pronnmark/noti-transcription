import { AppError, ErrorCode, ErrorSeverity, ErrorContext } from './AppError';

export interface DatabaseErrorContext extends ErrorContext {
  table?: string;
  operation?: string;
  query?: string;
  parameters?: any[];
  constraint?: string;
  column?: string;
  value?: any;
}

export class DatabaseError extends AppError {
  public readonly table?: string;
  public readonly operation?: string;
  public readonly query?: string;

  constructor(
    message: string,
    code: ErrorCode = ErrorCode.DATABASE_ERROR,
    cause?: Error,
    context: Partial<DatabaseErrorContext> = {}
  ) {
    super(
      message,
      code,
      500,
      ErrorSeverity.HIGH,
      true,
      context,
      cause
    );

    this.table = context.table;
    this.operation = context.operation;
    this.query = context.query;
  }

  static connection(message: string, cause?: Error): DatabaseError {
    return new DatabaseError(
      `Database connection error: ${message}`,
      ErrorCode.DATABASE_CONNECTION_ERROR,
      cause,
      { operation: 'connect' }
    );
  }

  static transaction(message: string, cause?: Error, context?: Partial<DatabaseErrorContext>): DatabaseError {
    return new DatabaseError(
      `Transaction error: ${message}`,
      ErrorCode.TRANSACTION_ERROR,
      cause,
      { operation: 'transaction', ...context }
    );
  }

  static constraint(
    constraintName: string, 
    table?: string, 
    column?: string, 
    value?: any,
    cause?: Error
  ): DatabaseError {
    const message = `Constraint violation: ${constraintName}${table ? ` on table '${table}'` : ''}${column ? ` column '${column}'` : ''}`;
    
    return new DatabaseError(
      message,
      ErrorCode.CONSTRAINT_VIOLATION,
      cause,
      {
        operation: 'constraint_check',
        table,
        constraint: constraintName,
        column,
        value
      }
    );
  }

  static notFound(table: string, id?: string | number, cause?: Error): DatabaseError {
    const message = id 
      ? `Record not found in table '${table}' with id '${id}'`
      : `No records found in table '${table}'`;
    
    return new DatabaseError(
      message,
      ErrorCode.NOT_FOUND,
      cause,
      {
        operation: 'select',
        table,
        value: id
      }
    );
  }

  static duplicate(table: string, column?: string, value?: any, cause?: Error): DatabaseError {
    const message = column 
      ? `Duplicate entry for '${column}' in table '${table}'`
      : `Duplicate entry in table '${table}'`;
    
    return new DatabaseError(
      message,
      ErrorCode.ALREADY_EXISTS,
      cause,
      {
        operation: 'insert',
        table,
        column,
        value
      }
    );
  }

  static query(query: string, parameters?: any[], cause?: Error): DatabaseError {
    return new DatabaseError(
      `Query execution failed: ${cause?.message || 'Unknown error'}`,
      ErrorCode.DATABASE_ERROR,
      cause,
      {
        operation: 'query',
        query,
        parameters
      }
    );
  }

  static timeoutError(operation: string, table?: string, cause?: Error): DatabaseError {
    return new DatabaseError(
      `Database operation timed out: ${operation}${table ? ` on table '${table}'` : ''}`,
      ErrorCode.TIMEOUT_ERROR,
      cause,
      {
        operation,
        table
      }
    );
  }

  static migration(version: string, direction: 'up' | 'down', cause?: Error): DatabaseError {
    return new DatabaseError(
      `Migration ${direction} failed for version ${version}: ${cause?.message || 'Unknown error'}`,
      ErrorCode.DATABASE_ERROR,
      cause,
      {
        operation: 'migration',
        value: version
      }
    );
  }

  static schema(message: string, table?: string, cause?: Error): DatabaseError {
    return new DatabaseError(
      `Schema error: ${message}${table ? ` in table '${table}'` : ''}`,
      ErrorCode.DATABASE_ERROR,
      cause,
      {
        operation: 'schema',
        table
      }
    );
  }

  // Helper method to determine if error is retryable
  isRetryable(): boolean {
    const retryableCodes = [
      ErrorCode.DATABASE_CONNECTION_ERROR,
      ErrorCode.TIMEOUT_ERROR,
      ErrorCode.TRANSACTION_ERROR
    ];
    
    return retryableCodes.includes(this.code);
  }

  // Helper method to get user-friendly message
  getUserMessage(): string {
    switch (this.code) {
      case ErrorCode.DATABASE_CONNECTION_ERROR:
        return 'Unable to connect to the database. Please try again later.';
      
      case ErrorCode.CONSTRAINT_VIOLATION:
        if (this.metadata.context?.constraint?.includes('unique')) {
          return 'This record already exists. Please use different values.';
        }
        return 'The data violates database constraints. Please check your input.';
      
      case ErrorCode.NOT_FOUND:
        return 'The requested record was not found.';
      
      case ErrorCode.ALREADY_EXISTS:
        return 'A record with this information already exists.';
      
      case ErrorCode.TIMEOUT_ERROR:
        return 'The database operation took too long. Please try again.';
      
      case ErrorCode.TRANSACTION_ERROR:
        return 'The operation could not be completed. Please try again.';
      
      default:
        return 'A database error occurred. Please try again later.';
    }
  }
}
