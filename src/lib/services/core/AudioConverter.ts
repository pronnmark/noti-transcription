import { exec } from 'child_process';
import { promisify } from 'util';
import { join } from 'path';
import { promises as fs } from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { ErrorHandler } from '../../utils/errorHandler';

const execAsync = promisify(exec);

export interface ConversionOptions {
  outputFormat: 'wav' | 'mp3' | 'flac';
  sampleRate?: number;
  channels?: number;
  bitRate?: string;
  tempDir?: string;
}

export interface ConversionResult {
  outputPath: string;
  originalFormat: string;
  outputFormat: string;
  duration: number;
  sampleRate: number;
  channels: number;
}

/**
 * AudioConverter - Single Responsibility: Audio format conversion
 * Extracted from FileUploadService to follow SRP
 */
export class AudioConverter {
  private static readonly DEFAULT_TEMP_DIR = '/tmp';
  private static readonly DEFAULT_SAMPLE_RATE = 16000;
  private static readonly DEFAULT_CHANNELS = 1;

  /**
   * Convert audio file to WAV format for transcription
   */
  static async convertToWav(
    inputBuffer: Buffer, 
    originalFileName: string,
    options: Partial<ConversionOptions> = {}
  ): Promise<ConversionResult> {
    return await ErrorHandler.serviceMethod(async () => {
      const {
        sampleRate = this.DEFAULT_SAMPLE_RATE,
        channels = this.DEFAULT_CHANNELS,
        tempDir = this.DEFAULT_TEMP_DIR,
      } = options;

      const originalExt = originalFileName.split('.').pop()?.toLowerCase() || 'mp3';
      const tempFileName = `temp_${uuidv4()}`;
      const inputPath = join(tempDir, `${tempFileName}.${originalExt}`);
      const outputPath = join(tempDir, `${tempFileName}.wav`);

      try {
        // Write input buffer to temporary file
        await fs.writeFile(inputPath, inputBuffer);

        // Skip conversion if already WAV format
        if (originalExt === 'wav') {
          await fs.rename(inputPath, outputPath);
          const metadata = await this.extractAudioMetadata(outputPath);
          return {
            outputPath,
            originalFormat: 'wav',
            outputFormat: 'wav',
            ...metadata,
          };
        }

        // Convert to WAV using ffmpeg
        const ffmpegCommand = [
          'ffmpeg',
          `-i "${inputPath}"`,
          `-ar ${sampleRate}`,
          `-ac ${channels}`,
          '-c:a pcm_s16le',
          `"${outputPath}"`,
          '-y' // Overwrite output file
        ].join(' ');

        await execAsync(ffmpegCommand);

        // Extract metadata from converted file
        const metadata = await this.extractAudioMetadata(outputPath);

        // Clean up input file
        await fs.unlink(inputPath).catch(() => {});

        return {
          outputPath,
          originalFormat: originalExt,
          outputFormat: 'wav',
          ...metadata,
        };
      } catch (error) {
        // Clean up temporary files on error
        await fs.unlink(inputPath).catch(() => {});
        await fs.unlink(outputPath).catch(() => {});
        throw error;
      }
    }, {
      service: 'AudioConverter',
      operation: 'convertToWav',
      metadata: { 
        originalFileName,
        targetSampleRate: options.sampleRate,
        targetChannels: options.channels 
      }
    });
  }

  /**
   * Extract audio metadata using ffprobe
   */
  static async extractAudioMetadata(filePath: string): Promise<{
    duration: number;
    sampleRate: number;
    channels: number;
  }> {
    return await ErrorHandler.serviceMethod(async () => {
      // Get duration
      const durationCmd = `ffprobe -v quiet -show_entries format=duration -of csv=p=0 "${filePath}"`;
      const { stdout: durationOutput } = await execAsync(durationCmd);
      const duration = Math.round(parseFloat(durationOutput.trim()) || 0);

      // Get sample rate and channels
      const audioCmd = `ffprobe -v quiet -show_entries stream=sample_rate,channels -of csv=p=0 "${filePath}"`;
      const { stdout: audioOutput } = await execAsync(audioCmd);
      const [sampleRateStr, channelsStr] = audioOutput.trim().split(',');
      
      const sampleRate = parseInt(sampleRateStr, 10) || this.DEFAULT_SAMPLE_RATE;
      const channels = parseInt(channelsStr, 10) || this.DEFAULT_CHANNELS;

      return { duration, sampleRate, channels };
    }, {
      service: 'AudioConverter',
      operation: 'extractAudioMetadata',
      metadata: { filePath }
    });
  }

  /**
   * Convert audio buffer directly without file I/O (for supported formats)
   */
  static async convertBufferToWav(
    inputBuffer: Buffer,
    inputFormat: string
  ): Promise<Buffer> {
    return await ErrorHandler.serviceMethod(async () => {
      if (inputFormat.toLowerCase() === 'wav') {
        return inputBuffer; // No conversion needed
      }

      // For more complex conversions, we still need temporary files
      const tempDir = this.DEFAULT_TEMP_DIR;
      const tempFileName = `buffer_${uuidv4()}`;
      const inputPath = join(tempDir, `${tempFileName}.${inputFormat}`);
      const outputPath = join(tempDir, `${tempFileName}.wav`);

      try {
        await fs.writeFile(inputPath, inputBuffer);
        
        const ffmpegCommand = [
          'ffmpeg',
          `-i "${inputPath}"`,
          `-ar ${this.DEFAULT_SAMPLE_RATE}`,
          `-ac ${this.DEFAULT_CHANNELS}`,
          '-c:a pcm_s16le',
          `"${outputPath}"`,
          '-y'
        ].join(' ');

        await execAsync(ffmpegCommand);
        
        const outputBuffer = await fs.readFile(outputPath);
        
        // Clean up
        await fs.unlink(inputPath).catch(() => {});
        await fs.unlink(outputPath).catch(() => {});
        
        return outputBuffer;
      } catch (error) {
        // Clean up on error
        await fs.unlink(inputPath).catch(() => {});
        await fs.unlink(outputPath).catch(() => {});
        throw error;
      }
    }, {
      service: 'AudioConverter',
      operation: 'convertBufferToWav',
      metadata: { inputFormat, bufferSize: inputBuffer.length }
    });
  }

  /**
   * Check if ffmpeg is available
   */
  static async isFFmpegAvailable(): Promise<boolean> {
    try {
      await execAsync('ffmpeg -version');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get supported input formats
   */
  static async getSupportedFormats(): Promise<string[]> {
    try {
      const { stdout } = await execAsync('ffmpeg -formats');
      const formats = stdout
        .split('\n')
        .filter(line => line.includes('E') && (
          line.includes('mp3') ||
          line.includes('wav') ||
          line.includes('m4a') ||
          line.includes('mp4') ||
          line.includes('ogg') ||
          line.includes('flac') ||
          line.includes('aac')
        ))
        .map(line => line.split(' ').pop())
        .filter(Boolean);
      
      return formats as string[];
    } catch {
      // Return default supported formats if ffmpeg query fails
      return ['mp3', 'wav', 'm4a', 'mp4', 'ogg', 'flac', 'aac'];
    }
  }

  /**
   * Clean up temporary files
   */
  static async cleanupTempFiles(filePaths: string[]): Promise<void> {
    await Promise.all(
      filePaths.map(path => 
        fs.unlink(path).catch(error => 
          console.warn(`Failed to cleanup temp file ${path}:`, error)
        )
      )
    );
  }
}