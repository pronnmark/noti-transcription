import type { 
  AudioFile, 
  NewAudioFile, 
  TranscriptionJob, 
  NewTranscriptionJob,
  Extraction,
  NewExtraction,
  ExtractionTemplate,
  Summarization,
  NewSummarization,
  TranscriptSegment 
} from '@/lib/database/schema';

// Base service interface
export interface IService {
  readonly name: string;
  initialize?(): Promise<void>;
  destroy?(): Promise<void>;
}

// Audio service interface
export interface IAudioService extends IService {
  // File management
  getAllFiles(): Promise<AudioFile[]>;
  getFileById(id: number): Promise<AudioFile | null>;
  createFile(data: NewAudioFile): Promise<AudioFile>;
  updateFile(id: number, data: Partial<NewAudioFile>): Promise<AudioFile>;
  deleteFile(id: number): Promise<boolean>;
  
  // File operations
  checkForDuplicates(data: { fileHash: string; originalFileName: string; fileSize: number }): Promise<{
    isDuplicate: boolean;
    duplicateType?: string;
    message?: string;
    existingFile?: AudioFile;
  }>;
  
  // Statistics
  getStatistics(): Promise<{
    totalFiles: number;
    totalSize: number;
    averageSize: number;
    averageDuration: number;
  }>;
  
  // Search and filtering
  findByHash(hash: string): Promise<AudioFile | null>;
  findByFileName(fileName: string): Promise<AudioFile | null>;
  findRecent(limit?: number): Promise<AudioFile[]>;
  findByDateRange(startDate: Date, endDate: Date): Promise<AudioFile[]>;
}

// Transcription service interface
export interface ITranscriptionService extends IService {
  // Job management
  createJob(data: NewTranscriptionJob): Promise<TranscriptionJob>;
  getJobById(id: number): Promise<TranscriptionJob | null>;
  getJobsByFileId(fileId: number): Promise<TranscriptionJob[]>;
  getLatestJobByFileId(fileId: number): Promise<TranscriptionJob | null>;
  
  // Job operations
  startTranscription(jobId: number): Promise<TranscriptionJob>;
  updateProgress(jobId: number, progress: number): Promise<TranscriptionJob>;
  completeTranscription(jobId: number, transcript: TranscriptSegment[]): Promise<TranscriptionJob>;
  failTranscription(jobId: number, error: string): Promise<TranscriptionJob>;
  
  // Status management
  getJobsByStatus(status: string): Promise<TranscriptionJob[]>;
  getPendingJobs(): Promise<TranscriptionJob[]>;
  getProcessingJobs(): Promise<TranscriptionJob[]>;
}

// Extraction service interface
export interface IExtractionService extends IService {
  // Template management
  getTemplates(): Promise<ExtractionTemplate[]>;
  getActiveTemplates(): Promise<ExtractionTemplate[]>;
  getTemplateById(id: string): Promise<ExtractionTemplate | null>;
  createTemplate(data: any): Promise<ExtractionTemplate>;
  updateTemplate(id: string, data: any): Promise<ExtractionTemplate>;
  deleteTemplate(id: string): Promise<boolean>;
  
  // Extraction operations
  createExtraction(data: NewExtraction): Promise<Extraction>;
  getExtractionsByFileId(fileId: number): Promise<Extraction[]>;
  getExtractionsByTemplateId(templateId: string): Promise<Extraction[]>;
  
  // Batch operations
  extractFromTranscript(fileId: number, transcript: TranscriptSegment[], templateIds?: string[]): Promise<Extraction[]>;
  extractWithSettings(fileId: number, transcript: TranscriptSegment[], settings: ExtractionSettings): Promise<BatchExtractionResult>;
}

// Summarization service interface
export interface ISummarizationService extends IService {
  // Summarization operations
  createSummarization(data: NewSummarization): Promise<Summarization>;
  getSummarizationsByFileId(fileId: number): Promise<Summarization[]>;
  getLatestSummarizationByFileId(fileId: number): Promise<Summarization | null>;
  
  // Summary generation
  generateSummary(fileId: number, transcript: TranscriptSegment[], templateId?: string): Promise<Summarization>;
  regenerateSummary(fileId: number, templateId?: string): Promise<Summarization>;
}

// AI Provider interface
export interface IAIProvider extends IService {
  // Text generation
  generateText(prompt: string, options?: AIGenerationOptions): Promise<string>;
  generateStructuredOutput(prompt: string, schema: any, options?: AIGenerationOptions): Promise<any>;
  
  // Provider info
  getModelInfo(): AIModelInfo;
  isAvailable(): Promise<boolean>;
  
  // Configuration
  configure(config: AIProviderConfig): void;
}

// Storage service interface
export interface IStorageService extends IService {
  // File operations
  saveFile(path: string, data: Buffer): Promise<string>;
  readFile(path: string): Promise<Buffer>;
  deleteFile(path: string): Promise<boolean>;
  fileExists(path: string): Promise<boolean>;
  
  // Directory operations
  createDirectory(path: string): Promise<void>;
  listFiles(path: string): Promise<string[]>;
  getFileStats(path: string): Promise<FileStats>;
}

// Supporting types
export interface ExtractionSettings {
  tasks: boolean;
  psychology: boolean;
  decisions: boolean;
  questions: boolean;
  followups: boolean;
}

export interface ExtractionResult {
  type: 'tasks' | 'psychology' | 'decisions' | 'questions' | 'followups';
  success: boolean;
  count?: number;
  error?: string;
  executionTime?: number;
}

export interface BatchExtractionResult {
  success: boolean;
  results: ExtractionResult[];
  totalExecutionTime: number;
  successfulExtractions: number;
  failedExtractions: number;
}

export interface AIGenerationOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  jsonSchema?: any;
  retryOnFailure?: boolean;
}

export interface AIModelInfo {
  name: string;
  provider: string;
  maxTokens: number;
  supportsStructuredOutput: boolean;
  supportsFunctionCalling: boolean;
}

export interface AIProviderConfig {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  timeout?: number;
  retries?: number;
}

export interface FileStats {
  size: number;
  created: Date;
  modified: Date;
  isDirectory: boolean;
}

// Service configuration interface
export interface ServiceConfig {
  [key: string]: any;
}

// Service lifecycle events
export interface ServiceEvent {
  type: 'initialized' | 'destroyed' | 'error';
  service: string;
  timestamp: Date;
  data?: any;
}

// Service registry interface
export interface IServiceRegistry {
  register<T extends IService>(name: string, service: T): void;
  resolve<T extends IService>(name: string): T;
  has(name: string): boolean;
  unregister(name: string): void;
  getAll(): Map<string, IService>;
  
  // Lifecycle management
  initializeAll(): Promise<void>;
  destroyAll(): Promise<void>;
  
  // Event handling
  on(event: string, handler: (event: ServiceEvent) => void): void;
  off(event: string, handler: (event: ServiceEvent) => void): void;
  emit(event: ServiceEvent): void;
}
