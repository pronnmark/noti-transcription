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
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function testEdgeCases() {
  log('🧪 Testing Edge Cases for Speaker Diarization', 'cyan');
  log('='.repeat(60), 'cyan');

  const dbPath = path.join(process.cwd(), 'sqlite.db');
  const db = new Database(dbPath);

  try {
    // Test 1: Check for missing HUGGINGFACE_TOKEN scenario
    log('\n📋 Test 1: Missing HUGGINGFACE_TOKEN', 'blue');

    // Look for jobs where diarization was enabled but failed due to missing token
    const tokenErrors = db
      .prepare(
        `
      SELECT 
        tj.file_id,
        tj.diarization_error,
        af.original_file_name
      FROM transcription_jobs tj
      JOIN audio_files af ON tj.file_id = af.id
      WHERE tj.diarization_error LIKE '%HUGGINGFACE_TOKEN%'
      OR tj.diarization_error LIKE '%HuggingFace%'
    `
      )
      .all();

    if (tokenErrors.length > 0) {
      log(`  ❌ Found ${tokenErrors.length} files with token errors:`, 'red');
      tokenErrors.forEach(job => {
        log(`     File ${job.file_id}: ${job.original_file_name}`, 'red');
        log(`     Error: ${job.diarization_error}`, 'yellow');
      });
    } else {
      log('  ✅ No HUGGINGFACE_TOKEN errors found', 'green');
    }

    // Test 2: Check for format-specific failures
    log('\n📋 Test 2: Format-Specific Failures', 'blue');

    const formatErrors = db
      .prepare(
        `
      SELECT 
        tj.file_id,
        tj.diarization_error,
        af.original_file_name,
        af.file_name
      FROM transcription_jobs tj
      JOIN audio_files af ON tj.file_id = af.id
      WHERE tj.diarization_error LIKE '%Format not recognised%'
      OR tj.diarization_error LIKE '%format%'
    `
      )
      .all();

    if (formatErrors.length > 0) {
      log(`  ❌ Found ${formatErrors.length} files with format errors:`, 'red');
      const formats = {};
      formatErrors.forEach(job => {
        const ext = path.extname(job.original_file_name).toLowerCase();
        formats[ext] = (formats[ext] || 0) + 1;
        log(`     File ${job.file_id}: ${job.original_file_name}`, 'red');
      });
      log('\n  Format failure distribution:', 'yellow');
      Object.entries(formats).forEach(([ext, count]) => {
        log(`    ${ext}: ${count} failures`, 'yellow');
      });
    } else {
      log('  ✅ No format-specific errors found', 'green');
    }

    // Test 3: Check metadata file consistency
    log('\n📋 Test 3: Metadata File Consistency', 'blue');

    const completedJobs = db
      .prepare(
        `
      SELECT 
        tj.file_id,
        tj.status,
        tj.diarization_status,
        af.original_file_name
      FROM transcription_jobs tj
      JOIN audio_files af ON tj.file_id = af.id
      WHERE tj.status = 'completed'
    `
      )
      .all();

    let metadataIssues = 0;
    completedJobs.forEach(job => {
      const transcriptPath = path.join(
        process.cwd(),
        'data',
        'transcripts',
        `${job.file_id}.json`
      );
      const metadataPath = path.join(
        process.cwd(),
        'data',
        'transcripts',
        `${job.file_id}_metadata.json`
      );

      if (fs.existsSync(transcriptPath) && !fs.existsSync(metadataPath)) {
        metadataIssues++;
        log(`  ⚠️  File ${job.file_id} missing metadata file`, 'yellow');
      }
    });

    if (metadataIssues === 0) {
      log('  ✅ All recent transcriptions have metadata files', 'green');
    } else {
      log(`  ❌ ${metadataIssues} files missing metadata`, 'red');
    }

    // Test 4: Check for single-speaker files
    log('\n📋 Test 4: Single-Speaker Detection', 'blue');

    const noSpeakersDetected = db
      .prepare(
        `
      SELECT 
        COUNT(*) as count
      FROM transcription_jobs
      WHERE diarization_status = 'no_speakers_detected'
    `
      )
      .get();

    log(
      `  📊 Files with no speakers detected: ${noSpeakersDetected.count}`,
      'yellow'
    );
    log(
      '  💡 These might be single-speaker recordings or have diarization issues',
      'yellow'
    );

    // Test 5: Check diarization status distribution
    log('\n📋 Test 5: Diarization Status Distribution', 'blue');

    const statusDist = db
      .prepare(
        `
      SELECT 
        diarization_status,
        COUNT(*) as count
      FROM transcription_jobs
      WHERE status = 'completed'
      GROUP BY diarization_status
    `
      )
      .all();

    log('  Status distribution:', 'blue');
    statusDist.forEach(row => {
      const status = row.diarization_status || 'null/legacy';
      const color =
        status === 'success' ? 'green' : status === 'failed' ? 'red' : 'yellow';
      log(`    ${status}: ${row.count} files`, color);
    });

    // Test 6: Performance check
    log('\n📋 Test 6: Performance Analysis', 'blue');

    const transcriptSizes = completedJobs
      .map(job => {
        const transcriptPath = path.join(
          process.cwd(),
          'data',
          'transcripts',
          `${job.file_id}.json`
        );
        if (fs.existsSync(transcriptPath)) {
          const stats = fs.statSync(transcriptPath);
          return {
            fileId: job.file_id,
            fileName: job.original_file_name,
            size: stats.size,
          };
        }
        return null;
      })
      .filter(Boolean);

    if (transcriptSizes.length > 0) {
      transcriptSizes.sort((a, b) => b.size - a.size);
      log('  Largest transcript files:', 'blue');
      transcriptSizes.slice(0, 3).forEach(file => {
        log(
          `    File ${file.fileId}: ${(file.size / 1024).toFixed(1)}KB - ${file.fileName}`,
          'blue'
        );
      });
    }

    // Summary
    log('\n' + '='.repeat(60), 'cyan');
    log('📊 Edge Case Test Summary:', 'cyan');

    const totalFiles = db
      .prepare('SELECT COUNT(*) as count FROM audio_files')
      .get().count;
    const successfulDiarization = db
      .prepare(
        "SELECT COUNT(*) as count FROM transcription_jobs WHERE diarization_status = 'success'"
      )
      .get().count;
    const failedDiarization = db
      .prepare(
        "SELECT COUNT(*) as count FROM transcription_jobs WHERE diarization_status = 'failed'"
      )
      .get().count;

    log(`  Total files: ${totalFiles}`, 'blue');
    log(
      `  Successful diarization: ${successfulDiarization} (${((successfulDiarization / totalFiles) * 100).toFixed(1)}%)`,
      'green'
    );
    log(
      `  Failed diarization: ${failedDiarization} (${((failedDiarization / totalFiles) * 100).toFixed(1)}%)`,
      'red'
    );

    log('\n💡 Recommendations:', 'cyan');
    if (formatErrors.length > 0) {
      log(
        '  - Consider converting m4a files to mp3 before processing',
        'yellow'
      );
    }
    if (tokenErrors.length > 0) {
      log('  - Ensure HUGGINGFACE_TOKEN is set in environment', 'yellow');
    }
    if (metadataIssues > 0) {
      log('  - Re-transcribe older files to generate metadata', 'yellow');
    }
  } catch (error) {
    log(`\n❌ Error: ${error.message}`, 'red');
  } finally {
    db.close();
  }
}

// Run the tests
testEdgeCases().catch(error => {
  log(`❌ Unexpected error: ${error.message}`, 'red');
  process.exit(1);
});
