import { geminiProvider } from './ai/GeminiProvider';
import { ValidationError } from '../errors';
import crypto from 'crypto';

// Enhanced error types for better error handling
export class FileRenamingError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'FileRenamingError';
  }
}

export interface FileRenameResult {
  success: boolean;
  originalName: string;
  suggestedName: string;
  confidence?: number; // 0-1 confidence score
  reasoning?: string; // Why this name was chosen
  alternativeNames?: string[]; // Other suggestions
  error?: string;
  errorCode?: string;
  processingTime?: number; // Time taken in ms
}

export interface FileRenameOptions {
  maxLength?: number;
  includeDatePrefix?: boolean;
  includeFileExtension?: boolean;
  language?: string;
  category?: string; // meeting, interview, call, etc.
  speakers?: string[]; // Known speaker names
  customTemplate?: string; // Custom naming template
  forceOverwrite?: boolean; // Allow overwriting existing names
  generateAlternatives?: boolean; // Generate multiple suggestions
  maxAlternatives?: number; // Max number of alternatives
}

interface CacheEntry {
  result: FileRenameResult;
  timestamp: number;
  transcriptHash: string;
  options: FileRenameOptions;
}

interface RenameContext {
  fileId?: string;
  userId?: string;
  organizationId?: string;
  metadata?: Record<string, any>;
}

export class FileRenamingService {
  private static instance: FileRenamingService;
  private cache = new Map<string, CacheEntry>();
  private readonly CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
  private readonly MAX_CACHE_SIZE = 1000;
  private readonly MAX_TRANSCRIPT_LENGTH = 8000; // Limit for AI processing
  private readonly MIN_TRANSCRIPT_LENGTH = 10;
  private readonly MAX_FILENAME_LENGTH = 255;
  private readonly MIN_FILENAME_LENGTH = 3;

  // Rate limiting
  private readonly rateLimitMap = new Map<string, number[]>();
  private readonly RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
  private readonly RATE_LIMIT_MAX_REQUESTS = 10;

  public static getInstance(): FileRenamingService {
    if (!FileRenamingService.instance) {
      FileRenamingService.instance = new FileRenamingService();
    }
    return FileRenamingService.instance;
  }

  private constructor() {
    // Clean up cache periodically
    setInterval(() => this.cleanupCache(), 60 * 60 * 1000); // Every hour
  }

  /**
   * Generate a meaningful filename based on transcript content with enhanced error handling
   */
  async generateFilename(
    transcript: string,
    originalFilename: string,
    options: FileRenameOptions = {},
    context: RenameContext = {}
  ): Promise<FileRenameResult> {
    const startTime = Date.now();
    
    try {
      // Rate limiting check
      if (context.userId && !this.checkRateLimit(context.userId)) {
        throw new FileRenamingError(
          'Rate limit exceeded. Please try again later.',
          'RATE_LIMIT_EXCEEDED',
          { userId: context.userId, limit: this.RATE_LIMIT_MAX_REQUESTS }
        );
      }

      // Enhanced input validation
      const validationResult = this.validateInputs(transcript, originalFilename, options);
      if (!validationResult.valid) {
        return {
          success: false,
          originalName: originalFilename,
          suggestedName: originalFilename,
          error: validationResult.error,
          errorCode: validationResult.code,
          processingTime: Date.now() - startTime,
        };
      }

      // Check cache first
      const cacheKey = this.generateCacheKey(transcript, options);
      const cachedResult = this.getFromCache(cacheKey);
      if (cachedResult) {
        console.log(`[FileRenaming] Cache hit for key: ${cacheKey.substring(0, 8)}...`);
        return {
          ...cachedResult,
          processingTime: Date.now() - startTime,
          originalName: originalFilename, // Update with current filename
        };
      }

      // Sanitize and prepare transcript
      const processedTranscript = this.preprocessTranscript(transcript, options);
      
      // Enhanced options with defaults
      const enhancedOptions = this.enhanceOptions(options);

      // Initialize AI provider with retry logic
      await this.initializeAIProvider();

      // Generate filename with enhanced prompting
      const aiResponse = await this.generateWithAI(
        processedTranscript,
        originalFilename,
        enhancedOptions,
        context
      );

      // Process and validate AI response
      const result = await this.processAIResponse(
        aiResponse,
        originalFilename,
        enhancedOptions,
        startTime
      );

      // Cache successful result
      if (result.success) {
        this.addToCache(cacheKey, result);
      }

      // Log operation for analytics
      this.logOperation(result, context, Date.now() - startTime);

      return result;

    } catch (error) {
      console.error('[FileRenaming] Generation failed:', error);
      
      const result: FileRenameResult = {
        success: false,
        originalName: originalFilename,
        suggestedName: originalFilename,
        processingTime: Date.now() - startTime,
      };

      if (error instanceof FileRenamingError) {
        result.error = error.message;
        result.errorCode = error.code;
      } else if (error instanceof Error) {
        result.error = this.categorizeError(error);
        result.errorCode = this.getErrorCode(error);
      } else {
        result.error = 'Unknown error occurred during filename generation';
        result.errorCode = 'UNKNOWN_ERROR';
      }

      this.logOperation(result, context, Date.now() - startTime);
      return result;
    }
  }

  /**
   * Enhanced input validation
   */
  private validateInputs(
    transcript: string,
    originalFilename: string,
    options: FileRenameOptions
  ): { valid: boolean; error?: string; code?: string } {
    // Transcript validation
    if (!transcript || typeof transcript !== 'string') {
      return {
        valid: false,
        error: 'Transcript must be a non-empty string',
        code: 'INVALID_TRANSCRIPT'
      };
    }

    if (transcript.trim().length < this.MIN_TRANSCRIPT_LENGTH) {
      return {
        valid: false,
        error: `Transcript too short (minimum ${this.MIN_TRANSCRIPT_LENGTH} characters)`,
        code: 'TRANSCRIPT_TOO_SHORT'
      };
    }

    if (transcript.length > this.MAX_TRANSCRIPT_LENGTH * 2) {
      return {
        valid: false,
        error: `Transcript too long (maximum ${this.MAX_TRANSCRIPT_LENGTH * 2} characters)`,
        code: 'TRANSCRIPT_TOO_LONG'
      };
    }

    // Original filename validation
    if (!originalFilename || typeof originalFilename !== 'string') {
      return {
        valid: false,
        error: 'Original filename must be a non-empty string',
        code: 'INVALID_FILENAME'
      };
    }

    // Options validation
    if (options.maxLength && (options.maxLength < this.MIN_FILENAME_LENGTH || options.maxLength > this.MAX_FILENAME_LENGTH)) {
      return {
        valid: false,
        error: `Max length must be between ${this.MIN_FILENAME_LENGTH} and ${this.MAX_FILENAME_LENGTH}`,
        code: 'INVALID_MAX_LENGTH'
      };
    }

    if (options.maxAlternatives && (options.maxAlternatives < 1 || options.maxAlternatives > 10)) {
      return {
        valid: false,
        error: 'Max alternatives must be between 1 and 10',
        code: 'INVALID_MAX_ALTERNATIVES'
      };
    }

    return { valid: true };
  }

  /**
   * Preprocess transcript for better AI processing
   */
  private preprocessTranscript(transcript: string, options: FileRenameOptions): string {
    let processed = transcript.trim();

    // Remove or replace problematic characters
    processed = processed.replace(/[^\w\s\-.,!?;:()"']/g, ' ');
    
    // Normalize whitespace
    processed = processed.replace(/\s+/g, ' ');

    // Truncate if too long, keeping the most important parts
    if (processed.length > this.MAX_TRANSCRIPT_LENGTH) {
      // Try to keep the beginning and end, which often contain key information
      const beginningLength = Math.floor(this.MAX_TRANSCRIPT_LENGTH * 0.6);
      const endLength = Math.floor(this.MAX_TRANSCRIPT_LENGTH * 0.4);
      
      const beginning = processed.substring(0, beginningLength);
      const end = processed.substring(processed.length - endLength);
      
      processed = `${beginning}\n...\n${end}`;
    }

    return processed;
  }

  /**
   * Enhance options with intelligent defaults
   */
  private enhanceOptions(options: FileRenameOptions): FileRenameOptions {
    return {
      maxLength: options.maxLength || 60,
      includeDatePrefix: options.includeDatePrefix || false,
      includeFileExtension: options.includeFileExtension !== false, // Default true
      language: options.language || 'en',
      category: options.category,
      speakers: options.speakers || [],
      customTemplate: options.customTemplate,
      forceOverwrite: options.forceOverwrite || false,
      generateAlternatives: options.generateAlternatives || false,
      maxAlternatives: Math.min(options.maxAlternatives || 3, 5),
    };
  }

  /**
   * Initialize AI provider with proper error handling
   */
  private async initializeAIProvider(): Promise<void> {
    try {
      await geminiProvider.initialize();
      
      // Test if provider is actually available
      const isAvailable = await geminiProvider.isAvailable();
      if (!isAvailable) {
        throw new FileRenamingError(
          'AI service is not available. Please check configuration.',
          'AI_SERVICE_UNAVAILABLE'
        );
      }
    } catch (error) {
      if (error instanceof FileRenamingError) {
        throw error;
      }
      throw new FileRenamingError(
        'Failed to initialize AI service',
        'AI_INIT_FAILED',
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Generate filename using AI with enhanced prompting
   */
  private async generateWithAI(
    transcript: string,
    originalFilename: string,
    options: FileRenameOptions,
    context: RenameContext
  ): Promise<string> {
    const prompt = this.buildEnhancedPrompt(transcript, originalFilename, options, context);
    
    try {
      const response = await geminiProvider.generateText(prompt, {
        temperature: 0.3,
        maxTokens: 150,
        systemPrompt: this.getSystemPrompt(options),
      });

      if (!response || response.trim().length === 0) {
        throw new FileRenamingError(
          'AI returned empty response',
          'EMPTY_AI_RESPONSE'
        );
      }

      return response.trim();
    } catch (error) {
      if (error instanceof Error && error.message.includes('SAFETY')) {
        throw new FileRenamingError(
          'Content was flagged by AI safety filters',
          'CONTENT_FILTERED'
        );
      }
      throw error;
    }
  }

  /**
   * Build enhanced prompt for better AI responses
   */
  private buildEnhancedPrompt(
    transcript: string,
    originalFilename: string,
    options: FileRenameOptions,
    context: RenameContext
  ): string {
    const fileExtension = this.extractFileExtension(originalFilename);
    const speakerInfo = options.speakers?.length 
      ? `\nKnown speakers: ${options.speakers.join(', ')}`
      : '';
    
    const categoryHint = options.category 
      ? `\nFile category: ${options.category}`
      : '';

    const templateInfo = options.customTemplate 
      ? `\nUse this template: ${options.customTemplate} (where {topic} = main topic, {speakers} = speaker names, {date} = current date)`
      : '';

    return `Analyze this ${options.language || 'English'} audio transcript and create a descriptive filename:

TRANSCRIPT:
"${transcript}"

REQUIREMENTS:
- Maximum ${options.maxLength} characters (including "${fileExtension}")
- Use descriptive words that capture the main topic/purpose
- Replace spaces with underscores or hyphens
- Only alphanumeric characters, underscores, hyphens
- Must end with "${fileExtension}"
- Language: ${options.language || 'English'}${speakerInfo}${categoryHint}${templateInfo}

EXAMPLES:
- meeting_quarterly_review_q4_2024.mp3
- interview_sarah_chen_product_manager.wav
- call_customer_support_billing_issue.m4a
- presentation_ai_ethics_workshop.mp3

${options.generateAlternatives ? `Generate ${options.maxAlternatives} different filename options, one per line.` : 'Generate only one filename:'}`;
  }

  /**
   * Get system prompt based on options
   */
  private getSystemPrompt(options: FileRenameOptions): string {
    return `You are an expert file naming assistant. Create concise, descriptive filenames that help users quickly understand file content. Focus on the main topic, participants, and purpose. Avoid generic terms and be specific about the content discussed.

${options.category ? `This is a ${options.category} recording.` : ''}`;
  }

  /**
   * Process AI response and validate output
   */
  private async processAIResponse(
    aiResponse: string,
    originalFilename: string,
    options: FileRenameOptions,
    startTime: number
  ): Promise<FileRenameResult> {
    const lines = aiResponse.split('\n').map(line => line.trim()).filter(line => line);
    
    if (lines.length === 0) {
      throw new FileRenamingError(
        'AI returned no valid filename suggestions',
        'NO_VALID_SUGGESTIONS'
      );
    }

    const suggestedName = this.cleanFilename(lines[0], this.extractFileExtension(originalFilename));
    const alternativeNames = options.generateAlternatives 
      ? lines.slice(1, options.maxAlternatives! + 1).map(line => 
          this.cleanFilename(line, this.extractFileExtension(originalFilename))
        ).filter(name => name !== suggestedName)
      : [];

    // Validate generated filename
    const validation = this.validateFilename(suggestedName);
    if (!validation.valid) {
      throw new FileRenamingError(
        `Generated filename is invalid: ${validation.error}`,
        'INVALID_GENERATED_FILENAME'
      );
    }

    // Calculate confidence score based on various factors
    const confidence = this.calculateConfidence(aiResponse, suggestedName, originalFilename);

    return {
      success: true,
      originalName: originalFilename,
      suggestedName,
      confidence,
      alternativeNames: alternativeNames.length > 0 ? alternativeNames : undefined,
      reasoning: this.extractReasoning(aiResponse),
      processingTime: Date.now() - startTime,
    };
  }

  /**
   * Calculate confidence score for the generated filename
   */
  private calculateConfidence(aiResponse: string, suggestedName: string, originalName: string): number {
    let confidence = 0.5; // Base confidence

    // Increase confidence if the name is descriptive (not generic)
    const genericTerms = ['audio', 'recording', 'file', 'untitled', 'new'];
    const hasGenericTerms = genericTerms.some(term => 
      suggestedName.toLowerCase().includes(term)
    );
    if (!hasGenericTerms) confidence += 0.2;

    // Increase confidence if name contains specific terms
    const specificWords = suggestedName.toLowerCase().split(/[_\-]/).filter(word => word.length > 3);
    if (specificWords.length >= 3) confidence += 0.2;

    // Decrease confidence if very similar to original
    const similarity = this.calculateSimilarity(suggestedName, originalName);
    if (similarity > 0.8) confidence -= 0.3;

    // Increase confidence if AI response was detailed
    if (aiResponse.length > 50) confidence += 0.1;

    return Math.max(0, Math.min(1, confidence));
  }

  /**
   * Calculate similarity between two strings
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = this.getEditDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  /**
   * Calculate edit distance between two strings
   */
  private getEditDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));

    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        if (str1[i - 1] === str2[j - 1]) {
          matrix[j][i] = matrix[j - 1][i - 1];
        } else {
          matrix[j][i] = Math.min(
            matrix[j - 1][i - 1] + 1,
            matrix[j][i - 1] + 1,
            matrix[j - 1][i] + 1
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Extract reasoning from AI response (if provided)
   */
  private extractReasoning(aiResponse: string): string | undefined {
    // Look for explanation patterns in the response
    const reasoningPatterns = [
      /because\s+(.+)/i,
      /this\s+captures?\s+(.+)/i,
      /reasoning:\s*(.+)/i,
    ];

    for (const pattern of reasoningPatterns) {
      const match = aiResponse.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    return undefined;
  }

  /**
   * Enhanced filename cleaning with better validation
   */
  private cleanFilename(generatedName: string, fileExtension: string): string {
    // Remove quotes and clean up
    let cleaned = generatedName
      .replace(/['""`]/g, '')
      .replace(/^\d+\.\s*/, '') // Remove numbering like "1. "
      .trim();

    // Extract just the filename if there's extra text
    const filenameMatch = cleaned.match(/([a-zA-Z0-9_\-]+\.[a-zA-Z0-9]+)/) || 
                         cleaned.match(/([a-zA-Z0-9_\-]+)/);
    if (filenameMatch) {
      cleaned = filenameMatch[1];
    }

    // Clean up characters
    cleaned = cleaned
      .replace(/\s+/g, '_')
      .replace(/[^\w\-_.]/g, '')
      .replace(/_+/g, '_')
      .replace(/^[_\-]+|[_\-]+$/g, '');

    // Ensure it doesn't start with a number or special character
    if (/^[0-9\-_]/.test(cleaned)) {
      cleaned = 'audio_' + cleaned;
    }

    // Add file extension if not present
    if (fileExtension && !cleaned.toLowerCase().endsWith(fileExtension.toLowerCase())) {
      const existingExtIndex = cleaned.lastIndexOf('.');
      if (existingExtIndex > 0) {
        cleaned = cleaned.substring(0, existingExtIndex);
      }
      cleaned += fileExtension;
    }

    // Ensure minimum length
    if (cleaned.length < this.MIN_FILENAME_LENGTH) {
      cleaned = 'audio_file' + (fileExtension || '.mp3');
    }

    return cleaned;
  }

  /**
   * Enhanced filename validation
   */
  validateFilename(filename: string): { valid: boolean; error?: string; code?: string } {
    if (!filename || filename.trim().length === 0) {
      return { valid: false, error: 'Filename cannot be empty', code: 'EMPTY_FILENAME' };
    }

    if (filename.length > this.MAX_FILENAME_LENGTH) {
      return { valid: false, error: `Filename too long (max ${this.MAX_FILENAME_LENGTH} characters)`, code: 'FILENAME_TOO_LONG' };
    }

    if (filename.length < this.MIN_FILENAME_LENGTH) {
      return { valid: false, error: `Filename too short (min ${this.MIN_FILENAME_LENGTH} characters)`, code: 'FILENAME_TOO_SHORT' };
    }

    // Check for invalid characters
    const invalidChars = /[<>:"/\\|?*\x00-\x1f]/;
    if (invalidChars.test(filename)) {
      return { valid: false, error: 'Filename contains invalid characters', code: 'INVALID_CHARACTERS' };
    }

    // Check for reserved names (Windows)
    const reservedNames = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\.|$)/i;
    if (reservedNames.test(filename)) {
      return { valid: false, error: 'Filename uses a reserved name', code: 'RESERVED_NAME' };
    }

    // Check for spaces at beginning/end
    if (filename !== filename.trim()) {
      return { valid: false, error: 'Filename cannot start or end with spaces', code: 'INVALID_SPACING' };
    }

    return { valid: true };
  }

  // ... [Additional utility methods for caching, rate limiting, error handling, etc.]

  private extractFileExtension(filename: string): string {
    const lastDot = filename.lastIndexOf('.');
    return lastDot > 0 ? filename.substring(lastDot) : '';
  }

  private generateCacheKey(transcript: string, options: FileRenameOptions): string {
    const content = transcript + JSON.stringify(options);
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  private getFromCache(key: string): FileRenameResult | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // Check if expired
    if (Date.now() - entry.timestamp > this.CACHE_TTL) {
      this.cache.delete(key);
      return null;
    }

    return entry.result;
  }

  private addToCache(key: string, result: FileRenameResult): void {
    // Clean cache if too large
    if (this.cache.size >= this.MAX_CACHE_SIZE) {
      this.cleanupCache();
    }

    this.cache.set(key, {
      result,
      timestamp: Date.now(),
      transcriptHash: key,
      options: {},
    });
  }

  private cleanupCache(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.CACHE_TTL) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.cache.delete(key));
    console.log(`[FileRenaming] Cleaned up ${keysToDelete.length} expired cache entries`);
  }

  private checkRateLimit(userId: string): boolean {
    const now = Date.now();
    const userRequests = this.rateLimitMap.get(userId) || [];
    
    // Remove old requests outside the window
    const validRequests = userRequests.filter(timestamp => now - timestamp < this.RATE_LIMIT_WINDOW);
    
    if (validRequests.length >= this.RATE_LIMIT_MAX_REQUESTS) {
      return false;
    }

    // Add current request
    validRequests.push(now);
    this.rateLimitMap.set(userId, validRequests);
    
    return true;
  }

  private categorizeError(error: Error): string {
    const message = error.message.toLowerCase();
    
    if (message.includes('api key') || message.includes('unauthorized')) {
      return 'AI service authentication failed. Please check API configuration.';
    }
    if (message.includes('rate limit') || message.includes('quota')) {
      return 'AI service rate limit exceeded. Please try again later.';
    }
    if (message.includes('network') || message.includes('timeout')) {
      return 'Network error occurred. Please check your connection.';
    }
    if (message.includes('safety') || message.includes('content policy')) {
      return 'Content was filtered by AI safety policies.';
    }
    
    return 'An unexpected error occurred during filename generation.';
  }

  private getErrorCode(error: Error): string {
    const message = error.message.toLowerCase();
    
    if (message.includes('api key')) return 'AUTH_ERROR';
    if (message.includes('rate limit')) return 'RATE_LIMIT';
    if (message.includes('network')) return 'NETWORK_ERROR';
    if (message.includes('timeout')) return 'TIMEOUT';
    if (message.includes('safety')) return 'CONTENT_FILTERED';
    
    return 'UNKNOWN_ERROR';
  }

  private logOperation(result: FileRenameResult, context: RenameContext, processingTime: number): void {
    const logData = {
      success: result.success,
      processingTime,
      confidence: result.confidence,
      hasAlternatives: !!result.alternativeNames?.length,
      errorCode: result.errorCode,
      userId: context.userId,
      fileId: context.fileId,
      timestamp: new Date().toISOString(),
    };

    console.log('[FileRenaming] Operation completed:', logData);
    
    // In production, this would go to a proper logging service
    // analytics.track('file_rename_attempt', logData);
  }
}

// Export enhanced singleton instance
export const fileRenamingService = FileRenamingService.getInstance();