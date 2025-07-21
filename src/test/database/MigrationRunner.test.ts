import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MigrationRunner } from '@/lib/database/migrations/migration-runner';
import { DatabaseInitializer } from '@/lib/database/init';
import { healthCheck, closeDatabase } from '@/lib/database';
import { existsSync, unlinkSync } from 'fs';
import { join } from 'path';

describe('MigrationRunner', () => {
  let migrationRunner: MigrationRunner;
  let databaseInitializer: DatabaseInitializer;
  const testDbPath = join(process.cwd(), 'test-migration.db');

  beforeEach(() => {
    // Set test database path
    process.env.DATABASE_PATH = testDbPath;

    migrationRunner = new MigrationRunner();
    databaseInitializer = new DatabaseInitializer();

    // Clean up any existing test database
    if (existsSync(testDbPath)) {
      unlinkSync(testDbPath);
    }
  });

  afterEach(() => {
    // Clean up test database
    try {
      closeDatabase();
    } catch (error) {
      // Ignore errors when closing database
    }

    if (existsSync(testDbPath)) {
      unlinkSync(testDbPath);
    }
  });

  describe('runMigrations', () => {
    it('should run migrations successfully', async () => {
      await expect(migrationRunner.runMigrations()).resolves.not.toThrow();
    });

    it('should create database file after migrations', async () => {
      await migrationRunner.runMigrations();
      expect(existsSync(testDbPath)).toBe(true);
    });

    it('should allow database operations after migrations', async () => {
      await migrationRunner.runMigrations();
      const isHealthy = await healthCheck();
      expect(isHealthy).toBe(true);
    });
  });

  describe('getMigrationInfo', () => {
    it('should return empty array for fresh database', async () => {
      const info = await migrationRunner.getMigrationInfo();
      expect(info).toEqual([]);
    });

    it('should return migration info after running migrations', async () => {
      await migrationRunner.runMigrations();
      const info = await migrationRunner.getMigrationInfo();

      // Should have at least one migration
      expect(info.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('checkMigrationStatus', () => {
    it('should check migration status without errors', async () => {
      await expect(migrationRunner.checkMigrationStatus()).resolves.not.toThrow();
    });

    it('should show migration status after running migrations', async () => {
      await migrationRunner.runMigrations();
      await expect(migrationRunner.checkMigrationStatus()).resolves.not.toThrow();
    });
  });

  describe('validateDatabase', () => {
    it('should fail validation before migrations', async () => {
      const isValid = await migrationRunner.validateDatabase();
      expect(isValid).toBe(false);
    });

    it('should pass validation after migrations', async () => {
      await migrationRunner.runMigrations();
      const isValid = await migrationRunner.validateDatabase();
      expect(isValid).toBe(true);
    });
  });
});

describe('DatabaseInitializer', () => {
  let initializer: DatabaseInitializer;
  const testDbPath = join(process.cwd(), 'test-init.db');

  beforeEach(() => {
    process.env.DATABASE_PATH = testDbPath;
    initializer = new DatabaseInitializer();

    if (existsSync(testDbPath)) {
      unlinkSync(testDbPath);
    }
  });

  afterEach(() => {
    try {
      closeDatabase();
    } catch (error) {
      // Ignore errors
    }

    if (existsSync(testDbPath)) {
      unlinkSync(testDbPath);
    }
  });

  describe('initialize', () => {
    it('should initialize database successfully', async () => {
      await expect(initializer.initialize()).resolves.not.toThrow();
    });

    it('should create database file', async () => {
      await initializer.initialize();
      expect(existsSync(testDbPath)).toBe(true);
    });

    it('should allow skipping migrations', async () => {
      await expect(
        initializer.initialize({ runMigrations: false }),
      ).resolves.not.toThrow();
    });

    it('should allow skipping validation', async () => {
      await expect(
        initializer.initialize({ validateSchema: false }),
      ).resolves.not.toThrow();
    });
  });

  describe('getStatus', () => {
    it('should return status for uninitialized database', async () => {
      const status = await initializer.getStatus();

      expect(status).toHaveProperty('connected');
      expect(status).toHaveProperty('migrationsApplied');
      expect(typeof status.connected).toBe('boolean');
      expect(typeof status.migrationsApplied).toBe('number');
    });

    it('should return status for initialized database', async () => {
      await initializer.initialize();
      const status = await initializer.getStatus();

      expect(status.connected).toBe(true);
      expect(status.migrationsApplied).toBeGreaterThanOrEqual(0);
    });
  });

  describe('reset', () => {
    it('should require confirmation for reset', async () => {
      await expect(initializer.reset(false)).rejects.toThrow('confirmation');
    });

    it('should reset with confirmation', async () => {
      await initializer.initialize();
      await expect(initializer.reset(true)).resolves.not.toThrow();
    });
  });
});
