import { AudioFile, TranscriptionJob, SpeakerLabel, FileLabel } from '../client';

/**
 * Repository Interfaces
 * 
 * These interfaces define contracts for repository implementations,
 * following the Interface Segregation Principle (ISP)
 */

// Base repository interface
export interface IBaseRepository {
  // Common operations can be defined here if needed
}

// Audio file repository interface
export interface IAudioRepository extends IBaseRepository {
  // Core CRUD operations
  findById(id: number): Promise<AudioFile | null>;
  findByHash(hash: string): Promise<AudioFile | null>;
  findByFileName(fileName: string): Promise<AudioFile | null>;
  create(data: Omit<AudioFile, 'id' | 'uploaded_at' | 'updated_at'>): Promise<AudioFile>;
  update(id: number, data: Partial<Omit<AudioFile, 'id' | 'uploaded_at' | 'updated_at'>>): Promise<AudioFile>;
  delete(id: number): Promise<boolean>;

  // Query operations
  findAll(options?: FindAllOptions): Promise<AudioFile[]>;
  findRecent(limit?: number): Promise<AudioFile[]>;
  findByDateRange(startDate: Date, endDate: Date): Promise<AudioFile[]>;
  checkForDuplicates(data: DuplicateCheckData): Promise<AudioFile[]>;
  count(): Promise<number>;

  // Utility operations
  updateTimestamp(id: number): Promise<void>;
  deleteAll(): Promise<void>; // For testing only
}

// Audio statistics repository interface (separated concern)
export interface IAudioStatsRepository extends IBaseRepository {
  getStorageStats(): Promise<AudioStorageStats>;
  getUsageStats(period: 'day' | 'week' | 'month'): Promise<AudioUsageStats>;
}

// Transcription repository interface
export interface ITranscriptionRepository extends IBaseRepository {
  // Core CRUD operations
  findById(id: number): Promise<TranscriptionJob | null>;
  findLatestByFileId(fileId: number): Promise<TranscriptionJob | null>;
  findByFileId(fileId: number): Promise<TranscriptionJob[]>;
  create(data: Omit<TranscriptionJob, 'id' | 'created_at' | 'updated_at'>): Promise<TranscriptionJob>;
  update(id: number, data: Partial<Omit<TranscriptionJob, 'id' | 'created_at' | 'updated_at'>>): Promise<TranscriptionJob>;
  delete(id: number): Promise<boolean>;

  // Status management operations
  updateStatus(id: number, status: TranscriptionJob['status'], options?: UpdateStatusOptions): Promise<TranscriptionJob>;
  updateProgress(id: number, progress: number, status?: TranscriptionJob['status']): Promise<TranscriptionJob>;
  updateWithResults(id: number, data: UpdateResultsData): Promise<TranscriptionJob>;
  updateWithError(id: number, data: UpdateErrorData): Promise<TranscriptionJob>;

  // Query operations
  findByStatus(status: TranscriptionJob['status']): Promise<TranscriptionJob[]>;
  findPendingJobs(limit?: number): Promise<TranscriptionJob[]>;

  // Utility operations
  deleteAll(): Promise<void>; // For testing only
}

// Summarization repository interface
export interface ISummarizationRepository extends IBaseRepository {
  create(data: SummarizationCreateData): Promise<Summarization>;
  findByFileId(fileId: number): Promise<Summarization[]>;
  findActiveByIds(ids: string[]): Promise<any[]>;
}

// Template repository interface
export interface ITemplateRepository extends IBaseRepository {
  findById(id: string): Promise<any | null>;
  findActiveByIds(ids: string[]): Promise<any[]>;
  findAll(): Promise<any[]>;
  findDefault(): Promise<any | null>;
}

// Supporting types
export interface FindAllOptions {
  limit?: number;
  offset?: number;
  sortBy?: 'uploaded_at' | 'updated_at' | 'file_name';
  sortOrder?: 'asc' | 'desc';
}

export interface DuplicateCheckData {
  fileHash: string;
  fileSize: number;
  originalFileName: string;
}

export interface AudioStorageStats {
  totalFiles: number;
  totalSize: number;
  averageSize: number;
  totalDuration: number;
}

export interface AudioUsageStats {
  uploadsInPeriod: number;
  transcriptionsInPeriod: number;
  storageUsedInPeriod: number;
}

export interface UpdateStatusOptions {
  progress?: number;
  lastError?: string;
  startedAt?: string;
  completedAt?: string;
  transcript?: any;
}

export interface UpdateResultsData {
  status: TranscriptionJob['status'];
  progress: number;
  transcript: any;
  completedAt: Date;
}

export interface UpdateErrorData {
  status: 'failed';
  lastError: string;
  completedAt: Date;
}

export interface SummarizationCreateData {
  file_id: number;
  content: string;
  model: string;
  prompt: string;
  template_id?: string | null;
}

export interface Summarization {
  id: number;
  file_id: number;
  content: string;
  model: string;
  prompt: string;
  template_id?: string | null;
  created_at: string;
  updated_at: string;
}