import { useCallback } from 'react';

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export interface FileValidationResult {
  validFiles: File[];
  invalidFiles: { file: File; error: string }[];
}

const SUPPORTED_AUDIO_FORMATS = [
  'flac',
  'm4a',
  'mp3',
  'mp4',
  'mpeg',
  'mpga',
  'oga',
  'ogg',
  'wav',
  'webm',
];

/**
 * Custom hook for file validation
 * Follows SRP by handling only file validation logic
 */
export function useFileValidation() {
  const getFileExtension = useCallback((filename: string): string => {
    return filename.toLowerCase().split('.').pop() || '';
  }, []);

  const validateAudioFormat = useCallback(
    (file: File): ValidationResult => {
      const extension = getFileExtension(file.name);

      if (!SUPPORTED_AUDIO_FORMATS.includes(extension)) {
        return {
          valid: false,
          error: `Unsupported format: .${extension}. Supported formats: ${SUPPORTED_AUDIO_FORMATS.join(', ')}`,
        };
      }

      // Check file size (max 100MB)
      const maxSize = 100 * 1024 * 1024;
      if (file.size > maxSize) {
        return {
          valid: false,
          error: `File too large: ${(file.size / 1024 / 1024).toFixed(1)}MB. Maximum size: 100MB`,
        };
      }

      return { valid: true };
    },
    [getFileExtension]
  );

  const validateFiles = useCallback(
    (files: File[]): FileValidationResult => {
      const validFiles: File[] = [];
      const invalidFiles: { file: File; error: string }[] = [];

      files.forEach(file => {
        const validation = validateAudioFormat(file);
        if (validation.valid) {
          validFiles.push(file);
        } else {
          invalidFiles.push({ file, error: validation.error || 'Unknown error' });
        }
      });

      return { validFiles, invalidFiles };
    },
    [validateAudioFormat]
  );

  const getSupportedFormats = useCallback(() => {
    return [...SUPPORTED_AUDIO_FORMATS];
  }, []);

  return {
    validateAudioFormat,
    validateFiles,
    getFileExtension,
    getSupportedFormats,
  };
}