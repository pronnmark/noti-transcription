import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema/index';
import { join, resolve } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';

// Database configuration - ensure absolute path
const DB_PATH = resolve(process.env.DATABASE_PATH || 'sqlite.db');
const DB_OPTIONS: Database.Options = {
  verbose: process.env.NODE_ENV === 'development' ? console.log : undefined,
  fileMustExist: false,
  timeout: 5000,
};

// Create database connection with error handling
function createDatabase(): Database.Database {
  try {
    console.log(`📂 Connecting to database: ${DB_PATH}`);

    // Ensure the directory exists
    const dbDir = dirname(DB_PATH);
    if (!existsSync(dbDir)) {
      console.log(`📁 Creating database directory: ${dbDir}`);
      mkdirSync(dbDir, { recursive: true });
    }

    // Log current working directory for debugging
    console.log(`📍 Current working directory: ${process.cwd()}`);
    console.log(`📍 Database will be created at: ${DB_PATH}`);

    const sqlite = new Database(DB_PATH, DB_OPTIONS);

    // Enable WAL mode for better concurrency
    sqlite.pragma('journal_mode = WAL');

    // Enable foreign keys
    sqlite.pragma('foreign_keys = ON');

    // Set reasonable timeout
    sqlite.pragma('busy_timeout = 5000');

    console.log('✅ Database connection established');
    return sqlite;
  } catch (error) {
    console.error('❌ Failed to connect to database:', error);
    console.error('Error details:', {
      dbPath: DB_PATH,
      cwd: process.cwd(),
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    // Don't just throw - this might be causing the silent crash
    if (process.env.NODE_ENV === 'development') {
      console.error('💡 To fix this, try:');
      console.error('   1. Check file permissions in the project directory');
      console.error('   2. Ensure you have write access to:', DB_PATH);
      console.error(
        '   3. Try deleting any existing sqlite.db file and let it recreate',
      );
    }

    throw new Error(
      `Database connection failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

// Lazy database connection - create only when needed
let sqlite: Database.Database | null = null;

function getDatabase(): Database.Database {
  if (!sqlite) {
    sqlite = createDatabase();
  }
  return sqlite;
}

// Lazy drizzle instance - create only when first used
let db: ReturnType<typeof drizzle> | null = null;

export function getDb() {
  if (!db) {
    try {
      console.log('🔧 Creating drizzle instance...');
      db = drizzle(getDatabase(), {
        schema,
        logger: process.env.NODE_ENV === 'development',
      });
      console.log('✅ Drizzle instance created');
    } catch (error) {
      console.error('❌ Failed to create drizzle instance:', error);
      throw error;
    }
  }
  return db;
}

// Export function to get sqlite instance for advanced operations
export function getSqlite(): Database.Database {
  return getDatabase();
}

// Database health check
export async function healthCheck(): Promise<boolean> {
  try {
    // Simple query to test connection
    const sqliteInstance = getDatabase();
    const result = sqliteInstance.prepare('SELECT 1 as test').get();
    return !!(result && (result as any).test === 1);
  } catch (error) {
    console.error('Database health check failed:', error);
    return false;
  }
}

// Enhanced connection validation for API routes
export async function ensureConnection(): Promise<boolean> {
  try {
    // Test database connection
    const isHealthy = await healthCheck();
    if (!isHealthy) {
      console.warn('Database connection unhealthy, attempting to reconnect...');

      // Reset connection and try again
      closeDatabase();
      const newCheck = await healthCheck();

      if (!newCheck) {
        console.error('Failed to restore database connection');
        return false;
      }

      console.log('✅ Database connection restored');
    }

    return true;
  } catch (error) {
    console.error('Connection validation failed:', error);
    return false;
  }
}

// Graceful shutdown
export function closeDatabase(): void {
  try {
    if (sqlite) {
      sqlite.close();
      sqlite = null;
      db = null; // Reset drizzle instance as well
      console.log('📂 Database connection closed');
    }
  } catch (error) {
    console.error('Error closing database:', error);
  }
}

// Process termination is handled by ServiceLifecycleManager
// Exporting closeDatabase for centralized shutdown handling
