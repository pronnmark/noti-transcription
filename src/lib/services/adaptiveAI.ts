import { customAIService } from './customAI';
import type { AIGenerationOptions } from './ai/AIProvider';
import type { AIProvider } from './ai/AIProvider';
import { getSupabase } from '@/lib/database/client';

interface SummarizationOptions {
  templateId?: string;
  customPrompt?: string;
  model?: string;
}

interface SummarizationResult {
  content: string;
  model: string;
  prompt: string;
  metadata?: {
    processingTime?: number;
    tokenCount?: number;
    [key: string]: any;
  };
}

/**
 * AdaptiveAIService - Simplified version for summarization only
 *
 * This service adapts to user-defined templates and prompts to provide
 * flexible AI-powered summarization of transcripts.
 */
export class AdaptiveAIService {
  private aiProvider: AIProvider;
  private defaultModel = 'anthropic/claude-sonnet-4';

  constructor() {
    this.aiProvider = customAIService;
  }

  /**
   * Summarize a transcript using adaptive templates or custom prompts
   */
  async summarizeTranscript(
    transcript: string,
    options: SummarizationOptions = {}
  ): Promise<SummarizationResult> {
    const { templateId, customPrompt, model = this.defaultModel } = options;

    // Get template if provided
    let template = null;
    let validatedTemplateId = null;
    if (templateId) {
      const supabase = getSupabase();

      const { data: result, error } = await supabase
        .from('summarization_prompts')
        .select('*')
        .eq('id', templateId)
        .eq('is_active', true)
        .limit(1)
        .single();

      template = error ? null : result;

      if (!template) {
        console.warn(
          `⚠️ Invalid template ID provided: ${templateId}. Falling back to default summarization.`
        );
        validatedTemplateId = null; // Use null instead of invalid ID
      } else {
        validatedTemplateId = templateId;
      }
    }

    // Build the prompt
    const basePrompt = `
Please analyze and summarize the following transcript. Focus on:
1. Main topics discussed
2. Key decisions or outcomes
3. Action items or next steps
4. Important details or insights

Transcript:
${transcript}

Please provide a well-structured summary that captures the essential information.`;

    const prompt = customPrompt || template?.prompt || basePrompt;

    // Generate summary
    const startTime = Date.now();

    try {
      const generationOptions: AIGenerationOptions = {
        systemPrompt:
          template?.system_prompt ||
          'You are an AI assistant specialized in creating clear, structured summaries of audio transcripts. Focus on accuracy and relevance.',
        model,
        temperature: 0.3,
        maxTokens: 1000,
      };

      const summary = await this.aiProvider.generateText(
        prompt,
        generationOptions
      );

      const processingTime = Date.now() - startTime;

      return {
        content: summary,
        model,
        prompt,
        metadata: {
          processingTime,
          templateId: validatedTemplateId,
          templateName: template?.name,
        },
      };
    } catch (error) {
      console.error('❌ Summarization failed:', error);
      throw new Error(
        `Failed to summarize transcript: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  /**
   * Get available models
   */
  async getAvailableModels() {
    // Return a static list of available models for now
    return [
      { id: 'anthropic/claude-sonnet-4', name: 'Claude 3 Sonnet' },
      { id: 'gpt-4', name: 'GPT-4' },
      { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' },
    ];
  }
}

// Export singleton instance
export const adaptiveAIService = new AdaptiveAIService();
