import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import { join } from 'path';
import { getDb } from '../../../lib/database/client';
import { audioFiles } from '../../../lib/database/schema/audio';
import { transcriptionJobs } from '../../../lib/database/schema/transcripts';
import { processTranscriptionJobs } from '../../../lib/transcriptionWorker';
import { extractAudioMetadata } from '../../../lib/services/audioMetadata';

export const runtime = 'nodejs';

// Whisper-supported audio formats (from OpenAI Whisper API documentation)
const SUPPORTED_FORMATS = ['flac', 'm4a', 'mp3', 'mp4', 'mpeg', 'mpga', 'oga', 'ogg', 'wav', 'webm'];
const SUPPORTED_MIME_TYPES = [
  'audio/flac', 'audio/x-flac',
  'audio/mp4', 'audio/x-m4a',
  'audio/mpeg', 'audio/mp3',
  'video/mp4',
  'audio/mpeg',
  'audio/x-mpga',
  'audio/ogg', 'application/ogg',
  'audio/ogg',
  'audio/wav', 'audio/x-wav',
  'video/webm', 'audio/webm',
];

function getFileExtension(filename: string): string {
  return filename.toLowerCase().split('.').pop() || '';
}

function validateAudioFormat(file: File): { valid: boolean; error?: string } {
  const extension = getFileExtension(file.name);
  const mimeType = file.type.toLowerCase();

  // Check file extension
  if (!SUPPORTED_FORMATS.includes(extension)) {
    return {
      valid: false,
      error: `Unsupported file format: .${extension}. Supported formats: ${SUPPORTED_FORMATS.join(', ')}`,
    };
  }

  // If MIME type is provided, validate it too
  if (mimeType && !SUPPORTED_MIME_TYPES.includes(mimeType)) {
    console.warn(`Unknown MIME type: ${mimeType} for extension: ${extension} - proceeding based on extension`);
  }

  return { valid: true };
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    // Try both common field names
    const file = formData.get('file') || formData.get('audio');

    if (!file || !(file instanceof File)) {
      return NextResponse.json({
        error: 'No file provided',
        receivedFields: Array.from(formData.keys()),
        hint: 'Expected field name: file or audio',
      }, { status: 400 });
    }

    // Validate audio format
    const formatValidation = validateAudioFormat(file);
    if (!formatValidation.valid) {
      return NextResponse.json({
        error: formatValidation.error,
        supportedFormats: SUPPORTED_FORMATS,
      }, { status: 400 });
    }

    // Extract and validate speaker count (optional)
    let speakerCount: number | undefined;
    const speakerCountField = formData.get('speakerCount');
    if (speakerCountField) {
      const parsedCount = parseInt(speakerCountField.toString());
      if (isNaN(parsedCount) || parsedCount < 1 || parsedCount > 10) {
        return NextResponse.json({
          error: 'Invalid speaker count. Must be a number between 1 and 10.',
          providedValue: speakerCountField.toString(),
        }, { status: 400 });
      }
      speakerCount = parsedCount;
      console.log(`User specified ${speakerCount} speakers for diarization`);
    }

    // Create upload directory
    const uploadDir = join(process.cwd(), 'data', 'audio_files');
    await fs.mkdir(uploadDir, { recursive: true });

    // Save file with simple timestamp name
    const fileName = `${Date.now()}_${file.name}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    const filePath = join(uploadDir, fileName);
    await fs.writeFile(filePath, buffer);

    // Extract complete audio metadata (duration, recording date, etc.)
    let recordedAt: Date | null = null;
    let duration: number = 0;
    try {
      const metadata = await extractAudioMetadata(filePath);
      recordedAt = metadata.recordedAt || null;
      duration = metadata.duration || 0;
      console.log(`Extracted metadata - Duration: ${duration}s, Recording date: ${recordedAt ? recordedAt.toISOString() : 'none'}`);
    } catch (error) {
      console.warn('Failed to extract audio metadata:', error);
      // Continue with defaults - not a critical error
    }

    // Save to database
    const db = getDb();
    const [record] = await db.insert(audioFiles).values({
      fileName,
      originalFileName: file.name,
      originalFileType: file.type || 'audio/mpeg',
      fileSize: file.size,
      fileHash: null,
      duration: duration,
      recordedAt: recordedAt,
    }).returning();

    // Create transcription job
    await db.insert(transcriptionJobs).values({
      fileId: record.id,
      status: 'pending',
      modelSize: 'large-v3',
      diarization: true,
      speakerCount: speakerCount,
      progress: 0,
    });

    // Auto-trigger transcription worker (non-blocking)
    // This runs in the background without blocking the upload response
    setImmediate(async () => {
      try {
        console.log('Starting transcription worker for newly uploaded file...');
        const result = await processTranscriptionJobs();
        console.log('Transcription worker completed:', result);
      } catch (error) {
        console.error('Error in transcription worker:', error);
      }
    });

    return NextResponse.json({
      success: true,
      fileId: record.id,
      fileName: record.fileName,
      transcriptionStatus: 'pending',
      speakerCount: speakerCount || null,
      speakerDetection: speakerCount ? 'user_specified' : 'auto_detect',
    });

  } catch (error: any) {
    console.error('Upload error:', error);
    return NextResponse.json({
      error: error.message,
      stack: error.stack,
    }, { status: 500 });
  }
}
