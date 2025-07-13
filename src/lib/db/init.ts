import { db } from './index';
import { sql } from 'drizzle-orm';

// Test database connection
export async function testDatabaseConnection(): Promise<boolean> {
  try {
    await db.execute(sql`SELECT 1`);
    return true;
  } catch (error) {
    console.error('Database connection failed:', error);
    return false;
  }
}

// We'll check database availability at runtime instead of module load time
let _isDatabaseAvailable: boolean | null = null;

export async function isDatabaseAvailable(): Promise<boolean> {
  if (_isDatabaseAvailable === null) {
    _isDatabaseAvailable = await testDatabaseConnection();
  }
  return _isDatabaseAvailable;
}