import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { telegramSettings, audioFiles, transcriptionJobs } from '@/lib/database/schema';
import { eq, gte, desc } from 'drizzle-orm';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';

const execAsync = promisify(exec);

// Webhook secret for validation (should be set when registering webhook)
const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET || 'noti-telegram-webhook-secret';

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from: {
      id: number;
      is_bot: boolean;
      first_name: string;
      username?: string;
    };
    chat: {
      id: number;
      type: string;
      title?: string;
      username?: string;
    };
    date: number;
    text?: string;
    voice?: {
      duration: number;
      mime_type: string;
      file_id: string;
      file_unique_id: string;
      file_size?: number;
    };
    audio?: {
      duration: number;
      mime_type: string;
      file_id: string;
      file_unique_id: string;
      file_size?: number;
      title?: string;
      performer?: string;
    };
  };
  callback_query?: {
    id: string;
    from: any;
    message: any;
    data: string;
  };
}

// Process incoming webhook updates
export async function POST(request: NextRequest) {
  try {
    // Validate webhook secret
    const secret = request.headers.get('x-telegram-bot-api-secret-token');
    if (secret !== WEBHOOK_SECRET) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const update: TelegramUpdate = await request.json();

    // Check if Telegram integration is enabled
    const settings = await db.select().from(telegramSettings).limit(1);
    const config = settings[0];
    
    if (!config?.isEnabled) {
      return NextResponse.json({ ok: true }); // Acknowledge but don't process
    }

    // Handle different types of updates
    if (update.message) {
      await handleMessage(update.message);
    } else if (update.callback_query) {
      await handleCallbackQuery(update.callback_query);
    }

    // Always return OK to Telegram
    return NextResponse.json({ ok: true });

  } catch (error) {
    console.error('Webhook error:', error);
    // Still return OK to avoid Telegram retrying
    return NextResponse.json({ ok: true });
  }
}

// Handle incoming messages
async function handleMessage(message: any) {
  const chatId = message.chat.id;
  const userId = message.from.id;
  const text = message.text;

  // Handle commands
  if (text?.startsWith('/')) {
    const [command, ...args] = text.split(' ');
    
    switch (command) {
      case '/start':
        await sendMessage(chatId, `👋 Welcome to Noti Audio Transcription Bot!

I can help you transcribe audio files and voice messages.

**Available commands:**
/transcribe - Send an audio file to transcribe
/status - Check your transcription status
/list - List your recent transcriptions
/help - Show this help message

Just send me a voice message or audio file, and I'll transcribe it for you!`);
        break;

      case '/help':
        await sendMessage(chatId, `📋 **Noti Bot Commands**

/transcribe - Start a new transcription
/status [id] - Check transcription status
/list - Show your recent transcriptions
/summary [id] - Get summary of a transcription
/help - Show this help message

You can also just send me:
• Voice messages 🎤
• Audio files 🎵

I'll automatically transcribe them for you!`);
        break;

      case '/list':
        await handleListCommand(chatId, userId);
        break;

      case '/status':
        const jobId = args[0];
        if (jobId) {
          await handleStatusCommand(chatId, jobId);
        } else {
          await sendMessage(chatId, 'Please provide a transcription ID. Example: /status 123');
        }
        break;

      case '/summary':
        const fileId = args[0];
        if (fileId) {
          await handleSummaryCommand(chatId, fileId);
        } else {
          await sendMessage(chatId, 'Please provide a file ID. Example: /summary 123');
        }
        break;

      default:
        await sendMessage(chatId, `Unknown command: ${command}. Use /help to see available commands.`);
    }
  } 
  // Handle voice messages
  else if (message.voice) {
    await handleVoiceMessage(chatId, userId, message.voice);
  }
  // Handle audio files
  else if (message.audio) {
    await handleAudioFile(chatId, userId, message.audio);
  }
}

// Handle voice messages
async function handleVoiceMessage(chatId: number, userId: number, voice: any) {
  try {
    await sendMessage(chatId, '🎤 Voice message received! Starting transcription...');

    // Download voice file from Telegram
    const fileData = await downloadTelegramFile(voice.file_id);
    if (!fileData.success) {
      await sendMessage(chatId, `❌ Failed to download voice message: ${fileData.error}`);
      return;
    }

    // Save to Noti file system
    const timestamp = Date.now();
    const fileName = `telegram_voice_${userId}_${timestamp}.ogg`;
    const filePath = path.join(process.cwd(), 'data', 'audio_files', fileName);
    
    if (!fileData.data) {
      throw new Error('No file data received from Telegram');
    }

    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, fileData.data);

    // Create audio file record
    const [audioFile] = await db.insert(audioFiles).values({
      fileName: fileName,
      originalFileName: fileName,
      originalFileType: voice.mime_type || 'audio/ogg',
      fileSize: voice.file_size || fileData.data?.length || 0,
      duration: voice.duration,
    }).returning();

    // Create transcription job
    const [job] = await db.insert(transcriptionJobs).values({
      fileId: audioFile.id,
      status: 'pending',
    }).returning();

    await sendMessage(chatId, `✅ Voice message saved!
📝 Transcription job created with ID: ${job.id}
🔄 Processing will begin shortly...

Use /status ${job.id} to check progress.`);

  } catch (error) {
    console.error('Error handling voice message:', error);
    await sendMessage(chatId, '❌ Failed to process voice message. Please try again.');
  }
}

// Handle audio files
async function handleAudioFile(chatId: number, userId: number, audio: any) {
  try {
    await sendMessage(chatId, '🎵 Audio file received! Starting transcription...');

    // Download audio file from Telegram
    const fileData = await downloadTelegramFile(audio.file_id);
    if (!fileData.success) {
      await sendMessage(chatId, `❌ Failed to download audio file: ${fileData.error}`);
      return;
    }

    // Determine file extension from mime type
    const extension = getExtensionFromMimeType(audio.mime_type) || 'mp3';
    const timestamp = Date.now();
    const fileName = `telegram_audio_${userId}_${timestamp}.${extension}`;
    const filePath = path.join(process.cwd(), 'data', 'audio_files', fileName);
    
    if (!fileData.data) {
      throw new Error('No file data received from Telegram');
    }

    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, fileData.data);

    // Create audio file record
    const [audioFile] = await db.insert(audioFiles).values({
      fileName: fileName,
      originalFileName: audio.title || fileName,
      originalFileType: audio.mime_type || 'audio/mpeg',
      fileSize: audio.file_size || fileData.data?.length || 0,
      duration: audio.duration,
      title: audio.title,
    }).returning();

    // Create transcription job
    const [job] = await db.insert(transcriptionJobs).values({
      fileId: audioFile.id,
      status: 'pending',
    }).returning();

    await sendMessage(chatId, `✅ Audio file saved!
📝 Transcription job created with ID: ${job.id}
🔄 Processing will begin shortly...

Use /status ${job.id} to check progress.`);

  } catch (error) {
    console.error('Error handling audio file:', error);
    await sendMessage(chatId, '❌ Failed to process audio file. Please try again.');
  }
}

// Handle list command
async function handleListCommand(chatId: number, userId: number) {
  try {
    // Get recent transcriptions for this user  
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentFiles = await db.select()
      .from(audioFiles)
      .where(gte(audioFiles.uploadedAt, sevenDaysAgo))
      .orderBy(desc(audioFiles.uploadedAt))
      .limit(10);

    if (recentFiles.length === 0) {
      await sendMessage(chatId, 'No recent transcriptions found. Send me an audio file or voice message to get started!');
      return;
    }

    let message = '📋 **Your Recent Transcriptions**\n\n';
    
    for (const file of recentFiles) {
      message += `📁 **${file.originalFileName}**\n`;
      message += `   ID: ${file.id} | Size: ${Math.round(file.fileSize / 1024)} KB\n`;
      message += `   ${new Date(file.uploadedAt).toLocaleDateString()}\n\n`;
    }

    message += 'Use /status [id] or /summary [id] for more details.';
    
    await sendMessage(chatId, message);

  } catch (error) {
    console.error('Error handling list command:', error);
    await sendMessage(chatId, '❌ Failed to retrieve transcription list.');
  }
}

// Handle status command
async function handleStatusCommand(chatId: number, jobId: string) {
  try {
    const jobResults = await db.select().from(transcriptionJobs).where(eq(transcriptionJobs.id, parseInt(jobId))).limit(1);
    const job = jobResults[0];

    if (!job) {
      await sendMessage(chatId, `❌ Transcription job #${jobId} not found.`);
      return;
    }

    let message = `📊 **Transcription Status**\n\n`;
    message += `Job ID: ${job.id}\n`;
    message += `File ID: ${job.fileId}\n`;
    message += `Status: **${job.status}**\n`;
    
    if (job.startedAt) {
      message += `Started: ${new Date(job.startedAt).toLocaleString()}\n`;
    }
    
    if (job.completedAt) {
      message += `Completed: ${new Date(job.completedAt).toLocaleString()}\n`;
      const duration = (new Date(job.completedAt).getTime() - new Date(job.startedAt || job.createdAt).getTime()) / 1000;
      message += `Duration: ${Math.round(duration)}s\n`;
    }

    if (job.lastError) {
      message += `\n❌ Error: ${job.lastError}\n`;
    }

    if (job.status === 'completed') {
      message += `\n✅ Transcription completed! Use /summary ${job.fileId} to see the result.`;
    }

    await sendMessage(chatId, message);

  } catch (error) {
    console.error('Error handling status command:', error);
    await sendMessage(chatId, '❌ Failed to retrieve job status.');
  }
}

// Handle summary command
async function handleSummaryCommand(chatId: number, fileId: string) {
  try {
    const file = await db.query.audioFiles.findFirst({
      where: (files, { eq }) => eq(files.id, parseInt(fileId)),
      with: {
        transcriptionJobs: {
          where: (jobs, { eq }) => eq(jobs.status, 'completed'),
          orderBy: (jobs, { desc }) => [desc(jobs.completedAt)],
          limit: 1,
        },
      },
    });

    if (!file || !file.transcriptionJobs[0]?.result) {
      await sendMessage(chatId, `❌ No completed transcription found for file #${fileId}.`);
      return;
    }

    const transcription = file.transcriptionJobs[0].result;
    const text = transcription.segments?.map(s => s.text).join(' ') || transcription.text || 'No text available';

    // Split long messages
    const maxLength = 4000;
    if (text.length > maxLength) {
      await sendMessage(chatId, `📝 **Transcription for ${file.originalFileName}**\n\n_(Showing first ${maxLength} characters)_\n\n${text.substring(0, maxLength)}...`);
      await sendMessage(chatId, `_Full transcription is ${text.length} characters. Visit Noti web interface for complete text._`);
    } else {
      await sendMessage(chatId, `📝 **Transcription for ${file.originalFileName}**\n\n${text}`);
    }

  } catch (error) {
    console.error('Error handling summary command:', error);
    await sendMessage(chatId, '❌ Failed to retrieve transcription summary.');
  }
}

// Handle callback queries (inline keyboard responses)
async function handleCallbackQuery(callbackQuery: any) {
  const chatId = callbackQuery.message.chat.id;
  const data = callbackQuery.data;

  // Answer the callback query
  await answerCallbackQuery(callbackQuery.id);

  // Handle different callback data
  if (data.startsWith('transcribe_')) {
    const fileId = data.replace('transcribe_', '');
    await sendMessage(chatId, `Starting transcription for file ${fileId}...`);
  }
}

// Helper function to send messages
async function sendMessage(chatId: number, text: string, options?: any) {
  try {
    const escapedText = text
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/`/g, '\\`')
      .replace(/\$/g, '\\$')
      .replace(/\n/g, '\\n');

    const command = `docker exec telegram-mcp-server python -c "
import asyncio
from telethon import TelegramClient
from main import client

async def send():
    await client.connect()
    await client.send_message(${chatId}, '''${escapedText}''', parse_mode='Markdown')

asyncio.run(send())
"`;

    await execAsync(command);
  } catch (error) {
    console.error('Error sending message:', error);
  }
}

// Answer callback query
async function answerCallbackQuery(callbackQueryId: string) {
  try {
    const command = `docker exec telegram-mcp-server python -c "
import asyncio
from telethon import TelegramClient
from main import client

async def answer():
    await client.connect()
    await client.answer_callback_query(${callbackQueryId})

asyncio.run(answer())
"`;

    await execAsync(command);
  } catch (error) {
    console.error('Error answering callback query:', error);
  }
}

// Download file from Telegram
async function downloadTelegramFile(fileId: string): Promise<{ success: boolean; data?: Buffer; error?: string }> {
  try {
    const command = `docker exec telegram-mcp-server python -c "
import asyncio
import base64
import json
from telethon import TelegramClient
from main import client

async def download():
    try:
        await client.connect()
        file_bytes = await client.download_media(${fileId}, bytes)
        encoded = base64.b64encode(file_bytes).decode('utf-8')
        print(json.dumps({'success': True, 'data': encoded}))
    except Exception as e:
        print(json.dumps({'success': False, 'error': str(e)}))

asyncio.run(download())
"`;

    const { stdout } = await execAsync(command);
    const result = JSON.parse(stdout.trim());
    
    if (result.success) {
      return {
        success: true,
        data: Buffer.from(result.data, 'base64'),
      };
    } else {
      return {
        success: false,
        error: result.error,
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Get file extension from mime type
function getExtensionFromMimeType(mimeType: string): string {
  const mimeToExt: Record<string, string> = {
    'audio/mpeg': 'mp3',
    'audio/mp3': 'mp3',
    'audio/mp4': 'm4a',
    'audio/x-m4a': 'm4a',
    'audio/wav': 'wav',
    'audio/x-wav': 'wav',
    'audio/flac': 'flac',
    'audio/ogg': 'ogg',
    'audio/webm': 'webm',
    'audio/opus': 'opus',
  };
  
  return mimeToExt[mimeType] || 'mp3';
}

// Register webhook endpoint
export async function PUT(request: NextRequest) {
  try {
    const { url, secretToken } = await request.json();

    if (!url) {
      return NextResponse.json(
        { error: 'Webhook URL is required' },
        { status: 400 }
      );
    }

    // Set webhook via Telegram API
    const command = `docker exec telegram-mcp-server python -c "
import asyncio
import json
from telethon import TelegramClient
from main import client, BOT_TOKEN
import requests

async def set_webhook():
    try:
        # Use Telegram Bot API to set webhook
        bot_token = BOT_TOKEN
        api_url = f'https://api.telegram.org/bot{bot_token}/setWebhook'
        
        params = {
            'url': '${url}',
            'secret_token': '${secretToken || WEBHOOK_SECRET}',
            'allowed_updates': ['message', 'callback_query']
        }
        
        response = requests.post(api_url, json=params)
        result = response.json()
        
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({'ok': False, 'error': str(e)}))

asyncio.run(set_webhook())
"`;

    const { stdout } = await execAsync(command);
    const result = JSON.parse(stdout.trim());

    if (result.ok) {
      return NextResponse.json({
        success: true,
        message: 'Webhook registered successfully',
        result,
      });
    } else {
      return NextResponse.json(
        { success: false, error: result.description || result.error },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Error setting webhook:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to set webhook' },
      { status: 500 }
    );
  }
}