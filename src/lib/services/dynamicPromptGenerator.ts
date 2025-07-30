// Simplified prompt generator focused on summarization only
// Extraction functionality removed as it's not a requirement

import { getSupabase } from '../database/client';
import { debugLog } from '../utils';

export interface DynamicPromptConfig {
  summarizationPromptId?: string;
  useCustomSummarizationPrompt?: string;
}

export interface GeneratedPrompt {
  systemPrompt: string;
  expectedJsonSchema: any;
}

export interface ParseAndStoreResult {
  success: boolean;
  summarizationResult?: any;
  error?: string;
}

export class DynamicPromptGenerator {
  private supabase = getSupabase();

  async generatePrompt(config: DynamicPromptConfig): Promise<GeneratedPrompt> {
    try {
      let systemPrompt: string;
      
      // Use custom prompt if provided
      if (config.useCustomSummarizationPrompt) {
        systemPrompt = config.useCustomSummarizationPrompt;
      } else if (config.summarizationPromptId) {
        // Fetch template from database
        const { data: template, error } = await this.supabase
          .from('summarization_templates')
          .select('template')
          .eq('id', config.summarizationPromptId)
          .single();
        
        if (error || !template) {
          debugLog('dynamicPrompt', 'Template not found, using default');
          systemPrompt = this.getDefaultSystemPrompt();
        } else {
          systemPrompt = template.template;
        }
      } else {
        systemPrompt = this.getDefaultSystemPrompt();
      }

      return {
        systemPrompt,
        expectedJsonSchema: this.getExpectedJsonSchema(),
      };
    } catch (error) {
      debugLog('dynamicPrompt', 'Error generating prompt:', error);
      return {
        systemPrompt: this.getDefaultSystemPrompt(),
        expectedJsonSchema: this.getExpectedJsonSchema(),
      };
    }
  }

  async parseAndStoreResults(
    fileId: number,
    aiResponse: string,
    sessionId: string,
    model: string,
    summarizationPromptId?: string
  ): Promise<ParseAndStoreResult> {
    try {
      // Handle empty response (fallback case)
      if (!aiResponse || aiResponse.trim() === '') {
        const fallbackResult = {
          summary: 'AI processing failed, no summary available',
          key_points: [],
          sentiment: 'neutral',
        };

        const { error: insertError } = await this.supabase
          .from('summarizations')
          .insert({
            file_id: fileId,
            template_id: summarizationPromptId || null,
            result: fallbackResult,
            session_id: sessionId,
            model: model,
            status: 'fallback',
            created_at: new Date().toISOString(),
          });

        if (insertError) {
          debugLog('dynamicPrompt', 'Failed to store fallback result:', insertError);
        }

        return {
          success: true,
          summarizationResult: fallbackResult,
        };
      }

      // Try to parse JSON response
      let parsedResult;
      try {
        parsedResult = JSON.parse(aiResponse);
      } catch (parseError) {
        // If not JSON, treat as plain text summary
        parsedResult = {
          summary: aiResponse,
          key_points: [],
          sentiment: 'neutral',
        };
      }

      // Store in database
      const { error: insertError } = await this.supabase
        .from('summarizations')
        .insert({
          file_id: fileId,
          template_id: summarizationPromptId || null,
          result: parsedResult,
          session_id: sessionId,
          model: model,
          status: 'completed',
          created_at: new Date().toISOString(),
        });

      if (insertError) {
        debugLog('dynamicPrompt', 'Failed to store result:', insertError);
        return {
          success: false,
          error: `Failed to store summarization: ${insertError.message}`,
        };
      }

      return {
        success: true,
        summarizationResult: parsedResult,
      };
    } catch (error) {
      debugLog('dynamicPrompt', 'Error parsing and storing results:', error);
      return {
        success: false,
        error: `Failed to process results: ${String(error)}`,
      };
    }
  }

  async getActiveSummarizationPrompts(): Promise<any[]> {
    try {
      const { data, error } = await this.supabase
        .from('summarization_templates')
        .select('*')
        .eq('active', true)
        .order('name');

      if (error) {
        debugLog('dynamicPrompt', 'Failed to fetch templates:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      debugLog('dynamicPrompt', 'Error fetching templates:', error);
      return [];
    }
  }

  private getDefaultSystemPrompt(): string {
    return `You are an expert at analyzing and summarizing audio transcripts. 
Please analyze the provided transcript and create a comprehensive summary.

Focus on:
- Main topics and themes discussed
- Key decisions or action items
- Important insights or conclusions
- Overall sentiment and tone

Provide your response as a JSON object with the following structure:
{
  "summary": "A comprehensive summary of the transcript",
  "key_points": ["List of key points discussed"],
  "action_items": ["Any action items or decisions made"],
  "sentiment": "overall sentiment (positive/negative/neutral)",
  "topics": ["Main topics covered"]
}`;
  }

  private getExpectedJsonSchema(): any {
    return {
      type: 'object',
      properties: {
        summary: { type: 'string' },
        key_points: {
          type: 'array',
          items: { type: 'string' }
        },
        action_items: {
          type: 'array',
          items: { type: 'string' }
        },
        sentiment: {
          type: 'string',
          enum: ['positive', 'negative', 'neutral']
        },
        topics: {
          type: 'array',
          items: { type: 'string' }
        }
      },
      required: ['summary', 'key_points', 'sentiment']
    };
  }
}

// Export singleton instance
export const dynamicPromptGenerator = new DynamicPromptGenerator();
