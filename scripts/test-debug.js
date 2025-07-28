#!/usr/bin/env node

const fs = require('fs');
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

async function checkDatabase() {
  log('🔍 Checking database state...', 'blue');
  
  try {
    const response = await fetch('http://localhost:5173/api/files');
    
    if (!response.ok) {
      throw new Error(`Failed to get files: ${response.status}`);
    }

    const data = await response.json();
    
    log(`📊 Database state:`, 'blue');
    log(`  - Total files: ${data.total}`, 'blue');
    
    if (data.files.length > 0) {
      log(`  - Recent files:`, 'blue');
      data.files.slice(0, 5).forEach((file, i) => {
        log(`    ${i + 1}. ID: ${file.id}, Name: ${file.originalName}, Status: ${file.transcriptionStatus}`, 'blue');
      });
    }
    
    return data;
  } catch (error) {
    log(`❌ Database check failed: ${error.message}`, 'red');
    throw error;
  }
}

async function testSimpleTranscription() {
  log('🧪 Testing simple transcription...', 'blue');
  
  try {
    // Test with a very short timeout first
    const response = await fetch('http://localhost:5173/api/worker/transcribe', {
      method: 'GET',
      signal: AbortSignal.timeout(5000) // 5 second timeout
    });
    
    if (!response.ok) {
      throw new Error(`Worker failed: ${response.status}`);
    }
    
    const result = await response.json();
    log(`✅ Worker response: ${JSON.stringify(result, null, 2)}`, 'green');
    
    return result;
  } catch (error) {
    if (error.name === 'TimeoutError') {
      log(`⏰ Worker timed out after 5 seconds - transcription is probably running`, 'yellow');
      return { message: 'Worker is processing (timed out)' };
    } else {
      log(`❌ Worker error: ${error.message}`, 'red');
      throw error;
    }
  }
}

async function checkDataDirectory() {
  log('📁 Checking data directory...', 'blue');
  
  const dataDir = path.join(process.cwd(), 'data');
  const audioDir = path.join(dataDir, 'audio_files');
  const transcriptsDir = path.join(dataDir, 'transcripts');
  
  log(`  - Data directory: ${dataDir}`, 'blue');
  log(`  - Audio directory: ${audioDir}`, 'blue');
  log(`  - Transcripts directory: ${transcriptsDir}`, 'blue');
  
  try {
    if (fs.existsSync(audioDir)) {
      const audioFiles = fs.readdirSync(audioDir);
      log(`  - Audio files found: ${audioFiles.length}`, 'blue');
      audioFiles.slice(0, 5).forEach((file, i) => {
        const filePath = path.join(audioDir, file);
        const stats = fs.statSync(filePath);
        log(`    ${i + 1}. ${file} (${stats.size} bytes)`, 'blue');
      });
    } else {
      log(`  - Audio directory does not exist`, 'yellow');
    }
    
    if (fs.existsSync(transcriptsDir)) {
      const transcriptFiles = fs.readdirSync(transcriptsDir);
      log(`  - Transcript files found: ${transcriptFiles.length}`, 'blue');
      transcriptFiles.slice(0, 5).forEach((file, i) => {
        log(`    ${i + 1}. ${file}`, 'blue');
      });
    } else {
      log(`  - Transcripts directory does not exist`, 'yellow');
    }
    
  } catch (error) {
    log(`❌ Directory check failed: ${error.message}`, 'red');
  }
}

async function runDebug() {
  try {
    log('🔧 Starting Debug Session', 'blue');
    log('='.repeat(50), 'blue');
    
    // Check database state
    const dbState = await checkDatabase();
    
    // Check data directory
    await checkDataDirectory();
    
    // Test worker (with timeout)
    const workerResult = await testSimpleTranscription();
    
    log('='.repeat(50), 'green');
    log('🔍 Debug Complete', 'green');
    
  } catch (error) {
    log('='.repeat(50), 'red');
    log(`❌ DEBUG FAILED: ${error.message}`, 'red');
    process.exit(1);
  }
}

// Run the debug
runDebug().catch(error => {
  log(`❌ Unexpected error: ${error.message}`, 'red');
  process.exit(1);
});