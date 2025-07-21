#!/usr/bin/env node

/**
 * Debug script to analyze diarization results for File 3
 */

const fs = require('fs');
const path = require('path');

const fileId = 9;
const transcriptPath = path.join(__dirname, 'data', 'transcripts', `${fileId}.json`);
const metadataPath = path.join(__dirname, 'data', 'transcripts', `${fileId}_metadata.json`);

console.log('=== DIARIZATION DEBUG ANALYSIS ===');
console.log(`File ID: ${fileId}`);
console.log(`Transcript path: ${transcriptPath}`);
console.log(`Metadata path: ${metadataPath}`);

// Read metadata
try {
  const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
  console.log('\n=== METADATA ===');
  console.log(`Diarization attempted: ${metadata.diarization_attempted}`);
  console.log(`Diarization success: ${metadata.diarization_success}`);
  console.log(`Detected speakers: ${metadata.detected_speakers}`);
  console.log(`Final speaker count: ${metadata.speaker_count}`);
  console.log(`Format conversion: ${metadata.format_conversion_attempted} -> ${metadata.format_conversion_success}`);
  
  if (metadata.diarization_error) {
    console.log(`Diarization error: ${metadata.diarization_error}`);
  }
} catch (error) {
  console.error('Error reading metadata:', error.message);
}

// Read transcript
try {
  const transcript = JSON.parse(fs.readFileSync(transcriptPath, 'utf8'));
  console.log('\n=== TRANSCRIPT ANALYSIS ===');
  console.log(`Total segments: ${transcript.segments.length}`);
  
  // Count speakers
  const speakerCounts = {};
  const speakerSegments = {};
  
  transcript.segments.forEach((segment, index) => {
    const speaker = segment.speaker || 'NO_SPEAKER';
    speakerCounts[speaker] = (speakerCounts[speaker] || 0) + 1;
    
    if (!speakerSegments[speaker]) {
      speakerSegments[speaker] = [];
    }
    speakerSegments[speaker].push({
      index,
      start: segment.start,
      end: segment.end,
      text: segment.text?.substring(0, 50) + '...'
    });
  });
  
  console.log('\n=== SPEAKER DISTRIBUTION ===');
  Object.keys(speakerCounts).forEach(speaker => {
    console.log(`${speaker}: ${speakerCounts[speaker]} segments`);
  });
  
  console.log('\n=== SAMPLE SEGMENTS ===');
  Object.keys(speakerSegments).forEach(speaker => {
    console.log(`\n${speaker} (first 3 segments):`);
    speakerSegments[speaker].slice(0, 3).forEach(seg => {
      console.log(`  [${seg.start?.toFixed(2)}s-${seg.end?.toFixed(2)}s] ${seg.text}`);
    });
  });
  
  // Check for timing patterns
  console.log('\n=== TIMING ANALYSIS ===');
  const firstFew = transcript.segments.slice(0, 5);
  const lastFew = transcript.segments.slice(-5);
  
  console.log('First 5 segments:');
  firstFew.forEach((seg, i) => {
    console.log(`  ${i}: [${seg.start?.toFixed(2)}s-${seg.end?.toFixed(2)}s] ${seg.speaker} - ${seg.text?.substring(0, 30)}...`);
  });
  
  console.log('Last 5 segments:');
  lastFew.forEach((seg, i) => {
    const actualIndex = transcript.segments.length - 5 + i;
    console.log(`  ${actualIndex}: [${seg.start?.toFixed(2)}s-${seg.end?.toFixed(2)}s] ${seg.speaker} - ${seg.text?.substring(0, 30)}...`);
  });
  
} catch (error) {
  console.error('Error reading transcript:', error.message);
}

console.log('\n=== CONCLUSION ===');
console.log('This analysis shows whether our speaker assignment fix worked.');
console.log('If detected_speakers > speaker_count, the assignment algorithm failed.');