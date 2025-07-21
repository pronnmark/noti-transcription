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

async function testTranscriptRetrieval() {
  log('🧪 Testing Transcript Retrieval', 'blue');
  log('='.repeat(50), 'blue');
  
  const dbPath = path.join(process.cwd(), 'sqlite.db');
  const db = new Database(dbPath);
  
  try {
    // Find completed transcription jobs
    const completedJobs = db.prepare(`
      SELECT 
        tj.id as job_id,
        tj.file_id,
        tj.status,
        tj.transcript,
        af.original_file_name
      FROM transcription_jobs tj
      JOIN audio_files af ON tj.file_id = af.id
      WHERE tj.status = 'completed' 
      AND tj.transcript IS NOT NULL
      ORDER BY tj.created_at DESC
      LIMIT 5
    `).all();
    
    log(`Found ${completedJobs.length} completed transcriptions`, 'yellow');
    
    if (completedJobs.length === 0) {
      log('❌ No completed transcriptions found in database', 'red');
      return;
    }
    
    // Show completed jobs
    completedJobs.forEach(job => {
      const transcript = JSON.parse(job.transcript);
      const segmentCount = Array.isArray(transcript) ? transcript.length : 0;
      log(`  - File ${job.file_id}: ${job.original_file_name} (${segmentCount} segments)`, 'blue');
    });
    
    // Test the API endpoint for the most recent completed job
    const testJob = completedJobs[0];
    log(`\n🔍 Testing API endpoint for file ${testJob.file_id}...`, 'blue');
    
    try {
      const response = await fetch(`http://localhost:5173/api/transcript/${testJob.file_id}`);
      
      if (!response.ok) {
        log(`❌ API returned error: ${response.status} ${response.statusText}`, 'red');
        const error = await response.text();
        log(`   Error: ${error}`, 'red');
      } else {
        const data = await response.json();
        log(`✅ API returned transcript successfully!`, 'green');
        log(`   - Segments: ${data.segments ? data.segments.length : 0}`, 'green');
        log(`   - Has speakers: ${data.hasSpeakers}`, 'green');
        
        if (data.segments && data.segments.length > 0) {
          log(`\n📝 First few segments:`, 'blue');
          data.segments.slice(0, 3).forEach((seg, i) => {
            const speaker = seg.speaker ? ` [${seg.speaker}]` : '';
            log(`   ${i + 1}. ${seg.start}s-${seg.end}s${speaker}: ${seg.text}`, 'blue');
          });
        }
      }
    } catch (fetchError) {
      log(`⚠️  Server not running, checking database directly...`, 'yellow');
      
      // Parse and display transcript from database
      const transcript = JSON.parse(testJob.transcript);
      if (Array.isArray(transcript) && transcript.length > 0) {
        log(`✅ Transcript exists in database with ${transcript.length} segments`, 'green');
        
        const hasSpeakers = transcript.some(s => s.speaker);
        log(`   - Has speakers: ${hasSpeakers}`, 'green');
        
        log(`\n📝 First few segments from database:`, 'blue');
        transcript.slice(0, 3).forEach((seg, i) => {
          const speaker = seg.speaker ? ` [${seg.speaker}]` : '';
          log(`   ${i + 1}. ${seg.start}s-${seg.end}s${speaker}: ${seg.text}`, 'blue');
        });
      }
    }
    
    log('='.repeat(50), 'green');
    log('✅ Transcript retrieval test complete!', 'green');
    
  } catch (error) {
    log('='.repeat(50), 'red');
    log(`❌ TEST FAILED: ${error.message}`, 'red');
  } finally {
    db.close();
  }
}

// Run the test
testTranscriptRetrieval().catch(error => {
  log(`❌ Unexpected error: ${error.message}`, 'red');
  process.exit(1);
});