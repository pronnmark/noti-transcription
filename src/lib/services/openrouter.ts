import { aiExtractsService, settingsService } from '@/lib/db/sqliteServices';
import { promises as fs } from 'fs';
import { join } from 'path';

// OpenRouter configuration for Claude
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
const CLAUDE_4_MODEL = 'anthropic/claude-sonnet-4'; // Default model

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
      // Try to read from file-based settings first
      let apiKey: string | undefined;
      
      try {
        const settingsPath = join(process.cwd(), 'data', 'settings', 'settings.json');
        const settingsData = await fs.readFile(settingsPath, 'utf-8');
        const fileSettings = JSON.parse(settingsData);
        apiKey = fileSettings?.ai?.openrouterApiKey;
      } catch (fileError) {
        // File doesn't exist or invalid, try database
        console.log('Could not read file settings, trying database...');
        const settings = await settingsService.get();
        apiKey = settings?.openrouterApiKey;
      }
      
      // Fall back to environment variable
      apiKey = apiKey || OPENROUTER_API_KEY;
      
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

      console.log(`🔑 Using API key: ${apiKey.substring(0, 10)}...${apiKey.substring(apiKey.length - 4)}`);
      
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
        console.error(`OpenRouter API error response: ${errorText}`);
        let errorMessage = `OpenRouter API error (${response.status}): ${errorText}`;
        
        // Parse common error patterns
        try {
          const errorJson = JSON.parse(errorText);
          if (errorJson.error?.message) {
            errorMessage = errorJson.error.message;
            
            // Add helpful context for specific errors
            if (response.status === 403 && errorMessage.includes('Key limit exceeded')) {
              errorMessage = '⚠️ OpenRouter API key limit exceeded!\n\n' +
                '1. Get a new API key from: https://openrouter.ai/settings/keys\n' +
                '2. Update it in Settings > API Keys > OpenRouter API Key\n\n' +
                'Current key: ' + apiKey.substring(0, 15) + '...';
            } else if (response.status === 401) {
              errorMessage = '🔑 Invalid OpenRouter API key. Please check your key in Settings > API Keys.';
            }
          }
        } catch {
          // Keep original error text
        }
        
        throw new Error(errorMessage);
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

    // Calculate appropriate max tokens based on transcript length
    // Roughly 1 token per 4 characters, and we want output to be ~20-30% of input
    const transcriptTokens = Math.ceil(transcript.length / 4);
    const maxOutputTokens = Math.min(
      Math.max(1000, Math.ceil(transcriptTokens * 0.25)), // 25% of input tokens
      8000 // Cap at 8k tokens for very long transcripts
    );
    
    console.log(`📊 Transcript analysis: ${transcript.length} chars ≈ ${transcriptTokens} tokens`);
    console.log(`📊 Setting max output tokens to: ${maxOutputTokens}`);
    
    return this.chat(messages, { 
      model,
      maxTokens: maxOutputTokens,
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

// Helper to get available models with context windows
export function getAvailableModels() {
  return [
    {
      id: 'anthropic/claude-4.0-sonnet',
      name: 'Claude 4.0 Sonnet',
      description: 'Best balance of capability and speed (200k context)',
      contextWindow: 200000
    },
    {
      id: 'anthropic/claude-3-opus',
      name: 'Claude 3 Opus',
      description: 'Most powerful for complex analysis (200k context)',
      contextWindow: 200000
    },
    {
      id: 'anthropic/claude-3-haiku',
      name: 'Claude 3 Haiku',
      description: 'Fast and economical (200k context)',
      contextWindow: 200000
    },
    {
      id: 'openai/gpt-4-turbo',
      name: 'GPT-4 Turbo',
      description: 'OpenAI\'s flagship model (128k context)',
      contextWindow: 128000
    },
    {
      id: 'openai/gpt-4o',
      name: 'GPT-4o',
      description: 'Multimodal GPT-4 (128k context)',
      contextWindow: 128000
    },
    {
      id: 'google/gemini-pro-1.5',
      name: 'Gemini 1.5 Pro',
      description: 'Google\'s model with huge context (2M tokens)',
      contextWindow: 2000000
    },
    {
      id: 'meta-llama/llama-3.1-70b-instruct',
      name: 'Llama 3.1 70B',
      description: 'Open source powerhouse (128k context)',
      contextWindow: 128000
    },
    {
      id: 'deepseek/deepseek-chat',
      name: 'DeepSeek Chat',
      description: 'Cost-effective for long documents (128k context)',
      contextWindow: 128000
    }
  ];
}