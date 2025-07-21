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

async function retranscribeFiles(fileIds) {
  log('🔄 Re-transcription Tool for Speaker Diarization', 'cyan');
  log('=' .repeat(60), 'cyan');
  
  const dbPath = path.join(process.cwd(), 'sqlite.db');
  const db = new Database(dbPath);
  
  try {
    // If no file IDs provided, get all files without speakers
    if (fileIds.length === 0) {
      log('\n📋 Finding all files without speakers...', 'yellow');
      
      const jobsWithoutSpeakers = db.prepare(`
        SELECT 
          tj.file_id,
          af.original_file_name
        FROM transcription_jobs tj
        JOIN audio_files af ON tj.file_id = af.id
        WHERE tj.status = 'completed'
        AND tj.transcript NOT LIKE '%speaker%'
        ORDER BY tj.file_id
      `).all();
      
      fileIds = jobsWithoutSpeakers.map(j => j.file_id);
      
      if (fileIds.length === 0) {
        log('✅ All transcriptions already have speaker information!', 'green');
        return;
      }
      
      log(`Found ${fileIds.length} files without speakers:`, 'yellow');
      jobsWithoutSpeakers.forEach(job => {
        log(`  File ${job.file_id}: ${job.original_file_name}`);
      });
    }
    
    log(`\n🚀 Preparing to re-transcribe ${fileIds.length} files...`, 'blue');
    
    // Reset transcription jobs for specified files
    let resetCount = 0;
    
    for (const fileId of fileIds) {
      // Get file info
      const file = db.prepare('SELECT * FROM audio_files WHERE id = ?').get(fileId);
      if (!file) {
        log(`  ⚠️  File ${fileId} not found, skipping...`, 'yellow');
        continue;
      }
      
      // Check current job status
      const currentJob = db.prepare(`
        SELECT id, status, transcript 
        FROM transcription_jobs 
        WHERE file_id = ? 
        ORDER BY created_at DESC 
        LIMIT 1
      `).get(fileId);
      
      if (!currentJob) {
        log(`  ⚠️  No transcription job found for file ${fileId}, creating new one...`, 'yellow');
        
        // Create new transcription job
        db.prepare(`
          INSERT INTO transcription_jobs (file_id, status, created_at, progress)
          VALUES (?, 'pending', datetime('now'), 0)
        `).run(fileId);
        
        resetCount++;
        log(`  ✅ Created new job for file ${fileId}: ${file.original_file_name}`, 'green');
      } else {
        // Check if it already has speakers
        const hasSpeakers = currentJob.transcript && currentJob.transcript.includes('speaker');
        if (hasSpeakers) {
          log(`  ℹ️  File ${fileId} already has speakers, skipping...`, 'blue');
          continue;
        }
        
        // Reset job to pending
        db.prepare(`
          UPDATE transcription_jobs 
          SET status = 'pending', 
              progress = 0,
              started_at = NULL,
              completed_at = NULL,
              last_error = 'Re-transcribing for speaker diarization'
          WHERE id = ?
        `).run(currentJob.id);
        
        resetCount++;
        log(`  ✅ Reset job for file ${fileId}: ${file.original_file_name}`, 'green');
      }
    }
    
    if (resetCount === 0) {
      log('\n⚠️  No files were reset for re-transcription', 'yellow');
      return;
    }
    
    log(`\n✅ Successfully reset ${resetCount} transcription jobs`, 'green');
    log('\n📝 Next Steps:', 'cyan');
    log('1. Start the development server: npm run dev');
    log('2. Trigger the transcription worker:');
    log('   curl -X GET http://localhost:5173/api/worker/transcribe', 'cyan');
    log('\n3. Monitor the console output for diarization status');
    log('4. Check results with: node diagnose-speakers.js');
    
    log('\n💡 Tip: Watch for diarization errors in the console output', 'yellow');
    log('   Look for messages like ">>Performing speaker diarization..."', 'yellow');
    
  } catch (error) {
    log(`\n❌ Error: ${error.message}`, 'red');
  } finally {
    db.close();
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const fileIds = args.map(id => parseInt(id)).filter(id => !isNaN(id));

// Run the re-transcription
retranscribeFiles(fileIds).catch(error => {
  log(`❌ Unexpected error: ${error.message}`, 'red');
  process.exit(1);
});