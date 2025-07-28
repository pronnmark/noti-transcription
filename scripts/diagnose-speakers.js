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

async function diagnoseSpeakers() {
  log('🔍 Speaker Diarization Diagnostic Tool', 'cyan');
  log('=' .repeat(60), 'cyan');
  
  const dbPath = path.join(process.cwd(), 'sqlite.db');
  const db = new Database(dbPath);
  
  try {
    // Get all completed transcriptions
    const jobs = db.prepare(`
      SELECT 
        tj.id as job_id,
        tj.file_id,
        tj.status,
        tj.transcript,
        tj.created_at,
        tj.completed_at,
        af.original_file_name,
        af.file_name
      FROM transcription_jobs tj
      JOIN audio_files af ON tj.file_id = af.id
      WHERE tj.status = 'completed'
      ORDER BY tj.created_at DESC
    `).all();
    
    log(`\nFound ${jobs.length} completed transcriptions\n`, 'yellow');
    
    // Analyze each transcription
    const withSpeakers = [];
    const withoutSpeakers = [];
    const fileFormats = {};
    
    jobs.forEach(job => {
      const transcript = JSON.parse(job.transcript || '[]');
      const hasSpeakers = transcript.some(seg => seg.speaker);
      const fileExt = path.extname(job.original_file_name).toLowerCase();
      
      fileFormats[fileExt] = (fileFormats[fileExt] || 0) + 1;
      
      if (hasSpeakers) {
        const speakers = new Set(transcript.map(seg => seg.speaker).filter(Boolean));
        withSpeakers.push({ ...job, speakerCount: speakers.size, fileExt });
      } else {
        withoutSpeakers.push({ ...job, fileExt });
      }
    });
    
    // Display statistics
    log('📊 Statistics:', 'blue');
    log(`  Total transcriptions: ${jobs.length}`);
    log(`  With speakers: ${withSpeakers.length} (${(withSpeakers.length/jobs.length*100).toFixed(1)}%)`, 'green');
    log(`  Without speakers: ${withoutSpeakers.length} (${(withoutSpeakers.length/jobs.length*100).toFixed(1)}%)`, 'red');
    
    log('\n📁 File Format Distribution:', 'blue');
    Object.entries(fileFormats).forEach(([ext, count]) => {
      log(`  ${ext}: ${count} files`);
    });
    
    // Show files with speakers
    if (withSpeakers.length > 0) {
      log('\n✅ Files WITH Speaker Diarization:', 'green');
      withSpeakers.forEach(job => {
        log(`  File ${job.file_id}: ${job.original_file_name} (${job.speakerCount} speakers)`);
      });
    }
    
    // Show files without speakers
    if (withoutSpeakers.length > 0) {
      log('\n❌ Files WITHOUT Speaker Diarization:', 'red');
      withoutSpeakers.forEach(job => {
        log(`  File ${job.file_id}: ${job.original_file_name}`);
      });
      
      // Offer to re-transcribe
      log('\n🔄 Re-transcription Options:', 'yellow');
      log('  1. Re-transcribe all files without speakers');
      log('  2. Re-transcribe specific file IDs');
      log('  3. Exit');
      
      // For now, just show which files can be re-transcribed
      const fileIds = withoutSpeakers.map(j => j.file_id);
      log(`\nTo re-transcribe these files, run:`, 'cyan');
      log(`node retranscribe-speakers.js ${fileIds.join(' ')}`, 'cyan');
    }
    
    // Pattern analysis
    log('\n🔎 Pattern Analysis:', 'blue');
    
    // Check format correlation
    const mp3WithSpeakers = withSpeakers.filter(j => j.fileExt === '.mp3').length;
    const mp3Total = jobs.filter(j => path.extname(j.original_file_name).toLowerCase() === '.mp3').length;
    const m4aWithSpeakers = withSpeakers.filter(j => j.fileExt === '.m4a').length;
    const m4aTotal = jobs.filter(j => path.extname(j.original_file_name).toLowerCase() === '.m4a').length;
    
    if (mp3Total > 0) {
      log(`  MP3 files: ${mp3WithSpeakers}/${mp3Total} have speakers (${(mp3WithSpeakers/mp3Total*100).toFixed(1)}%)`);
    }
    if (m4aTotal > 0) {
      log(`  M4A files: ${m4aWithSpeakers}/${m4aTotal} have speakers (${(m4aWithSpeakers/m4aTotal*100).toFixed(1)}%)`);
    }
    
    log('\n' + '='.repeat(60), 'cyan');
    
  } catch (error) {
    log(`\n❌ Error: ${error.message}`, 'red');
  } finally {
    db.close();
  }
}

// Run the diagnostic
diagnoseSpeakers().catch(error => {
  log(`❌ Unexpected error: ${error.message}`, 'red');
  process.exit(1);
});