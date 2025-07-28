import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import { join } from 'path';
import { getDb } from '../../../lib/database/client';
import { audioFiles } from '../../../lib/database/schema/audio';
import { transcriptionJobs } from '../../../lib/database/schema/transcripts';
import { processTranscriptionJobs } from '../../../lib/transcriptionWorker';
import { extractAudioMetadata } from '../../../lib/services/audioMetadata';

export const runtime = 'nodejs';

// Configure API route for large file uploads
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '100mb',
    },
  },
};

// For App Router, we also need to set maxDuration if needed
export const maxDuration = 60; // 60 seconds

// Debug logging (can be disabled by setting DEBUG_API=false)
const DEBUG_API = process.env.DEBUG_API !== 'false';
const debugLog = (...args: unknown[]) => {
  if (DEBUG_API) {
    console.log(...args);
  }
};

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
    debugLog(`Unknown MIME type: ${mimeType} for extension: ${extension} - proceeding based on extension`);
  }

  return { valid: true };
}

export async function POST(request: NextRequest) {
  try {
    // Debug logging
    debugLog('Upload request received');
    debugLog('Content-Type:', request.headers.get('content-type'));
    debugLog('Content-Length:', request.headers.get('content-length'));
    
    // Check body size
    const contentLength = request.headers.get('content-length');
    if (contentLength) {
      const sizeInMB = parseInt(contentLength) / (1024 * 1024);
      debugLog(`Body size: ${sizeInMB.toFixed(2)} MB`);
    }
    
    let formData;
    try {
      formData = await request.formData();
      debugLog('FormData parsed successfully');
    } catch (parseError) {
      debugLog('FormData parsing failed:', parseError);
      
      // Try to get more info about the error
      const errorInfo = {
        message: parseError instanceof Error ? parseError.message : String(parseError),
        name: parseError instanceof Error ? parseError.name : 'Unknown',
        contentType: request.headers.get('content-type'),
        contentLength: request.headers.get('content-length'),
        hasBody: !!request.body
      };
      
      debugLog('Error details:', errorInfo);
      
      return NextResponse.json(
        { 
          error: `Failed to parse form data: ${errorInfo.message}`,
          details: errorInfo
        },
        { status: 400 }
      );
    }

    // Get all files from formData (support both single and multiple files)
    const files: File[] = [];
    
    // Check for multiple files (files[] format)
    const multipleFiles = formData.getAll('files');
    if (multipleFiles.length > 0) {
      multipleFiles.forEach(item => {
        if (item instanceof File) {
          files.push(item);
        }
      });
    }
    
    // Check for single file (backward compatibility)
    if (files.length === 0) {
      const singleFile = formData.get('file') || formData.get('audio');
      if (singleFile instanceof File) {
        files.push(singleFile);
      }
    }

    if (files.length === 0) {
      return NextResponse.json({
        error: 'No files provided',
        receivedFields: Array.from(formData.keys()),
        hint: 'Expected field name: files[] for multiple files or file/audio for single file',
      }, { status: 400 });
    }

    // Validate all files first
    const results: Array<{
      success: boolean;
      fileId?: number;
      fileName?: string;
      error?: string;
    }> = [];

    // Extract and validate speaker count (optional, applies to all files)
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
      debugLog(`User specified ${speakerCount} speakers for diarization`);
    }

    // Extract location data (optional, applies to all files)
    const locationData: {
      latitude?: number;
      longitude?: number;
      accuracy?: number;
      timestamp?: number;
      provider?: string;
    } = {};

    const latitudeField = formData.get('latitude');
    const longitudeField = formData.get('longitude');
    const accuracyField = formData.get('locationAccuracy');
    const timestampField = formData.get('locationTimestamp');
    const providerField = formData.get('locationProvider');

    if (latitudeField && longitudeField) {
      const latitude = parseFloat(latitudeField.toString());
      const longitude = parseFloat(longitudeField.toString());

      // Basic validation for geographic coordinates
      if (isNaN(latitude) || isNaN(longitude) ||
          latitude < -90 || latitude > 90 ||
          longitude < -180 || longitude > 180) {
        debugLog('Invalid location coordinates provided:', { latitude, longitude });
      } else {
        locationData.latitude = latitude;
        locationData.longitude = longitude;

        if (accuracyField) {
          const accuracy = parseInt(accuracyField.toString());
          if (!isNaN(accuracy) && accuracy > 0) {
            locationData.accuracy = accuracy;
          }
        }

        if (timestampField) {
          const timestamp = parseInt(timestampField.toString());
          if (!isNaN(timestamp) && timestamp > 0) {
            locationData.timestamp = timestamp;
          }
        }

        if (providerField && ['gps', 'network', 'passive'].includes(providerField.toString())) {
          locationData.provider = providerField.toString();
        }

        debugLog('📍 Location data received:', locationData);
      }
    }

    // Process each file
    for (const file of files) {
      try {
        // Validate audio format
        const formatValidation = validateAudioFormat(file);
        if (!formatValidation.valid) {
          results.push({
            success: false,
            fileName: file.name,
            error: formatValidation.error,
          });
          continue;
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
          debugLog(`Extracted metadata - Duration: ${duration}s, Recording date: ${recordedAt ? recordedAt.toISOString() : 'none'}`);
        } catch (error) {
          debugLog('Failed to extract audio metadata:', error);
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
          // Include location data if available
          latitude: locationData.latitude || null,
          longitude: locationData.longitude || null,
          locationAccuracy: locationData.accuracy || null,
          locationTimestamp: locationData.timestamp ? new Date(locationData.timestamp) : null,
          locationProvider: locationData.provider || null,
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

        results.push({
          success: true,
          fileId: record.id,
          fileName: record.fileName,
        });

        debugLog(`✅ Successfully processed file: ${file.name} (ID: ${record.id})`);

      } catch (error) {
        console.error(`❌ Failed to process file ${file.name}:`, error);
        results.push({
          success: false,
          fileName: file.name,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Auto-trigger transcription worker for all successfully uploaded files (non-blocking)
    const successfulUploads = results.filter(r => r.success).length;
    if (successfulUploads > 0) {
      setImmediate(async () => {
        try {
          debugLog(`Starting transcription worker for ${successfulUploads} newly uploaded files...`);
          const result = await processTranscriptionJobs();
          debugLog('Transcription worker completed:', result);
        } catch (error) {
          console.error('Error in transcription worker:', error);
        }
      });
    }

    // Return results summary
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    return NextResponse.json({
      success: successCount > 0,
      totalFiles: files.length,
      successCount,
      failureCount,
      results,
      speakerCount: speakerCount || null,
      speakerDetection: speakerCount ? 'user_specified' : 'auto_detect',
      locationCaptured: !!(locationData.latitude && locationData.longitude),
      locationProvider: locationData.provider || null,
    });

  } catch (error: any) {
    console.error('Upload error:', error);
    return NextResponse.json({
      error: error.message,
      stack: error.stack,
    }, { status: 500 });
  }
}
