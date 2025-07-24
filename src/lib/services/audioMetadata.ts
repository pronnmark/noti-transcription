import { spawn } from 'child_process';
import { promises as fs } from 'fs';

export interface AudioMetadata {
  duration?: number;
  recordedAt?: Date;
  format?: string;
  bitrate?: number;
  sampleRate?: number;
  channels?: number;
  fileSize?: number;
  creationTime?: Date;

  // Location metadata (from recording session)
  latitude?: number;
  longitude?: number;
  locationAccuracy?: number;
  locationTimestamp?: Date;
  locationProvider?: 'gps' | 'network' | 'passive';
}

/**
 * Extract comprehensive metadata from audio files using FFprobe
 */
export async function extractAudioMetadata(filePath: string): Promise<AudioMetadata> {
  try {
    // Check if file exists
    const stats = await fs.stat(filePath);

    // Run FFprobe to get metadata
    const metadata = await runFFprobe(filePath);

    return {
      duration: metadata.duration,
      recordedAt: metadata.recordedAt || metadata.creationTime || new Date(stats.birthtime),
      format: metadata.format,
      bitrate: metadata.bitrate,
      sampleRate: metadata.sampleRate,
      channels: metadata.channels,
      fileSize: stats.size,
      creationTime: metadata.creationTime,
    };
  } catch (error) {
    console.error('Failed to extract audio metadata:', error);

    // Fallback to file system stats
    try {
      const stats = await fs.stat(filePath);
      return {
        fileSize: stats.size,
        recordedAt: new Date(stats.birthtime), // Use file creation time as fallback
      };
    } catch (fallbackError) {
      console.error('Failed to get file stats:', fallbackError);
      return {};
    }
  }
}

interface FFprobeResult {
  duration?: number;
  recordedAt?: Date;
  creationTime?: Date;
  format?: string;
  bitrate?: number;
  sampleRate?: number;
  channels?: number;
}

/**
 * Run FFprobe to extract metadata from audio file
 */
function runFFprobe(filePath: string): Promise<FFprobeResult> {
  return new Promise((resolve, reject) => {
    const ffprobe = spawn('ffprobe', [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_format',
      '-show_streams',
      filePath,
    ]);

    let stdout = '';
    let stderr = '';

    ffprobe.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    ffprobe.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    ffprobe.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`FFprobe failed with code ${code}: ${stderr}`));
        return;
      }

      try {
        const data = JSON.parse(stdout);
        const result = parseFFprobeOutput(data);
        resolve(result);
      } catch (error) {
        reject(new Error(`Failed to parse FFprobe output: ${error}`));
      }
    });

    ffprobe.on('error', (error) => {
      reject(new Error(`Failed to spawn FFprobe: ${error.message}`));
    });
  });
}

/**
 * Parse FFprobe JSON output to extract relevant metadata
 */
function parseFFprobeOutput(data: any): FFprobeResult {
  const result: FFprobeResult = {};

  // Extract format information
  if (data.format) {
    result.duration = parseFloat(data.format.duration);
    result.format = data.format.format_name;
    result.bitrate = parseInt(data.format.bit_rate);

    // Look for creation time in format tags
    const tags = data.format.tags || {};
    result.creationTime = parseCreationTime(tags);
  }

  // Extract stream information (focus on first audio stream)
  if (data.streams && Array.isArray(data.streams)) {
    const audioStream = data.streams.find((stream: any) =>
      stream.codec_type === 'audio',
    );

    if (audioStream) {
      result.sampleRate = parseInt(audioStream.sample_rate);
      result.channels = parseInt(audioStream.channels);

      // Look for creation time in stream tags
      const streamTags = audioStream.tags || {};
      const streamCreationTime = parseCreationTime(streamTags);
      if (streamCreationTime && !result.creationTime) {
        result.creationTime = streamCreationTime;
      }
    }
  }

  // Set recordedAt to the most reliable timestamp we found
  result.recordedAt = result.creationTime;

  return result;
}

/**
 * Parse creation time from various tag formats
 */
function parseCreationTime(tags: Record<string, any>): Date | undefined {
  // Common creation time tag names in audio files
  const creationTimeKeys = [
    'creation_time',
    'date',
    'DATE',
    'recorded_date',
    'RECORDED_DATE',
    'recording_date',
    'RECORDING_DATE',
    'timestamp',
    'TIMESTAMP',
    'created',
    'CREATED',
    'encoded_date',
    'ENCODED_DATE',
    'tagged_date',
    'TAGGED_DATE',
    'time',
    'TIME',
    'original_date',
    'ORIGINAL_DATE',
  ];

  for (const key of creationTimeKeys) {
    const value = tags[key];
    if (value) {
      const parsed = parseTimestamp(value);
      if (parsed) {
        return parsed;
      }
    }
  }

  return undefined;
}

/**
 * Parse various timestamp formats
 */
function parseTimestamp(timestamp: string): Date | undefined {
  if (!timestamp || typeof timestamp !== 'string') {
    return undefined;
  }

  try {
    // Try ISO 8601 format first
    const isoDate = new Date(timestamp);
    if (!isNaN(isoDate.getTime())) {
      return isoDate;
    }

    // Try common date formats
    const formats = [
      /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/, // ISO format
      /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})/, // SQL datetime
      /^(\d{4})-(\d{2})-(\d{2})/, // Date only
      /^(\d{2})\/(\d{2})\/(\d{4})/, // MM/DD/YYYY
      /^(\d{2})-(\d{2})-(\d{4})/, // MM-DD-YYYY
    ];

    for (const format of formats) {
      if (format.test(timestamp)) {
        const parsed = new Date(timestamp);
        if (!isNaN(parsed.getTime())) {
          return parsed;
        }
      }
    }

    return undefined;
  } catch (error) {
    console.warn(`Failed to parse timestamp "${timestamp}":`, error);
    return undefined;
  }
}

/**
 * Extract recording date specifically (convenience function)
 */
export async function extractRecordingDate(filePath: string): Promise<Date | null> {
  try {
    const metadata = await extractAudioMetadata(filePath);
    return metadata.recordedAt || null;
  } catch (error) {
    console.error('Failed to extract recording date:', error);
    return null;
  }
}

/**
 * Batch extract metadata for multiple files
 */
export async function extractBatchMetadata(filePaths: string[]): Promise<Map<string, AudioMetadata>> {
  const results = new Map<string, AudioMetadata>();

  // Process files in parallel with a reasonable concurrency limit
  const concurrency = 5;
  for (let i = 0; i < filePaths.length; i += concurrency) {
    const batch = filePaths.slice(i, i + concurrency);
    const promises = batch.map(async (filePath) => {
      try {
        const metadata = await extractAudioMetadata(filePath);
        results.set(filePath, metadata);
      } catch (error) {
        console.error(`Failed to extract metadata for ${filePath}:`, error);
        results.set(filePath, {});
      }
    });

    await Promise.all(promises);
  }

  return results;
}
