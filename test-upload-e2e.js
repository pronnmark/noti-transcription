#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

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

async function startServer() {
  log('🚀 Starting Next.js server...', 'blue');
  
  const server = spawn('npm', ['run', 'dev'], {
    stdio: 'pipe',
    cwd: process.cwd()
  });

  // Wait for server to be ready
  return new Promise((resolve, reject) => {
    let serverReady = false;
    const timeout = setTimeout(() => {
      if (!serverReady) {
        server.kill();
        reject(new Error('Server startup timeout'));
      }
    }, 30000); // 30 second timeout

    server.stdout.on('data', (data) => {
      const output = data.toString();
      console.log(output);
      
      if (output.includes('Ready') || output.includes('compiled successfully')) {
        serverReady = true;
        clearTimeout(timeout);
        log('✅ Server is ready!', 'green');
        resolve(server);
      }
    });

    server.stderr.on('data', (data) => {
      const output = data.toString();
      console.error(output);
      
      if (output.includes('Error')) {
        server.kill();
        reject(new Error(`Server error: ${output}`));
      }
    });

    server.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });
}

async function uploadFile() {
  const testFile = path.join(process.cwd(), 'testmp3.mp3');
  
  if (!fs.existsSync(testFile)) {
    throw new Error(`Test file not found: ${testFile}`);
  }

  log(`📁 Found test file: ${testFile}`, 'blue');
  log(`📊 File size: ${fs.statSync(testFile).size} bytes`, 'blue');

  const formData = new FormData();
  const fileBuffer = fs.readFileSync(testFile);
  const blob = new Blob([fileBuffer], { type: 'audio/mpeg' });
  formData.append('file', blob, 'testmp3.mp3');

  log('📤 Uploading file...', 'blue');
  
  const response = await fetch('http://localhost:3000/api/upload', {
    method: 'POST',
    body: formData
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Upload failed: ${response.status} ${error}`);
  }

  const result = await response.json();
  log(`✅ Upload successful! File ID: ${result.fileId}`, 'green');
  
  return result;
}

async function checkTranscriptionJob(fileId) {
  log(`🔍 Checking transcription job for file ${fileId}...`, 'blue');
  
  const response = await fetch(`http://localhost:3000/api/files/${fileId}`);
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get file info: ${response.status} ${error}`);
  }

  const fileInfo = await response.json();
  log(`📋 File info:`, 'blue');
  log(`  - Original name: ${fileInfo.originalFileName}`, 'blue');
  log(`  - Duration: ${fileInfo.duration}s`, 'blue');
  
  return fileInfo;
}

async function checkTranscriptionProgress(fileId, maxWaitTime = 300000) { // 5 minutes
  log(`⏳ Monitoring transcription progress for file ${fileId}...`, 'blue');
  
  const startTime = Date.now();
  let lastStatus = '';
  
  while (Date.now() - startTime < maxWaitTime) {
    try {
      const response = await fetch('http://localhost:3000/api/files');
      
      if (!response.ok) {
        throw new Error(`Failed to get files: ${response.status}`);
      }

      const data = await response.json();
      const file = data.files.find(f => f.id === fileId);
      
      if (!file) {
        throw new Error(`File ${fileId} not found in files list`);
      }

      const status = file.transcriptionStatus;
      
      if (status !== lastStatus) {
        log(`📊 Transcription status: ${status}`, 'yellow');
        lastStatus = status;
      }

      if (status === 'completed') {
        log(`✅ Transcription completed!`, 'green');
        return true;
      }

      if (status === 'failed') {
        log(`❌ Transcription failed`, 'red');
        return false;
      }

      // Wait before next check
      await sleep(2000);
      
    } catch (error) {
      log(`⚠️  Error checking progress: ${error.message}`, 'yellow');
      await sleep(5000); // Wait longer on error
    }
  }

  log(`⏰ Transcription timeout after ${maxWaitTime / 1000} seconds`, 'red');
  return false;
}

async function verifyTranscript(fileId) {
  log(`🔍 Verifying transcript for file ${fileId}...`, 'blue');
  
  // Check if transcript file exists
  const transcriptPath = path.join(process.cwd(), 'data', 'transcripts', `${fileId}.json`);
  
  if (!fs.existsSync(transcriptPath)) {
    throw new Error(`Transcript file not found: ${transcriptPath}`);
  }

  const transcriptData = JSON.parse(fs.readFileSync(transcriptPath, 'utf-8'));
  
  if (!transcriptData.segments || !Array.isArray(transcriptData.segments)) {
    throw new Error('Invalid transcript format: missing segments array');
  }

  log(`📝 Transcript has ${transcriptData.segments.length} segments`, 'green');
  
  // Check for speaker diarization
  const hasSpeekerInfo = transcriptData.segments.some(s => s.speaker);
  if (hasSpeekerInfo) {
    const speakers = new Set(transcriptData.segments.map(s => s.speaker).filter(Boolean));
    log(`🎤 Speaker diarization found: ${speakers.size} speakers`, 'green');
  } else {
    log(`⚠️  No speaker diarization found`, 'yellow');
  }

  // Show first few segments
  log(`📄 First few transcript segments:`, 'blue');
  transcriptData.segments.slice(0, 3).forEach((segment, i) => {
    const speaker = segment.speaker ? ` [${segment.speaker}]` : '';
    log(`  ${i + 1}. ${segment.start}s-${segment.end}s${speaker}: ${segment.text}`, 'blue');
  });

  return transcriptData;
}

async function runTest() {
  let server = null;
  
  try {
    log('🧪 Starting End-to-End Transcription Test', 'blue');
    log('=' * 50, 'blue');
    
    // Start server
    server = await startServer();
    
    // Wait a bit for server to fully initialize
    await sleep(3000);
    
    // Upload file
    const uploadResult = await uploadFile();
    
    // Check transcription job was created
    await checkTranscriptionJob(uploadResult.fileId);
    
    // Monitor transcription progress
    const success = await checkTranscriptionProgress(uploadResult.fileId);
    
    if (!success) {
      throw new Error('Transcription did not complete successfully');
    }
    
    // Verify transcript
    const transcript = await verifyTranscript(uploadResult.fileId);
    
    log('=' * 50, 'green');
    log('🎉 ALL TESTS PASSED!', 'green');
    log('✅ File uploaded successfully', 'green');
    log('✅ Transcription job created', 'green');
    log('✅ Auto-trigger worked', 'green');
    log('✅ Transcription completed', 'green');
    log('✅ Transcript file generated', 'green');
    log(`✅ Generated ${transcript.segments.length} transcript segments`, 'green');
    
  } catch (error) {
    log('=' * 50, 'red');
    log(`❌ TEST FAILED: ${error.message}`, 'red');
    process.exit(1);
  } finally {
    if (server) {
      log('🛑 Stopping server...', 'blue');
      server.kill();
    }
  }
}

// Handle cleanup on exit
process.on('SIGINT', () => {
  log('🛑 Test interrupted', 'yellow');
  process.exit(1);
});

// Run the test
runTest().catch(error => {
  log(`❌ Unexpected error: ${error.message}`, 'red');
  process.exit(1);
});