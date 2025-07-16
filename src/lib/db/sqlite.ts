import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './sqliteSchema';
import { eq, and, inArray } from 'drizzle-orm';
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

// Export schema and utility functions for easier access
export { schema, eq, and, inArray };

// Initialize database tables
export async function initializeDatabase() {
  try {
    console.log('🔄 Initializing database...');
    
    // Create core tables first
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS audio_files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        file_name TEXT NOT NULL,
        original_file_name TEXT NOT NULL,
        original_file_type TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        file_hash TEXT UNIQUE,
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
        ai_extract_model TEXT DEFAULT 'gemini-1.5-flash',
        auto_extract_tasks INTEGER DEFAULT 1,
        auto_extract_psychology INTEGER DEFAULT 1,
        auto_extract_decisions INTEGER DEFAULT 1,
        auto_extract_questions INTEGER DEFAULT 1,
        auto_extract_followups INTEGER DEFAULT 1,
        psychology_enabled INTEGER DEFAULT 1,
        psychology_auto_run INTEGER DEFAULT 1
      );

      -- Keep ai_notes for backward compatibility (will be migrated)
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
        comments TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      
      -- Keep psychological_evaluations for backward compatibility (will be migrated)
      CREATE TABLE IF NOT EXISTS psychological_evaluations (
        id TEXT PRIMARY KEY,
        file_id INTEGER NOT NULL REFERENCES audio_files(id) ON DELETE CASCADE,
        mood TEXT,
        energy INTEGER,
        stress_level INTEGER,
        confidence INTEGER,
        engagement INTEGER,
        emotional_state TEXT,
        speech_patterns TEXT,
        key_insights TEXT,
        timestamp_analysis TEXT,
        model TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS psychological_metrics (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL DEFAULT 'default',
        date TEXT NOT NULL,
        average_mood REAL,
        average_energy REAL,
        average_stress REAL,
        session_count INTEGER,
        dominant_emotion TEXT,
        insights TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create new flexible system tables
    sqlite.exec(`
      -- Extraction Templates - Configurable extraction criteria
      CREATE TABLE IF NOT EXISTS extraction_templates (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        prompt TEXT NOT NULL,
        expected_output_format TEXT, -- JSON schema definition
        default_priority TEXT DEFAULT 'medium' CHECK (default_priority IN ('high', 'medium', 'low')),
        is_active INTEGER DEFAULT 1,
        is_default INTEGER DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      
      -- Data Point Templates - Configurable analysis metrics
      CREATE TABLE IF NOT EXISTS data_point_templates (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        analysis_prompt TEXT NOT NULL,
        output_schema TEXT, -- JSON schema for expected metrics
        visualization_type TEXT DEFAULT 'chart', -- chart, gauge, text, etc.
        is_active INTEGER DEFAULT 1,
        is_default INTEGER DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      
      -- Flexible Extractions (renamed from ai_notes)
      CREATE TABLE IF NOT EXISTS extractions (
        id TEXT PRIMARY KEY,
        file_id INTEGER NOT NULL REFERENCES audio_files(id) ON DELETE CASCADE,
        template_id TEXT NOT NULL REFERENCES extraction_templates(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        context TEXT,
        speaker TEXT,
        timestamp REAL,
        priority TEXT DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
        status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),
        metadata TEXT, -- JSON metadata based on template schema
        comments TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      -- Flexible Data Points (renamed from psychological_evaluations)
      CREATE TABLE IF NOT EXISTS data_points (
        id TEXT PRIMARY KEY,
        file_id INTEGER NOT NULL REFERENCES audio_files(id) ON DELETE CASCADE,
        template_id TEXT NOT NULL REFERENCES data_point_templates(id) ON DELETE CASCADE,
        analysis_results TEXT NOT NULL, -- JSON results based on template schema
        model TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      
      -- Summarizations (renamed from ai_extracts)
      CREATE TABLE IF NOT EXISTS summarizations (
        id TEXT PRIMARY KEY,
        file_id INTEGER NOT NULL REFERENCES audio_files(id) ON DELETE CASCADE,
        template_id TEXT REFERENCES summarization_templates(id) ON DELETE SET NULL,
        model TEXT NOT NULL,
        prompt TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create indexes
    sqlite.exec(`
      CREATE INDEX IF NOT EXISTS idx_audio_files_transcription_status ON audio_files(transcription_status);
      CREATE INDEX IF NOT EXISTS idx_audio_files_uploaded_at ON audio_files(uploaded_at);
      CREATE INDEX IF NOT EXISTS idx_audio_files_file_hash ON audio_files(file_hash);
      CREATE INDEX IF NOT EXISTS idx_summarization_templates_title ON summarization_templates(title);
      CREATE INDEX IF NOT EXISTS idx_ai_extracts_file_id ON ai_extracts(file_id);
      CREATE INDEX IF NOT EXISTS idx_ai_notes_file_id ON ai_notes(file_id);
      CREATE INDEX IF NOT EXISTS idx_ai_notes_note_type ON ai_notes(note_type);
      CREATE INDEX IF NOT EXISTS idx_ai_notes_status ON ai_notes(status);
      CREATE INDEX IF NOT EXISTS idx_psychological_evaluations_file_id ON psychological_evaluations(file_id);
      CREATE INDEX IF NOT EXISTS idx_psychological_evaluations_created_at ON psychological_evaluations(created_at);
      CREATE INDEX IF NOT EXISTS idx_psychological_metrics_date ON psychological_metrics(date);
      CREATE INDEX IF NOT EXISTS idx_psychological_metrics_user_id ON psychological_metrics(user_id);
      
      -- New table indexes
      CREATE INDEX IF NOT EXISTS idx_extraction_templates_active ON extraction_templates(is_active);
      CREATE INDEX IF NOT EXISTS idx_extraction_templates_default ON extraction_templates(is_default);
      CREATE INDEX IF NOT EXISTS idx_data_point_templates_active ON data_point_templates(is_active);
      CREATE INDEX IF NOT EXISTS idx_data_point_templates_default ON data_point_templates(is_default);
      CREATE INDEX IF NOT EXISTS idx_extractions_file_id ON extractions(file_id);
      CREATE INDEX IF NOT EXISTS idx_extractions_template_id ON extractions(template_id);
      CREATE INDEX IF NOT EXISTS idx_extractions_status ON extractions(status);
      CREATE INDEX IF NOT EXISTS idx_data_points_file_id ON data_points(file_id);
      CREATE INDEX IF NOT EXISTS idx_data_points_template_id ON data_points(template_id);
      CREATE INDEX IF NOT EXISTS idx_summarizations_file_id ON summarizations(file_id);
      CREATE INDEX IF NOT EXISTS idx_summarizations_template_id ON summarizations(template_id);
    `);

    // Add new columns to existing tables
    await addFlexibleSystemColumns();

    // Insert default templates
    await insertDefaultTemplates();

    console.log('✅ Database initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize SQLite database:', error);
    throw error;
  }
}

async function addFlexibleSystemColumns() {
  try {
    console.log('🔄 Adding flexible system columns...');
    
    // Check what columns exist in audio_files table
    const tableInfo = sqlite.prepare('PRAGMA table_info(audio_files)').all();
    const columnNames = tableInfo.map((col: any) => col.name);
    
    // Add new flexible system columns
    const columnsToAdd = [
      { name: 'notes_extracted_at', definition: 'TEXT' },
      { name: 'notes_status', definition: 'TEXT DEFAULT "pending"' },
      { name: 'notes_count', definition: 'TEXT' },
      { name: 'file_hash', definition: 'TEXT UNIQUE' },
      // New flexible system columns
      { name: 'summarization_status', definition: 'TEXT DEFAULT "pending"' },
      { name: 'summarization_content', definition: 'TEXT' },
      { name: 'extraction_templates_used', definition: 'TEXT' },
      { name: 'data_point_templates_used', definition: 'TEXT' },
      { name: 'extraction_status', definition: 'TEXT DEFAULT "pending"' },
      { name: 'data_point_status', definition: 'TEXT DEFAULT "pending"' }
    ];
    
    for (const column of columnsToAdd) {
      if (!columnNames.includes(column.name)) {
        console.log(`🔄 Adding ${column.name} column...`);
        sqlite.exec(`ALTER TABLE audio_files ADD COLUMN ${column.name} ${column.definition}`);
        console.log(`✅ Migration: ${column.name} column added`);
      }
    }

    // Check what columns exist in system_settings table
    const settingsTableInfo = sqlite.prepare('PRAGMA table_info(system_settings)').all();
    const settingsColumnNames = settingsTableInfo.map((col: any) => col.name);
    
    const settingsColumnsToAdd = [
      { name: 'auto_extract_tasks', definition: 'INTEGER DEFAULT 1' },
      { name: 'auto_extract_psychology', definition: 'INTEGER DEFAULT 1' },
      { name: 'auto_extract_decisions', definition: 'INTEGER DEFAULT 1' },
      { name: 'auto_extract_questions', definition: 'INTEGER DEFAULT 1' },
      { name: 'auto_extract_followups', definition: 'INTEGER DEFAULT 1' },
      { name: 'psychology_enabled', definition: 'INTEGER DEFAULT 1' },
      { name: 'psychology_auto_run', definition: 'INTEGER DEFAULT 1' }
    ];
    
    for (const column of settingsColumnsToAdd) {
      if (!settingsColumnNames.includes(column.name)) {
        console.log(`🔄 Adding ${column.name} column to system_settings...`);
        sqlite.exec(`ALTER TABLE system_settings ADD COLUMN ${column.name} ${column.definition}`);
        console.log(`✅ Migration: ${column.name} column added to system_settings`);
      }
    }
    
    // Check what columns exist in ai_notes table and add missing ones
    const notesTableExists = sqlite.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='ai_notes'`).get();
    if (notesTableExists) {
      const notesTableInfo = sqlite.prepare('PRAGMA table_info(ai_notes)').all();
      const notesColumnNames = notesTableInfo.map((col: any) => col.name);
      
      const notesColumnsToAdd = [
        { name: 'comments', definition: 'TEXT' }
      ];
      
      for (const column of notesColumnsToAdd) {
        if (!notesColumnNames.includes(column.name)) {
          console.log(`🔄 Adding ${column.name} column to ai_notes...`);
          sqlite.exec(`ALTER TABLE ai_notes ADD COLUMN ${column.name} ${column.definition}`);
          console.log(`✅ Migration: ${column.name} column added to ai_notes`);
        }
      }
    }
  } catch (error) {
    console.error('❌ Migration error:', error);
  }
}

async function insertDefaultTemplates() {
  try {
    // Insert default extraction templates
    const defaultExtractionTemplates = [
      {
        id: 'template-tasks',
        name: 'Tasks',
        description: 'Extract actionable tasks and commitments',
        prompt: `Extract ONLY concrete, actionable tasks and commitments from this transcript.
        
        STRICT CRITERIA - Only include if it meets ALL of these:
        - Specific action to be taken by someone
        - Clear responsibility (who will do it)
        - Not vague statements or general discussion
        - Represents actual work or commitment
        
        Format as JSON array: [{
          "content": "Task description",
          "speaker": "Who said it",
          "context": "Brief surrounding conversation",
          "priority": "high|medium|low",
          "metadata": { "deadline": "when", "assigned_to": "who" }
        }]`,
        expected_output_format: JSON.stringify({
          type: 'array',
          items: {
            type: 'object',
            properties: {
              content: { type: 'string' },
              speaker: { type: 'string' },
              context: { type: 'string' },
              priority: { type: 'string', enum: ['high', 'medium', 'low'] },
              metadata: { type: 'object' }
            },
            required: ['content']
          }
        }),
        is_active: 1,
        is_default: 1
      },
      {
        id: 'template-questions',
        name: 'Questions',
        description: 'Extract unanswered questions that need follow-up',
        prompt: `Extract ONLY genuine unanswered questions that require follow-up.
        
        STRICT CRITERIA - Only include if it meets ALL of these:
        - Direct question with clear intent
        - No complete answer was provided
        - Important enough to need follow-up
        - Not rhetorical or casual questions
        
        Format as JSON array: [{
          "content": "Question text",
          "speaker": "Who asked it",
          "context": "Brief surrounding conversation",
          "priority": "high|medium|low",
          "metadata": { "topic": "what it's about", "urgency": "when answer needed" }
        }]`,
        expected_output_format: JSON.stringify({
          type: 'array',
          items: {
            type: 'object',
            properties: {
              content: { type: 'string' },
              speaker: { type: 'string' },
              context: { type: 'string' },
              priority: { type: 'string', enum: ['high', 'medium', 'low'] },
              metadata: { type: 'object' }
            },
            required: ['content']
          }
        }),
        is_active: 1,
        is_default: 1
      },
      {
        id: 'template-decisions',
        name: 'Decisions',
        description: 'Extract important decisions made during the conversation',
        prompt: `Extract ONLY important decisions that were made during this conversation.
        
        STRICT CRITERIA - Only include if it meets ALL of these:
        - Clear decision was reached
        - Decision has impact on actions or outcomes
        - Not tentative or "we might" statements
        - Represents a definitive choice
        
        Format as JSON array: [{
          "content": "Decision description",
          "speaker": "Who made the decision",
          "context": "Brief surrounding conversation",
          "priority": "high|medium|low",
          "metadata": { "impact": "what it affects", "rationale": "why decided" }
        }]`,
        expected_output_format: JSON.stringify({
          type: 'array',
          items: {
            type: 'object',
            properties: {
              content: { type: 'string' },
              speaker: { type: 'string' },
              context: { type: 'string' },
              priority: { type: 'string', enum: ['high', 'medium', 'low'] },
              metadata: { type: 'object' }
            },
            required: ['content']
          }
        }),
        is_active: 1,
        is_default: 0
      }
    ];
    
    // Insert default data point templates
    const defaultDataPointTemplates = [
      {
        id: 'template-mood-energy',
        name: 'Mood & Energy Analysis',
        description: 'Analyze emotional state and energy levels',
        analysis_prompt: `Analyze this transcript for emotional state and energy levels.
        
        Provide analysis in this JSON format:
        {
          "mood": {
            "dominant_emotion": "happy|sad|anxious|calm|frustrated|excited|neutral",
            "emotional_intensity": 1-10,
            "mood_stability": 1-10,
            "secondary_emotions": ["list", "of", "emotions"]
          },
          "energy": {
            "energy_level": 1-10,
            "energy_consistency": 1-10,
            "fatigue_indicators": ["list", "of", "indicators"]
          },
          "speech_patterns": {
            "pace": "slow|normal|fast",
            "tone": "positive|negative|neutral",
            "confidence_level": 1-10
          },
          "key_insights": "Brief summary of emotional and energy insights"
        }`,
        output_schema: JSON.stringify({
          type: 'object',
          properties: {
            mood: {
              type: 'object',
              properties: {
                dominant_emotion: { type: 'string' },
                emotional_intensity: { type: 'number', minimum: 1, maximum: 10 },
                mood_stability: { type: 'number', minimum: 1, maximum: 10 },
                secondary_emotions: { type: 'array', items: { type: 'string' } }
              }
            },
            energy: {
              type: 'object',
              properties: {
                energy_level: { type: 'number', minimum: 1, maximum: 10 },
                energy_consistency: { type: 'number', minimum: 1, maximum: 10 },
                fatigue_indicators: { type: 'array', items: { type: 'string' } }
              }
            },
            speech_patterns: {
              type: 'object',
              properties: {
                pace: { type: 'string', enum: ['slow', 'normal', 'fast'] },
                tone: { type: 'string', enum: ['positive', 'negative', 'neutral'] },
                confidence_level: { type: 'number', minimum: 1, maximum: 10 }
              }
            },
            key_insights: { type: 'string' }
          }
        }),
        visualization_type: 'mixed',
        is_active: 1,
        is_default: 1
      },
      {
        id: 'template-stress-analysis',
        name: 'Stress & Wellbeing Analysis',
        description: 'Analyze stress levels and wellbeing indicators',
        analysis_prompt: `Analyze this transcript for stress levels and wellbeing indicators.
        
        Provide analysis in this JSON format:
        {
          "stress": {
            "stress_level": 1-10,
            "stress_indicators": ["list", "of", "indicators"],
            "stress_sources": ["identified", "stressors"]
          },
          "wellbeing": {
            "overall_wellbeing": 1-10,
            "positive_indicators": ["list", "of", "positive", "signs"],
            "concern_areas": ["areas", "of", "concern"]
          },
          "recommendations": ["suggested", "actions", "or", "interventions"],
          "key_insights": "Brief summary of stress and wellbeing insights"
        }`,
        output_schema: JSON.stringify({
          type: 'object',
          properties: {
            stress: {
              type: 'object',
              properties: {
                stress_level: { type: 'number', minimum: 1, maximum: 10 },
                stress_indicators: { type: 'array', items: { type: 'string' } },
                stress_sources: { type: 'array', items: { type: 'string' } }
              }
            },
            wellbeing: {
              type: 'object',
              properties: {
                overall_wellbeing: { type: 'number', minimum: 1, maximum: 10 },
                positive_indicators: { type: 'array', items: { type: 'string' } },
                concern_areas: { type: 'array', items: { type: 'string' } }
              }
            },
            recommendations: { type: 'array', items: { type: 'string' } },
            key_insights: { type: 'string' }
          }
        }),
        visualization_type: 'gauge',
        is_active: 1,
        is_default: 0
      }
    ];
    
    // Insert extraction templates
    const insertExtractionTemplate = sqlite.prepare(`
      INSERT OR IGNORE INTO extraction_templates 
      (id, name, description, prompt, expected_output_format, is_active, is_default, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `);
    
    for (const template of defaultExtractionTemplates) {
      insertExtractionTemplate.run(
        template.id,
        template.name,
        template.description,
        template.prompt,
        template.expected_output_format,
        template.is_active,
        template.is_default
      );
    }
    
    // Insert data point templates
    const insertDataPointTemplate = sqlite.prepare(`
      INSERT OR IGNORE INTO data_point_templates 
      (id, name, description, analysis_prompt, output_schema, visualization_type, is_active, is_default, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `);
    
    for (const template of defaultDataPointTemplates) {
      insertDataPointTemplate.run(
        template.id,
        template.name,
        template.description,
        template.analysis_prompt,
        template.output_schema,
        template.visualization_type,
        template.is_active,
        template.is_default
      );
    }
    
    console.log('✅ Default templates inserted successfully');
  } catch (error) {
    console.error('❌ Error inserting default templates:', error);
  }
}

// Initialize on import
initializeDatabase();

export type Database = typeof db;