/**
 * Validation Service
 * 
 * Centralizes validation logic to eliminate DRY violations and improve consistency.
 * Follows Single Responsibility Principle by focusing solely on validation concerns.
 */

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export interface ValidationRule<T> {
  validate(value: T): ValidationResult;
  message?: string;
}

export class ValidationService {
  /**
   * Validate a numeric ID
   */
  validateId(id: any, fieldName: string = 'ID'): ValidationResult {
    const errors: string[] = [];
    
    if (id === null || id === undefined) {
      errors.push(`${fieldName} is required`);
    } else if (typeof id !== 'number') {
      errors.push(`${fieldName} must be a number`);
    } else if (!Number.isInteger(id)) {
      errors.push(`${fieldName} must be an integer`);
    } else if (id <= 0) {
      errors.push(`${fieldName} must be a positive number`);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate required fields
   */
  validateRequired<T>(value: T, fieldName: string = 'Field'): ValidationResult {
    const errors: string[] = [];
    
    if (value === null || value === undefined) {
      errors.push(`${fieldName} is required`);
    } else if (typeof value === 'string' && value.trim() === '') {
      errors.push(`${fieldName} cannot be empty`);
    } else if (Array.isArray(value) && value.length === 0) {
      errors.push(`${fieldName} cannot be empty`);
    } else if (typeof value === 'object' && Object.keys(value).length === 0) {
      errors.push(`${fieldName} cannot be empty`);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate file size
   */
  validateFileSize(size: number, maxSize: number = 100 * 1024 * 1024): ValidationResult {
    const errors: string[] = [];
    
    if (typeof size !== 'number') {
      errors.push('File size must be a number');
    } else if (size <= 0) {
      errors.push('File size must be greater than 0');
    } else if (size > maxSize) {
      const maxMB = Math.round(maxSize / (1024 * 1024));
      errors.push(`File size cannot exceed ${maxMB}MB`);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate file name
   */
  validateFileName(fileName: string): ValidationResult {
    const errors: string[] = [];
    
    if (!fileName || typeof fileName !== 'string') {
      errors.push('File name is required');
    } else {
      const trimmed = fileName.trim();
      if (trimmed === '') {
        errors.push('File name cannot be empty');
      } else if (trimmed.length > 255) {
        errors.push('File name cannot exceed 255 characters');
      } else if (!/^[a-zA-Z0-9._-]+$/.test(trimmed)) {
        errors.push('File name contains invalid characters');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate email format
   */
  validateEmail(email: string): ValidationResult {
    const errors: string[] = [];
    
    if (!email || typeof email !== 'string') {
      errors.push('Email is required');
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        errors.push('Invalid email format');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate transcription status
   */
  validateTranscriptionStatus(status: string): ValidationResult {
    const validStatuses = ['pending', 'processing', 'completed', 'failed', 'draft'];
    const errors: string[] = [];
    
    if (!status || typeof status !== 'string') {
      errors.push('Status is required');
    } else if (!validStatuses.includes(status)) {
      errors.push(`Status must be one of: ${validStatuses.join(', ')}`);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate progress percentage
   */
  validateProgress(progress: number): ValidationResult {
    const errors: string[] = [];
    
    if (typeof progress !== 'number') {
      errors.push('Progress must be a number');
    } else if (progress < 0 || progress > 100) {
      errors.push('Progress must be between 0 and 100');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate audio file data for creation
   */
  validateAudioFileCreation(data: any): ValidationResult {
    const allErrors: string[] = [];

    // Required fields validation
    const requiredFields = [
      { field: 'file_name', name: 'File name' },
      { field: 'original_file_name', name: 'Original file name' },
      { field: 'original_file_type', name: 'File type' },
      { field: 'file_size', name: 'File size' }
    ];

    for (const { field, name } of requiredFields) {
      const result = this.validateRequired(data[field], name);
      allErrors.push(...result.errors);
    }

    // File name validation
    if (data.file_name) {
      const fileNameResult = this.validateFileName(data.file_name);
      allErrors.push(...fileNameResult.errors);
    }

    // File size validation
    if (data.file_size) {
      const fileSizeResult = this.validateFileSize(data.file_size);
      allErrors.push(...fileSizeResult.errors);
    }

    // Optional numeric fields validation
    const numericFields = ['duration', 'latitude', 'longitude', 'location_accuracy'];
    for (const field of numericFields) {
      if (data[field] !== undefined && data[field] !== null) {
        if (typeof data[field] !== 'number') {
          allErrors.push(`${field} must be a number`);
        }
      }
    }

    return {
      isValid: allErrors.length === 0,
      errors: allErrors
    };
  }

  /**
   * Validate transcription job creation data
   */
  validateTranscriptionJobCreation(data: any): ValidationResult {
    const allErrors: string[] = [];

    // File ID validation
    const fileIdResult = this.validateId(data.file_id, 'File ID');
    allErrors.push(...fileIdResult.errors);

    // Status validation (optional, defaults to 'pending')
    if (data.status) {
      const statusResult = this.validateTranscriptionStatus(data.status);
      allErrors.push(...statusResult.errors);
    }

    // Progress validation (optional)
    if (data.progress !== undefined) {
      const progressResult = this.validateProgress(data.progress);
      allErrors.push(...progressResult.errors);
    }

    return {
      isValid: allErrors.length === 0,
      errors: allErrors
    };
  }

  /**
   * Combine multiple validation results
   */
  combineResults(...results: ValidationResult[]): ValidationResult {
    const allErrors = results.flatMap(result => result.errors);
    
    return {
      isValid: allErrors.length === 0,
      errors: allErrors
    };
  }

  /**
   * Create a validation error message from results
   */
  createErrorMessage(result: ValidationResult, prefix: string = 'Validation failed'): string {
    if (result.isValid) {
      return '';
    }
    
    return `${prefix}: ${result.errors.join(', ')}`;
  }

  /**
   * Throw validation error if invalid
   */
  assertValid(result: ValidationResult, operation: string = 'Operation'): void {
    if (!result.isValid) {
      throw new Error(this.createErrorMessage(result, `${operation} validation failed`));
    }
  }
}