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
  magenta: '\x1b[35m',
  reset: '\x1b[0m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function diagnoseSpeakersEnhanced() {
  log('🔍 Enhanced Speaker Diarization Diagnostic Tool', 'cyan');
  log('=' .repeat(60), 'cyan');
  
  const dbPath = path.join(process.cwd(), 'sqlite.db');
  const db = new Database(dbPath);
  
  try {
    // Get all transcription jobs with the new fields
    const jobs = db.prepare(`
      SELECT 
        tj.id as job_id,
        tj.file_id,
        tj.status,
        tj.transcript,
        tj.diarization_status,
        tj.diarization_error,
        tj.created_at,
        tj.completed_at,
        af.original_file_name,
        af.file_name
      FROM transcription_jobs tj
      JOIN audio_files af ON tj.file_id = af.id
      ORDER BY tj.created_at DESC
    `).all();
    
    log(`\nFound ${jobs.length} total transcription jobs\n`, 'yellow');
    
    // Analyze diarization status
    const statusCounts = {
      'not_attempted': 0,
      'in_progress': 0,
      'success': 0,
      'failed': 0,
      'no_speakers_detected': 0,
      'null': 0
    };
    
    const completedJobs = [];
    const failedDiarizations = [];
    
    jobs.forEach(job => {
      const status = job.diarization_status || 'null';
      statusCounts[status] = (statusCounts[status] || 0) + 1;
      
      if (job.status === 'completed') {
        completedJobs.push(job);
      }
      
      if (job.diarization_status === 'failed' && job.diarization_error) {
        failedDiarizations.push(job);
      }
    });
    
    // Display diarization status summary
    log('📊 Diarization Status Summary:', 'blue');
    Object.entries(statusCounts).forEach(([status, count]) => {
      if (count > 0) {
        const color = status === 'success' ? 'green' : 
                     status === 'failed' ? 'red' : 
                     status === 'in_progress' ? 'yellow' : 'reset';
        log(`  ${status}: ${count} jobs`, color);
      }
    });
    
    // Show completed jobs with speaker analysis
    if (completedJobs.length > 0) {
      log('\n📝 Completed Transcriptions:', 'blue');
      log('File ID | Diarization Status | Speakers | File Name', 'blue');
      log('-'.repeat(80), 'blue');
      
      completedJobs.forEach(job => {
        const transcript = JSON.parse(job.transcript || '[]');
        const hasSpeakers = transcript.some(seg => seg.speaker);
        const speakerCount = new Set(transcript.map(seg => seg.speaker).filter(Boolean)).size;
        
        const status = job.diarization_status || 'unknown';
        const statusColor = status === 'success' ? 'green' : 
                           status === 'failed' ? 'red' : 
                           status === 'no_speakers_detected' ? 'yellow' : 'reset';
        
        log(`File ${job.file_id.toString().padStart(2)} | ${status.padEnd(20)} | ${speakerCount.toString().padStart(8)} | ${job.original_file_name}`, statusColor);
      });
    }
    
    // Show failed diarizations
    if (failedDiarizations.length > 0) {
      log('\n❌ Failed Diarizations:', 'red');
      failedDiarizations.forEach(job => {
        log(`\nFile ${job.file_id}: ${job.original_file_name}`, 'red');
        log(`  Error: ${job.diarization_error}`, 'red');
      });
    }
    
    // Pattern analysis
    log('\n🔎 Detailed Analysis:', 'magenta');
    
    // Success rate by format (enhanced for new audio format support)
    const formats = {};
    completedJobs.forEach(job => {
      const ext = path.extname(job.original_file_name).toLowerCase();
      if (!formats[ext]) {
        formats[ext] = { total: 0, success: 0, failed: 0, no_speakers: 0, whisperSupported: false };
      }
      formats[ext].total++;
      
      // Mark if this format is supported by Whisper
      const whisperFormats = ['.flac', '.m4a', '.mp3', '.mp4', '.mpeg', '.mpga', '.oga', '.ogg', '.wav', '.webm'];
      formats[ext].whisperSupported = whisperFormats.includes(ext);
      
      if (job.diarization_status === 'success') {
        formats[ext].success++;
      } else if (job.diarization_status === 'failed') {
        formats[ext].failed++;
      } else if (job.diarization_status === 'no_speakers_detected') {
        formats[ext].no_speakers++;
      }
    });
    
    log('\n📊 Format Analysis (with Whisper compatibility):', 'magenta');
    Object.entries(formats).forEach(([ext, stats]) => {
      const successRate = (stats.success / stats.total * 100).toFixed(1);
      const supportStatus = stats.whisperSupported ? '✅ Supported' : '❌ Not supported';
      const supportColor = stats.whisperSupported ? 'green' : 'red';
      
      log(`\n  ${ext} files (${supportStatus}):`, 'magenta');
      log(`    Whisper support: ${supportStatus}`, supportColor);
      log(`    Total: ${stats.total}`);
      log(`    Success: ${stats.success} (${successRate}%)`, 'green');
      log(`    Failed: ${stats.failed}`, 'red');
      log(`    No speakers detected: ${stats.no_speakers}`, 'yellow');
      
      // Special analysis for m4a files
      if (ext === '.m4a') {
        log(`    Note: m4a files now use FFmpeg conversion for better diarization`, 'blue');
      }
    });
    
    // Recommendations
    log('\n💡 Recommendations:', 'cyan');
    
    const nullStatusCount = statusCounts['null'] || 0;
    if (nullStatusCount > 0) {
      log(`  - ${nullStatusCount} jobs have no diarization status (older transcriptions)`, 'yellow');
      log(`    Run: node retranscribe-speakers.js`, 'yellow');
    }
    
    const failedCount = statusCounts['failed'] || 0;
    if (failedCount > 0) {
      log(`  - ${failedCount} jobs failed diarization`, 'red');
      log(`    Check error messages above for details`, 'red');
      log(`    With new format conversion, m4a files should work better now`, 'blue');
    }
    
    const noSpeakersCount = statusCounts['no_speakers_detected'] || 0;
    if (noSpeakersCount > 0) {
      log(`  - ${noSpeakersCount} jobs detected no speakers`, 'yellow');
      log(`    These may be single-speaker recordings`, 'yellow');
    }
    
    // Audio format recommendations
    const unsupportedFormats = Object.keys(formats).filter(ext => !formats[ext].whisperSupported);
    if (unsupportedFormats.length > 0) {
      log(`  - Unsupported audio formats detected: ${unsupportedFormats.join(', ')}`, 'red');
      log(`    Consider converting to supported formats: mp3, wav, m4a, etc.`, 'blue');
    }
    
    log(`  - Supported Whisper formats: flac, m4a, mp3, mp4, mpeg, mpga, oga, ogg, wav, webm`, 'green');
    log(`  - Upload validation now checks for supported formats`, 'green');
    
    log('\n' + '='.repeat(60), 'cyan');
    
  } catch (error) {
    log(`\n❌ Error: ${error.message}`, 'red');
  } finally {
    db.close();
  }
}

// Run the diagnostic
diagnoseSpeakersEnhanced().catch(error => {
  log(`❌ Unexpected error: ${error.message}`, 'red');
  process.exit(1);
});