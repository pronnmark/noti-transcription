import { BaseService, ValidationRules } from './BaseService';
import { RepositoryFactory } from '../../database/repositories';
import type { AudioRepository } from '../../database/repositories/AudioRepository';
import type { IAudioService } from './interfaces';
import type { AudioFile, NewAudioFile, TranscriptSegment } from '../../database/schema';

export class AudioService extends BaseService implements IAudioService {
  private audioRepository: AudioRepository;

  constructor() {
    super('AudioService');
    this.audioRepository = RepositoryFactory.audioRepository;
  }

  protected async onInitialize(): Promise<void> {
    this._logger.info('Audio service initialized');
  }

  protected async onDestroy(): Promise<void> {
    this._logger.info('Audio service destroyed');
  }

  async getAllFiles(): Promise<AudioFile[]> {
    return this.executeWithErrorHandling('getAllFiles', async () => {
      const files = await this.audioRepository.findAll();
      this._logger.info(`Found ${files.length} audio files`);
      return files;
    });
  }

  async getFileById(id: number): Promise<AudioFile | null> {
    return this.executeWithErrorHandling('getFileById', async () => {
      this.validateInput(id, [
        ValidationRules.required('id'),
        ValidationRules.isNumber('id'),
        ValidationRules.isPositive('id')
      ]);

      return await this.audioRepository.findById(id);
    });
  }

  async createFile(data: NewAudioFile): Promise<AudioFile> {
    return this.executeWithErrorHandling('createFile', async () => {
      this.validateInput(data, [
        ValidationRules.required('fileName'),
        ValidationRules.required('originalFileName'),
        ValidationRules.required('originalFileType'),
        ValidationRules.required('fileSize'),
        ValidationRules.isPositive('fileSize')
      ]);

      const newFile = await this.audioRepository.create(data);
      this._logger.info(`Created audio file with ID: ${newFile.id}`);
      return newFile;
    });
  }

  async updateFile(id: number, data: Partial<NewAudioFile>): Promise<AudioFile> {
    return this.executeWithErrorHandling('updateFile', async () => {
      this.validateInput(id, [
        ValidationRules.required('id'),
        ValidationRules.isNumber('id'),
        ValidationRules.isPositive('id')
      ]);

      const updatedFile = await this.audioRepository.update(id, data);
      this._logger.info(`Updated audio file ${id}`);
      return updatedFile;
    });
  }

  async deleteFile(id: number): Promise<boolean> {
    return this.executeWithErrorHandling('deleteFile', async () => {
      this.validateInput(id, [
        ValidationRules.required('id'),
        ValidationRules.isNumber('id'),
        ValidationRules.isPositive('id')
      ]);

      const deleted = await this.audioRepository.delete(id);
      if (deleted) {
        this._logger.info(`Deleted audio file ${id}`);
      } else {
        this._logger.warn(`Audio file ${id} not found for deletion`);
      }
      return deleted;
    });
  }

  async checkForDuplicates(data: {
    fileHash: string;
    originalFileName: string;
    fileSize: number;
  }): Promise<{
    isDuplicate: boolean;
    duplicateType?: string;
    message?: string;
    existingFile?: AudioFile;
  }> {
    return this.executeWithErrorHandling('checkForDuplicates', async () => {
      this.validateInput(data, [
        ValidationRules.required('fileHash'),
        ValidationRules.required('originalFileName'),
        ValidationRules.required('fileSize'),
        ValidationRules.isString('fileHash'),
        ValidationRules.isString('originalFileName'),
        ValidationRules.isNumber('fileSize'),
        ValidationRules.isPositive('fileSize')
      ]);

      const existingFile = await this.audioRepository.findByHash(data.fileHash);
      if (existingFile) {
        if (existingFile.fileSize === data.fileSize && existingFile.originalFileName === data.originalFileName) {
          return {
            isDuplicate: true,
            duplicateType: 'full',
            message: 'An identical file has already been uploaded.',
            existingFile,
          };
        }
        return {
          isDuplicate: true,
          duplicateType: 'hash',
          message: 'A file with the same content but different metadata exists.',
          existingFile,
        };
      }
      return { isDuplicate: false };
    });
  }

  async getStatistics(): Promise<{
    totalFiles: number;
    totalSize: number;
    averageSize: number;
    averageDuration: number;
  }> {
    return this.executeWithErrorHandling('getStatistics', async () => {
      return await this.audioRepository.getStatistics();
    });
  }

  async findByHash(hash: string): Promise<AudioFile | null> {
    return this.executeWithErrorHandling('findByHash', async () => {
      this.validateInput(hash, [
        ValidationRules.required('hash'),
        ValidationRules.isString('hash'),
        ValidationRules.minLength('hash', 1)
      ]);

      return await this.audioRepository.findByHash(hash);
    });
  }

  async findByFileName(fileName: string): Promise<AudioFile | null> {
    return this.executeWithErrorHandling('findByFileName', async () => {
      this.validateInput(fileName, [
        ValidationRules.required('fileName'),
        ValidationRules.isString('fileName'),
        ValidationRules.minLength('fileName', 1)
      ]);

      return await this.audioRepository.findByFileName(fileName);
    });
  }

  async findRecent(limit: number = 10): Promise<AudioFile[]> {
    return this.executeWithErrorHandling('findRecent', async () => {
      this.validateInput(limit, [
        ValidationRules.isNumber('limit'),
        ValidationRules.isPositive('limit')
      ]);

      return await this.audioRepository.findRecent(limit);
    });
  }

  async findByDateRange(startDate: Date, endDate: Date): Promise<AudioFile[]> {
    return this.executeWithErrorHandling('findByDateRange', async () => {
      this.validateInput(startDate, [ValidationRules.required('startDate')]);
      this.validateInput(endDate, [ValidationRules.required('endDate')]);

      if (startDate > endDate) {
        throw new Error('Start date must be before end date');
      }

      return await this.audioRepository.findByDateRange(startDate, endDate);
    });
  }

  // New method to get files with all related details (DRY principle - centralize data aggregation)
  async getAllFilesWithDetails(): Promise<Array<{
    id: string;
    filename: string;
    originalName: string;
    size: number;
    mimeType: string;
    createdAt: Date;
    updatedAt: Date;
    transcriptionStatus: 'pending' | 'processing' | 'completed' | 'failed' | 'draft';
    hasTranscript: boolean;
    hasAiExtract: boolean;
    extractCount: number;
    duration?: number;
  }>> {
    return this.executeWithErrorHandling('getAllFilesWithDetails', async () => {
      // Get all files
      const files = await this.audioRepository.findAll();

      // Get related services through service container
      const { serviceContainer } = await import('../../services');
      const transcriptionService = serviceContainer.transcriptionService;
      const extractionService = serviceContainer.extractionService;

      // Transform files with related data
      const transformedFiles = await Promise.all(
        files.map(async (file) => {
          // Get transcription status
          const transcriptionJob = await transcriptionService.getJobByFileId(file.id);
          const transcriptionStatus = transcriptionJob?.status || 'pending';
          const hasTranscript = transcriptionStatus === 'completed' && !!transcriptionJob?.transcript;

          // Get extraction count
          const extracts = await extractionService.getExtractionsByFileId(file.id);
          const extractCount = extracts.length;

          return {
            id: file.id.toString(),
            filename: file.fileName,
            originalName: file.originalFileName,
            size: file.fileSize,
            mimeType: file.originalFileType,
            createdAt: file.uploadedAt,
            updatedAt: file.updatedAt,
            transcriptionStatus: transcriptionStatus as 'pending' | 'processing' | 'completed' | 'failed' | 'draft',
            hasTranscript,
            hasAiExtract: extractCount > 0,
            extractCount,
            duration: file.duration ?? undefined, // Convert null to undefined
          };
        })
      );

      this._logger.info(`Retrieved ${transformedFiles.length} files with details`);
      return transformedFiles;
    });
  }
}