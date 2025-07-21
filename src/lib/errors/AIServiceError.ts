import { AppError, ErrorCode, ErrorSeverity, ErrorContext } from './AppError';

export interface AIServiceErrorContext extends ErrorContext {
  provider?: string;
  model?: string;
  prompt?: string;
  tokens?: number;
  cost?: number;
  retryCount?: number;
  responseTime?: number;
  statusCode?: number;
}

export class AIServiceError extends AppError {
  public readonly provider?: string;
  public readonly model?: string;
  public readonly retryCount?: number;

  constructor(
    message: string,
    code: ErrorCode = ErrorCode.AI_SERVICE_ERROR,
    statusCode: number = 502,
    cause?: Error,
    context: Partial<AIServiceErrorContext> = {}
  ) {
    // Map AI service context to error metadata
    const metadata = {
      service: context.provider,
      operation: context.model,
      duration: context.responseTime,
      ...context
    };

    super(
      message,
      code,
      statusCode,
      ErrorSeverity.MEDIUM,
      true,
      metadata,
      cause
    );

    this.provider = context.provider;
    this.model = context.model;
    this.retryCount = context.retryCount;
  }

  static authentication(provider: string, cause?: Error): AIServiceError {
    return new AIServiceError(
      `Authentication failed for ${provider}. Please check your API key.`,
      ErrorCode.UNAUTHORIZED,
      401,
      cause,
      { provider }
    );
  }

  static quotaExceeded(provider: string, model?: string, cause?: Error): AIServiceError {
    const message = model 
      ? `Quota exceeded for ${provider} model '${model}'`
      : `Quota exceeded for ${provider}`;
    
    return new AIServiceError(
      message,
      ErrorCode.AI_QUOTA_EXCEEDED,
      429,
      cause,
      { provider, model }
    );
  }

  static rateLimit(provider: string, retryAfter?: number, cause?: Error): AIServiceError {
    const message = retryAfter 
      ? `Rate limit exceeded for ${provider}. Retry after ${retryAfter} seconds.`
      : `Rate limit exceeded for ${provider}`;
    
    return new AIServiceError(
      message,
      ErrorCode.RATE_LIMIT_EXCEEDED,
      429,
      cause,
      { provider, retryCount: retryAfter }
    );
  }

  static invalidResponse(provider: string, model?: string, cause?: Error): AIServiceError {
    const message = model 
      ? `Invalid response from ${provider} model '${model}'`
      : `Invalid response from ${provider}`;
    
    return new AIServiceError(
      message,
      ErrorCode.AI_INVALID_RESPONSE,
      502,
      cause,
      { provider, model }
    );
  }

  static timeoutError(provider: string, model?: string, responseTime?: number, cause?: Error): AIServiceError {
    const message = model 
      ? `Timeout calling ${provider} model '${model}'`
      : `Timeout calling ${provider}`;
    
    return new AIServiceError(
      message,
      ErrorCode.TIMEOUT_ERROR,
      408,
      cause,
      { provider, model, responseTime }
    );
  }

  static modelNotFound(provider: string, model: string, cause?: Error): AIServiceError {
    return new AIServiceError(
      `Model '${model}' not found on ${provider}`,
      ErrorCode.NOT_FOUND,
      404,
      cause,
      { provider, model }
    );
  }

  static invalidInput(provider: string, message: string, cause?: Error): AIServiceError {
    return new AIServiceError(
      `Invalid input for ${provider}: ${message}`,
      ErrorCode.INVALID_INPUT,
      400,
      cause,
      { provider }
    );
  }

  static serviceUnavailable(provider: string, cause?: Error): AIServiceError {
    return new AIServiceError(
      `${provider} service is currently unavailable`,
      ErrorCode.SERVICE_UNAVAILABLE,
      503,
      cause,
      { provider }
    );
  }

  static networkError(provider: string, cause?: Error): AIServiceError {
    return new AIServiceError(
      `Network error connecting to ${provider}`,
      ErrorCode.NETWORK_ERROR,
      502,
      cause,
      { provider }
    );
  }

  static contentFilter(provider: string, reason?: string, cause?: Error): AIServiceError {
    const message = reason 
      ? `Content filtered by ${provider}: ${reason}`
      : `Content filtered by ${provider}`;
    
    return new AIServiceError(
      message,
      ErrorCode.FORBIDDEN,
      403,
      cause,
      { provider }
    );
  }

  static tokenLimit(provider: string, model?: string, tokens?: number, cause?: Error): AIServiceError {
    const message = model 
      ? `Token limit exceeded for ${provider} model '${model}'${tokens ? ` (${tokens} tokens)` : ''}`
      : `Token limit exceeded for ${provider}`;
    
    return new AIServiceError(
      message,
      ErrorCode.AI_QUOTA_EXCEEDED,
      413,
      cause,
      { provider, model, tokens }
    );
  }

  // Helper method to determine if error is retryable
  isRetryable(): boolean {
    const retryableCodes = [
      ErrorCode.TIMEOUT_ERROR,
      ErrorCode.NETWORK_ERROR,
      ErrorCode.SERVICE_UNAVAILABLE,
      ErrorCode.RATE_LIMIT_EXCEEDED
    ];
    
    return retryableCodes.includes(this.code);
  }

  // Helper method to get retry delay in milliseconds
  getRetryDelay(): number {
    switch (this.code) {
      case ErrorCode.RATE_LIMIT_EXCEEDED:
        return (this.retryCount || 60) * 1000; // Use retryAfter or default to 60 seconds
      
      case ErrorCode.TIMEOUT_ERROR:
        return 5000; // 5 seconds
      
      case ErrorCode.NETWORK_ERROR:
        return 2000; // 2 seconds
      
      case ErrorCode.SERVICE_UNAVAILABLE:
        return 30000; // 30 seconds
      
      default:
        return 1000; // 1 second default
    }
  }

  // Helper method to get user-friendly message
  getUserMessage(): string {
    switch (this.code) {
      case ErrorCode.UNAUTHORIZED:
        return 'AI service authentication failed. Please check your API configuration.';
      
      case ErrorCode.AI_QUOTA_EXCEEDED:
        return 'AI service quota exceeded. Please try again later or upgrade your plan.';
      
      case ErrorCode.RATE_LIMIT_EXCEEDED:
        return 'Too many requests to AI service. Please wait a moment and try again.';
      
      case ErrorCode.TIMEOUT_ERROR:
        return 'AI service request timed out. Please try again.';
      
      case ErrorCode.SERVICE_UNAVAILABLE:
        return 'AI service is temporarily unavailable. Please try again later.';
      
      case ErrorCode.NETWORK_ERROR:
        return 'Unable to connect to AI service. Please check your internet connection.';
      
      case ErrorCode.FORBIDDEN:
        return 'Content was filtered by the AI service. Please modify your input.';
      
      case ErrorCode.NOT_FOUND:
        return 'The requested AI model is not available.';
      
      case ErrorCode.INVALID_INPUT:
        return 'Invalid input provided to AI service. Please check your request.';
      
      default:
        return 'An error occurred with the AI service. Please try again later.';
    }
  }
}
