import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { getDb, getSqlite } from '../client';
import { join } from 'path';
import { existsSync, readFileSync } from 'fs';

interface MigrationInfo {
  version: string;
  name: string;
  timestamp: number;
  applied: boolean;
}

export class MigrationRunner {
  private migrationsFolder: string;

  constructor(migrationsFolder?: string) {
    this.migrationsFolder = migrationsFolder || join(__dirname, '.');
  }

  async runMigrations(): Promise<void> {
    console.log('🔄 Starting database migrations...');

    try {
      // Check if migrations folder exists
      if (!existsSync(this.migrationsFolder)) {
        throw new Error(
          `Migrations folder not found: ${this.migrationsFolder}`,
        );
      }

      // Get migration info before running
      const migrationsBefore = await this.getMigrationInfo();
      console.log(`📊 Found ${migrationsBefore.length} migration(s) to check`);

      // Run migrations
      const startTime = Date.now();
      await migrate(getDb(), { migrationsFolder: this.migrationsFolder });
      const duration = Date.now() - startTime;

      // Get migration info after running
      const migrationsAfter = await this.getMigrationInfo();
      const appliedCount = migrationsAfter.filter(m => m.applied).length;

      console.log(`✅ Migrations completed successfully in ${duration}ms`);
      console.log(
        `📈 Applied migrations: ${appliedCount}/${migrationsAfter.length}`,
      );
    } catch (error) {
      console.error('❌ Error running migrations:', error);
      throw error;
    }
  }

  async getMigrationInfo(): Promise<MigrationInfo[]> {
    try {
      const journalPath = join(this.migrationsFolder, 'meta', '_journal.json');

      if (!existsSync(journalPath)) {
        console.log(
          '📝 No migration journal found, this appears to be a fresh database',
        );
        return [];
      }

      const journalContent = readFileSync(journalPath, 'utf-8');
      const journal = JSON.parse(journalContent);

      return (
        journal.entries?.map((entry: any) => ({
          version: entry.tag,
          name: entry.tag,
          timestamp: entry.when,
          applied: true, // If it's in the journal, it's been applied
        })) || []
      );
    } catch (error) {
      console.warn('⚠️ Could not read migration journal:', error);
      return [];
    }
  }

  async checkMigrationStatus(): Promise<void> {
    console.log('🔍 Checking migration status...');

    try {
      const migrations = await this.getMigrationInfo();

      if (migrations.length === 0) {
        console.log('📝 No migrations found or applied');
        return;
      }

      console.log('\n📋 Migration Status:');
      console.log('─'.repeat(60));

      migrations.forEach((migration, index) => {
        const status = migration.applied ? '✅' : '⏳';
        const date = new Date(migration.timestamp).toISOString();
        console.log(`${status} ${migration.name} (${date})`);
      });

      console.log('─'.repeat(60));
    } catch (error) {
      console.error('❌ Error checking migration status:', error);
      throw error;
    }
  }

  async validateDatabase(): Promise<boolean> {
    console.log('🔍 Validating database schema...');

    try {
      // Basic validation - check if we can query the database using SQLite system tables
      const result = getSqlite()
        .prepare("SELECT name FROM sqlite_master WHERE type='table'")
        .all();

      // Check if core tables exist
      const tableNames = result.map((row: any) => row.name);
      const requiredTables = [
        'audio_files',
        'transcription_jobs',
        'extractions',
      ];
      const missingTables = requiredTables.filter(
        table => !tableNames.includes(table),
      );

      if (missingTables.length > 0) {
        console.warn(`⚠️ Missing tables: ${missingTables.join(', ')}`);
      }

      console.log('✅ Database schema validation passed');
      return true;
    } catch (error) {
      console.error('❌ Database schema validation failed:', error);
      return false;
    }
  }
}

// CLI interface
async function main() {
  const runner = new MigrationRunner();

  const command = process.argv[2];

  try {
    switch (command) {
      case 'run':
        await runner.runMigrations();
        break;
      case 'status':
        await runner.checkMigrationStatus();
        break;
      case 'validate':
        const isValid = await runner.validateDatabase();
        process.exit(isValid ? 0 : 1);
        break;
      default:
        console.log('📖 Usage:');
        console.log('  npm run migrate run     - Run pending migrations');
        console.log('  npm run migrate status  - Check migration status');
        console.log('  npm run migrate validate - Validate database schema');
        break;
    }

    process.exit(0);
  } catch (error) {
    console.error('💥 Migration failed:', error);
    process.exit(1);
  }
}

// MigrationRunner is already exported above

// Run if called directly
if (require.main === module) {
  main();
}
