import { BaseService, ValidationRules } from './BaseService';
import { RepositoryFactory } from '../../database/repositories';
import type { SummarizationRepository } from '../../database/repositories/SummarizationRepository';
import type { SummarizationTemplateRepository } from '../../database/repositories/TemplateRepository';
import type { ISummarizationService } from './interfaces';
import type { 
  Summarization, 
  NewSummarization, 
  SummarizationTemplate,
  TranscriptSegment 
} from '../../database/schema';

export class SummarizationService extends BaseService implements ISummarizationService {
  private summarizationRepository: SummarizationRepository;
  private templateRepository: SummarizationTemplateRepository;

  constructor() {
    super('SummarizationService');
    this.summarizationRepository = RepositoryFactory.summarizationRepository;
    this.templateRepository = RepositoryFactory.summarizationTemplateRepository;
  }

  protected async onInitialize(): Promise<void> {
    this._logger.info('Summarization service initialized');
  }

  protected async onDestroy(): Promise<void> {
    this._logger.info('Summarization service destroyed');
  }

  async createSummarization(data: NewSummarization): Promise<Summarization> {
    return this.executeWithErrorHandling('createSummarization', async () => {
      this.validateInput(data, [
        ValidationRules.required('fileId'),
        ValidationRules.required('model'),
        ValidationRules.required('prompt'),
        ValidationRules.required('content'),
        ValidationRules.isNumber('fileId'),
        ValidationRules.isString('model'),
        ValidationRules.isString('prompt'),
        ValidationRules.isString('content'),
        ValidationRules.isPositive('fileId'),
        ValidationRules.minLength('prompt', 10),
        ValidationRules.minLength('content', 1)
      ]);

      // Verify template exists if provided
      if (data.templateId) {
        const template = await this.templateRepository.findById(data.templateId);
        if (!template) {
          throw new Error(`Template with id '${data.templateId}' not found`);
        }
      }

      const summarization = await this.summarizationRepository.create(data);
      this._logger.info(`Created summarization ${summarization.id} for file ${data.fileId}`);
      return summarization;
    });
  }

  async getSummarizationsByFileId(fileId: number): Promise<Summarization[]> {
    return this.executeWithErrorHandling('getSummarizationsByFileId', async () => {
      this.validateInput(fileId, [
        ValidationRules.required('fileId'),
        ValidationRules.isNumber('fileId'),
        ValidationRules.isPositive('fileId')
      ]);

      return await this.summarizationRepository.findByFileId(fileId);
    });
  }

  async getLatestSummarizationByFileId(fileId: number): Promise<Summarization | null> {
    return this.executeWithErrorHandling('getLatestSummarizationByFileId', async () => {
      this.validateInput(fileId, [
        ValidationRules.required('fileId'),
        ValidationRules.isNumber('fileId'),
        ValidationRules.isPositive('fileId')
      ]);

      return await this.summarizationRepository.findLatestByFileId(fileId);
    });
  }

  async generateSummary(
    fileId: number, 
    transcript: TranscriptSegment[], 
    templateId?: string
  ): Promise<Summarization> {
    return this.executeWithErrorHandling('generateSummary', async () => {
      this.validateInput(fileId, [
        ValidationRules.required('fileId'),
        ValidationRules.isNumber('fileId'),
        ValidationRules.isPositive('fileId')
      ]);

      this.validateInput(transcript, [
        ValidationRules.required('transcript'),
        ValidationRules.isArray('transcript')
      ]);

      if (transcript.length === 0) {
        throw new Error('Cannot generate summary from empty transcript');
      }

      // Get template if specified
      let template: SummarizationTemplate | null = null;
      if (templateId) {
        template = await this.templateRepository.findById(templateId);
        if (!template) {
          throw new Error(`Template with id '${templateId}' not found`);
        }
      }

      // Prepare transcript text
      const transcriptText = transcript
        .map(segment => segment.text)
        .join(' ')
        .trim();

      if (transcriptText.length === 0) {
        throw new Error('Cannot generate summary from empty transcript text');
      }

      // Use template prompt or default prompt
      const prompt = template?.prompt || this.getDefaultSummaryPrompt();
      const model = 'anthropic/claude-sonnet-4'; // Default model

      // For now, create a placeholder summarization
      // In a real implementation, this would call an AI service
      const summaryContent = await this.generateSummaryContent(transcriptText, prompt);

      const summarizationData: NewSummarization = {
        fileId,
        templateId: template?.id,
        model,
        prompt,
        content: summaryContent,
        createdAt: new Date().toISOString(),
      };

      const summarization = await this.summarizationRepository.create(summarizationData);
      this._logger.info(`Generated summary for file ${fileId} using ${template ? `template ${template.id}` : 'default prompt'}`);
      
      return summarization;
    });
  }

  async regenerateSummary(fileId: number, templateId?: string): Promise<Summarization> {
    return this.executeWithErrorHandling('regenerateSummary', async () => {
      this.validateInput(fileId, [
        ValidationRules.required('fileId'),
        ValidationRules.isNumber('fileId'),
        ValidationRules.isPositive('fileId')
      ]);

      // Get the audio file and its transcript
      const audioRepository = RepositoryFactory.audioRepository;
      const audioFile = await audioRepository.findById(fileId);
      
      if (!audioFile) {
        throw new Error(`Audio file with id ${fileId} not found`);
      }

      // For now, we'll need to get the transcript from the transcription jobs
      // In a real implementation, you'd get the latest completed transcription
      const transcriptionRepository = RepositoryFactory.transcriptionRepository;
      const latestJob = await transcriptionRepository.findLatestByFileId(fileId);
      
      if (!latestJob || !latestJob.transcript) {
        throw new Error(`No transcript available for file ${fileId}`);
      }

      return await this.generateSummary(fileId, latestJob.transcript, templateId);
    });
  }

  // Template management methods
  async getTemplates(): Promise<SummarizationTemplate[]> {
    return this.executeWithErrorHandling('getTemplates', async () => {
      return await this.templateRepository.findAll();
    });
  }

  async getTemplateById(id: string): Promise<SummarizationTemplate | null> {
    return this.executeWithErrorHandling('getTemplateById', async () => {
      this.validateInput(id, [
        ValidationRules.required('id'),
        ValidationRules.isString('id'),
        ValidationRules.minLength('id', 1)
      ]);

      return await this.templateRepository.findById(id);
    });
  }

  async getRecentTemplates(limit: number = 10): Promise<SummarizationTemplate[]> {
    return this.executeWithErrorHandling('getRecentTemplates', async () => {
      this.validateInput(limit, [
        ValidationRules.isNumber('limit'),
        ValidationRules.isPositive('limit')
      ]);

      return await this.templateRepository.findRecent(limit);
    });
  }

  // Utility methods
  private getDefaultSummaryPrompt(): string {
    return `Please provide a comprehensive summary of the following transcript. 
Focus on:
- Key topics and themes discussed
- Important decisions made
- Action items and next steps
- Main participants and their contributions

Transcript:`;
  }

  private async generateSummaryContent(transcriptText: string, prompt: string): Promise<string> {
    // This is a placeholder implementation
    // In a real implementation, this would call an AI service
    
    const wordCount = transcriptText.split(' ').length;
    const estimatedDuration = Math.ceil(wordCount / 150); // Assuming 150 words per minute
    
    return `Summary of transcript (${wordCount} words, ~${estimatedDuration} minutes):

This is a placeholder summary. In a real implementation, this would be generated by an AI service using the provided prompt and transcript text.

Key points would be extracted and summarized here based on the transcript content.`;
  }

  // Statistics and analytics
  async getSummarizationStatistics(): Promise<{
    total: number;
    byModel: Record<string, number>;
    byTemplate: Record<string, number>;
    averageLength: number;
  }> {
    return this.executeWithErrorHandling('getSummarizationStatistics', async () => {
      const allSummarizations = await this.summarizationRepository.findAll();
      
      const byModel: Record<string, number> = {};
      const byTemplate: Record<string, number> = {};
      let totalLength = 0;
      
      for (const summarization of allSummarizations) {
        // Count by model
        byModel[summarization.model] = (byModel[summarization.model] || 0) + 1;
        
        // Count by template
        const templateKey = summarization.templateId || 'default';
        byTemplate[templateKey] = (byTemplate[templateKey] || 0) + 1;
        
        // Calculate total length
        totalLength += summarization.content.length;
      }
      
      return {
        total: allSummarizations.length,
        byModel,
        byTemplate,
        averageLength: allSummarizations.length > 0 ? Math.round(totalLength / allSummarizations.length) : 0,
      };
    });
  }

  async deleteSummarization(id: string): Promise<boolean> {
    return this.executeWithErrorHandling('deleteSummarization', async () => {
      this.validateInput(id, [
        ValidationRules.required('id'),
        ValidationRules.isString('id'),
        ValidationRules.minLength('id', 1)
      ]);

      const deleted = await this.summarizationRepository.delete(id);
      if (deleted) {
        this._logger.info(`Deleted summarization ${id}`);
      } else {
        this._logger.warn(`Summarization ${id} not found for deletion`);
      }
      return deleted;
    });
  }
}
