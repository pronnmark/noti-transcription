import { ValidationUtils, FileValidationOptions } from '../../utils/validation';
import { configManager } from '../../utils/configuration';

/**
 * FileValidator - Single Responsibility: File validation logic
 * Extracted from FileUploadService to follow SRP
 */
export class FileValidator {
  private static readonly DEFAULT_AUDIO_MIME_TYPES = [
    'audio/mpeg',
    'audio/wav',
    'audio/mp3',
    'audio/mp4',
    'audio/webm',
    'audio/ogg',
    'audio/m4a',
    'audio/x-m4a',
    'audio/flac',
    'audio/x-flac',
    'audio/aac',
    'audio/x-aac',
  ];

  private static readonly DEFAULT_AUDIO_EXTENSIONS = [
    'mp3', 'wav', 'm4a', 'mp4', 'webm', 'ogg', 'flac', 'aac'
  ];

  /**
   * Validate uploaded file for audio processing
   */
  static validateAudioFile(file: File): void {
    const appConfig = configManager.getAppConfig();
    
    const options: FileValidationOptions = {
      maxSize: appConfig.maxFileSize,
      allowedMimeTypes: this.DEFAULT_AUDIO_MIME_TYPES,
      allowedExtensions: this.DEFAULT_AUDIO_EXTENSIONS,
      requireExtension: true,
    };

    ValidationUtils.validateFile(file, options);
  }

  /**
   * Validate file buffer data
   */
  static validateFileBuffer(buffer: Buffer, originalFileName: string): void {
    if (!buffer || buffer.length === 0) {
      throw new Error('File buffer is empty');
    }

    // Validate file extension from name
    const extension = originalFileName.split('.').pop()?.toLowerCase();
    if (!extension || !this.DEFAULT_AUDIO_EXTENSIONS.includes(extension)) {
      throw new Error(`Unsupported file extension: ${extension}`);
    }
  }

  /**
   * Validate upload options
   */
  static validateUploadOptions(options: {
    speakerCount?: number;
    isDraft?: boolean;
    allowDuplicates?: boolean;
    location?: {
      latitude: number;
      longitude: number;
      accuracy?: number;
      timestamp?: number;
      provider?: string;
    };
  }): void {
    if (options.speakerCount !== undefined) {
      ValidationUtils.validateSpeakerCount(options.speakerCount);
    }

    if (options.location) {
      ValidationUtils.validateLocation(options.location);
    }
  }

  /**
   * Check if file format needs conversion for transcription
   */
  static needsFormatConversion(fileName: string): boolean {
    const extension = fileName.split('.').pop()?.toLowerCase();
    // Only WAV files don't need conversion for Whisper
    return extension !== 'wav';
  }

  /**
   * Get supported file formats for client validation
   */
  static getSupportedFormats(): {
    mimeTypes: string[];
    extensions: string[];
    maxSize: number;
  } {
    const appConfig = configManager.getAppConfig();
    
    return {
      mimeTypes: this.DEFAULT_AUDIO_MIME_TYPES,
      extensions: this.DEFAULT_AUDIO_EXTENSIONS,
      maxSize: appConfig.maxFileSize,
    };
  }

  /**
   * Validate file for specific processing requirements
   */
  static validateForProcessing(
    file: File,
    processingType: 'transcription' | 'analysis' | 'storage'
  ): void {
    this.validateAudioFile(file);

    switch (processingType) {
      case 'transcription':
        // Additional validation for transcription
        if (file.size < 1024) { // 1KB minimum
          throw new Error('Audio file too small for transcription');
        }
        break;
        
      case 'analysis':
        // Additional validation for AI analysis
        if (file.size > 50 * 1024 * 1024) { // 50MB max for analysis
          throw new Error('File too large for AI analysis (max 50MB)');
        }
        break;
        
      case 'storage':
        // Standard storage validation (already done in validateAudioFile)
        break;
    }
  }
}