import { BaseService, ValidationRules } from './BaseService';
import { RepositoryFactory } from '../../database/repositories';
import type { ExtractionRepository } from '../../database/repositories/ExtractionRepository';
import type { ExtractionTemplateRepository } from '../../database/repositories/TemplateRepository';
import type { 
  IExtractionService, 
  ExtractionSettings, 
  BatchExtractionResult, 
  ExtractionResult 
} from './interfaces';
import type { 
  Extraction, 
  NewExtraction, 
  ExtractionTemplate, 
  NewExtractionTemplate,
  TranscriptSegment 
} from '../../database/schema';

export class ExtractionService extends BaseService implements IExtractionService {
  private extractionRepository: ExtractionRepository;
  private templateRepository: ExtractionTemplateRepository;

  constructor() {
    super('ExtractionService');
    this.extractionRepository = RepositoryFactory.extractionRepository;
    this.templateRepository = RepositoryFactory.extractionTemplateRepository;
  }

  protected async onInitialize(): Promise<void> {
    this._logger.info('Extraction service initialized');
  }

  protected async onDestroy(): Promise<void> {
    this._logger.info('Extraction service destroyed');
  }

  // Template management
  async getTemplates(): Promise<ExtractionTemplate[]> {
    return this.executeWithErrorHandling('getTemplates', async () => {
      return await this.templateRepository.findAll();
    });
  }

  async getActiveTemplates(): Promise<ExtractionTemplate[]> {
    return this.executeWithErrorHandling('getActiveTemplates', async () => {
      return await this.templateRepository.findActive();
    });
  }

  async getTemplateById(id: string): Promise<ExtractionTemplate | null> {
    return this.executeWithErrorHandling('getTemplateById', async () => {
      this.validateInput(id, [
        ValidationRules.required('id'),
        ValidationRules.isString('id'),
        ValidationRules.minLength('id', 1)
      ]);

      return await this.templateRepository.findById(id);
    });
  }

  async createTemplate(data: NewExtractionTemplate): Promise<ExtractionTemplate> {
    return this.executeWithErrorHandling('createTemplate', async () => {
      this.validateInput(data, [
        ValidationRules.required('name'),
        ValidationRules.required('prompt'),
        ValidationRules.isString('name'),
        ValidationRules.isString('prompt'),
        ValidationRules.minLength('name', 1),
        ValidationRules.minLength('prompt', 10)
      ]);

      // Check if template with same name exists
      const existingTemplate = await this.templateRepository.findByName(data.name);
      if (existingTemplate) {
        throw new Error(`Template with name '${data.name}' already exists`);
      }

      const template = await this.templateRepository.create(data);
      this._logger.info(`Created extraction template: ${template.name}`);
      return template;
    });
  }

  async updateTemplate(id: string, data: Partial<NewExtractionTemplate>): Promise<ExtractionTemplate> {
    return this.executeWithErrorHandling('updateTemplate', async () => {
      this.validateInput(id, [
        ValidationRules.required('id'),
        ValidationRules.isString('id'),
        ValidationRules.minLength('id', 1)
      ]);

      // Check if template exists
      const existingTemplate = await this.templateRepository.findById(id);
      if (!existingTemplate) {
        throw new Error(`Template with id '${id}' not found`);
      }

      // If name is being updated, check for conflicts
      if (data.name && data.name !== existingTemplate.name) {
        const nameConflict = await this.templateRepository.findByName(data.name);
        if (nameConflict) {
          throw new Error(`Template with name '${data.name}' already exists`);
        }
      }

      const updatedTemplate = await this.templateRepository.update(id, data);
      this._logger.info(`Updated extraction template: ${id}`);
      return updatedTemplate;
    });
  }

  async deleteTemplate(id: string): Promise<boolean> {
    return this.executeWithErrorHandling('deleteTemplate', async () => {
      this.validateInput(id, [
        ValidationRules.required('id'),
        ValidationRules.isString('id'),
        ValidationRules.minLength('id', 1)
      ]);

      // Check if template exists
      const existingTemplate = await this.templateRepository.findById(id);
      if (!existingTemplate) {
        throw new Error(`Template with id '${id}' not found`);
      }

      // Check if template is being used
      const extractions = await this.extractionRepository.findByTemplateId(id);
      if (extractions.length > 0) {
        throw new Error(`Cannot delete template '${id}': it is being used by ${extractions.length} extraction(s)`);
      }

      const deleted = await this.templateRepository.delete(id);
      if (deleted) {
        this._logger.info(`Deleted extraction template: ${id}`);
      }
      return deleted;
    });
  }

  // Extraction operations
  async createExtraction(data: NewExtraction): Promise<Extraction> {
    return this.executeWithErrorHandling('createExtraction', async () => {
      this.validateInput(data, [
        ValidationRules.required('fileId'),
        ValidationRules.required('templateId'),
        ValidationRules.isNumber('fileId'),
        ValidationRules.isString('templateId'),
        ValidationRules.isPositive('fileId')
      ]);

      // Verify template exists
      const template = await this.templateRepository.findById(data.templateId);
      if (!template) {
        throw new Error(`Template with id '${data.templateId}' not found`);
      }

      const extraction = await this.extractionRepository.create(data);
      this._logger.info(`Created extraction ${extraction.id} for file ${data.fileId} using template ${data.templateId}`);
      return extraction;
    });
  }

  async getExtractionsByFileId(fileId: number): Promise<Extraction[]> {
    return this.executeWithErrorHandling('getExtractionsByFileId', async () => {
      this.validateInput(fileId, [
        ValidationRules.required('fileId'),
        ValidationRules.isNumber('fileId'),
        ValidationRules.isPositive('fileId')
      ]);

      return await this.extractionRepository.findByFileId(fileId);
    });
  }

  async getExtractionsByTemplateId(templateId: string): Promise<Extraction[]> {
    return this.executeWithErrorHandling('getExtractionsByTemplateId', async () => {
      this.validateInput(templateId, [
        ValidationRules.required('templateId'),
        ValidationRules.isString('templateId'),
        ValidationRules.minLength('templateId', 1)
      ]);

      return await this.extractionRepository.findByTemplateId(templateId);
    });
  }

  // Batch operations
  async extractFromTranscript(
    fileId: number, 
    transcript: TranscriptSegment[], 
    templateIds?: string[]
  ): Promise<Extraction[]> {
    return this.executeWithErrorHandling('extractFromTranscript', async () => {
      this.validateInput(fileId, [
        ValidationRules.required('fileId'),
        ValidationRules.isNumber('fileId'),
        ValidationRules.isPositive('fileId')
      ]);

      this.validateInput(transcript, [
        ValidationRules.required('transcript'),
        ValidationRules.isArray('transcript')
      ]);

      // Get templates to use
      let templates: ExtractionTemplate[];
      if (templateIds && templateIds.length > 0) {
        templates = [];
        for (const templateId of templateIds) {
          const template = await this.templateRepository.findById(templateId);
          if (template) {
            templates.push(template);
          } else {
            this._logger.warn(`Template ${templateId} not found, skipping`);
          }
        }
      } else {
        templates = await this.templateRepository.findActive();
      }

      if (templates.length === 0) {
        this._logger.warn('No templates available for extraction');
        return [];
      }

      const extractions: Extraction[] = [];
      
      for (const template of templates) {
        try {
          const extractionData: NewExtraction = {
            fileId,
            templateId: template.id,
            status: 'active',
            priority: template.defaultPriority || 'medium',
            content: '', // Will be filled by AI processing
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          const extraction = await this.extractionRepository.create(extractionData);
          extractions.push(extraction);
        } catch (error) {
          this._logger.error(`Failed to create extraction for template ${template.id}`,
            error instanceof Error ? error : new Error(String(error)));
        }
      }

      this._logger.info(`Created ${extractions.length} extractions for file ${fileId}`);
      return extractions;
    });
  }

  async extractWithSettings(
    fileId: number, 
    transcript: TranscriptSegment[], 
    settings: ExtractionSettings
  ): Promise<BatchExtractionResult> {
    return this.executeWithErrorHandling('extractWithSettings', async () => {
      const startTime = Date.now();
      const results: ExtractionResult[] = [];
      let successfulExtractions = 0;
      let failedExtractions = 0;

      // Get templates based on settings
      const activeTemplates = await this.templateRepository.findActive();
      const selectedTemplates = activeTemplates.filter(template => {
        // Map template names to settings (this is a simplified mapping)
        const templateName = template.name.toLowerCase();
        if (settings.tasks && templateName.includes('task')) return true;
        if (settings.psychology && templateName.includes('psychology')) return true;
        if (settings.decisions && templateName.includes('decision')) return true;
        if (settings.questions && templateName.includes('question')) return true;
        if (settings.followups && templateName.includes('followup')) return true;
        return false;
      });

      for (const template of selectedTemplates) {
        const extractionStartTime = Date.now();
        
        try {
          const extractionData: NewExtraction = {
            fileId,
            templateId: template.id,
            status: 'active',
            priority: template.defaultPriority || 'medium',
            content: '', // Will be filled by AI processing
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          await this.extractionRepository.create(extractionData);
          
          const executionTime = Date.now() - extractionStartTime;
          results.push({
            type: this.getExtractionTypeFromTemplate(template.name),
            success: true,
            count: 1,
            executionTime,
          });
          
          successfulExtractions++;
        } catch (error) {
          const executionTime = Date.now() - extractionStartTime;
          results.push({
            type: this.getExtractionTypeFromTemplate(template.name),
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            executionTime,
          });
          
          failedExtractions++;
          this._logger.error(`Failed extraction for template ${template.id}`,
            error instanceof Error ? error : new Error(String(error)));
        }
      }

      const totalExecutionTime = Date.now() - startTime;
      
      const batchResult: BatchExtractionResult = {
        success: failedExtractions === 0,
        results,
        totalExecutionTime,
        successfulExtractions,
        failedExtractions,
      };

      this._logger.info(`Batch extraction completed: ${successfulExtractions} successful, ${failedExtractions} failed`);
      return batchResult;
    });
  }

  private getExtractionTypeFromTemplate(templateName: string): 'tasks' | 'psychology' | 'decisions' | 'questions' | 'followups' {
    const name = templateName.toLowerCase();
    if (name.includes('task')) return 'tasks';
    if (name.includes('psychology')) return 'psychology';
    if (name.includes('decision')) return 'decisions';
    if (name.includes('question')) return 'questions';
    if (name.includes('followup')) return 'followups';
    return 'tasks'; // default
  }

  // Additional methods for extraction management (DRY principle - centralize extraction operations)
  async getExtractionById(id: string): Promise<Extraction | null> {
    return this.executeWithErrorHandling('getExtractionById', async () => {
      this.validateInput(id, [
        ValidationRules.required('id'),
        ValidationRules.isString('id'),
        ValidationRules.minLength('id', 1)
      ]);

      return await this.extractionRepository.findById(id);
    });
  }

  async updateExtraction(id: string, data: Partial<NewExtraction>): Promise<Extraction> {
    return this.executeWithErrorHandling('updateExtraction', async () => {
      this.validateInput(id, [
        ValidationRules.required('id'),
        ValidationRules.isString('id'),
        ValidationRules.minLength('id', 1)
      ]);

      const existing = await this.extractionRepository.findById(id);
      if (!existing) {
        throw new Error(`Extraction with id '${id}' not found`);
      }

      const updated = await this.extractionRepository.update(id, {
        ...data,
        updatedAt: new Date().toISOString()
      });

      this._logger.info(`Updated extraction ${id}`);
      return updated;
    });
  }

  async deleteExtraction(id: string): Promise<boolean> {
    return this.executeWithErrorHandling('deleteExtraction', async () => {
      this.validateInput(id, [
        ValidationRules.required('id'),
        ValidationRules.isString('id'),
        ValidationRules.minLength('id', 1)
      ]);

      const deleted = await this.extractionRepository.delete(id);
      if (deleted) {
        this._logger.info(`Deleted extraction ${id}`);
      }
      return deleted;
    });
  }

  // Comment management methods (missing from legacy notesService)
  async addComment(id: string, comment: string): Promise<boolean> {
    return this.executeWithErrorHandling('addComment', async () => {
      this.validateInput(id, [
        ValidationRules.required('id'),
        ValidationRules.isString('id'),
        ValidationRules.minLength('id', 1)
      ]);

      this.validateInput(comment, [
        ValidationRules.required('comment'),
        ValidationRules.isString('comment'),
        ValidationRules.minLength('comment', 1)
      ]);

      const existing = await this.extractionRepository.findById(id);
      if (!existing) {
        return false;
      }

      const currentComments = existing.comments || '';
      const newComments = currentComments
        ? `${currentComments}\n---\n${comment}`
        : comment;

      await this.extractionRepository.update(id, {
        comments: newComments,
        updatedAt: new Date().toISOString()
      });

      this._logger.info(`Added comment to extraction ${id}`);
      return true;
    });
  }

  async updateComment(id: string, comment: string): Promise<boolean> {
    return this.executeWithErrorHandling('updateComment', async () => {
      this.validateInput(id, [
        ValidationRules.required('id'),
        ValidationRules.isString('id'),
        ValidationRules.minLength('id', 1)
      ]);

      this.validateInput(comment, [
        ValidationRules.required('comment'),
        ValidationRules.isString('comment')
      ]);

      const existing = await this.extractionRepository.findById(id);
      if (!existing) {
        return false;
      }

      await this.extractionRepository.update(id, {
        comments: comment,
        updatedAt: new Date().toISOString()
      });

      this._logger.info(`Updated comment for extraction ${id}`);
      return true;
    });
  }

  async toggleStatus(id: string, status: 'active' | 'completed' | 'archived'): Promise<boolean> {
    return this.executeWithErrorHandling('toggleStatus', async () => {
      this.validateInput(id, [
        ValidationRules.required('id'),
        ValidationRules.isString('id'),
        ValidationRules.minLength('id', 1)
      ]);

      this.validateInput(status, [
        ValidationRules.required('status'),
        ValidationRules.oneOf('status', ['active', 'completed', 'archived'])
      ]);

      const existing = await this.extractionRepository.findById(id);
      if (!existing) {
        return false;
      }

      await this.extractionRepository.update(id, {
        status,
        updatedAt: new Date().toISOString()
      });

      this._logger.info(`Updated status for extraction ${id} to ${status}`);
      return true;
    });
  }

  // Statistics and reporting methods
  async getExtractionStats(fileId: number): Promise<{
    total: number;
    active: number;
    completed: number;
    archived: number;
    byPriority: {
      high: number;
      medium: number;
      low: number;
    };
    recentActivity: Array<{
      id: string;
      content: string;
      status: string;
      updatedAt: string;
    }>;
  }> {
    return this.executeWithErrorHandling('getExtractionStats', async () => {
      this.validateInput(fileId, [
        ValidationRules.required('fileId'),
        ValidationRules.isNumber('fileId'),
        ValidationRules.isPositive('fileId')
      ]);

      const extractions = await this.extractionRepository.findByFileId(fileId);

      const stats = {
        total: extractions.length,
        active: extractions.filter(e => e.status === 'active').length,
        completed: extractions.filter(e => e.status === 'completed').length,
        archived: extractions.filter(e => e.status === 'archived').length,
        byPriority: {
          high: extractions.filter(e => e.priority === 'high').length,
          medium: extractions.filter(e => e.priority === 'medium').length,
          low: extractions.filter(e => e.priority === 'low').length,
        },
        recentActivity: extractions
          .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
          .slice(0, 5)
          .map(e => ({
            id: e.id,
            content: e.content.substring(0, 100),
            status: e.status || 'active', // Handle null status
            updatedAt: e.updatedAt,
          })),
      };

      return stats;
    });
  }

  async getGlobalStats(): Promise<{
    total: number;
    active: number;
    completed: number;
    archived: number;
    byPriority: {
      high: number;
      medium: number;
      low: number;
    };
    recentActivity: Array<{
      id: string;
      content: string;
      status: string;
      fileId: number;
      updatedAt: string;
    }>;
    completionRate: number;
  }> {
    return this.executeWithErrorHandling('getGlobalStats', async () => {
      const allExtractions = await this.extractionRepository.findAll();

      const stats = {
        total: allExtractions.length,
        active: allExtractions.filter(e => e.status === 'active').length,
        completed: allExtractions.filter(e => e.status === 'completed').length,
        archived: allExtractions.filter(e => e.status === 'archived').length,
        byPriority: {
          high: allExtractions.filter(e => e.priority === 'high').length,
          medium: allExtractions.filter(e => e.priority === 'medium').length,
          low: allExtractions.filter(e => e.priority === 'low').length,
        },
        recentActivity: allExtractions
          .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
          .slice(0, 10)
          .map(e => ({
            id: e.id,
            content: e.content.substring(0, 100),
            status: e.status || 'active', // Handle null status
            fileId: e.fileId,
            updatedAt: e.updatedAt,
          })),
        completionRate: allExtractions.length > 0
          ? Math.round((allExtractions.filter(e => e.status === 'completed').length / allExtractions.length) * 100)
          : 0,
      };

      return stats;
    });
  }

  async getExtractionsByStatus(status: 'active' | 'completed' | 'archived'): Promise<Extraction[]> {
    return this.executeWithErrorHandling('getExtractionsByStatus', async () => {
      this.validateInput(status, [
        ValidationRules.required('status'),
        ValidationRules.oneOf('status', ['active', 'completed', 'archived'])
      ]);

      return await this.extractionRepository.findByStatus(status);
    });
  }
}
