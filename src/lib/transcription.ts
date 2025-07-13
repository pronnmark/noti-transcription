import { spawn } from 'child_process';
import { join } from 'path';
import { readFile } from 'fs/promises';
import { audioFilesService } from './db/sqliteServices';
import { fileService } from './services/fileService';
import type { TranscriptSegment } from './db/sqliteSchema';

// Transcription settings - matching SvelteKit version
const HUGGINGFACE_TOKEN = process.env.HUGGINGFACE_TOKEN || 'your-huggingface-token-here';
const MODEL_SIZE = 'large-v3'; // Always use the biggest, most accurate model
const ENABLE_DIARIZATION = true; // Always enable speaker detection

export interface TranscriptionResult {
  segments: TranscriptSegment[];
}

// Helper function to try transcription with specific device
async function tryTranscription(
  audioPath: string,
  outputPath: string,
  device: 'cuda' | 'cpu'
): Promise<boolean> {
  const args = [
    '/home/philip/Documents/projects/noti/scripts/transcribe.py',
    '--audio-file', audioPath,
    '--output-file', outputPath,
    '--model-size', MODEL_SIZE,
    '--language', 'sv',
    '--device', device,
    '--enable-diarization'
  ];

  console.log(`Trying transcription with ${device.toUpperCase()}:`, args);

  return new Promise((resolve) => {
    // Use the Python environment from noti
    const pythonProcess = spawn('/home/philip/Documents/projects/noti/venv/bin/python', args, {
      env: {
        ...process.env,
        // ALWAYS include HuggingFace token for speaker diarization
        HUGGINGFACE_TOKEN,
        // GPU environment variables
        ...(device === 'cuda' ? {
          'CUDA_VISIBLE_DEVICES': '0',
          'PYTORCH_CUDA_ALLOC_CONF': 'max_split_size_mb:512',
          'LD_LIBRARY_PATH': `/home/philip/Documents/projects/Scriberr/venv/lib/python3.12/site-packages/nvidia/cudnn/lib:${process.env.LD_LIBRARY_PATH || ''}`
        } : {})
      }
    });

    let stderrOutput = '';

    pythonProcess.stdout.on('data', (data) => {
      console.log(`${device.toUpperCase()} stdout:`, data.toString());
    });

    pythonProcess.stderr.on('data', (data) => {
      stderrOutput += data.toString();
      console.error(`${device.toUpperCase()} stderr:`, data.toString());
    });

    pythonProcess.on('close', (code) => {
      if (code === 0) {
        console.log(`✅ ${device.toUpperCase()} transcription completed successfully!`);
        resolve(true);
      } else {
        console.error(`❌ ${device.toUpperCase()} transcription failed with code ${code}`);
        
        // Check if it's a CUDA error that should trigger fallback
        const isCudaError = device === 'cuda' && (
          stderrOutput.includes('libcudnn') || 
          stderrOutput.includes('CUDA') || 
          stderrOutput.includes('cuDNN') ||
          stderrOutput.includes('core dumped') ||
          code === 134
        );
        
        if (isCudaError) {
          console.log('🔄 CUDA error detected, will try CPU fallback');
        }
        
        resolve(false);
      }
    });

    pythonProcess.on('error', (err) => {
      console.error(`${device.toUpperCase()} process error:`, err);
      resolve(false);
    });
  });
}

export async function startTranscription(
  fileId: number | string,
  audioPath: string
): Promise<void> {
  try {
    console.log(`🚀 Starting transcription for file ${fileId} with ${MODEL_SIZE} model...`);
    console.log(`Speaker diarization: ${ENABLE_DIARIZATION ? 'enabled' : 'disabled'}`);
    
    // Update status to processing
    if (typeof fileId === 'number') {
      await audioFilesService.update(fileId, { transcriptionStatus: 'processing' });
    } else {
      await fileService.updateFileStatus(fileId, 'processing');
    }

    const outputPath = join(process.cwd(), 'data', 'transcripts', `${fileId}.json`);

    // Try GPU first, then fallback to CPU
    let success = false;
    
    console.log(`🚀 Starting GPU transcription with ${MODEL_SIZE} model...`);
    success = await tryTranscription(audioPath, outputPath, 'cuda');
    
    if (!success) {
      console.log('🔄 GPU transcription failed, falling back to CPU...');
      success = await tryTranscription(audioPath, outputPath, 'cpu');
    }

    if (success) {
      // Read the transcript file
      const transcriptData = await readFile(outputPath, 'utf-8');
      const result: TranscriptionResult = JSON.parse(transcriptData);
      
      console.log(`✅ Transcription completed with ${result.segments.length} segments`);
      
      // Check if speaker diarization worked
      const hasSpeakers = result.segments.some(s => s.speaker);
      if (hasSpeakers) {
        console.log('✅ Speaker diarization successful!');
      } else {
        console.log('⚠️ No speaker information found in transcript');
      }
      
      // Update file in database with transcript
      if (typeof fileId === 'number') {
        await audioFilesService.updateTranscript(fileId, result.segments, 'completed');
      } else {
        await fileService.updateFileTranscript(fileId, result.segments);
      }
    } else {
      throw new Error('Transcription failed on both GPU and CPU');
    }
  } catch (error) {
    console.error('Transcription error:', error);
    if (typeof fileId === 'number') {
      await audioFilesService.update(fileId, { 
        transcriptionStatus: 'failed',
        lastError: error instanceof Error ? error.message : 'Transcription failed'
      });
    } else {
      await fileService.updateFileStatus(fileId, 'failed');
    }
  }
}

// Get transcript for a file
export async function getTranscript(fileId: string): Promise<TranscriptionResult | null> {
  // Try to get from database first
  const numericId = parseInt(fileId);
  if (!isNaN(numericId)) {
    const file = await audioFilesService.findById(numericId);
    if (file && file.transcript) {
      return { segments: file.transcript };
    }
  }
  
  // Fallback to file system
  try {
    const transcriptPath = join(process.cwd(), 'data', 'transcripts', `${fileId}.json`);
    const data = await readFile(transcriptPath, 'utf-8');
    return JSON.parse(data);
  } catch {
    return null;
  }
}