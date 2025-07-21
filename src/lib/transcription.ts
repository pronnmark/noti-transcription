import { spawn } from "child_process";
import { join } from "path";
import { readFile } from "fs/promises";
import { AudioService } from "./services/core/AudioService";
import { detectAndApplySpeakerNames } from "./services/speakerDetectionService";
import type { TranscriptSegment } from "./database/schema";
import { getDb } from "./database/client";
import { transcriptionJobs } from "./database/schema/transcripts";
import { eq, desc } from "drizzle-orm";

const audioService = new AudioService();

// Transcription settings - matching SvelteKit version
const HUGGINGFACE_TOKEN = process.env.HUGGINGFACE_TOKEN;
const MODEL_SIZE = "large-v3"; // Always use the biggest, most accurate model
const ENABLE_DIARIZATION = true; // Always enable speaker detection

export interface TranscriptionResult {
  segments: TranscriptSegment[];
}

// Helper function to try transcription with specific device
async function tryTranscription(
  audioPath: string,
  outputPath: string,
  device: "cuda" | "cpu",
  speakerCount?: number
): Promise<boolean> {
  const scriptPath = join(process.cwd(), "scripts", "transcribe.py");
  const pythonPath = join(process.cwd(), "venv", "bin", "python");

  const args = [
    scriptPath,
    "--audio-file",
    audioPath,
    "--output-file",
    outputPath,
    "--model-size",
    MODEL_SIZE,
    "--language",
    "sv",
    "--device",
    device,
    "--enable-diarization",
  ];

  // Add speaker count if specified
  if (speakerCount && speakerCount > 1) {
    args.push("--num-speakers", speakerCount.toString());
  }

  const envVars = {
    ...process.env,
    // ALWAYS include HuggingFace token for speaker diarization (with hardcoded fallback)
    HUGGINGFACE_TOKEN: HUGGINGFACE_TOKEN,
    // Set Python path to include our venv
    PYTHONPATH: join(
      process.cwd(),
      "venv",
      "lib",
      "python3.12",
      "site-packages"
    ),
    // GPU environment variables - try multiple CUDA paths
    ...(device === "cuda"
      ? {
          CUDA_VISIBLE_DEVICES: "0",
          PYTORCH_CUDA_ALLOC_CONF: "max_split_size_mb:512",
          LD_LIBRARY_PATH: [
            "/usr/local/cuda/lib64",
            "/usr/lib/x86_64-linux-gnu",
            `${process.cwd()}/venv/lib/python3.12/site-packages/nvidia/cudnn/lib`,
            `${process.cwd()}/venv/lib/python3.12/site-packages/nvidia/cuda_runtime/lib`,
            `${process.cwd()}/venv/lib/python3.12/site-packages/nvidia/cublas/lib`,
            process.env.LD_LIBRARY_PATH || "",
          ]
            .filter(Boolean)
            .join(":"),
        }
      : {}),
  };

  console.log(`Trying transcription with ${device.toUpperCase()}:`, args);
  console.log(`Environment variables for ${device.toUpperCase()}:`);
  console.log(
    `  HUGGINGFACE_TOKEN: ${envVars.HUGGINGFACE_TOKEN ? "SET" : "NOT SET"}`
  );
  console.log(`  PYTHONPATH: ${envVars.PYTHONPATH}`);
  if (device === "cuda") {
    console.log(`  CUDA_VISIBLE_DEVICES: ${envVars.CUDA_VISIBLE_DEVICES}`);
    console.log(`  LD_LIBRARY_PATH: ${envVars.LD_LIBRARY_PATH}`);
  }

  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      console.error(
        `❌ ${device.toUpperCase()} transcription timed out after 10 minutes`
      );
      pythonProcess.kill("SIGTERM");
      resolve(false);
    }, 10 * 60 * 1000); // 10 minute timeout

    const pythonProcess = spawn(pythonPath, args, {
      cwd: process.cwd(),
      env: envVars,
    });

    let stderrOutput = "";
    let stdoutOutput = "";

    pythonProcess.stdout.on("data", (data) => {
      const output = data.toString();
      stdoutOutput += output;
      console.log(`${device.toUpperCase()} stdout:`, output.trim());
    });

    pythonProcess.stderr.on("data", (data) => {
      const output = data.toString();
      stderrOutput += output;
      // Only log important stderr messages, not warnings
      if (
        output.includes("Error") ||
        output.includes("Failed") ||
        output.includes("Exception")
      ) {
        console.error(`${device.toUpperCase()} stderr:`, output.trim());
      }
    });

    pythonProcess.on("close", (code) => {
      clearTimeout(timeout);

      if (code === 0) {
        console.log(
          `✅ ${device.toUpperCase()} transcription completed successfully!`
        );
        resolve(true);
      } else {
        console.error(
          `❌ ${device.toUpperCase()} transcription failed with code ${code}`
        );

        // Log relevant error information
        if (
          stderrOutput.includes("Error") ||
          stderrOutput.includes("Exception")
        ) {
          console.error(
            "Error details:",
            stderrOutput
              .split("\n")
              .filter(
                (line) =>
                  line.includes("Error") ||
                  line.includes("Exception") ||
                  line.includes("Traceback")
              )
              .slice(-5)
          );
        }

        // Check if it's a CUDA error that should trigger fallback
        const isCudaError =
          device === "cuda" &&
          (stderrOutput.includes("libcudnn") ||
            stderrOutput.includes("CUDA out of memory") ||
            stderrOutput.includes("cuDNN") ||
            stderrOutput.includes("core dumped") ||
            code === 134 ||
            code === null); // Process killed

        if (isCudaError) {
          console.log("🔄 CUDA error detected, will try CPU fallback");
        }

        resolve(false);
      }
    });

    pythonProcess.on("error", (err) => {
      clearTimeout(timeout);
      console.error(`${device.toUpperCase()} process error:`, err);
      resolve(false);
    });
  });
}

export async function startTranscription(
  fileId: number,
  audioPath: string,
  speakerCount?: number
): Promise<void> {
  const db = getDb();
  
  try {
    console.log(
      `🚀 Starting transcription for file ${fileId} with ${MODEL_SIZE} model...`
    );
    console.log(`Audio path: ${audioPath}`);
    console.log(
      `Speaker diarization: ${ENABLE_DIARIZATION ? "enabled" : "disabled"}`
    );
    // Note: Speaker count will be read from database job or fallback to parameter

    // Get the transcription job
    const jobs = await db.select()
      .from(transcriptionJobs)
      .where(eq(transcriptionJobs.fileId, fileId))
      .orderBy(transcriptionJobs.createdAt)
      .limit(1);
    
    if (jobs.length === 0) {
      throw new Error(`No transcription job found for file ${fileId}`);
    }
    
    const job = jobs[0];
    
    // Use speaker count from database (user-specified) or fallback to parameter
    const finalSpeakerCount = job.speakerCount || speakerCount;
    if (finalSpeakerCount) {
      console.log(`Using speaker count: ${finalSpeakerCount} ${job.speakerCount ? '(user-specified)' : '(parameter)'}`);
    } else {
      console.log('No speaker count specified - will auto-detect');
    }
    
    // Update job to processing status
    await db.update(transcriptionJobs)
      .set({ 
        status: 'processing',
        startedAt: new Date(),
        progress: 10,
        diarizationStatus: 'in_progress'
      })
      .where(eq(transcriptionJobs.id, job.id));

    // Validate audio file exists
    try {
      await readFile(audioPath);
    } catch (error) {
      await db.update(transcriptionJobs)
        .set({ 
          status: 'failed',
          lastError: `Audio file not found: ${audioPath}`,
          completedAt: new Date()
        })
        .where(eq(transcriptionJobs.id, job.id));
      throw new Error(`Audio file not found: ${audioPath}`);
    }

    const outputPath = join(
      process.cwd(),
      "data",
      "transcripts",
      `${fileId}.json`
    );
    console.log(`Output path: ${outputPath}`);
    
    // Ensure transcripts directory exists
    const transcriptsDir = join(process.cwd(), "data", "transcripts");
    const fs = require('fs');
    if (!fs.existsSync(transcriptsDir)) {
      fs.mkdirSync(transcriptsDir, { recursive: true });
      console.log(`Created transcripts directory: ${transcriptsDir}`);
    }

    // Update progress
    await db.update(transcriptionJobs)
      .set({ progress: 20 })
      .where(eq(transcriptionJobs.id, job.id));

    // Try GPU first, then fallback to CPU
    let success = false;

    console.log(`🚀 Starting GPU transcription with ${MODEL_SIZE} model...`);
    success = await tryTranscription(
      audioPath,
      outputPath,
      "cuda",
      finalSpeakerCount
    );

    if (!success) {
      console.log("🔄 GPU transcription failed, falling back to CPU...");
      // Update progress
      await db.update(transcriptionJobs)
        .set({ progress: 50 })
        .where(eq(transcriptionJobs.id, job.id));
      
      success = await tryTranscription(
        audioPath,
        outputPath,
        "cpu",
        finalSpeakerCount
      );
    }

    if (success) {
      // Update progress
      await db.update(transcriptionJobs)
        .set({ progress: 80 })
        .where(eq(transcriptionJobs.id, job.id));
      
      // Verify the output file exists and is valid
      let result: TranscriptionResult;
      try {
        const transcriptData = await readFile(outputPath, "utf-8");
        result = JSON.parse(transcriptData);

        if (!result.segments || !Array.isArray(result.segments)) {
          throw new Error("Invalid transcript format: missing segments array");
        }
      } catch (parseError) {
        const errorMsg = `Failed to read transcript file: ${
          parseError instanceof Error ? parseError.message : "Unknown error"
        }`;
        
        await db.update(transcriptionJobs)
          .set({ 
            status: 'failed',
            lastError: errorMsg,
            completedAt: new Date()
          })
          .where(eq(transcriptionJobs.id, job.id));
        
        throw new Error(errorMsg);
      }

      console.log(
        `✅ Transcription completed with ${result.segments.length} segments`
      );

      // Read metadata file to get diarization and format conversion status
      let diarizationStatus: 'success' | 'no_speakers_detected' | 'failed' = 'no_speakers_detected';
      let diarizationError: string | null = null;
      
      try {
        const metadataPath = outputPath.replace('.json', '_metadata.json');
        const metadataData = await readFile(metadataPath, "utf-8");
        const metadata = JSON.parse(metadataData);
        
        console.log('Transcription metadata:', metadata);
        
        // Log format conversion information
        if (metadata.format_conversion_attempted) {
          if (metadata.format_conversion_success) {
            console.log(`🔄 Audio format converted successfully for diarization compatibility`);
          } else if (metadata.format_conversion_error) {
            console.log(`⚠️ Audio format conversion failed: ${metadata.format_conversion_error}`);
            console.log(`📝 Continuing with original file format...`);
          }
        }
        
        if (metadata.diarization_attempted) {
          if (metadata.diarization_success) {
            diarizationStatus = 'success';
            console.log(`✅ Speaker diarization successful! Found ${metadata.detected_speakers} speakers`);
          } else if (metadata.diarization_error) {
            diarizationStatus = 'failed';
            diarizationError = metadata.diarization_error;
            
            // Enhanced error message if format conversion was attempted but failed
            if (metadata.format_conversion_attempted && !metadata.format_conversion_success) {
              diarizationError = `Format conversion failed (${metadata.format_conversion_error}), then diarization failed: ${metadata.diarization_error}`;
              console.log(`⚠️ Both format conversion and diarization failed: ${diarizationError}`);
            } else {
              console.log(`⚠️ Speaker diarization failed: ${diarizationError}`);
            }
          }
        }
      } catch (metadataError) {
        console.log('Could not read diarization metadata, falling back to segment analysis');
        if (metadataError instanceof Error) {
          console.log('Metadata error details:', metadataError.message);
        }
        
        // Fallback: Check if speaker diarization worked by analyzing segments
        const hasSpeakers = result.segments.some((s) => s.speaker);
        
        if (hasSpeakers) {
          const uniqueSpeakers = new Set(
            result.segments.map((s) => s.speaker).filter(Boolean)
          );
          console.log(
            `✅ Speaker diarization successful! Found ${uniqueSpeakers.size} speakers`
          );
          diarizationStatus = 'success';
        } else {
          console.log("⚠️ No speaker information found in transcript");
          // If no metadata file and no speakers, assume diarization wasn't attempted
          diarizationStatus = 'no_speakers_detected';
        }
      }

      // Apply speaker name detection if we have speakers
      let finalSegments = result.segments;
      if (diarizationStatus === 'success') {
        try {
          console.log(`🎯 Starting speaker name detection for file ${fileId}...`);
          const speakerResult = await detectAndApplySpeakerNames(result.segments);
          
          if (speakerResult.success && speakerResult.updatedTranscript) {
            finalSegments = speakerResult.updatedTranscript;
            console.log(`✅ Speaker detection completed for file ${fileId}:`, speakerResult.stats);
          } else {
            console.log(`ℹ️ Speaker detection skipped for file ${fileId}: ${speakerResult.error || 'No names found'}`);
          }
        } catch (speakerError) {
          console.error(`⚠️ Speaker detection failed for file ${fileId}:`, speakerError);
          // Continue with original segments - don't fail transcription
        }
      } else {
        console.log(`ℹ️ Skipping speaker detection for file ${fileId}: no speaker diarization available`);
      }

      // Update job as completed with the transcript (potentially with updated speaker names)
      await db.update(transcriptionJobs)
        .set({ 
          status: 'completed',
          progress: 100,
          transcript: finalSegments,
          diarizationStatus: diarizationStatus,
          diarizationError: diarizationError,
          completedAt: new Date()
        })
        .where(eq(transcriptionJobs.id, job.id));

      console.log(
        `✅ File ${fileId} transcription process completed successfully`
      );

      console.log(`✅ Transcription completed successfully for file ${fileId}`);
      // Note: Auto-extraction system has been removed for simplicity
    } else {
      await db.update(transcriptionJobs)
        .set({ 
          status: 'failed',
          lastError: 'Transcription failed on both GPU and CPU',
          diarizationStatus: 'failed',
          diarizationError: 'Transcription failed before diarization could be attempted',
          completedAt: new Date()
        })
        .where(eq(transcriptionJobs.id, job.id));
      
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
      const jobs = await db.select()
        .from(transcriptionJobs)
        .where(eq(transcriptionJobs.fileId, fileId))
        .orderBy(transcriptionJobs.createdAt)
        .limit(1);
      
      if (jobs.length > 0) {
        await db.update(transcriptionJobs)
          .set({ 
            status: 'failed',
            lastError: error instanceof Error ? error.message : 'Unknown error',
            diarizationStatus: 'failed',
            diarizationError: error instanceof Error ? error.message : 'Unknown error',
            completedAt: new Date()
          })
          .where(eq(transcriptionJobs.id, jobs[0].id));
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
    const db = getDb();
    
    // Query transcription job for this file
    const transcriptionJob = await db
      .select()
      .from(transcriptionJobs)
      .where(eq(transcriptionJobs.fileId, fileId))
      .orderBy(desc(transcriptionJobs.createdAt))
      .limit(1);
    
    if (!transcriptionJob.length || !transcriptionJob[0].transcript) {
      console.log(`No transcript found for file ${fileId}`);
      return null;
    }
    
    // Return transcript in expected format
    return {
      segments: transcriptionJob[0].transcript
    };
  } catch (error) {
    console.error(`Error getting transcript for file ${fileId}:`, error);
    return null;
  }
}
