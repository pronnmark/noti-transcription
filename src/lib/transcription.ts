import { spawn } from 'child_process';
import { join } from 'path';
import { readFile } from 'fs/promises';
import { audioFilesService, settingsService } from './db/sqliteServices';
import { fileService } from './services/fileService';
import type { TranscriptSegment } from './db/sqliteSchema';

// Transcription settings - matching SvelteKit version
const HUGGINGFACE_TOKEN = process.env.HUGGINGFACE_TOKEN || '';
const MODEL_SIZE = 'large-v3'; // Always use the biggest, most accurate model
const ENABLE_DIARIZATION = true; // Always enable speaker detection

export interface TranscriptionResult {
  segments: TranscriptSegment[];
}

// Helper function to try transcription with specific device
async function tryTranscription(
  audioPath: string,
  outputPath: string,
  device: 'cuda' | 'cpu',
  speakerCount?: number
): Promise<boolean> {
  const scriptPath = join(process.cwd(), 'scripts', 'transcribe.py');
  const pythonPath = join(process.cwd(), 'venv', 'bin', 'python');
  
  const args = [
    scriptPath,
    '--audio-file', audioPath,
    '--output-file', outputPath,
    '--model-size', MODEL_SIZE,
    '--language', 'sv',
    '--device', device,
    '--enable-diarization'
  ];
  
  // Add speaker count if specified
  if (speakerCount && speakerCount > 1) {
    args.push('--num-speakers', speakerCount.toString());
  }

  const envVars = {
    ...process.env,
    // ALWAYS include HuggingFace token for speaker diarization
    HUGGINGFACE_TOKEN,
    // Set Python path to include our venv
    PYTHONPATH: join(process.cwd(), 'venv', 'lib', 'python3.12', 'site-packages'),
    // GPU environment variables - try multiple CUDA paths
    ...(device === 'cuda' ? {
      'CUDA_VISIBLE_DEVICES': '0',
      'PYTORCH_CUDA_ALLOC_CONF': 'max_split_size_mb:512',
      'LD_LIBRARY_PATH': [
        '/usr/local/cuda/lib64',
        '/usr/lib/x86_64-linux-gnu',
        `${process.cwd()}/venv/lib/python3.12/site-packages/nvidia/cudnn/lib`,
        `${process.cwd()}/venv/lib/python3.12/site-packages/nvidia/cuda_runtime/lib`,
        `${process.cwd()}/venv/lib/python3.12/site-packages/nvidia/cublas/lib`,
        process.env.LD_LIBRARY_PATH || ''
      ].filter(Boolean).join(':')
    } : {})
  };

  console.log(`Trying transcription with ${device.toUpperCase()}:`, args);
  console.log(`Environment variables for ${device.toUpperCase()}:`);
  console.log(`  HUGGINGFACE_TOKEN: ${envVars.HUGGINGFACE_TOKEN ? 'SET' : 'NOT SET'}`);
  console.log(`  PYTHONPATH: ${envVars.PYTHONPATH}`);
  if (device === 'cuda') {
    console.log(`  CUDA_VISIBLE_DEVICES: ${envVars.CUDA_VISIBLE_DEVICES}`);
    console.log(`  LD_LIBRARY_PATH: ${envVars.LD_LIBRARY_PATH}`);
  }

  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      console.error(`❌ ${device.toUpperCase()} transcription timed out after 10 minutes`);
      pythonProcess.kill('SIGTERM');
      resolve(false);
    }, 10 * 60 * 1000); // 10 minute timeout

    const pythonProcess = spawn(pythonPath, args, {
      cwd: process.cwd(),
      env: envVars
    });

    let stderrOutput = '';
    let stdoutOutput = '';

    pythonProcess.stdout.on('data', (data) => {
      const output = data.toString();
      stdoutOutput += output;
      console.log(`${device.toUpperCase()} stdout:`, output.trim());
    });

    pythonProcess.stderr.on('data', (data) => {
      const output = data.toString();
      stderrOutput += output;
      // Only log important stderr messages, not warnings
      if (output.includes('Error') || output.includes('Failed') || output.includes('Exception')) {
        console.error(`${device.toUpperCase()} stderr:`, output.trim());
      }
    });

    pythonProcess.on('close', (code) => {
      clearTimeout(timeout);
      
      if (code === 0) {
        console.log(`✅ ${device.toUpperCase()} transcription completed successfully!`);
        resolve(true);
      } else {
        console.error(`❌ ${device.toUpperCase()} transcription failed with code ${code}`);
        
        // Log relevant error information
        if (stderrOutput.includes('Error') || stderrOutput.includes('Exception')) {
          console.error('Error details:', stderrOutput.split('\n').filter(line => 
            line.includes('Error') || line.includes('Exception') || line.includes('Traceback')
          ).slice(-5));
        }
        
        // Check if it's a CUDA error that should trigger fallback
        const isCudaError = device === 'cuda' && (
          stderrOutput.includes('libcudnn') || 
          stderrOutput.includes('CUDA out of memory') ||
          stderrOutput.includes('cuDNN') ||
          stderrOutput.includes('core dumped') ||
          code === 134 ||
          code === null // Process killed
        );
        
        if (isCudaError) {
          console.log('🔄 CUDA error detected, will try CPU fallback');
        }
        
        resolve(false);
      }
    });

    pythonProcess.on('error', (err) => {
      clearTimeout(timeout);
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
    console.log(`Audio path: ${audioPath}`);
    console.log(`Speaker diarization: ${ENABLE_DIARIZATION ? 'enabled' : 'disabled'}`);
    
    // Validate audio file exists
    try {
      await readFile(audioPath);
    } catch (error) {
      throw new Error(`Audio file not found: ${audioPath}`);
    }
    
    // Update status to processing
    if (typeof fileId === 'number') {
      await audioFilesService.update(fileId, { transcriptionStatus: 'processing' });
    } else {
      await fileService.updateFileStatus(fileId, 'processing');
    }

    const outputPath = join(process.cwd(), 'data', 'transcripts', `${fileId}.json`);
    console.log(`Output path: ${outputPath}`);

    // Get settings for speaker count
    let speakerCount: number | undefined;
    try {
      const settings = await settingsService.get();
      if (settings?.transcription) {
        speakerCount = (settings.transcription as any).speakerCount;
        if (speakerCount) {
          console.log(`Speaker count specified: ${speakerCount}`);
        }
      }
    } catch (error) {
      console.log('Could not load settings, using defaults');
    }

    // Try GPU first, then fallback to CPU
    let success = false;
    
    console.log(`🚀 Starting GPU transcription with ${MODEL_SIZE} model...`);
    success = await tryTranscription(audioPath, outputPath, 'cuda', speakerCount);
    
    if (!success) {
      console.log('🔄 GPU transcription failed, falling back to CPU...');
      success = await tryTranscription(audioPath, outputPath, 'cpu', speakerCount);
    }

    if (success) {
      // Verify the output file exists and is valid
      let result: TranscriptionResult;
      try {
        const transcriptData = await readFile(outputPath, 'utf-8');
        result = JSON.parse(transcriptData);
        
        if (!result.segments || !Array.isArray(result.segments)) {
          throw new Error('Invalid transcript format: missing segments array');
        }
      } catch (parseError) {
        throw new Error(`Failed to read transcript file: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
      }
      
      console.log(`✅ Transcription completed with ${result.segments.length} segments`);
      
      // Check if speaker diarization worked
      const hasSpeakers = result.segments.some(s => s.speaker);
      if (hasSpeakers) {
        const uniqueSpeakers = new Set(result.segments.map(s => s.speaker).filter(Boolean));
        console.log(`✅ Speaker diarization successful! Found ${uniqueSpeakers.size} speakers`);
      } else {
        console.log('⚠️ No speaker information found in transcript');
      }
      
      // Update file in database with transcript
      if (typeof fileId === 'number') {
        await audioFilesService.updateTranscript(fileId, result.segments, 'completed');
      } else {
        await fileService.updateFileTranscript(fileId, result.segments);
      }
      
      console.log(`✅ File ${fileId} transcription process completed successfully`);
    } else {
      throw new Error('Transcription failed on both GPU and CPU');
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Transcription failed';
    console.error(`❌ Transcription error for file ${fileId}:`, errorMessage);
    
    // Update file status to failed
    try {
      if (typeof fileId === 'number') {
        await audioFilesService.update(fileId, { 
          transcriptionStatus: 'failed',
          lastError: errorMessage
        });
      } else {
        await fileService.updateFileStatus(fileId, 'failed');
      }
    } catch (updateError) {
      console.error(`Failed to update file status for ${fileId}:`, updateError);
    }
    
    // Re-throw the error for the caller to handle
    throw error;
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