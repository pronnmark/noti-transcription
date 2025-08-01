// Server-only database utilities
// This file contains utilities that should only be used in Node.js environment

export { DatabaseInitializer, databaseInitializer } from './init';

// Re-export everything from the main database module
export * from './index';
