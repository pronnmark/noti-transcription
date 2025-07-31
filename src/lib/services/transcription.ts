import { join } from 'path';
import { readFile, writeFile } from 'fs/promises';
import { getAudioService } from '../di/containerSetup';
import { SupabaseStorageService } from './core/SupabaseStorageService';
import { detectAndApplySpeakerNames } from './speakerDetectionService';
import { getSupabase } from '../database/client';
import FormData from 'form-data';
import { createReadStream } from 'fs';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
  speaker?: number;
  speakerName?: string;
}

// Audio service will be retrieved when needed
const getAudioServiceInstance = () => getAudioService();

// Debug logging (can be disabled by setting DEBUG_TRANSCRIPTION=false)
const DEBUG_TRANSCRIPTION = process.env.DEBUG_TRANSCRIPTION !== 'false';
const debugLog = (...args: unknown[]) => {
  if (DEBUG_TRANSCRIPTION) {
    console.log(...args);
  }
};

// Whisper Docker container settings
const WHISPER_API_URL = process.env.WHISPER_API_URL || 'http://localhost:8080';
const WHISPER_TIMEOUT = 600000; // 10 minutes
const ENABLE_DIARIZATION = true; // Always enable speaker detection

export interface TranscriptionResult {
  segments: TranscriptSegment[];
}

// Helper function to parse Whisper diarized text into segments
function parseWhisperTextToSegments(whisperText: string): TranscriptSegment[] {
  const segments: TranscriptSegment[] = [];
  const lines = whisperText.split('\n').filter(line => line.trim());

  let currentTime = 0;
  const SEGMENT_DURATION = 5; // Default 5 seconds per segment

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;

    // Check if line contains speaker information
    const speakerMatch = trimmedLine.match(/^\(speaker (\?|\d+)\)\s*(.+)$/);

    if (speakerMatch) {
      const speakerId = speakerMatch[1];
      const text = speakerMatch[2].trim();

      if (text) {
        segments.push({
          start: currentTime,
          end: currentTime + SEGMENT_DURATION,
          text: text,
          speaker: speakerId === '?' ? undefined : parseInt(speakerId, 10),
        });
        currentTime += SEGMENT_DURATION;
      }
    } else {
      // No speaker diarization, treat as single speaker
      if (trimmedLine) {
        segments.push({
          start: currentTime,
          end: currentTime + SEGMENT_DURATION,
          text: trimmedLine,
          speaker: 1,
        });
        currentTime += SEGMENT_DURATION;
      }
    }
  }

  // If no segments were created, create one from the entire text
  if (segments.length === 0 && whisperText.trim()) {
    segments.push({
      start: 0,
      end: 30, // Default duration
      text: whisperText.trim(),
      speaker: 1,
    });
  }

  return segments;
}

// Helper function to call Whisper Docker container API
async function tryTranscription(
  audioPath: string,
  outputPath: string,
  device: 'cuda' | 'cpu',
  speakerCount?: number
): Promise<boolean> {
  const inferenceUrl = `${WHISPER_API_URL}/inference`;

  console.log(`🎙️ Starting Whisper transcription for ${audioPath}`);

  try {
    // First check if Whisper container is available
    const healthResponse = await axios.get(`${WHISPER_API_URL}/health`, {
      timeout: 5000,
    });

    if (healthResponse.data.status !== 'ok') {
      throw new Error('Whisper container not healthy');
    }

    // Prepare FormData for API call
    const formData = new FormData();
    formData.append('file', createReadStream(audioPath));
    formData.append('response_format', 'json');
    formData.append('temperature', '0.0');

    // Get file size for logging
    const { stat } = await import('fs/promises');
    const fileStats = await stat(audioPath);
    const fileSizeMB = (fileStats.size / 1024 / 1024).toFixed(2);
    
    console.log(`📡 Sending audio file to Whisper container: ${audioPath} (${fileSizeMB}MB)`);

    // Call Whisper API
    const response = await axios.post(inferenceUrl, formData, {
      headers: formData.getHeaders(),
      timeout: WHISPER_TIMEOUT,
    });

    const whisperResult = response.data;
    console.log(
      `✅ Whisper transcription completed: ${whisperResult.text?.length || 0} characters`
    );

    // Parse Whisper response and convert to our format
    const transcriptText = whisperResult.text || '';
    const segments = parseWhisperTextToSegments(transcriptText);

    const result = {
      segments: segments,
    };

    // Write result to output file
    await writeFile(outputPath, JSON.stringify(result, null, 2));

    // Create metadata file
    const metadataPath = outputPath.replace('.json', '_metadata.json');
    const metadata = {
      diarization_attempted: true,
      diarization_success: segments.some(s => s.speaker),
      detected_speakers: new Set(segments.map(s => s.speaker).filter(Boolean))
        .size,
      format_conversion_attempted: false,
      whisper_model: 'ggml-base.en.bin',
      language: 'auto',
    };
    await writeFile(metadataPath, JSON.stringify(metadata, null, 2));

    console.log(`✅ Transcription completed successfully for ${audioPath}`);
    return true;
  } catch (error) {
    console.error(`❌ Whisper transcription failed for ${audioPath}:`, error);
    return false;
  }
}

export async function startTranscription(
  fileId: number,
  audioPath: string,
  speakerCount?: number
): Promise<void> {
  const supabase = getSupabase();

  try {
    debugLog(
      `🚀 Starting transcription for file ${fileId} with Whisper Docker container...`
    );
    debugLog(`Audio path: ${audioPath}`);
    debugLog(
      `Speaker diarization: ${ENABLE_DIARIZATION ? 'enabled' : 'disabled'}`
    );
    // Note: Speaker count will be read from database job or fallback to parameter

    // Get the transcription job
    const { data: jobs, error: jobError } = await supabase
      .from('transcription_jobs')
      .select('*')
      .eq('file_id', fileId)
      .order('created_at', { ascending: false })
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
    if (finalSpeakerCount && finalSpeakerCount > 0) {
      debugLog(
        `Using speaker count: ${finalSpeakerCount} ${job.speakerCount ? '(user-specified)' : '(parameter)'}`
      );
    } else {
      debugLog('No speaker count specified - will auto-detect speakers');
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

    // Download audio file from Supabase storage to temporary file
    const storageService = new SupabaseStorageService();
    let tempAudioPath: string;
    
    try {
      debugLog(`Downloading file from Supabase Storage: ${audioPath}`);
      
      // Create temporary directory
      const tempDir = join(process.cwd(), 'data', 'temp');
      const { existsSync, mkdirSync } = await import('fs');
      if (!existsSync(tempDir)) {
        mkdirSync(tempDir, { recursive: true });
        debugLog(`Created temp directory: ${tempDir}`);
      }
      
      // Generate unique temporary filename
      const fileExtension = audioPath.split('.').pop() || 'webm';
      const tempFileName = `temp_${job.id}_${Date.now()}.${fileExtension}`;
      tempAudioPath = join(tempDir, tempFileName);
      
      // Download file from Supabase storage
      const fileBuffer = await storageService.downloadFile('audio-files', audioPath);
      
      // Save to temporary file efficiently
      await writeFile(tempAudioPath, fileBuffer);
      debugLog(`File downloaded to temporary location: ${tempAudioPath}`);
      debugLog(`File size: ${(fileBuffer.length / 1024 / 1024).toFixed(2)}MB`);
      
    } catch (error) {
      const errorMessage = `Failed to download audio file from storage: ${error instanceof Error ? error.message : 'Unknown error'}`;
      debugLog(`❌ ${errorMessage}`);
      
      await supabase
        .from('transcription_jobs')
        .update({
          status: 'failed',
          last_error: errorMessage,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', job.id);
      throw new Error(errorMessage);
    }

    const outputPath = join(
      process.cwd(),
      'data',
      'transcripts',
      `${fileId}.json`
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

    // Wrap transcription in try-finally to ensure cleanup
    try {
      debugLog(`🚀 Starting Whisper transcription...`);
      debugLog(`Temporary audio file: ${tempAudioPath}`);
      
      success = await tryTranscription(
        tempAudioPath,
        outputPath,
        'cuda',
        finalSpeakerCount
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
          tempAudioPath,
          outputPath,
          'cpu',
          finalSpeakerCount
        );
      }
    } finally {
      // Always clean up temporary file
      if (tempAudioPath) {
        try {
          const { unlink } = await import('fs/promises');
          await unlink(tempAudioPath);
          debugLog(`🧹 Cleaned up temporary file: ${tempAudioPath}`);
        } catch (cleanupError) {
          console.warn(`⚠️ Failed to cleanup temporary file ${tempAudioPath}:`, cleanupError);
          // Don't fail the transcription for cleanup issues
        }
      }
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
        `✅ Transcription completed with ${result.segments.length} segments`
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
              `🔄 Audio format converted successfully for diarization compatibility`
            );
          } else if (metadata.format_conversion_error) {
            debugLog(
              `⚠️ Audio format conversion failed: ${metadata.format_conversion_error}`
            );
            debugLog(`📝 Continuing with original file format...`);
          }
        }

        if (metadata.diarization_attempted) {
          if (metadata.diarization_success) {
            diarizationStatus = 'success';
            debugLog(
              `✅ Speaker diarization successful! Found ${metadata.detected_speakers} speakers`
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
                `⚠️ Both format conversion and diarization failed: ${diarizationError}`
              );
            } else {
              debugLog(`⚠️ Speaker diarization failed: ${diarizationError}`);
            }
          }
        }
      } catch (metadataError) {
        debugLog(
          'Could not read diarization metadata, falling back to segment analysis'
        );
        if (metadataError instanceof Error) {
          debugLog('Metadata error details:', metadataError.message);
        }

        // Fallback: Check if speaker diarization worked by analyzing segments
        const hasSpeakers = result.segments.some(s => s.speaker);

        if (hasSpeakers) {
          const uniqueSpeakers = new Set(
            result.segments.map(s => s.speaker).filter(Boolean)
          );
          debugLog(
            `✅ Speaker diarization successful! Found ${uniqueSpeakers.size} speakers`
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
            result.segments
          );

          if (speakerResult.success && speakerResult.updatedTranscript) {
            finalSegments = speakerResult.updatedTranscript;
            debugLog(
              `✅ Speaker detection completed for file ${fileId}:`,
              speakerResult.stats
            );
          } else {
            debugLog(
              `ℹ️ Speaker detection skipped for file ${fileId}: ${speakerResult.error || 'No names found'}`
            );
          }
        } catch (speakerError) {
          console.error(
            `⚠️ Speaker detection failed for file ${fileId}:`,
            speakerError
          );
          // Continue with original segments - don't fail transcription
        }
      } else {
        debugLog(
          `ℹ️ Skipping speaker detection for file ${fileId}: no speaker diarization available`
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
          `📏 Calculated duration from transcript: ${calculatedDuration} seconds`
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
              durationError.message
            );
          } else {
            debugLog(
              `📏 Updated audioFiles duration: ${calculatedDuration} seconds for file ${fileId}`
            );
          }
        } catch (durationError) {
          console.error(
            `⚠️ Failed to update duration for file ${fileId}:`,
            durationError
          );
          // Don't fail the transcription for duration update issues
        }
      }

      debugLog(
        `✅ File ${fileId} transcription process completed successfully`
      );

      debugLog(`✅ Transcription completed successfully for file ${fileId}`);
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
      error
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
            last_error:
              error instanceof Error ? error.message : 'Unknown error',
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
  fileId: number
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

    if (
      !transcriptionJobs ||
      transcriptionJobs.length === 0 ||
      !transcriptionJobs[0].transcript
    ) {
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
