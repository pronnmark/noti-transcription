import { AppError, ErrorCode, ErrorSeverity, ErrorContext } from './AppError';

export interface ValidationRule {
  field: string;
  rule: string;
  message: string;
  value?: any;
}

export interface ValidationErrorContext extends ErrorContext {
  field?: string;
  value?: any;
  rules?: ValidationRule[];
  schema?: string;
}

export class ValidationError extends AppError {
  public readonly field?: string;
  public readonly value?: any;
  public readonly rules: ValidationRule[];

  constructor(
    message: string,
    field?: string,
    value?: any,
    rules: ValidationRule[] = [],
    context: Partial<ValidationErrorContext> = {}
  ) {
    // Map validation context to error metadata
    const metadata = {
      operation: 'validation',
      ...context,
      // Store validation-specific data as additional properties
      validationField: field,
      validationValue: value,
      validationRules: rules,
    };

    super(
      message,
      ErrorCode.VALIDATION_ERROR,
      400,
      ErrorSeverity.LOW,
      true,
      metadata
    );

    this.field = field;
    this.value = value;
    this.rules = rules;
  }

  static required(field: string, value?: any): ValidationError {
    return new ValidationError(`Field '${field}' is required`, field, value, [
      { field, rule: 'required', message: 'This field is required', value },
    ]);
  }

  static invalidType(
    field: string,
    expectedType: string,
    actualValue?: any
  ): ValidationError {
    const actualType = typeof actualValue;
    return new ValidationError(
      `Field '${field}' must be of type '${expectedType}', got '${actualType}'`,
      field,
      actualValue,
      [
        {
          field,
          rule: 'type',
          message: `Must be of type '${expectedType}'`,
          value: actualValue,
        },
      ]
    );
  }

  static invalidFormat(
    field: string,
    format: string,
    value?: any
  ): ValidationError {
    return new ValidationError(
      `Field '${field}' has invalid format, expected '${format}'`,
      field,
      value,
      [
        {
          field,
          rule: 'format',
          message: `Must match format '${format}'`,
          value,
        },
      ]
    );
  }

  static outOfRange(
    field: string,
    min?: number,
    max?: number,
    value?: any
  ): ValidationError {
    let message = `Field '${field}' is out of range`;
    if (min !== undefined && max !== undefined) {
      message += ` (must be between ${min} and ${max})`;
    } else if (min !== undefined) {
      message += ` (must be at least ${min})`;
    } else if (max !== undefined) {
      message += ` (must be at most ${max})`;
    }

    return new ValidationError(message, field, value, [
      {
        field,
        rule: 'range',
        message: `Must be between ${min} and ${max}`,
        value,
      },
    ]);
  }

  static invalidLength(
    field: string,
    minLength?: number,
    maxLength?: number,
    actualLength?: number
  ): ValidationError {
    let message = `Field '${field}' has invalid length`;
    if (minLength !== undefined && maxLength !== undefined) {
      message += ` (must be between ${minLength} and ${maxLength} characters)`;
    } else if (minLength !== undefined) {
      message += ` (must be at least ${minLength} characters)`;
    } else if (maxLength !== undefined) {
      message += ` (must be at most ${maxLength} characters)`;
    }

    if (actualLength !== undefined) {
      message += `, got ${actualLength}`;
    }

    return new ValidationError(message, field, actualLength, [
      {
        field,
        rule: 'length',
        message: `Length must be between ${minLength} and ${maxLength}`,
        value: actualLength,
      },
    ]);
  }

  static invalidChoice(
    field: string,
    validChoices: any[],
    value?: any
  ): ValidationError {
    return new ValidationError(
      `Field '${field}' must be one of: ${validChoices.join(', ')}`,
      field,
      value,
      [
        {
          field,
          rule: 'choice',
          message: `Must be one of: ${validChoices.join(', ')}`,
          value,
        },
      ]
    );
  }

  static custom(
    field: string,
    message: string,
    value?: any,
    rule?: string
  ): ValidationError {
    return new ValidationError(message, field, value, [
      {
        field,
        rule: rule || 'custom',
        message,
        value,
      },
    ]);
  }

  static multiple(rules: ValidationRule[], message?: string): ValidationError {
    const defaultMessage = `Validation failed for ${rules.length} field(s): ${rules.map(r => r.field).join(', ')}`;
    return new ValidationError(
      message || defaultMessage,
      undefined,
      undefined,
      rules
    );
  }

  // Helper method to get all validation errors as a formatted object
  getValidationErrors(): Record<string, string[]> {
    const errors: Record<string, string[]> = {};

    for (const rule of this.rules) {
      if (!errors[rule.field]) {
        errors[rule.field] = [];
      }
      errors[rule.field].push(rule.message);
    }

    return errors;
  }

  // Helper method to get the first error for each field
  getFirstErrors(): Record<string, string> {
    const errors: Record<string, string> = {};

    for (const rule of this.rules) {
      if (!errors[rule.field]) {
        errors[rule.field] = rule.message;
      }
    }

    return errors;
  }
}
