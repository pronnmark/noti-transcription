import { ValidationError } from '../errors';

export interface FileValidationOptions {
  maxSize?: number;
  allowedMimeTypes?: string[];
  allowedExtensions?: string[];
  requireExtension?: boolean;
}

export interface LocationValidationOptions {
  requireAccuracy?: boolean;
  maxAccuracy?: number;
  allowedProviders?: string[];
}

export class ValidationUtils {
  // Default validation constants
  private static readonly DEFAULT_MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
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
   * Validate numeric ID parameters (eliminates repeated validation in services)
   */
  static validateId(id: unknown, fieldName: string = 'id'): number {
    if (!id || typeof id !== 'number' || id <= 0 || !Number.isInteger(id)) {
      throw new ValidationError(`${fieldName} is required and must be a positive integer`);
    }
    return id;
  }

  /**
   * Validate required string parameters
   */
  static validateRequiredString(value: unknown, fieldName: string, maxLength?: number): string {
    if (!value || typeof value !== 'string' || value.trim().length === 0) {
      throw new ValidationError(`${fieldName} is required and must be a non-empty string`);
    }
    
    const trimmed = value.trim();
    if (maxLength && trimmed.length > maxLength) {
      throw new ValidationError(`${fieldName} must be ${maxLength} characters or less`);
    }
    
    return trimmed;
  }

  /**
   * Validate numeric range parameters
   */
  static validateNumericRange(
    value: unknown, 
    fieldName: string, 
    min: number, 
    max: number
  ): number {
    if (typeof value !== 'number' || isNaN(value)) {
      throw new ValidationError(`${fieldName} must be a valid number`);
    }
    
    if (value < min || value > max) {
      throw new ValidationError(`${fieldName} must be between ${min} and ${max}`);
    }
    
    return value;
  }

  /**
   * Validate file objects (eliminates duplication between AudioService and FileUploadService)
   */
  static validateFile(file: File, options: FileValidationOptions = {}): void {
    const {
      maxSize = this.DEFAULT_MAX_FILE_SIZE,
      allowedMimeTypes = this.DEFAULT_AUDIO_MIME_TYPES,
      allowedExtensions = this.DEFAULT_AUDIO_EXTENSIONS,
      requireExtension = true
    } = options;

    // Check if file is valid File object
    if (!file || typeof file.size !== 'number' || typeof file.name !== 'string') {
      throw new ValidationError('Invalid file object - missing required properties');
    }

    // Check file size
    if (file.size === 0) {
      throw new ValidationError('File is empty');
    }

    if (file.size > maxSize) {
      throw new ValidationError(
        `File size exceeds maximum limit of ${Math.round(maxSize / 1024 / 1024)}MB`
      );
    }

    // Validate file type
    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    const baseMimeType = file.type.split(';')[0].trim();

    const isValidType = 
      allowedMimeTypes.includes(baseMimeType) ||
      allowedMimeTypes.includes(file.type) ||
      (file.type === 'application/octet-stream' && 
       fileExtension && 
       allowedExtensions.includes(fileExtension));

    if (!isValidType) {
      throw new ValidationError(
        `Invalid file type: ${file.type}. Supported formats: ${allowedExtensions.join(', ')}`
      );
    }

    if (requireExtension && !fileExtension) {
      throw new ValidationError('File must have a valid extension');
    }
  }

  /**
   * Validate file size for database storage
   */
  static validateFileSize(size: unknown, maxSize: number = this.DEFAULT_MAX_FILE_SIZE): number {
    if (typeof size !== 'number' || size <= 0) {
      throw new ValidationError('File size must be a positive number');
    }

    if (size > maxSize) {
      throw new ValidationError(
        `File too large (max ${Math.round(maxSize / 1024 / 1024)}MB)`
      );
    }

    return size;
  }

  /**
   * Validate location data (eliminates duplication across location-aware services)
   */
  static validateLocation(
    location: { latitude: number; longitude: number; accuracy?: number; provider?: string }, 
    options: LocationValidationOptions = {}
  ): void {
    const { requireAccuracy = false, maxAccuracy = 10000, allowedProviders = ['gps', 'network', 'passive'] } = options;

    // Validate latitude
    this.validateNumericRange(location.latitude, 'latitude', -90, 90);

    // Validate longitude  
    this.validateNumericRange(location.longitude, 'longitude', -180, 180);

    // Validate accuracy if provided
    if (location.accuracy !== undefined) {
      if (location.accuracy < 0) {
        throw new ValidationError('Location accuracy must be positive');
      }
      if (location.accuracy > maxAccuracy) {
        throw new ValidationError(`Location accuracy must be less than ${maxAccuracy}m`);
      }
    } else if (requireAccuracy) {
      throw new ValidationError('Location accuracy is required');
    }

    // Validate provider if provided
    if (location.provider && !allowedProviders.includes(location.provider)) {
      throw new ValidationError(`Invalid location provider. Allowed: ${allowedProviders.join(', ')}`);
    }
  }

  /**
   * Validate speaker count parameter
   */
  static validateSpeakerCount(count: unknown): number {
    if (count === undefined || count === null) {
      return 1; // Default value
    }
    
    return this.validateNumericRange(count, 'speaker count', 1, 10);
  }

  /**
   * Validate transcript segments array
   */
  static validateTranscriptSegments(segments: unknown): any[] {
    if (!Array.isArray(segments)) {
      throw new ValidationError('Transcript segments must be an array');
    }

    if (segments.length === 0) {
      throw new ValidationError('Transcript segments cannot be empty');
    }

    // Validate each segment
    segments.forEach((segment, index) => {
      if (!segment || typeof segment !== 'object') {
        throw new ValidationError(`Transcript segment ${index} must be an object`);
      }

      // Check required properties
      if (typeof segment.start !== 'number' || 
          typeof segment.end !== 'number' || 
          typeof segment.text !== 'string') {
        throw new ValidationError(
          `Transcript segment ${index} must have start (number), end (number), and text (string) properties`
        );
      }

      // Validate timing
      if (segment.start >= segment.end) {
        throw new ValidationError(
          `Transcript segment ${index}: start time must be before end time`
        );
      }

      if (segment.start < 0 || segment.end < 0) {
        throw new ValidationError(
          `Transcript segment ${index}: times cannot be negative`
        );
      }
    });

    return segments;
  }

  /**
   * Validate email format
   */
  static validateEmail(email: unknown): string {
    const emailStr = this.validateRequiredString(email, 'email');
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    if (!emailRegex.test(emailStr)) {
      throw new ValidationError('Invalid email format');
    }
    
    return emailStr;
  }

  /**
   * Validate URL format
   */
  static validateUrl(url: unknown, fieldName: string = 'URL'): string {
    const urlStr = this.validateRequiredString(url, fieldName);
    
    try {
      new URL(urlStr);
      return urlStr;
    } catch {
      throw new ValidationError(`Invalid ${fieldName} format`);
    }
  }

  /**
   * Validate array with minimum length
   */
  static validateArray<T>(
    arr: unknown, 
    fieldName: string, 
    minLength: number = 0,
    maxLength?: number
  ): T[] {
    if (!Array.isArray(arr)) {
      throw new ValidationError(`${fieldName} must be an array`);
    }

    if (arr.length < minLength) {
      throw new ValidationError(`${fieldName} must have at least ${minLength} items`);
    }

    if (maxLength && arr.length > maxLength) {
      throw new ValidationError(`${fieldName} must have at most ${maxLength} items`);
    }

    return arr as T[];
  }

  /**
   * Validate enum value
   */
  static validateEnum<T extends string>(
    value: unknown, 
    fieldName: string, 
    allowedValues: readonly T[]
  ): T {
    const strValue = this.validateRequiredString(value, fieldName);
    
    if (!allowedValues.includes(strValue as T)) {
      throw new ValidationError(
        `Invalid ${fieldName}. Allowed values: ${allowedValues.join(', ')}`
      );
    }
    
    return strValue as T;
  }
}