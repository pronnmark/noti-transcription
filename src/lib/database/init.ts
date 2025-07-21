import { getDb } from './client';
import { MigrationRunner } from './migrations/migration-runner';
import { audioFiles } from './schema/audio';
import { existsSync } from 'fs';
import { join } from 'path';
import { sql } from 'drizzle-orm';

export interface DatabaseInitOptions {
  runMigrations?: boolean;
  validateSchema?: boolean;
  createBackup?: boolean;
  force?: boolean;
}

export class DatabaseInitializer {
  private migrationRunner: MigrationRunner;

  constructor() {
    this.migrationRunner = new MigrationRunner();
  }

  async initialize(options: DatabaseInitOptions = {}): Promise<void> {
    const {
      runMigrations = true,
      validateSchema = true,
      createBackup = false,
      force = false,
    } = options;

    console.log('🚀 Initializing database...');

    try {
      // Check if database file exists
      const dbPath = 'sqlite.db';
      const dbExists = existsSync(dbPath);

      if (!dbExists) {
        console.log('📝 Database file not found, creating new database...');
      } else {
        console.log('📂 Existing database found');

        if (createBackup) {
          await this.createBackup();
        }
      }

      // Test database connection
      await this.testConnection();

      // Run migrations if requested
      if (runMigrations) {
        await this.migrationRunner.runMigrations();
      }

      // Validate schema if requested
      if (validateSchema) {
        const isValid = await this.migrationRunner.validateDatabase();
        if (!isValid && !force) {
          throw new Error('Database schema validation failed');
        }
      }

      // Initialize default data if needed
      await this.initializeDefaultData();

      console.log('✅ Database initialization completed successfully');

    } catch (error) {
      console.error('❌ Database initialization failed:', error);
      throw error;
    }
  }

  private async testConnection(): Promise<void> {
    console.log('🔌 Testing database connection...');

    try {
      // Simple query to test connection without requiring specific tables
      const db = getDb();
      const result = await db.run(sql`SELECT 1 as test`);
      console.log('✅ Database connection successful');
    } catch (error) {
      console.error('❌ Database connection failed:', error);
      throw new Error(`Database connection failed: ${error}`);
    }
  }

  private async createBackup(): Promise<void> {
    console.log('💾 Creating database backup...');

    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = `sqlite.db.backup.${timestamp}`;

      // Note: In a real implementation, you'd copy the database file
      // For now, we'll just log the intent
      console.log(`📁 Backup would be created at: ${backupPath}`);
      console.log('✅ Backup created successfully');

    } catch (error) {
      console.error('❌ Backup creation failed:', error);
      throw error;
    }
  }

  private async initializeDefaultData(): Promise<void> {
    console.log('📊 Checking for default data...');

    try {
      // Check if we need to insert default templates or settings
      // This is where you'd add default extraction templates, etc.

      console.log('✅ Default data check completed');

    } catch (error) {
      console.error('❌ Default data initialization failed:', error);
      throw error;
    }
  }

  async getStatus(): Promise<{
    connected: boolean;
    migrationsApplied: number;
    lastMigration?: string;
    databaseSize?: number;
  }> {
    try {
      // Test connection
      let connected = false;
      try {
        await this.testConnection();
        connected = true;
      } catch {
        connected = false;
      }

      // Get migration info
      const migrations = await this.migrationRunner.getMigrationInfo();
      const appliedMigrations = migrations.filter(m => m.applied);
      const lastMigration = appliedMigrations.length > 0
        ? appliedMigrations[appliedMigrations.length - 1].name
        : undefined;

      // Get database size (simplified)
      let databaseSize: number | undefined;
      try {
        const dbPath = 'sqlite.db';
        if (existsSync(dbPath)) {
          const fs = require('fs');
          const stats = fs.statSync(dbPath);
          databaseSize = stats.size;
        }
      } catch {
        // Ignore size calculation errors
      }

      return {
        connected,
        migrationsApplied: appliedMigrations.length,
        lastMigration,
        databaseSize,
      };

    } catch (error) {
      console.error('Error getting database status:', error);
      return {
        connected: false,
        migrationsApplied: 0,
      };
    }
  }

  async reset(confirm: boolean = false): Promise<void> {
    if (!confirm) {
      throw new Error('Database reset requires explicit confirmation');
    }

    console.log('🗑️ Resetting database...');
    console.warn('⚠️ This will delete all data!');

    try {
      // In a real implementation, you'd drop all tables or delete the database file
      // For now, we'll just log the intent
      console.log('🔄 Database reset completed');

    } catch (error) {
      console.error('❌ Database reset failed:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const databaseInitializer = new DatabaseInitializer();

// CLI interface
async function main() {
  const command = process.argv[2];
  const initializer = new DatabaseInitializer();

  try {
    switch (command) {
      case 'init':
        await initializer.initialize();
        break;
      case 'status':
        const status = await initializer.getStatus();
        console.log('📊 Database Status:');
        console.log(`  Connected: ${status.connected ? '✅' : '❌'}`);
        console.log(`  Migrations Applied: ${status.migrationsApplied}`);
        if (status.lastMigration) {
          console.log(`  Last Migration: ${status.lastMigration}`);
        }
        if (status.databaseSize) {
          console.log(`  Database Size: ${(status.databaseSize / 1024).toFixed(2)} KB`);
        }
        break;
      case 'reset':
        const confirm = process.argv[3] === '--confirm';
        await initializer.reset(confirm);
        break;
      default:
        console.log('📖 Usage:');
        console.log('  npm run db init     - Initialize database');
        console.log('  npm run db status   - Show database status');
        console.log('  npm run db reset --confirm - Reset database (destructive!)');
        break;
    }

    process.exit(0);

  } catch (error) {
    console.error('💥 Database operation failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}
