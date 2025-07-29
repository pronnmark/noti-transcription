import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/database/client';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// GET - Retrieve current Telegram settings
export async function GET() {
  try {
    const supabase = getSupabase();
    const { data: settings } = await supabase.from('telegram_settings').select('*').limit(1);
    const config = settings?.[0];

    const hasBotToken = !!(config?.bot_token || process.env.TELEGRAM_BOT_TOKEN);
    let botInfo = null;

    // If bot token exists, try to get bot info via MCP
    if (hasBotToken) {
      try {
        const command = `docker exec telegram-mcp-server python -c "
import json
import asyncio
from main import get_me

async def get_bot_info():
    try:
        result = await get_me()
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({'error': str(e)}))

asyncio.run(get_bot_info())
"`;

        const { stdout } = await execAsync(command);
        const result = JSON.parse(stdout.trim());

        if (!result.error) {
          botInfo = {
            id: result.id,
            name: result.first_name,
            username: result.username,
            canJoinGroups: result.can_join_groups,
            canReadAllGroupMessages: result.can_read_all_group_messages,
          };
        }
      } catch (error) {
        console.error('Failed to get bot info:', error);
      }
    }

    return NextResponse.json({
      success: true,
      settings: {
        id: config?.id || null,
        hasBotToken,
        botTokenSource: config?.bot_token ? 'database' : 'environment',
        chatConfigurations: config?.chat_configurations || [],
        defaultChatId:
          config?.default_chat_id || process.env.TELEGRAM_DEFAULT_CHAT_ID || null,
        isEnabled: config?.is_enabled ?? true,
        botInfo,
      },
    });
  } catch (error) {
    console.error('Error fetching Telegram settings:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch settings' },
      { status: 500 },
    );
  }
}

// POST - Update Telegram settings
export async function POST(request: NextRequest) {
  try {
    const { botToken, chatConfigurations, defaultChatId, isEnabled } =
      await request.json();

    const supabase = getSupabase();
    
    // Get existing settings
    const { data: existingSettings } = await supabase
      .from('telegram_settings')
      .select('*')
      .limit(1);
    const existing = existingSettings?.[0];

    const updateData = {
      bot_token: botToken || null,
      chat_configurations: chatConfigurations || [],
      default_chat_id: defaultChatId || null,
      is_enabled: isEnabled ?? true,
      updated_at: new Date().toISOString(),
    };

    let result;
    if (existing) {
      // Update existing settings
      const { data, error } = await supabase
        .from('telegram_settings')
        .update(updateData)
        .eq('id', existing.id)
        .select()
        .single();
      
      if (error) throw error;
      result = data;
    } else {
      // Create new settings
      const { data, error } = await supabase
        .from('telegram_settings')
        .insert({
          ...updateData,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();
      
      if (error) throw error;
      result = data;
    }

    return NextResponse.json({
      success: true,
      settings: result,
      message: 'Telegram settings updated successfully',
    });
  } catch (error) {
    console.error('Error updating Telegram settings:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update settings' },
      { status: 500 },
    );
  }
}

// Test connection endpoint
export async function PUT(request: NextRequest) {
  try {
    const { testChatId } = await request.json();

    if (!testChatId) {
      return NextResponse.json(
        { success: false, error: 'Test chat ID is required' },
        { status: 400 },
      );
    }

    // Get bot token (DB or env)
    const supabase = getSupabase();
    const { data: settings } = await supabase
      .from('telegram_settings')
      .select('*')
      .limit(1);
    const config = settings?.[0];
    const botToken = config?.bot_token || process.env.TELEGRAM_BOT_TOKEN;

    if (!botToken) {
      return NextResponse.json(
        { success: false, error: 'No bot token configured' },
        { status: 400 },
      );
    }

    // Enhanced test message with better formatting
    const testMessage = `🤖 **Telegram Connection Test**

✅ Configuration is working!
🎙️ Bot is ready to share audio summaries

_Sent from Noti Audio Transcription_`;

    try {
      const escapedMessage = testMessage
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/`/g, '\\`')
        .replace(/\$/g, '\\$')
        .replace(/\n/g, '\\n');

      const command = `docker exec telegram-mcp-server python -c "
import json
import asyncio
from telethon import TelegramClient
from main import client, get_me

async def test_connection():
    try:
        # Get bot info first
        bot_info = await get_me()
        
        # Connect and send message
        await client.connect()
        result = await client.send_message(${testChatId}, '''${escapedMessage}''', parse_mode='Markdown')
        
        print(json.dumps({
            'success': True,
            'message_id': result.id,
            'bot_info': {
                'name': bot_info.get('first_name'),
                'username': bot_info.get('username')
            }
        }))
    except Exception as e:
        print(json.dumps({
            'success': False,
            'error': str(e)
        }))

asyncio.run(test_connection())
"`;

      const { stdout, stderr } = await execAsync(command);
      const response = JSON.parse(stdout.trim());

      if (!response.success) {
        throw new Error(response.error || 'Failed to send test message');
      }

      return NextResponse.json({
        success: true,
        message: 'Test message sent successfully!',
        botInfo: response.bot_info,
      });
    } catch (error) {
      throw error;
    }
  } catch (error) {
    console.error('Telegram connection test error:', error);
    return NextResponse.json(
      { success: false, error: `Connection test failed: ${error}` },
      { status: 500 },
    );
  }
}
