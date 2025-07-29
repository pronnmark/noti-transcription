import { spawn } from 'child_process';
import { join } from 'path';
import { readFile } from 'fs/promises';
import { AudioService } from './core/AudioService';
import { detectAndApplySpeakerNames } from './speakerDetectionService';
import { getSupabase } from '../database/client';

export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
  speaker?: string;
}

const _audioService = new AudioService();

// Debug logging (can be disabled by setting DEBUG_TRANSCRIPTION=false)
const DEBUG_TRANSCRIPTION = process.env.DEBUG_TRANSCRIPTION !== 'false';
const debugLog = (...args: unknown[]) => {
  if (DEBUG_TRANSCRIPTION) {
    console.log(...args);
  }
};

// Transcription settings - matching SvelteKit version
const HUGGINGFACE_TOKEN = process.env.HUGGINGFACE_TOKEN;
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
  speakerCount?: number,
): Promise<boolean> {
  const scriptPath = join(process.cwd(), 'scripts', 'transcribe.py');
  const pythonPath = join(process.cwd(), 'venv', 'bin', 'python');

  const args = [
    scriptPath,
    '--audio-file',
    audioPath,
    '--output-file',
    outputPath,
    '--model-size',
    MODEL_SIZE,
    '--language',
    'sv',
    '--device',
    device,
    '--enable-diarization',
  ];

  // Add speaker count if specified
  if (speakerCount && speakerCount > 1) {
    args.push('--num-speakers', speakerCount.toString());
  }

  const envVars = {
    ...process.env,
    // ALWAYS include HuggingFace token for speaker diarization (with hardcoded fallback)
    HUGGINGFACE_TOKEN: HUGGINGFACE_TOKEN,
    // Set Python path to include our venv
    PYTHONPATH: join(
      process.cwd(),
      'venv',
      'lib',
      'python3.12',
      'site-packages',
    ),
    // GPU environment variables - try multiple CUDA paths
    ...(device === 'cuda'
      ? {
        CUDA_VISIBLE_DEVICES: '0',
        PYTORCH_CUDA_ALLOC_CONF: 'max_split_size_mb:512',
        LD_LIBRARY_PATH: [
          '/usr/local/cuda/lib64',
          '/usr/lib/x86_64-linux-gnu',
          `${process.cwd()}/venv/lib/python3.12/site-packages/nvidia/cudnn/lib`,
          `${process.cwd()}/venv/lib/python3.12/site-packages/nvidia/cuda_runtime/lib`,
          `${process.cwd()}/venv/lib/python3.12/site-packages/nvidia/cublas/lib`,
          process.env.LD_LIBRARY_PATH || '',
        ]
          .filter(Boolean)
          .join(':'),
      }
      : {}),
  };

  debugLog(`Trying transcription with ${device.toUpperCase()}:`, args);
  debugLog(`Environment variables for ${device.toUpperCase()}:`);
  debugLog(
    `  HUGGINGFACE_TOKEN: ${envVars.HUGGINGFACE_TOKEN ? 'SET' : 'NOT SET'}`,
  );
  debugLog(`  PYTHONPATH: ${envVars.PYTHONPATH}`);
  if (device === 'cuda') {
    debugLog(`  CUDA_VISIBLE_DEVICES: ${envVars.CUDA_VISIBLE_DEVICES}`);
    debugLog(`  LD_LIBRARY_PATH: ${envVars.LD_LIBRARY_PATH}`);
  }

  return new Promise(resolve => {
    const timeout = setTimeout(
      () => {
        console.error(
          `❌ ${device.toUpperCase()} transcription timed out after 10 minutes`,
        );
        pythonProcess.kill('SIGTERM');
        resolve(false);
      },
      10 * 60 * 1000,
    ); // 10 minute timeout

    const pythonProcess = spawn(pythonPath, args, {
      cwd: process.cwd(),
      env: envVars,
    });

    let stderrOutput = '';
    let stdoutOutput = '';

    pythonProcess.stdout.on('data', data => {
      const output = data.toString();
      stdoutOutput += output;
      debugLog(`${device.toUpperCase()} stdout:`, output.trim());
    });

    pythonProcess.stderr.on('data', data => {
      const output = data.toString();
      stderrOutput += output;
      // Only log important stderr messages, not warnings
      if (
        output.includes('Error') ||
        output.includes('Failed') ||
        output.includes('Exception')
      ) {
        console.error(`${device.toUpperCase()} stderr:`, output.trim());
      }
    });

    pythonProcess.on('close', code => {
      clearTimeout(timeout);

      if (code === 0) {
        debugLog(
          `✅ ${device.toUpperCase()} transcription completed successfully!`,
        );
        resolve(true);
      } else {
        console.error(
          `❌ ${device.toUpperCase()} transcription failed with code ${code}`,
        );

        // Log relevant error information
        if (
          stderrOutput.includes('Error') ||
          stderrOutput.includes('Exception')
        ) {
          console.error(
            'Error details:',
            stderrOutput
              .split('\n')
              .filter(
                line =>
                  line.includes('Error') ||
                  line.includes('Exception') ||
                  line.includes('Traceback'),
              )
              .slice(-5),
          );
        }

        // Check if it's a CUDA error that should trigger fallback
        const isCudaError =
          device === 'cuda' &&
          (stderrOutput.includes('libcudnn') ||
            stderrOutput.includes('CUDA out of memory') ||
            stderrOutput.includes('cuDNN') ||
            stderrOutput.includes('core dumped') ||
            code === 134 ||
            code === null); // Process killed

        if (isCudaError) {
          debugLog('🔄 CUDA error detected, will try CPU fallback');
        }

        resolve(false);
      }
    });

    pythonProcess.on('error', err => {
      clearTimeout(timeout);
      console.error(`${device.toUpperCase()} process error:`, err);
      resolve(false);
    });
  });
}

export async function startTranscription(
  fileId: number,
  audioPath: string,
  speakerCount?: number,
): Promise<void> {
  const supabase = getSupabase();

  try {
    debugLog(
      `🚀 Starting transcription for file ${fileId} with ${MODEL_SIZE} model...`,
    );
    debugLog(`Audio path: ${audioPath}`);
    debugLog(
      `Speaker diarization: ${ENABLE_DIARIZATION ? 'enabled' : 'disabled'}`,
    );
    // Note: Speaker count will be read from database job or fallback to parameter

    // Get the transcription job
    const { data: jobs, error: jobError } = await supabase
      .from('transcription_jobs')
      .select('*')
      .eq('file_id', fileId)
      .order('created_at', { ascending: true })
      .limit(1);

    if (jobError) {
      throw new Error(`Failed to fetch transcription job: ${jobError.message}`);
    }

    if (!jobs || jobs.length === 0) {
      throw new Error(`No transcription job found for file ${fileId}`);
    }

    const job = jobs[0];

    // Use speaker count from database (user-specified) or fallback to parameter
    const finalSpeakerCount = job.speakerCount || speakerCount;
    if (finalSpeakerCount) {
      debugLog(
        `Using speaker count: ${finalSpeakerCount} ${job.speakerCount ? '(user-specified)' : '(parameter)'}`,
      );
    } else {
      debugLog('No speaker count specified - will auto-detect');
    }

    // Update job to processing status
    const { error: updateError1 } = await supabase
      .from('transcription_jobs')
      .update({
        status: 'processing',
        started_at: new Date().toISOString(),
        progress: 10,
        diarization_status: 'in_progress',
        updated_at: new Date().toISOString(),
      })
      .eq('id', job.id);

    if (updateError1) {
      throw new Error(`Failed to update job status: ${updateError1.message}`);
    }

    // Validate audio file exists
    try {
      await readFile(audioPath);
    } catch (_error) {
      await supabase
        .from('transcription_jobs')
        .update({
          status: 'failed',
          last_error: `Audio file not found: ${audioPath}`,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', job.id);
      throw new Error(`Audio file not found: ${audioPath}`);
    }

    const outputPath = join(
      process.cwd(),
      'data',
      'transcripts',
      `${fileId}.json`,
    );
    debugLog(`Output path: ${outputPath}`);

    // Ensure transcripts directory exists
    const transcriptsDir = join(process.cwd(), 'data', 'transcripts');
    const { existsSync, mkdirSync } = await import('fs');
    if (!existsSync(transcriptsDir)) {
      mkdirSync(transcriptsDir, { recursive: true });
      debugLog(`Created transcripts directory: ${transcriptsDir}`);
    }

    // Update progress
    await supabase
      .from('transcription_jobs')
      .update({ 
        progress: 20,
        updated_at: new Date().toISOString(),
      })
      .eq('id', job.id);

    // Try GPU first, then fallback to CPU
    let success = false;

    debugLog(`🚀 Starting GPU transcription with ${MODEL_SIZE} model...`);
    success = await tryTranscription(
      audioPath,
      outputPath,
      'cuda',
      finalSpeakerCount,
    );

    if (!success) {
      debugLog('🔄 GPU transcription failed, falling back to CPU...');
      // Update progress
      await supabase
        .from('transcription_jobs')
        .update({ 
          progress: 50,
          updated_at: new Date().toISOString(),
        })
        .eq('id', job.id);

      success = await tryTranscription(
        audioPath,
        outputPath,
        'cpu',
        finalSpeakerCount,
      );
    }

    if (success) {
      // Update progress
      await supabase
        .from('transcription_jobs')
        .update({ 
          progress: 80,
          updated_at: new Date().toISOString(),
        })
        .eq('id', job.id);

      // Verify the output file exists and is valid
      let result: TranscriptionResult;
      try {
        const transcriptData = await readFile(outputPath, 'utf-8');
        result = JSON.parse(transcriptData);

        if (!result.segments || !Array.isArray(result.segments)) {
          throw new Error('Invalid transcript format: missing segments array');
        }
      } catch (parseError) {
        const errorMsg = `Failed to read transcript file: ${
          parseError instanceof Error ? parseError.message : 'Unknown error'
        }`;

        await supabase
          .from('transcription_jobs')
          .update({
            status: 'failed',
            last_error: errorMsg,
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', job.id);

        throw new Error(errorMsg);
      }

      debugLog(
        `✅ Transcription completed with ${result.segments.length} segments`,
      );

      // Read metadata file to get diarization and format conversion status
      let diarizationStatus: 'success' | 'no_speakers_detected' | 'failed' =
        'no_speakers_detected';
      let diarizationError: string | null = null;

      try {
        const metadataPath = outputPath.replace('.json', '_metadata.json');
        const metadataData = await readFile(metadataPath, 'utf-8');
        const metadata = JSON.parse(metadataData);

        debugLog('Transcription metadata:', metadata);

        // Log format conversion information
        if (metadata.format_conversion_attempted) {
          if (metadata.format_conversion_success) {
            debugLog(
              `🔄 Audio format converted successfully for diarization compatibility`,
            );
          } else if (metadata.format_conversion_error) {
            debugLog(
              `⚠️ Audio format conversion failed: ${metadata.format_conversion_error}`,
            );
            debugLog(`📝 Continuing with original file format...`);
          }
        }

        if (metadata.diarization_attempted) {
          if (metadata.diarization_success) {
            diarizationStatus = 'success';
            debugLog(
              `✅ Speaker diarization successful! Found ${metadata.detected_speakers} speakers`,
            );
          } else if (metadata.diarization_error) {
            diarizationStatus = 'failed';
            diarizationError = metadata.diarization_error;

            // Enhanced error message if format conversion was attempted but failed
            if (
              metadata.format_conversion_attempted &&
              !metadata.format_conversion_success
            ) {
              diarizationError = `Format conversion failed (${metadata.format_conversion_error}), then diarization failed: ${metadata.diarization_error}`;
              debugLog(
                `⚠️ Both format conversion and diarization failed: ${diarizationError}`,
              );
            } else {
              debugLog(`⚠️ Speaker diarization failed: ${diarizationError}`);
            }
          }
        }
      } catch (metadataError) {
        debugLog(
          'Could not read diarization metadata, falling back to segment analysis',
        );
        if (metadataError instanceof Error) {
          debugLog('Metadata error details:', metadataError.message);
        }

        // Fallback: Check if speaker diarization worked by analyzing segments
        const hasSpeakers = result.segments.some(s => s.speaker);

        if (hasSpeakers) {
          const uniqueSpeakers = new Set(
            result.segments.map(s => s.speaker).filter(Boolean),
          );
          debugLog(
            `✅ Speaker diarization successful! Found ${uniqueSpeakers.size} speakers`,
          );
          diarizationStatus = 'success';
        } else {
          debugLog('⚠️ No speaker information found in transcript');
          // If no metadata file and no speakers, assume diarization wasn't attempted
          diarizationStatus = 'no_speakers_detected';
        }
      }

      // Apply speaker name detection if we have speakers
      let finalSegments = result.segments;
      if (diarizationStatus === 'success') {
        try {
          debugLog(`🎯 Starting speaker name detection for file ${fileId}...`);
          const speakerResult = await detectAndApplySpeakerNames(
            result.segments,
          );

          if (speakerResult.success && speakerResult.updatedTranscript) {
            finalSegments = speakerResult.updatedTranscript;
            debugLog(
              `✅ Speaker detection completed for file ${fileId}:`,
              speakerResult.stats,
            );
          } else {
            debugLog(
              `ℹ️ Speaker detection skipped for file ${fileId}: ${speakerResult.error || 'No names found'}`,
            );
          }
        } catch (speakerError) {
          console.error(
            `⚠️ Speaker detection failed for file ${fileId}:`,
            speakerError,
          );
          // Continue with original segments - don't fail transcription
        }
      } else {
        debugLog(
          `ℹ️ Skipping speaker detection for file ${fileId}: no speaker diarization available`,
        );
      }

      // Calculate duration from transcript segments
      let calculatedDuration = 0;
      if (finalSegments && finalSegments.length > 0) {
        // Find the segment with the latest end time
        const lastSegment = finalSegments.reduce((latest, segment) => {
          const segmentEnd = segment.end || 0;
          const latestEnd = latest.end || 0;
          return segmentEnd > latestEnd ? segment : latest;
        });
        calculatedDuration = lastSegment.end || 0;
        debugLog(
          `📏 Calculated duration from transcript: ${calculatedDuration} seconds`,
        );
      }

      // Update job as completed with the transcript (potentially with updated speaker names)
      const { error: completeError } = await supabase
        .from('transcription_jobs')
        .update({
          status: 'completed',
          progress: 100,
          transcript: finalSegments,
          diarization_status: diarizationStatus,
          diarization_error: diarizationError,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', job.id);

      if (completeError) {
        throw new Error(`Failed to complete job: ${completeError.message}`);
      }

      // Update audioFiles table with calculated duration
      if (calculatedDuration > 0) {
        try {
          const { error: durationError } = await supabase
            .from('audio_files')
            .update({
              duration: Math.round(calculatedDuration),
              updated_at: new Date().toISOString(),
            })
            .eq('id', fileId);

          if (durationError) {
            console.error(
              `⚠️ Failed to update duration for file ${fileId}:`,
              durationError.message,
            );
          } else {
            debugLog(
              `📏 Updated audioFiles duration: ${calculatedDuration} seconds for file ${fileId}`,
            );
          }
        } catch (durationError) {
          console.error(
            `⚠️ Failed to update duration for file ${fileId}:`,
            durationError,
          );
          // Don't fail the transcription for duration update issues
        }
      }

      debugLog(
        `✅ File ${fileId} transcription process completed successfully`,
      );

      debugLog(`✅ Transcription completed successfully for file ${fileId}`);
      // Note: Auto-extraction system has been removed for simplicity
    } else {
      await supabase
        .from('transcription_jobs')
        .update({
          status: 'failed',
          last_error: 'Transcription failed on both GPU and CPU',
          diarization_status: 'failed',
          diarization_error:
            'Transcription failed before diarization could be attempted',
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', job.id);

      console.error(`❌ Transcription failed for file ${fileId}`);
      throw new Error('Transcription failed on both GPU and CPU');
    }
  } catch (error) {
    console.error(
      `❌ Top-level transcription error for file ${fileId}:`,
      error,
    );

    // Update job as failed if not already updated
    try {
      const { data: jobs, error: jobError } = await supabase
        .from('transcription_jobs')
        .select('*')
        .eq('file_id', fileId)
        .order('created_at', { ascending: true })
        .limit(1);

      if (!jobError && jobs && jobs.length > 0) {
        await supabase
          .from('transcription_jobs')
          .update({
            status: 'failed',
            last_error: error instanceof Error ? error.message : 'Unknown error',
            diarization_status: 'failed',
            diarization_error:
              error instanceof Error ? error.message : 'Unknown error',
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', jobs[0].id);
      }
    } catch (dbError) {
      console.error('Failed to update job status:', dbError);
    }

    throw error;
  }
}

export async function getTranscript(
  fileId: number,
): Promise<TranscriptionResult | null> {
  try {
    const supabase = getSupabase();

    // Query transcription job for this file
    const { data: transcriptionJobs, error } = await supabase
      .from('transcription_jobs')
      .select('*')
      .eq('file_id', fileId)
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      console.error(`Error fetching transcript for file ${fileId}:`, error);
      return null;
    }

    if (!transcriptionJobs || transcriptionJobs.length === 0 || !transcriptionJobs[0].transcript) {
      debugLog(`No transcript found for file ${fileId}`);
      return null;
    }

    // Return transcript in expected format
    return {
      segments: transcriptionJobs[0].transcript,
    };
  } catch (error) {
    console.error(`Error getting transcript for file ${fileId}:`, error);
    return null;
  }
}
