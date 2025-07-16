import { NextRequest, NextResponse } from 'next/server';
import { settingsService } from '@/lib/db/sqliteServices';
import { promises as fs } from 'fs';
import { join } from 'path';

// File-based settings fallback
const SETTINGS_DIR = join(process.cwd(), 'data', 'settings');
const SETTINGS_FILE = join(SETTINGS_DIR, 'settings.json');

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
    geminiApiKey: string;
    openaiApiKey: string;
    openrouterApiKey: string;
    aiExtractEnabled: boolean;
    aiExtractModel: string;
    aiExtractPrompt: string;
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

async function loadFileSettings(): Promise<Settings> {
  try {
    await fs.mkdir(SETTINGS_DIR, { recursive: true });
    const data = await fs.readFile(SETTINGS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    // Return default settings
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
        geminiApiKey: '',
        openaiApiKey: '',
        openrouterApiKey: '',
        aiExtractEnabled: false,
        aiExtractModel: 'anthropic/claude-sonnet-4',
        aiExtractPrompt: 'Summarize the key points from this transcript.',
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
}

async function saveFileSettings(settings: Settings): Promise<void> {
  await fs.mkdir(SETTINGS_DIR, { recursive: true });
  await fs.writeFile(SETTINGS_FILE, JSON.stringify(settings, null, 2));
}

export async function GET(request: NextRequest) {
  try {
    // Try database first
    try {
      const dbSettings = await settingsService.get();
      if (dbSettings) {
        // Convert database format to API format
        const settings: Settings = {
          transcription: {
            modelSize: dbSettings.whisperModelSizes ? JSON.parse(dbSettings.whisperModelSizes as any)[0] : 'large-v3',
            language: 'sv',
            enableSpeakerDiarization: true,
            huggingfaceToken: process.env.HUGGINGFACE_TOKEN || '',
            preferredDevice: 'auto',
            computeType: 'float32',
            batchSize: 16,
            threads: 4,
          },
          ai: {
            geminiApiKey: dbSettings.geminiApiKey || '',
            openaiApiKey: dbSettings.openaiApiKey || '',
            openrouterApiKey: dbSettings.openrouterApiKey || '',
            aiExtractEnabled: dbSettings.aiExtractEnabled || false,
            aiExtractModel: dbSettings.aiExtractModel || 'anthropic/claude-sonnet-4',
            aiExtractPrompt: dbSettings.aiExtractPrompt || 'Summarize the key points from this transcript.',
          },
          storage: {
            obsidianEnabled: dbSettings.obsidianEnabled || false,
            obsidianVaultPath: dbSettings.obsidianVaultPath || '',
            obsidianFolder: dbSettings.obsidianFolder || '',
          },
          notes: {
            tasksPrompt: dbSettings.notesPrompts?.tasks || '',
            questionsPrompt: dbSettings.notesPrompts?.questions || '',
            decisionsPrompt: dbSettings.notesPrompts?.decisions || '',
            followupsPrompt: dbSettings.notesPrompts?.followups || '',
            mentionsPrompt: dbSettings.notesPrompts?.mentions || '',
          },
        };
        return NextResponse.json(settings);
      }
    } catch (dbError) {
      console.log('Database not available, using file-based settings');
    }

    // Fallback to file-based settings
    const settings = await loadFileSettings();
    return NextResponse.json(settings);
  } catch (error) {
    console.error('Error loading settings:', error);
    return NextResponse.json(
      { error: 'Failed to load settings' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const settings: Settings = await request.json();

    // Try to save to database first
    try {
      await settingsService.update({
        geminiApiKey: settings.ai.geminiApiKey,
        openaiApiKey: settings.ai.openaiApiKey,
        openrouterApiKey: settings.ai.openrouterApiKey,
        aiExtractEnabled: settings.ai.aiExtractEnabled,
        aiExtractModel: settings.ai.aiExtractModel,
        aiExtractPrompt: settings.ai.aiExtractPrompt,
        obsidianEnabled: settings.storage.obsidianEnabled,
        obsidianVaultPath: settings.storage.obsidianVaultPath,
        obsidianFolder: settings.storage.obsidianFolder,
        notesPrompts: {
          tasks: settings.notes.tasksPrompt,
          questions: settings.notes.questionsPrompt,
          decisions: settings.notes.decisionsPrompt,
          followups: settings.notes.followupsPrompt,
          mentions: settings.notes.mentionsPrompt,
        },
      });
    } catch (dbError) {
      console.log('Database not available, saving to file');
    }

    // Always save to file as well
    await saveFileSettings(settings);
    
    // Update environment variable for HuggingFace token
    if (settings.transcription.huggingfaceToken) {
      process.env.HUGGINGFACE_TOKEN = settings.transcription.huggingfaceToken;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving settings:', error);
    return NextResponse.json(
      { error: 'Failed to save settings' },
      { status: 500 }
    );
  }
}