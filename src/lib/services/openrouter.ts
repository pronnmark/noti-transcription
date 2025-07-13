import { aiExtractsService, settingsService } from '@/lib/db/sqliteServices';

// OpenRouter configuration for Claude 4.0 Sonnet
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
const CLAUDE_4_MODEL = 'anthropic/claude-4';

interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OpenRouterRequest {
  model: string;
  messages: OpenRouterMessage[];
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  stream?: boolean;
}

interface OpenRouterResponse {
  choices: Array<{
    message: {
      content: string;
      role: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class OpenRouterService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = OPENROUTER_BASE_URL;
  }

  private async getApiKey(): Promise<string> {
    try {
      const settings = await settingsService.get();
      const apiKey = settings?.openrouterApiKey || OPENROUTER_API_KEY;
      
      if (!apiKey) {
        throw new Error('OpenRouter API key is required. Please configure it in Settings.');
      }
      
      return apiKey;
    } catch (error) {
      console.error('Error getting OpenRouter API key:', error);
      throw new Error('OpenRouter API key is required. Please configure it in Settings.');
    }
  }

  async chat(messages: OpenRouterMessage[], options: {
    model?: string;
    maxTokens?: number;
    temperature?: number;
    topP?: number;
  } = {}): Promise<string> {
    const {
      model = CLAUDE_4_MODEL,
      maxTokens = 4000,
      temperature = 0.7,
      topP = 0.9
    } = options;

    const request: OpenRouterRequest = {
      model,
      messages,
      max_tokens: maxTokens,
      temperature,
      top_p: topP,
      stream: false
    };

    try {
      const apiKey = await this.getApiKey();
      
      console.log(`🤖 Making OpenRouter request to ${model}...`);
      console.log(`Messages: ${messages.length}, Max tokens: ${maxTokens}`);

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://noti.local',
          'X-Title': 'Noti Audio Transcription'
        },
        body: JSON.stringify(request)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenRouter API error (${response.status}): ${errorText}`);
      }

      const data: OpenRouterResponse = await response.json();
      
      if (!data.choices || data.choices.length === 0) {
        throw new Error('No response from OpenRouter API');
      }

      const content = data.choices[0].message.content;
      console.log(`✅ OpenRouter response received: ${content.length} characters`);
      console.log(`Token usage: ${data.usage.total_tokens} total (${data.usage.prompt_tokens} prompt + ${data.usage.completion_tokens} completion)`);

      return content;
    } catch (error) {
      console.error('OpenRouter API error:', error);
      throw error;
    }
  }

  async extractFromTranscript(
    transcript: string, 
    prompt: string = 'Summarize the key points from this transcript.',
    model: string = CLAUDE_4_MODEL
  ): Promise<string> {
    if (!transcript || transcript.trim().length === 0) {
      throw new Error('Transcript is empty or invalid');
    }

    const messages: OpenRouterMessage[] = [
      {
        role: 'system',
        content: `You are an AI assistant specialized in analyzing audio transcripts. 
        You provide clear, structured summaries and extract key information as requested.
        Always respond in Swedish when the transcript is in Swedish.
        Focus on accuracy and relevance.`
      },
      {
        role: 'user',
        content: `${prompt}\n\nTranscript:\n${transcript}`
      }
    ];

    return this.chat(messages, { 
      model,
      maxTokens: 2000,
      temperature: 0.3  // Lower temperature for more consistent extraction
    });
  }
}

// Export singleton instance
export const openRouterService = new OpenRouterService();

// AI Extraction functions
export async function createAIExtract(
  fileId: number,
  transcript: string,
  prompt?: string,
  model?: string,
  templateId?: string
): Promise<string> {
  try {
    console.log(`🤖 Starting AI extraction for file ${fileId}...`);
    
    const extractedContent = await openRouterService.extractFromTranscript(
      transcript,
      prompt,
      model || CLAUDE_4_MODEL
    );

    // Save to database
    await aiExtractsService.create({
      fileId,
      templateId,
      model: model || CLAUDE_4_MODEL,
      prompt: prompt || 'Summarize the key points from this transcript.',
      content: extractedContent
    });

    console.log(`✅ AI extraction completed for file ${fileId}`);
    return extractedContent;
  } catch (error) {
    console.error('AI extraction error:', error);
    throw error;
  }
}

// Helper to get available models
export function getAvailableModels() {
  return [
    {
      id: 'anthropic/claude-4',
      name: 'Claude 4.0 Sonnet',
      description: 'Most capable Claude model for complex analysis'
    },
    {
      id: 'anthropic/claude-3.5-sonnet',
      name: 'Claude 3.5 Sonnet',
      description: 'Fast and capable for most tasks'
    },
    {
      id: 'anthropic/claude-3-haiku',
      name: 'Claude 3 Haiku',
      description: 'Fastest and most economical'
    },
    {
      id: 'openai/gpt-4o',
      name: 'GPT-4o',
      description: 'OpenAI\'s multimodal flagship model'
    },
    {
      id: 'google/gemini-pro-1.5',
      name: 'Gemini Pro 1.5',
      description: 'Google\'s advanced language model'
    }
  ];
}