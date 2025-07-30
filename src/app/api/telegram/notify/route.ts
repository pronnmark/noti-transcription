import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/database/client';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface NotificationRequest {
  type:
    | 'transcription_complete'
    | 'transcription_failed'
    | 'summary_ready'
    | 'custom';
  fileId?: number;
  jobId?: number;
  chatId?: string;
  message?: string;
  metadata?: Record<string, any>;
}

// Send notification to Telegram
export async function POST(request: NextRequest) {
  try {
    const notification: NotificationRequest = await request.json();

    // Check if Telegram integration is enabled
    const supabase = getSupabase();
    const { data: settings, error: settingsError } = await supabase
      .from('telegram_settings')
      .select('*')
      .limit(1);

    if (settingsError) {
      throw settingsError;
    }

    const config = settings?.[0];

    if (!config?.is_enabled) {
      return NextResponse.json({
        success: false,
        error: 'Telegram integration is disabled',
      });
    }

    // Handle different notification types
    switch (notification.type) {
      case 'transcription_complete':
        return await handleTranscriptionComplete(notification, config);

      case 'transcription_failed':
        return await handleTranscriptionFailed(notification, config);

      case 'summary_ready':
        return await handleSummaryReady(notification, config);

      case 'custom':
        return await handleCustomNotification(notification, config);

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid notification type',
        });
    }
  } catch (error) {
    console.error('Notification error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}

// Handle transcription complete notifications
async function handleTranscriptionComplete(
  notification: NotificationRequest,
  config: any
) {
  if (!notification.jobId) {
    return NextResponse.json({ success: false, error: 'Job ID required' });
  }

  const supabase = getSupabase();

  // Get job details
  const { data: jobResults, error: jobError } = await supabase
    .from('transcription_jobs')
    .select('*')
    .eq('id', notification.jobId!)
    .limit(1);

  if (jobError || !jobResults || jobResults.length === 0) {
    return NextResponse.json({ success: false, error: 'Job not found' });
  }

  const job = jobResults[0];

  // Get file details
  const { data: fileResults, error: fileError } = await supabase
    .from('audio_files')
    .select('*')
    .eq('id', job.file_id)
    .limit(1);

  if (fileError || !fileResults || fileResults.length === 0) {
    return NextResponse.json({ success: false, error: 'File not found' });
  }

  const file = fileResults[0];

  // Attach file to job object to maintain compatibility
  (job as any).file = file;

  // Determine target chat
  const chatId = notification.chatId || config.default_chat_id;

  if (!chatId) {
    return NextResponse.json({ success: false, error: 'No chat ID specified' });
  }

  // Format notification message
  const duration =
    job.completed_at && job.started_at
      ? Math.round(
          (new Date(job.completed_at).getTime() -
            new Date(job.started_at).getTime()) /
            1000
        )
      : null;

  const message = `✅ **Transcription Complete!**

📁 File: ${file.original_file_name}
⏱️ Duration: ${duration ? `${duration}s` : 'N/A'}
🆔 Job ID: ${job.id}

${job.transcript?.length ? `📝 ${job.transcript.length} segments transcribed` : ''}

Use /summary ${file.id} to see the transcription.`;

  // Send notification
  const result = await sendTelegramMessage(chatId, message);

  return NextResponse.json({
    success: result.success,
    chatId,
    messageId: result.messageId,
    error: result.error,
  });
}

// Handle transcription failed notifications
async function handleTranscriptionFailed(
  notification: NotificationRequest,
  config: any
) {
  if (!notification.jobId) {
    return NextResponse.json({ success: false, error: 'Job ID required' });
  }

  const supabase = getSupabase();

  // Get job details
  const { data: jobResults, error: jobError } = await supabase
    .from('transcription_jobs')
    .select('*')
    .eq('id', notification.jobId!)
    .limit(1);

  if (jobError || !jobResults || jobResults.length === 0) {
    return NextResponse.json({ success: false, error: 'Job not found' });
  }

  const job = jobResults[0];

  // Get file details
  const { data: fileResults, error: fileError } = await supabase
    .from('audio_files')
    .select('*')
    .eq('id', job.file_id)
    .limit(1);

  if (fileError || !fileResults || fileResults.length === 0) {
    return NextResponse.json({ success: false, error: 'File not found' });
  }

  const file = fileResults[0];

  // Attach file to job object to maintain compatibility
  (job as any).file = file;

  // Determine target chat
  const chatId = notification.chatId || config.default_chat_id;

  if (!chatId) {
    return NextResponse.json({ success: false, error: 'No chat ID specified' });
  }

  // Format error message
  const message = `❌ **Transcription Failed**

📁 File: ${file.original_file_name}
🆔 Job ID: ${job.id}
💔 Error: ${job.last_error || 'Unknown error'}

Please try uploading the file again or contact support if the issue persists.`;

  // Send notification
  const result = await sendTelegramMessage(chatId, message);

  return NextResponse.json({
    success: result.success,
    chatId,
    messageId: result.messageId,
    error: result.error,
  });
}

// Handle summary ready notifications
async function handleSummaryReady(
  notification: NotificationRequest,
  config: any
) {
  if (!notification.fileId) {
    return NextResponse.json({ success: false, error: 'File ID required' });
  }

  const chatId = notification.chatId || config.defaultChatId;

  if (!chatId) {
    return NextResponse.json({ success: false, error: 'No chat ID specified' });
  }

  const message =
    notification.message ||
    `📊 **Summary Ready!**

Your audio summary is now available.
File ID: ${notification.fileId}

Visit the Noti dashboard to view and share the summary.`;

  // Send notification
  const result = await sendTelegramMessage(chatId, message);

  return NextResponse.json({
    success: result.success,
    chatId,
    messageId: result.messageId,
    error: result.error,
  });
}

// Handle custom notifications
async function handleCustomNotification(
  notification: NotificationRequest,
  config: any
) {
  const chatId = notification.chatId || config.defaultChatId;

  if (!chatId || !notification.message) {
    return NextResponse.json({
      success: false,
      error: 'Chat ID and message required for custom notifications',
    });
  }

  // Send custom message
  const result = await sendTelegramMessage(chatId, notification.message);

  return NextResponse.json({
    success: result.success,
    chatId,
    messageId: result.messageId,
    error: result.error,
  });
}

// Helper function to send Telegram messages
async function sendTelegramMessage(
  chatId: string | number,
  text: string
): Promise<{
  success: boolean;
  messageId?: number;
  error?: string;
}> {
  try {
    const escapedText = text
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/`/g, '\\`')
      .replace(/\$/g, '\\$')
      .replace(/\n/g, '\\n');

    const command = `docker exec telegram-mcp-server python -c "
import json
import asyncio
from telethon import TelegramClient
from main import client

async def send():
    try:
        await client.connect()
        result = await client.send_message(${chatId}, '''${escapedText}''', parse_mode='Markdown')
        print(json.dumps({
            'success': True,
            'message_id': result.id
        }))
    except Exception as e:
        print(json.dumps({
            'success': False,
            'error': str(e)
        }))

asyncio.run(send())
"`;

    const { stdout, stderr } = await execAsync(command);

    if (stderr && !stdout) {
      return { success: false, error: stderr };
    }

    const result = JSON.parse(stdout.trim());
    return {
      success: result.success,
      messageId: result.message_id,
      error: result.error,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send message',
    };
  }
}

// GET endpoint to check notification settings
export async function GET() {
  try {
    const supabase = getSupabase();
    const { data: settings, error } = await supabase
      .from('telegram_settings')
      .select('*')
      .limit(1);

    if (error) {
      throw error;
    }

    const config = settings?.[0];

    return NextResponse.json({
      success: true,
      enabled: config?.is_enabled || false,
      hasDefaultChat: !!config?.default_chat_id,
      chatConfigurations: config?.chat_configurations?.length || 0,
    });
  } catch (error) {
    console.error('Error fetching notification settings:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch settings' },
      { status: 500 }
    );
  }
}
