import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { validateSession } from '../../../../lib/auth';
import { getDb } from '../../../../lib/database/client';
import { audioFiles, transcriptionJobs } from '../../../../lib/database/schema';
import { eq } from 'drizzle-orm';
import { exec } from 'child_process';
import { promisify } from 'util';
import { promises as fs } from 'fs';
import { join } from 'path';

// Debug logging (can be disabled by setting DEBUG_API=false)
const DEBUG_API = process.env.DEBUG_API !== 'false';
const debugLog = (...args: unknown[]) => {
  if (DEBUG_API) {
    console.log(...args);
  }
};

const execAsync = promisify(exec);

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    // Check auth
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value;
    if (!await validateSession(token)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const fileId = parseInt(params.id);
    if (isNaN(fileId)) {
      return NextResponse.json({ error: 'Invalid file ID' }, { status: 400 });
    }

    // Get file from database
    const db = getDb();
    const [file] = await db.select().from(audioFiles).where(eq(audioFiles.id, fileId)).limit(1);

    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    // Check if transcription job already exists
    const existingJobs = await db.select()
      .from(transcriptionJobs)
      .where(eq(transcriptionJobs.fileId, fileId))
      .limit(1);

    if (existingJobs.length > 0) {
      return NextResponse.json({
        message: 'Transcription already exists',
        job: existingJobs[0],
      });
    }

    // Create transcription job
    const [job] = await db.insert(transcriptionJobs).values({
      fileId: fileId,
      status: 'processing',
      modelSize: 'base',
      diarization: true,
      progress: 0,
      startedAt: new Date(),
    }).returning();

    // Start transcription in background (fire and forget)
    transcribeInBackground(file, job.id).catch(error => {
      console.error('Background transcription failed:', error);
    });

    return NextResponse.json({
      success: true,
      message: 'Transcription started',
      jobId: job.id,
    });

  } catch (error: any) {
    console.error('Transcribe error:', error);
    return NextResponse.json({
      error: error.message || 'Transcription failed',
    }, { status: 500 });
  }
}

async function transcribeInBackground(file: any, jobId: number) {
  const db = getDb();

  try {
    // Update job status
    await db.update(transcriptionJobs)
      .set({ status: 'processing', progress: 10 })
      .where(eq(transcriptionJobs.id, jobId));

    // Path to audio file
    const audioPath = join(process.cwd(), 'data', 'audio_files', file.file_name);

    // Check if file exists
    await fs.access(audioPath);

    // Convert to WAV if needed (Whisper works better with WAV)
    const wavPath = audioPath.replace(/\.[^/.]+$/, '.wav');
    if (!audioPath.endsWith('.wav')) {
      debugLog('Converting to WAV...');
      await execAsync(`ffmpeg -i "${audioPath}" -ar 16000 -ac 1 -c:a pcm_s16le "${wavPath}" -y`);
    }

    // Update progress
    await db.update(transcriptionJobs)
      .set({ progress: 30 })
      .where(eq(transcriptionJobs.id, jobId));

    // Run Whisper transcription using Python script
    const pythonScript = join(process.cwd(), 'scripts', 'transcribe.py');
    debugLog('Running transcription...');

    const { stdout, stderr } = await execAsync(
      `python3 "${pythonScript}" "${wavPath}" --model base --language en`,
      { maxBuffer: 10 * 1024 * 1024 }, // 10MB buffer
    );

    if (stderr) {
      debugLog('Transcription warnings:', stderr);
    }

    // Parse transcription result (assuming JSON output)
    let transcript;
    try {
      transcript = JSON.parse(stdout);
    } catch (e) {
      // If not JSON, treat as plain text
      transcript = { text: stdout.trim(), segments: [] };
    }

    // Update job with results
    await db.update(transcriptionJobs)
      .set({
        status: 'completed',
        progress: 100,
        transcript: transcript.segments || [{ text: transcript.text || stdout.trim(), start: 0, end: 0 }],
        completedAt: new Date(),
      })
      .where(eq(transcriptionJobs.id, jobId));

    debugLog('Transcription completed for job:', jobId);

    // Clean up WAV file if we created it
    if (!audioPath.endsWith('.wav')) {
      await fs.unlink(wavPath).catch(() => {});
    }

  } catch (error) {
    console.error('Transcription error:', error);

    // Update job status to failed
    await db.update(transcriptionJobs)
      .set({
        status: 'failed',
        lastError: error instanceof Error ? error.message : 'Unknown error',
        completedAt: new Date(),
      })
      .where(eq(transcriptionJobs.id, jobId));
  }
}
