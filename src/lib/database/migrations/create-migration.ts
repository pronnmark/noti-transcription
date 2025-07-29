import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

export interface MigrationTemplate {
  name: string;
  description?: string;
  up: string;
  down?: string;
}

export class MigrationGenerator {
  private migrationsDir: string;

  constructor(migrationsDir?: string) {
    this.migrationsDir = migrationsDir || join(__dirname, '.');
  }

  generateMigration(template: MigrationTemplate): string {
    const timestamp = this.generateTimestamp();
    const fileName = `${timestamp}_${this.sanitizeName(template.name)}.sql`;
    const filePath = join(this.migrationsDir, fileName);

    // Ensure migrations directory exists
    if (!existsSync(this.migrationsDir)) {
      mkdirSync(this.migrationsDir, { recursive: true });
    }

    const content = this.generateMigrationContent(template);

    try {
      writeFileSync(filePath, content, 'utf-8');
      console.log(`✅ Migration created: ${fileName}`);
      return filePath;
    } catch (error) {
      console.error('❌ Failed to create migration:', error);
      throw error;
    }
  }

  private generateTimestamp(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');

    return `${year}${month}${day}${hours}${minutes}${seconds}`;
  }

  private sanitizeName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
  }

  private generateMigrationContent(template: MigrationTemplate): string {
    const header = `-- Migration: ${template.name}
-- Created: ${new Date().toISOString()}
${template.description ? `-- Description: ${template.description}` : ''}

`;

    const upSection = `-- UP Migration
${template.up}

`;

    const downSection = template.down
      ? `-- DOWN Migration (for rollback)
-- ${template.down}

`
      : `-- DOWN Migration (for rollback)
-- TODO: Add rollback statements

`;

    return header + upSection + downSection;
  }

  // Predefined migration templates
  static getTemplates(): Record<string, MigrationTemplate> {
    return {
      'add-table': {
        name: 'add_new_table',
        description: 'Add a new table to the database',
        up: `CREATE TABLE new_table (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX idx_new_table_name ON new_table(name);`,
        down: 'DROP TABLE IF EXISTS new_table;',
      },

      'add-column': {
        name: 'add_column_to_table',
        description: 'Add a new column to an existing table',
        up: `ALTER TABLE existing_table ADD COLUMN new_column TEXT;`,
        down: `-- SQLite doesn't support DROP COLUMN directly
-- You would need to recreate the table without the column`,
      },

      'add-index': {
        name: 'add_index',
        description: 'Add an index to improve query performance',
        up: `CREATE INDEX idx_table_column ON table_name(column_name);`,
        down: `DROP INDEX IF EXISTS idx_table_column;`,
      },

      'seed-data': {
        name: 'seed_initial_data',
        description: 'Insert initial/default data',
        up: `INSERT INTO table_name (column1, column2) VALUES 
  ('value1', 'value2'),
  ('value3', 'value4');`,
        down: `DELETE FROM table_name WHERE column1 IN ('value1', 'value3');`,
      },
    };
  }
}

// CLI interface
async function main() {
  const command = process.argv[2];
  const templateName = process.argv[3];
  const migrationName = process.argv[4];

  const generator = new MigrationGenerator();

  try {
    switch (command) {
      case 'create':
        if (!templateName) {
          console.log('❌ Template name required');
          console.log(
            'Available templates:',
            Object.keys(MigrationGenerator.getTemplates()).join(', '),
          );
          process.exit(1);
        }

        const templates = MigrationGenerator.getTemplates();
        const template = templates[templateName];

        if (!template) {
          console.log(`❌ Unknown template: ${templateName}`);
          console.log(
            'Available templates:',
            Object.keys(templates).join(', '),
          );
          process.exit(1);
        }

        // Override name if provided
        if (migrationName) {
          template.name = migrationName;
        }

        generator.generateMigration(template);
        break;

      case 'custom':
        if (!migrationName) {
          console.log('❌ Migration name required for custom migration');
          process.exit(1);
        }

        const customTemplate: MigrationTemplate = {
          name: migrationName,
          description: 'Custom migration',
          up: '-- Add your SQL statements here\n',
          down: '-- Add rollback statements here\n',
        };

        generator.generateMigration(customTemplate);
        break;

      case 'list':
        console.log('📋 Available migration templates:');
        const availableTemplates = MigrationGenerator.getTemplates();
        Object.entries(availableTemplates).forEach(([key, template]) => {
          console.log(`  ${key}: ${template.description || template.name}`);
        });
        break;

      default:
        console.log('📖 Usage:');
        console.log(
          '  npm run migration create <template> [name] - Create migration from template',
        );
        console.log(
          '  npm run migration custom <name>          - Create custom migration',
        );
        console.log(
          '  npm run migration list                   - List available templates',
        );
        console.log('');
        console.log('Examples:');
        console.log('  npm run migration create add-table users');
        console.log('  npm run migration create add-column add_email_to_users');
        console.log('  npm run migration custom fix_data_issue');
        break;
    }

    process.exit(0);
  } catch (error) {
    console.error('💥 Migration generation failed:', error);
    process.exit(1);
  }
}

// MigrationGenerator is already exported above

// Run if called directly
if (require.main === module) {
  main();
}
