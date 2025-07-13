import { sql } from 'drizzle-orm';
import { db, migrationClient } from '../src/lib/db';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function setup() {
  console.log('🔧 Setting up database...');
  
  try {
    // Run migrations
    console.log('📦 Running migrations...');
    await migrate(db, { migrationsFolder: './drizzle' });
    
    console.log('✅ Database setup complete!');
  } catch (error) {
    console.error('❌ Database setup failed:', error);
    process.exit(1);
  } finally {
    await migrationClient.end();
    process.exit(0);
  }
}

setup();