#!/usr/bin/env node

const Database = require('better-sqlite3');
const path = require('path');

// Colors for output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function addDiarizationStatusColumn() {
  log('🔧 Adding Diarization Status Columns to Database', 'cyan');
  log('=' .repeat(60), 'cyan');
  
  const dbPath = path.join(process.cwd(), 'sqlite.db');
  const db = new Database(dbPath);
  
  try {
    // Check if columns already exist
    const tableInfo = db.prepare('PRAGMA table_info(transcription_jobs)').all();
    const hasStatusColumn = tableInfo.some(col => col.name === 'diarization_status');
    const hasErrorColumn = tableInfo.some(col => col.name === 'diarization_error');
    
    if (hasStatusColumn && hasErrorColumn) {
      log('✅ Columns already exist, no changes needed', 'green');
      return;
    }
    
    // Add columns if they don't exist
    if (!hasStatusColumn) {
      log('Adding diarization_status column...', 'yellow');
      db.prepare(`
        ALTER TABLE transcription_jobs 
        ADD COLUMN diarization_status TEXT DEFAULT 'not_attempted'
      `).run();
      log('✅ Added diarization_status column', 'green');
    }
    
    if (!hasErrorColumn) {
      log('Adding diarization_error column...', 'yellow');
      db.prepare(`
        ALTER TABLE transcription_jobs 
        ADD COLUMN diarization_error TEXT
      `).run();
      log('✅ Added diarization_error column', 'green');
    }
    
    // Update existing records based on transcript content
    log('\nUpdating existing records...', 'yellow');
    
    // Get all completed transcriptions
    const jobs = db.prepare(`
      SELECT id, transcript 
      FROM transcription_jobs 
      WHERE status = 'completed' AND transcript IS NOT NULL
    `).all();
    
    let updatedCount = 0;
    jobs.forEach(job => {
      const hasSpeakers = job.transcript && job.transcript.includes('speaker');
      const status = hasSpeakers ? 'success' : 'no_speakers_detected';
      
      db.prepare(`
        UPDATE transcription_jobs 
        SET diarization_status = ? 
        WHERE id = ?
      `).run(status, job.id);
      
      updatedCount++;
    });
    
    log(`✅ Updated ${updatedCount} existing records`, 'green');
    
    // Show summary
    const summary = db.prepare(`
      SELECT 
        diarization_status, 
        COUNT(*) as count 
      FROM transcription_jobs 
      GROUP BY diarization_status
    `).all();
    
    log('\n📊 Diarization Status Summary:', 'blue');
    summary.forEach(row => {
      log(`  ${row.diarization_status}: ${row.count} records`);
    });
    
    log('\n✅ Database schema updated successfully!', 'green');
    log('\nNext steps:', 'cyan');
    log('1. Update transcribe.py to set diarization_status');
    log('2. The application will now track diarization success/failure');
    
  } catch (error) {
    log(`\n❌ Error: ${error.message}`, 'red');
  } finally {
    db.close();
  }
}

// Run the migration
addDiarizationStatusColumn().catch(error => {
  log(`❌ Unexpected error: ${error.message}`, 'red');
  process.exit(1);
});