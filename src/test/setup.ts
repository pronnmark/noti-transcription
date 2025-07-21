import '@testing-library/jest-dom';
import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { existsSync, unlinkSync } from 'fs';
import { join } from 'path';

// Test database path
const TEST_DB_PATH = join(process.cwd(), 'test.db');

// Set test environment
process.env.DATABASE_PATH = TEST_DB_PATH;

// Clean up test database before and after tests
beforeAll(() => {
  // Remove test database if it exists
  if (existsSync(TEST_DB_PATH)) {
    unlinkSync(TEST_DB_PATH);
  }
});

afterAll(() => {
  // Clean up test database after all tests
  if (existsSync(TEST_DB_PATH)) {
    unlinkSync(TEST_DB_PATH);
  }
});

beforeEach(() => {
  // Reset any global state before each test
});

afterEach(() => {
  // Clean up after each test
});
