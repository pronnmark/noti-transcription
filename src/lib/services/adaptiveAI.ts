// Removed logging dependency
import { customAIService } from './customAI';

export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
  speaker?: string;
}

export interface ProcessingOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  retryOnFailure?: boolean;
}

export interface ExtractionResult {
  id: string;
  templateId: string;
  content: string;
  context?: string;
  speaker?: string;
  timestamp?: number;
  priority: 'high' | 'medium' | 'low';
  metadata?: any;
}

export interface DataPointResult {
  id: string;
  templateId: string;
  analysisResults: any;
  model: string;
}

export interface SummarizationResult {
  id: string;
  templateId?: string;
  content: string;
  model: string;
  prompt: string;
}

/**
 * Adaptive AI Service - Core engine for flexible AI processing
 *
 * This service adapts to user-defined templates and prompts to provide
 * configurable AI analysis of transcripts.
 */
export class AdaptiveAIService {
  private defaultTemperature = 0.3;
  private defaultMaxTokens = 4000;
  private defaultModel = 'anthropic/claude-sonnet-4';

  /**
   * Process transcript for summarization using a template or custom prompt
   */
  async generateSummarization(
    fileId: number,
    transcript: string | TranscriptSegment[],
    options: {
      templateId?: string;
      customPrompt?: string;
      model?: string;
    } = {},
  ): Promise<SummarizationResult> {
    const { templateId, customPrompt, model = this.defaultModel } = options;

    // Get template if provided - using correct summarizationPrompts table
    let template = null;
    let validatedTemplateId = null;
    if (templateId) {
      const { getDb } = await import('@/lib/database/client');
      // Removed schema import - using Supabase queries
      // Removed drizzle-orm dependency

      const result = await getDb()
        .select()
        .from(summarizationPrompts)
        .where(
          and(
            eq(summarizationPrompts.id, templateId),
            eq(summarizationPrompts.isActive, true),
          ),
        )
        .limit(1);

      template = result[0] || null;

      if (!template) {
        console.warn(
          `⚠️ Invalid template ID provided: ${templateId}. Falling back to default summarization.`,
        );
        validatedTemplateId = null; // Use null instead of invalid ID
      } else {
        validatedTemplateId = templateId;
      }
    }

    // Format transcript text
    const transcriptText = this.formatTranscriptForAI(transcript);

    // Use template prompt or custom prompt or default
    const prompt =
      customPrompt ||
      template?.prompt ||
      `
      Please provide a comprehensive summary of the following transcript:
      
      Guidelines:
      1. Identify key topics and themes
      2. Highlight important decisions made
      3. Note any action items or follow-ups
      4. Summarize the main outcomes
      5. Keep it concise but comprehensive
      
      Transcript:
      {transcript}
    `;

    // Replace transcript placeholder
    const finalPrompt = prompt.replace('{transcript}', transcriptText);

    // Generate summary using AI
    const summary = await customAIService.generateText(finalPrompt, {
      model: options?.model,
      temperature: this.defaultTemperature,
      maxTokens: this.calculateMaxTokens(transcriptText),
      systemPrompt:
        'You are an AI assistant specialized in creating clear, structured summaries of audio transcripts. Focus on accuracy and relevance.',
    });

    // Store in database using validated template ID
    // Removed schema import - using Supabase queries
    const db = await import('@/lib/database/client').then(m => m.getDb());

    const [summarization] = await db
      .insert(summarizations)
      .values({
        fileId: fileId,
        templateId: validatedTemplateId,
        model: model,
        prompt: finalPrompt,
        content: summary,
      })
      .returning();

    return {
      id: summarization.id,
      templateId: validatedTemplateId || undefined,
      content: summary,
      model,
      prompt: finalPrompt,
    };
  }

  /**
   * Process transcript for extractions using templates
   */
  async processExtractions(
    fileId: number,
    transcript: string | TranscriptSegment[],
    templateIds: string[],
    options: ProcessingOptions = {},
  ): Promise<ExtractionResult[]> {
    const { model = this.defaultModel, temperature = this.defaultTemperature } =
      options;

    // Get templates
    // Removed schema import - using Supabase queries
    // Removed drizzle-orm dependency
    const db = await import('@/lib/database/client').then(m => m.getDb());

    const templates = await db
      .select()
      .from(extractionTemplates)
      .where(inArray(extractionTemplates.id, templateIds));

    if (templates.length === 0) {
      throw new Error('No valid templates found for extraction');
    }

    const transcriptText = this.formatTranscriptForAI(transcript);
    const results: ExtractionResult[] = [];

    // Process each template
    for (const template of templates) {
      try {
        console.log(`🔍 Processing extraction template: ${template.name}`);

        // Replace transcript placeholder in prompt
        const finalPrompt = template.prompt.replace(
          '{transcript}',
          transcriptText,
        );

        // Generate extraction using AI
        const extractionContent = await customAIService.generateText(
          finalPrompt,
          {
            model: options?.model,
            temperature,
            maxTokens: this.calculateMaxTokens(transcriptText, 0.3),
            systemPrompt: `You are an AI assistant specialized in extracting specific information from transcripts. Follow the provided instructions exactly and return results in the requested format.`,
          },
        );

        // Parse the extraction results
        const parsedResults = this.parseExtractionResults(
          extractionContent,
          template,
        );

        // Store each extracted item in the database
        for (const item of parsedResults) {
          // Removed schema import - using Supabase queries
          const [extraction] = await db
            .insert(extractions)
            .values({
              fileId: fileId,
              templateId: template.id,
              content: item.content,
              context: item.context || null,
              speaker: item.speaker || null,
              timestamp: item.timestamp || null,
              priority: item.priority || 'medium',
              status: 'active',
              metadata: JSON.stringify(item.metadata || {}),
              comments: null,
            })
            .returning();

          results.push({
            id: extraction.id,
            templateId: template.id,
            content: item.content,
            context: item.context,
            speaker: item.speaker,
            timestamp: item.timestamp,
            priority: item.priority || 'medium',
            metadata: item.metadata,
          });
        }

        console.log(
          `✅ Extracted ${parsedResults.length} items using template: ${template.name}`,
        );
      } catch (error) {
        console.error(`❌ Error processing template ${template.name}:`, error);
        if (!options.retryOnFailure) {
          throw error;
        }
      }
    }

    return results;
  }

  /**
   * Process transcript for data point analysis using templates
   */
  async processDataPoints(
    fileId: number,
    transcript: string | TranscriptSegment[],
    templateIds: string[],
    options: ProcessingOptions = {},
  ): Promise<DataPointResult[]> {
    const { model = this.defaultModel, temperature = 0.1 } = options; // Lower temperature for consistent analysis

    // Get templates
    // Removed schema import - using Supabase queries
    // Removed drizzle-orm dependency
    const db = await import('@/lib/database/client').then(m => m.getDb());

    const templates = await db
      .select()
      .from(dataPointTemplates)
      .where(inArray(dataPointTemplates.id, templateIds));

    if (templates.length === 0) {
      throw new Error('No valid templates found for data point analysis');
    }

    const transcriptText = this.formatTranscriptForAI(transcript);
    const results: DataPointResult[] = [];

    // Process each template
    for (const template of templates) {
      try {
        console.log(`📊 Processing data point template: ${template.name}`);

        // Replace transcript placeholder in prompt
        const finalPrompt = template.analysisPrompt.replace(
          '{transcript}',
          transcriptText,
        );

        // Generate analysis using AI
        const analysisContent = await customAIService.generateText(
          finalPrompt,
          {
            model: options?.model,
            temperature,
            maxTokens: this.calculateMaxTokens(transcriptText, 0.2),
            systemPrompt: `You are an AI assistant specialized in analyzing transcripts and generating structured data points. Follow the provided schema exactly and return valid JSON.`,
          },
        );

        // Parse and validate the analysis results
        const analysisResults = this.parseDataPointResults(
          analysisContent,
          template,
        );

        // Store in database
        // Removed schema import - using Supabase queries
        const [dataPoint] = await db
          .insert(dataPoints)
          .values({
            fileId: fileId,
            templateId: template.id,
            analysisResults: JSON.stringify(analysisResults),
            model: model,
          })
          .returning();

        results.push({
          id: dataPoint.id,
          templateId: template.id,
          analysisResults,
          model,
        });

        console.log(
          `✅ Generated data points using template: ${template.name}`,
        );
      } catch (error) {
        console.error(`❌ Error processing template ${template.name}:`, error);
        if (!options.retryOnFailure) {
          throw error;
        }
      }
    }

    return results;
  }

  /**
   * Process a file with default templates for all three types
   */
  async processFileWithDefaults(
    fileId: number,
    transcript: string | TranscriptSegment[],
    options: ProcessingOptions = {},
  ): Promise<{
    summarization?: SummarizationResult;
    extractions: ExtractionResult[];
    dataPoints: DataPointResult[];
  }> {
    // Get default templates
    // Removed schema import - using Supabase queries
    // Removed drizzle-orm dependency
    const db = await import('@/lib/database/client').then(m => m.getDb());

    const defaultExtractionTemplates = await db
      .select()
      .from(extractionTemplates)
      .where(eq(extractionTemplates.isDefault, true));

    // Removed schema import - using Supabase queries

    const defaultDataPointTemplates = await db
      .select()
      .from(dataPointTemplates)
      .where(eq(dataPointTemplates.isDefault, true));

    const results = {
      extractions: [] as ExtractionResult[],
      dataPoints: [] as DataPointResult[],
    };

    // Generate default summarization
    let summarization: SummarizationResult | undefined;
    try {
      summarization = await this.generateSummarization(
        fileId,
        transcript,
        options,
      );
    } catch (error) {
      console.error('Error generating default summarization:', error);
    }

    // Process default extractions
    if (defaultExtractionTemplates.length > 0) {
      try {
        results.extractions = await this.processExtractions(
          fileId,
          transcript,
          defaultExtractionTemplates.map(t => t.id),
          options,
        );
      } catch (error) {
        console.error('Error processing default extractions:', error);
      }
    }

    // Process default data points
    if (defaultDataPointTemplates.length > 0) {
      try {
        results.dataPoints = await this.processDataPoints(
          fileId,
          transcript,
          defaultDataPointTemplates.map(t => t.id),
          options,
        );
      } catch (error) {
        console.error('Error processing default data points:', error);
      }
    }

    return { summarization, ...results };
  }

  /**
   * Helper: Format transcript for AI processing
   */
  private formatTranscriptForAI(
    transcript: string | TranscriptSegment[],
  ): string {
    if (typeof transcript === 'string') {
      return transcript;
    }

    return transcript
      .map(segment => {
        const speaker = segment.speaker ? `${segment.speaker}: ` : '';
        const timestamp = `[${Math.floor(segment.start / 60)}:${String(Math.floor(segment.start % 60)).padStart(2, '0')}] `;
        return `${timestamp}${speaker}${segment.text}`;
      })
      .join('\n');
  }

  /**
   * Helper: Calculate appropriate max tokens based on transcript length
   */
  private calculateMaxTokens(
    transcript: string,
    outputRatio: number = 0.25,
  ): number {
    const transcriptTokens = Math.ceil(transcript.length / 4);
    return Math.min(
      Math.max(500, Math.ceil(transcriptTokens * outputRatio)),
      8000,
    );
  }

  /**
   * Helper: Parse extraction results from AI response
   */
  private parseExtractionResults(content: string, template: any): any[] {
    try {
      // Try to parse as JSON first
      const parsed = JSON.parse(content);
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      // If not JSON, try to extract structured data
      const lines = content.split('\n').filter(line => line.trim());
      return lines.map(line => ({
        content: line.trim(),
        priority: 'medium' as const,
        metadata: { template: template.name },
      }));
    }
  }

  /**
   * Helper: Parse and validate data point results from AI response
   */
  private parseDataPointResults(content: string, template: any): any {
    try {
      // Extract JSON from the response (handle cases where AI adds extra text)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      // Try parsing the entire content as JSON
      return JSON.parse(content);
    } catch (error) {
      console.warn(
        `Failed to parse data point results for template ${template.name}:`,
        error,
      );
      // Return a fallback structure
      return {
        error: 'Failed to parse analysis results',
        rawContent: content,
        template: template.name,
      };
    }
  }
}

// Lazy-loaded singleton instance
let _adaptiveAIService: AdaptiveAIService | null = null;

export function getAdaptiveAIService(): AdaptiveAIService {
  if (!_adaptiveAIService) {
    _adaptiveAIService = new AdaptiveAIService();
  }
  return _adaptiveAIService;
}

// Export getter proxy for backward compatibility
export const adaptiveAIService = new Proxy({} as AdaptiveAIService, {
  get(target, prop, receiver) {
    const service = getAdaptiveAIService();
    return Reflect.get(service, prop, receiver);
  },
});
