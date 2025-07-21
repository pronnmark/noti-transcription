#!/usr/bin/env node

const Database = require('better-sqlite3');
const path = require('path');

// Colors for output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function resetStuckJobs() {
  try {
    log('🔧 Resetting stuck transcription jobs...', 'blue');
    
    const dbPath = path.join(process.cwd(), 'sqlite.db');
    const db = new Database(dbPath);
    
    // Find stuck jobs (processing for more than 5 minutes OR any job in processing state)
    const stuckJobs = db.prepare(`
      SELECT id, file_id, started_at, last_error, created_at, progress
      FROM transcription_jobs 
      WHERE status = 'processing' 
      AND (started_at IS NULL OR started_at < datetime('now', '-5 minutes') OR created_at < datetime('now', '-10 minutes'))
    `).all();
    
    log(`Found ${stuckJobs.length} stuck jobs`, 'yellow');
    
    if (stuckJobs.length > 0) {
      stuckJobs.forEach(job => {
        log(`  - Job ${job.id} for file ${job.file_id} (started: ${job.started_at}, progress: ${job.progress}%)`, 'yellow');
      });
      
      // Reset stuck jobs to pending
      const resetStmt = db.prepare(`
        UPDATE transcription_jobs 
        SET status = 'pending', 
            started_at = NULL, 
            progress = 0,
            last_error = 'Reset from stuck processing state at ' || datetime('now'),
            updated_at = datetime('now')
        WHERE status = 'processing' 
        AND (started_at IS NULL OR started_at < datetime('now', '-5 minutes') OR created_at < datetime('now', '-10 minutes'))
      `);
      
      const result = resetStmt.run();
      log(`✅ Reset ${result.changes} stuck jobs to pending`, 'green');
    }
    
    // Also check for any extremely old pending jobs (older than 1 hour)
    const oldPendingJobs = db.prepare(`
      SELECT id, file_id, created_at
      FROM transcription_jobs 
      WHERE status = 'pending' 
      AND created_at < datetime('now', '-1 hour')
    `).all();
    
    if (oldPendingJobs.length > 0) {
      log(`Found ${oldPendingJobs.length} old pending jobs (> 1 hour)`, 'yellow');
      oldPendingJobs.forEach(job => {
        log(`  - Job ${job.id} for file ${job.file_id} (created: ${job.created_at})`, 'yellow');
      });
    }
    
    db.close();
    
  } catch (error) {
    log(`❌ Error resetting jobs: ${error.message}`, 'red');
    throw error;
  }
}

// Run the reset
resetStuckJobs().catch(error => {
  log(`❌ Unexpected error: ${error.message}`, 'red');
  process.exit(1);
});