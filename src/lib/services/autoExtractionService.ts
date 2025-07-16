import { settingsService } from '../db/sqliteServices';
import { extractNotesFromTranscript } from './notesExtractor';
import { psychologyService } from './psychologyService';
import type { TranscriptSegment } from '../db/sqliteSchema';

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

export const autoExtractionService = {
  /**
   * Get current auto-extraction settings from database
   */
  async getAutoExtractionSettings(): Promise<ExtractionSettings> {
    try {
      const settings = await settingsService.get();
      
      // Default settings if not configured
      const defaultSettings: ExtractionSettings = {
        tasks: true,
        psychology: false,
        decisions: false,
        questions: false,
        followups: false,
      };

      if (!settings?.extractionAutoRun) {
        return defaultSettings;
      }

      // Parse the JSON settings
      const autoRunSettings = typeof settings.extractionAutoRun === 'string' 
        ? JSON.parse(settings.extractionAutoRun) 
        : settings.extractionAutoRun;

      return {
        tasks: autoRunSettings.tasks ?? defaultSettings.tasks,
        psychology: autoRunSettings.psychology ?? defaultSettings.psychology,
        decisions: autoRunSettings.decisions ?? defaultSettings.decisions,
        questions: autoRunSettings.questions ?? defaultSettings.questions,
        followups: autoRunSettings.followups ?? defaultSettings.followups,
      };
    } catch (error) {
      console.error('Error getting auto-extraction settings:', error);
      // Return default settings on error
      return {
        tasks: true,
        psychology: false,
        decisions: false,
        questions: false,
        followups: false,
      };
    }
  },

  /**
   * Update auto-extraction settings in database
   */
  async updateAutoExtractionSettings(settings: ExtractionSettings): Promise<boolean> {
    try {
      await settingsService.update({
        extractionAutoRun: JSON.stringify(settings),
      });
      
      console.log('Auto-extraction settings updated:', settings);
      return true;
    } catch (error) {
      console.error('Error updating auto-extraction settings:', error);
      return false;
    }
  },

  /**
   * Check if psychological evaluation is enabled
   */
  async isPsychologyEnabled(): Promise<boolean> {
    try {
      const settings = await settingsService.get();
      return settings?.psychEvalEnabled ?? false;
    } catch (error) {
      console.error('Error checking psychology enabled status:', error);
      return false;
    }
  },

  /**
   * Check if psychological evaluation auto-run is enabled
   */
  async isPsychologyAutoRunEnabled(): Promise<boolean> {
    try {
      const settings = await settingsService.get();
      return settings?.psychEvalAutoRun ?? false;
    } catch (error) {
      console.error('Error checking psychology auto-run status:', error);
      return false;
    }
  },

  /**
   * Run automatic extractions based on settings
   */
  async runAutoExtractions(
    fileId: number,
    transcript: TranscriptSegment[]
  ): Promise<BatchExtractionResult> {
    const startTime = Date.now();
    const results: ExtractionResult[] = [];
    
    console.log(`🤖 Starting auto-extraction for file ${fileId}...`);

    try {
      // Get current settings
      const settings = await this.getAutoExtractionSettings();
      const psychologyEnabled = await this.isPsychologyEnabled();
      const psychologyAutoRun = await this.isPsychologyAutoRunEnabled();

      console.log('Auto-extraction settings:', {
        ...settings,
        psychologyEnabled,
        psychologyAutoRun
      });

      // Prepare extraction tasks
      const extractionTasks: Array<{
        type: keyof ExtractionSettings;
        enabled: boolean;
        execute: () => Promise<ExtractionResult>;
      }> = [
        {
          type: 'tasks',
          enabled: settings.tasks,
          execute: () => this.extractTasks(fileId, transcript)
        },
        {
          type: 'psychology',
          enabled: psychologyEnabled && (psychologyAutoRun || settings.psychology),
          execute: () => this.extractPsychology(fileId, transcript)
        },
        {
          type: 'decisions',
          enabled: settings.decisions,
          execute: () => this.extractDecisions(fileId, transcript)
        },
        {
          type: 'questions',
          enabled: settings.questions,
          execute: () => this.extractQuestions(fileId, transcript)
        },
        {
          type: 'followups',
          enabled: settings.followups,
          execute: () => this.extractFollowups(fileId, transcript)
        }
      ];

      // Execute enabled extractions in parallel
      const enabledTasks = extractionTasks.filter(task => task.enabled);
      
      if (enabledTasks.length === 0) {
        console.log('No auto-extractions enabled');
        return {
          success: true,
          results: [],
          totalExecutionTime: Date.now() - startTime,
          successfulExtractions: 0,
          failedExtractions: 0
        };
      }

      console.log(`Running ${enabledTasks.length} auto-extractions: ${enabledTasks.map(t => t.type).join(', ')}`);

      // Execute all enabled extractions in parallel
      const extractionPromises = enabledTasks.map(task => task.execute());
      const extractionResults = await Promise.all(extractionPromises);

      results.push(...extractionResults);

      const totalExecutionTime = Date.now() - startTime;
      const successfulExtractions = results.filter(r => r.success).length;
      const failedExtractions = results.filter(r => !r.success).length;

      console.log(`✅ Auto-extraction completed for file ${fileId}:`);
      console.log(`- Successful: ${successfulExtractions}/${results.length}`);
      console.log(`- Failed: ${failedExtractions}/${results.length}`);
      console.log(`- Total time: ${totalExecutionTime}ms`);

      return {
        success: true,
        results,
        totalExecutionTime,
        successfulExtractions,
        failedExtractions
      };

    } catch (error) {
      console.error('Auto-extraction batch error:', error);
      
      return {
        success: false,
        results,
        totalExecutionTime: Date.now() - startTime,
        successfulExtractions: results.filter(r => r.success).length,
        failedExtractions: results.filter(r => !r.success).length + 1
      };
    }
  },

  /**
   * Extract tasks (notes extraction)
   */
  async extractTasks(fileId: number, transcript: TranscriptSegment[]): Promise<ExtractionResult> {
    const startTime = Date.now();
    
    try {
      console.log(`🔍 Extracting tasks for file ${fileId}...`);
      
      const result = await extractNotesFromTranscript(fileId, transcript);
      
      return {
        type: 'tasks',
        success: result.success,
        count: result.notesCount,
        error: result.error,
        executionTime: Date.now() - startTime
      };
    } catch (error) {
      console.error('Task extraction error:', error);
      return {
        type: 'tasks',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime: Date.now() - startTime
      };
    }
  },

  /**
   * Extract psychological evaluation
   */
  async extractPsychology(fileId: number, transcript: TranscriptSegment[]): Promise<ExtractionResult> {
    const startTime = Date.now();
    
    try {
      console.log(`🧠 Extracting psychology for file ${fileId}...`);
      
      const result = await psychologyService.evaluateTranscript(fileId, transcript);
      
      return {
        type: 'psychology',
        success: result.success,
        count: result.success ? 1 : 0,
        error: result.error,
        executionTime: Date.now() - startTime
      };
    } catch (error) {
      console.error('Psychology extraction error:', error);
      return {
        type: 'psychology',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime: Date.now() - startTime
      };
    }
  },

  /**
   * Extract decisions (using notes extraction with decision type)
   */
  async extractDecisions(fileId: number, transcript: TranscriptSegment[]): Promise<ExtractionResult> {
    const startTime = Date.now();
    
    try {
      console.log(`⚖️ Extracting decisions for file ${fileId}...`);
      
      // This would use the same notes extraction but filtered for decisions
      // For now, we'll count it as part of the general notes extraction
      const result = await extractNotesFromTranscript(fileId, transcript);
      
      return {
        type: 'decisions',
        success: result.success,
        count: result.success ? 1 : 0, // Placeholder - would need decision-specific counting
        error: result.error,
        executionTime: Date.now() - startTime
      };
    } catch (error) {
      console.error('Decision extraction error:', error);
      return {
        type: 'decisions',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime: Date.now() - startTime
      };
    }
  },

  /**
   * Extract questions (using notes extraction with question type)
   */
  async extractQuestions(fileId: number, transcript: TranscriptSegment[]): Promise<ExtractionResult> {
    const startTime = Date.now();
    
    try {
      console.log(`❓ Extracting questions for file ${fileId}...`);
      
      // This would use the same notes extraction but filtered for questions
      const result = await extractNotesFromTranscript(fileId, transcript);
      
      return {
        type: 'questions',
        success: result.success,
        count: result.success ? 1 : 0, // Placeholder - would need question-specific counting
        error: result.error,
        executionTime: Date.now() - startTime
      };
    } catch (error) {
      console.error('Question extraction error:', error);
      return {
        type: 'questions',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime: Date.now() - startTime
      };
    }
  },

  /**
   * Extract follow-ups (using notes extraction with followup type)
   */
  async extractFollowups(fileId: number, transcript: TranscriptSegment[]): Promise<ExtractionResult> {
    const startTime = Date.now();
    
    try {
      console.log(`📅 Extracting follow-ups for file ${fileId}...`);
      
      // This would use the same notes extraction but filtered for followups
      const result = await extractNotesFromTranscript(fileId, transcript);
      
      return {
        type: 'followups',
        success: result.success,
        count: result.success ? 1 : 0, // Placeholder - would need followup-specific counting
        error: result.error,
        executionTime: Date.now() - startTime
      };
    } catch (error) {
      console.error('Follow-up extraction error:', error);
      return {
        type: 'followups',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime: Date.now() - startTime
      };
    }
  },

  /**
   * Get extraction statistics
   */
  async getExtractionStats(): Promise<{
    totalExtractions: number;
    successRate: number;
    averageExecutionTime: number;
    mostUsedExtraction: string;
  }> {
    // This would be implemented with proper logging/analytics
    // For now, return placeholder data
    return {
      totalExtractions: 0,
      successRate: 0,
      averageExecutionTime: 0,
      mostUsedExtraction: 'tasks'
    };
  }
};