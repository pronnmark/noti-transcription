#!/usr/bin/env node

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

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

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function checkPendingJobs() {
  log('🔍 Checking pending transcription jobs...', 'blue');
  
  const dbPath = path.join(process.cwd(), 'sqlite.db');
  const db = new Database(dbPath);
  
  // Find pending jobs
  const pendingJobs = db.prepare(`
    SELECT 
      tj.id as job_id,
      tj.file_id,
      tj.status,
      tj.progress,
      tj.created_at,
      af.file_name,
      af.original_file_name,
      af.file_size
    FROM transcription_jobs tj
    JOIN audio_files af ON tj.file_id = af.id
    WHERE tj.status = 'pending'
    ORDER BY tj.created_at
    LIMIT 10
  `).all();
  
  log(`Found ${pendingJobs.length} pending jobs`, 'yellow');
  
  pendingJobs.forEach(job => {
    const sizeMB = (job.file_size / (1024 * 1024)).toFixed(2);
    log(`  - Job ${job.job_id} for file ${job.file_id}: ${job.original_file_name} (${sizeMB}MB)`, 'blue');
  });
  
  db.close();
  return pendingJobs;
}

async function checkTranscripts() {
  log('\n📁 Checking existing transcripts...', 'blue');
  
  const transcriptsDir = path.join(process.cwd(), 'data', 'transcripts');
  
  if (!fs.existsSync(transcriptsDir)) {
    log('❌ Transcripts directory does not exist', 'red');
    return [];
  }
  
  const files = fs.readdirSync(transcriptsDir);
  log(`Found ${files.length} transcript files`, 'green');
  
  files.forEach(file => {
    const filePath = path.join(transcriptsDir, file);
    const stats = fs.statSync(filePath);
    log(`  - ${file} (${stats.size} bytes)`, 'blue');
  });
  
  return files;
}

async function simulateWorker() {
  log('\n🔧 Simulating worker process...', 'blue');
  
  try {
    // Import the worker function
    const { processTranscriptionJobs } = require('./dist/lib/transcriptionWorker');
    
    log('🚀 Starting transcription processing...', 'yellow');
    
    const result = await processTranscriptionJobs();
    
    log(`✅ Worker completed: ${result.message}`, 'green');
    log(`📊 Processed: ${result.processed} jobs`, 'green');
    
    if (result.results.length > 0) {
      result.results.forEach(r => {
        if (r.status === 'completed') {
          log(`  ✅ Job ${r.jobId}: ${r.fileName} - COMPLETED`, 'green');
        } else {
          log(`  ❌ Job ${r.jobId}: ${r.fileName} - FAILED: ${r.error}`, 'red');
        }
      });
    }
    
    return result;
  } catch (error) {
    log(`❌ Worker error: ${error.message}`, 'red');
    throw error;
  }
}

async function runDirectTest() {
  try {
    log('🧪 Direct Transcription Test (No Server Required)', 'blue');
    log('='.repeat(50), 'blue');
    
    // Check pending jobs
    const pendingJobs = await checkPendingJobs();
    
    // Check existing transcripts
    const transcripts = await checkTranscripts();
    
    if (pendingJobs.length > 0) {
      // Find testmp3.mp3 in pending jobs
      const testJob = pendingJobs.find(j => j.original_file_name === 'testmp3.mp3');
      
      if (testJob) {
        log(`\n🎯 Found test file in pending jobs: Job ${testJob.job_id}`, 'green');
        
        // Try to process it
        log('\n⏳ Processing transcription jobs...', 'yellow');
        
        try {
          const result = await simulateWorker();
          
          // Check if transcript was created
          await sleep(2000);
          const newTranscripts = await checkTranscripts();
          const transcriptCreated = newTranscripts.includes(`${testJob.file_id}.json`);
          
          if (transcriptCreated) {
            log(`\n✅ Transcript created for file ${testJob.file_id}!`, 'green');
            
            // Read and verify transcript
            const transcriptPath = path.join(process.cwd(), 'data', 'transcripts', `${testJob.file_id}.json`);
            const transcriptData = JSON.parse(fs.readFileSync(transcriptPath, 'utf-8'));
            
            log(`📝 Transcript has ${transcriptData.segments.length} segments`, 'green');
            
            log('='.repeat(50), 'green');
            log('🎉 TEST PASSED! Transcription works without server!', 'green');
          } else {
            log(`\n❌ Transcript not created for file ${testJob.file_id}`, 'red');
          }
          
        } catch (workerError) {
          log(`\n❌ Worker processing failed: ${workerError.message}`, 'red');
        }
        
      } else {
        log('\n⚠️  testmp3.mp3 not found in pending jobs', 'yellow');
        log('   Upload it first using the server', 'yellow');
      }
    } else {
      log('\n⚠️  No pending jobs found', 'yellow');
    }
    
    log('='.repeat(50), 'blue');
    
  } catch (error) {
    log('='.repeat(50), 'red');
    log(`❌ TEST FAILED: ${error.message}`, 'red');
    process.exit(1);
  }
}

// Run the test
runDirectTest().catch(error => {
  log(`❌ Unexpected error: ${error.message}`, 'red');
  process.exit(1);
});