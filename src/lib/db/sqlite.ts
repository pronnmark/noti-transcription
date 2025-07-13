import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './sqliteSchema';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';

// Ensure data directory exists
const DATA_DIR = process.env.DATA_DIR || './data';
if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true });
}

// Create SQLite database
const sqlite = new Database(join(DATA_DIR, 'noti.db'));

// Enable foreign keys
sqlite.pragma('foreign_keys = ON');

// Create database instance with schema
export const db = drizzle(sqlite, { schema });

// Initialize database tables
export async function initializeDatabase() {
  try {
    // Create tables if they don't exist
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS audio_files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        file_name TEXT NOT NULL,
        original_file_name TEXT NOT NULL,
        original_file_type TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        duration INTEGER,
        transcript TEXT,
        transcription_status TEXT DEFAULT 'pending',
        transcription_progress INTEGER DEFAULT 0,
        language TEXT,
        model_size TEXT DEFAULT 'large-v3',
        threads INTEGER,
        processors INTEGER,
        diarization INTEGER DEFAULT 1,
        summary TEXT,
        summary_prompt TEXT,
        summary_status TEXT DEFAULT 'pending',
        ai_extract TEXT,
        ai_extract_status TEXT DEFAULT 'pending',
        ai_extracted_at TEXT,
        ai_extract_file_path TEXT,
        notes_extracted_at TEXT,
        notes_status TEXT DEFAULT 'pending' CHECK (notes_status IN ('pending', 'processing', 'completed', 'failed')),
        notes_count TEXT,
        title TEXT,
        last_error TEXT,
        peaks TEXT,
        uploaded_at TEXT DEFAULT CURRENT_TIMESTAMP,
        transcribed_at TEXT,
        summarized_at TEXT,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS speaker_labels (
        file_id INTEGER PRIMARY KEY,
        labels TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (file_id) REFERENCES audio_files(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS summarization_templates (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        prompt TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS ai_extracts (
        id TEXT PRIMARY KEY,
        file_id INTEGER NOT NULL,
        template_id TEXT,
        model TEXT NOT NULL,
        prompt TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (file_id) REFERENCES audio_files(id) ON DELETE CASCADE,
        FOREIGN KEY (template_id) REFERENCES summarization_templates(id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS system_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        is_initialized INTEGER DEFAULT 0,
        first_startup_date TEXT,
        last_startup_date TEXT,
        whisper_model_sizes TEXT DEFAULT '["tiny","base","small","medium","large","large-v2","large-v3"]',
        whisper_quantization TEXT DEFAULT 'none',
        obsidian_enabled INTEGER DEFAULT 0,
        obsidian_vault_path TEXT,
        obsidian_folder TEXT,
        gemini_api_key TEXT,
        openai_api_key TEXT,
        openrouter_api_key TEXT,
        ai_extract_enabled INTEGER DEFAULT 0,
        ai_extract_prompt TEXT,
        ai_extract_output_path TEXT,
        ai_extract_model TEXT DEFAULT 'gemini-1.5-flash'
      );

      -- Create indexes
      CREATE INDEX IF NOT EXISTS idx_audio_files_transcription_status ON audio_files(transcription_status);
      CREATE INDEX IF NOT EXISTS idx_audio_files_uploaded_at ON audio_files(uploaded_at);
      CREATE INDEX IF NOT EXISTS idx_summarization_templates_title ON summarization_templates(title);
      CREATE INDEX IF NOT EXISTS idx_ai_extracts_file_id ON ai_extracts(file_id);
      
      CREATE TABLE IF NOT EXISTS ai_notes (
        id TEXT PRIMARY KEY,
        file_id INTEGER NOT NULL REFERENCES audio_files(id) ON DELETE CASCADE,
        note_type TEXT NOT NULL CHECK (note_type IN ('task', 'question', 'decision', 'followup', 'mention')),
        content TEXT NOT NULL,
        context TEXT,
        speaker TEXT,
        timestamp REAL,
        priority TEXT DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
        status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),
        metadata TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_ai_notes_file_id ON ai_notes(file_id);
      CREATE INDEX IF NOT EXISTS idx_ai_notes_note_type ON ai_notes(note_type);
      CREATE INDEX IF NOT EXISTS idx_ai_notes_status ON ai_notes(status);

      -- Insert default settings if not exists
      INSERT OR IGNORE INTO system_settings (id, is_initialized, last_startup_date) 
      VALUES (1, 1, CURRENT_TIMESTAMP);
    `);

    // Run migrations
    await runMigrations();
    
    console.log('✅ SQLite database initialized successfully');
    return true;
  } catch (error) {
    console.error('❌ Failed to initialize SQLite database:', error);
    return false;
  }
}

async function runMigrations() {
  try {
    // Check what columns exist
    const tableInfo = sqlite.prepare('PRAGMA table_info(audio_files)').all();
    const columnNames = tableInfo.map((col: any) => col.name);
    
    const columnsToAdd = [
      { name: 'notes_extracted_at', definition: 'TEXT' },
      { name: 'notes_status', definition: 'TEXT DEFAULT "pending"' },
      { name: 'notes_count', definition: 'TEXT' }
    ];
    
    for (const column of columnsToAdd) {
      if (!columnNames.includes(column.name)) {
        console.log(`🔄 Adding ${column.name} column...`);
        sqlite.exec(`ALTER TABLE audio_files ADD COLUMN ${column.name} ${column.definition}`);
        console.log(`✅ Migration: ${column.name} column added`);
      }
    }
  } catch (error) {
    console.error('❌ Migration error:', error);
  }
}

// Initialize on import
initializeDatabase();

export type Database = typeof db;