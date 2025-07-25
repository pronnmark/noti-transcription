import { NextRequest, NextResponse } from 'next/server';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { settingsService } from '@/lib/db';

const DATA_DIR = process.env.DATA_DIR || join(process.cwd(), 'data');
const SETTINGS_FILE = join(DATA_DIR, 'settings.json');

// Helper functions
async function loadSettings(): Promise<Settings> {
  const defaults = getDefaultSettings();

  // Load AI settings from database with environment variable fallback
  try {
    const dbSettings = await settingsService.get();
    if (dbSettings) {
      defaults.ai.customAiBaseUrl = dbSettings.customAiBaseUrl || process.env.CUSTOM_AI_BASE_URL || '';
      defaults.ai.customAiApiKey = dbSettings.customAiApiKey || process.env.CUSTOM_AI_API_KEY || '';
      defaults.ai.customAiModel = dbSettings.customAiModel || process.env.CUSTOM_AI_MODEL || '';
      defaults.ai.customAiProvider = dbSettings.customAiProvider || process.env.CUSTOM_AI_PROVIDER || 'custom';
      defaults.ai.openaiApiKey = dbSettings.openaiApiKey || '';
      defaults.ai.aiExtractEnabled = dbSettings.aiExtractEnabled || false;
      defaults.ai.aiExtractModel = dbSettings.aiExtractModel || '';
    }
  } catch (error) {
    console.error('Error loading AI settings from database:', error);
    // Fallback to environment variables
    defaults.ai.customAiBaseUrl = process.env.CUSTOM_AI_BASE_URL || '';
    defaults.ai.customAiApiKey = process.env.CUSTOM_AI_API_KEY || '';
    defaults.ai.customAiModel = process.env.CUSTOM_AI_MODEL || '';
    defaults.ai.customAiProvider = process.env.CUSTOM_AI_PROVIDER || 'custom';
  }

  // Load other settings from JSON file
  if (existsSync(SETTINGS_FILE)) {
    try {
      const data = readFileSync(SETTINGS_FILE, 'utf-8');
      const fileSettings = JSON.parse(data);

      // Merge file settings, but keep AI settings from database
      return {
        ...fileSettings,
        ai: defaults.ai, // AI settings come from database
      };
    } catch (error) {
      console.error('Error loading file settings:', error);
    }
  }

  return defaults;
}

async function saveSettings(settings: Settings): Promise<void> {
  // Save AI settings to database
  console.log('Attempting to save AI settings to database...');
  try {
    const aiSettingsData = {
      customAiBaseUrl: settings.ai.customAiBaseUrl,
      customAiApiKey: settings.ai.customAiApiKey,
      customAiModel: settings.ai.customAiModel,
      customAiProvider: settings.ai.customAiProvider,
      openaiApiKey: settings.ai.openaiApiKey,
      aiExtractEnabled: settings.ai.aiExtractEnabled,
      aiExtractModel: settings.ai.aiExtractModel,
    };
    console.log('AI settings data to save:', JSON.stringify(aiSettingsData, null, 2));

    await settingsService.update(aiSettingsData);
    console.log('Successfully saved AI settings to database');
  } catch (error) {
    console.error('Error saving AI settings to database:', error);
    console.error('Error details:', error instanceof Error ? error.message : String(error));
    throw error;
  }

  // Save other settings to JSON file (for backward compatibility)
  console.log('Saving other settings to JSON file...');
  try {
    const fileSettings = {
      transcription: settings.transcription,
      storage: settings.storage,
      notes: settings.notes,
      // Don't save AI settings to file anymore
    };

    writeFileSync(SETTINGS_FILE, JSON.stringify(fileSettings, null, 2));
    console.log('Successfully saved other settings to JSON file');
  } catch (error) {
    console.error('Error saving settings to JSON file:', error);
    throw error;
  }
}

interface Settings {
  transcription: {
    modelSize: string;
    language: string;
    enableSpeakerDiarization: boolean;
    huggingfaceToken: string;
    preferredDevice: string;
    computeType: string;
    batchSize: number;
    threads: number;
  };
  ai: {
    customAiBaseUrl: string;
    customAiApiKey: string;
    customAiModel: string;
    customAiProvider: string;
    openaiApiKey: string;
    aiExtractEnabled: boolean;
    aiExtractModel: string;
  };
  storage: {
    obsidianEnabled: boolean;
    obsidianVaultPath: string;
    obsidianFolder: string;
  };
  notes: {
    tasksPrompt: string;
    questionsPrompt: string;
    decisionsPrompt: string;
    followupsPrompt: string;
    mentionsPrompt: string;
  };
}

function getDefaultSettings(): Settings {
  return {
    transcription: {
      modelSize: 'large-v3',
      language: 'sv',
      enableSpeakerDiarization: true,
      huggingfaceToken: process.env.HUGGINGFACE_TOKEN || '',
      preferredDevice: 'auto',
      computeType: 'float32',
      batchSize: 16,
      threads: 4,
    },
    ai: {
      customAiBaseUrl: process.env.CUSTOM_AI_BASE_URL || '',
      customAiApiKey: process.env.CUSTOM_AI_API_KEY || '',
      customAiModel: process.env.CUSTOM_AI_MODEL || '',
      customAiProvider: process.env.CUSTOM_AI_PROVIDER || 'custom',
      openaiApiKey: '',
      aiExtractEnabled: false,
      aiExtractModel: '',
    },
    storage: {
      obsidianEnabled: false,
      obsidianVaultPath: '',
      obsidianFolder: '',
    },
    notes: {
      tasksPrompt: '',
      questionsPrompt: '',
      decisionsPrompt: '',
      followupsPrompt: '',
      mentionsPrompt: '',
    },
  };
}

export async function GET(request: NextRequest) {
  try {
    const settings = await loadSettings();
    return NextResponse.json(settings);
  } catch (error) {
    console.error('Error loading settings:', error);
    return NextResponse.json(
      { error: 'Failed to load settings' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const settings: Settings = await request.json();
    console.log('Received settings to save:', JSON.stringify(settings.ai, null, 2));

    // Save settings (AI to database, others to file)
    await saveSettings(settings);

    // Update environment variable for HuggingFace token
    if (settings.transcription.huggingfaceToken) {
      process.env.HUGGINGFACE_TOKEN = settings.transcription.huggingfaceToken;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving settings:', error);
    console.error('Error details:', error instanceof Error ? error.message : String(error));
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    return NextResponse.json(
      {
        error: 'Failed to save settings',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
