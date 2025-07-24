import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { telegramSettings } from '@/lib/database/schema';
import { eq } from 'drizzle-orm';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// GET - Retrieve current Telegram settings
export async function GET() {
  try {
    const settings = await db.select().from(telegramSettings).limit(1);
    const config = settings[0];

    return NextResponse.json({
      success: true,
      settings: {
        id: config?.id || null,
        hasBotToken: !!(config?.botToken || process.env.TELEGRAM_BOT_TOKEN),
        botTokenSource: config?.botToken ? 'database' : 'environment',
        chatConfigurations: config?.chatConfigurations || [],
        defaultChatId: config?.defaultChatId || process.env.TELEGRAM_DEFAULT_CHAT_ID || null,
        isEnabled: config?.isEnabled ?? true,
      }
    });
  } catch (error) {
    console.error('Error fetching Telegram settings:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch settings' },
      { status: 500 }
    );
  }
}

// POST - Update Telegram settings
export async function POST(request: NextRequest) {
  try {
    const { botToken, chatConfigurations, defaultChatId, isEnabled } = await request.json();

    // Get existing settings
    const existingSettings = await db.select().from(telegramSettings).limit(1);
    const existing = existingSettings[0];

    const updateData = {
      botToken: botToken || null,
      chatConfigurations: chatConfigurations || [],
      defaultChatId: defaultChatId || null,
      isEnabled: isEnabled ?? true,
      updatedAt: new Date(),
    };

    let result;
    if (existing) {
      // Update existing settings
      result = await db.update(telegramSettings)
        .set(updateData)
        .where(eq(telegramSettings.id, existing.id))
        .returning();
    } else {
      // Create new settings
      result = await db.insert(telegramSettings)
        .values(updateData)
        .returning();
    }

    return NextResponse.json({
      success: true,
      settings: result[0],
      message: 'Telegram settings updated successfully'
    });

  } catch (error) {
    console.error('Error updating Telegram settings:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update settings' },
      { status: 500 }
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
        { status: 400 }
      );
    }

    // Get bot token (DB or env)
    const settings = await db.select().from(telegramSettings).limit(1);
    const config = settings[0];
    const botToken = config?.botToken || process.env.TELEGRAM_BOT_TOKEN;

    if (!botToken) {
      return NextResponse.json(
        { success: false, error: 'No bot token configured' },
        { status: 400 }
      );
    }

    // Test message
    const testMessage = '🤖 Telegram connection test from Noti - configuration is working!';
    const escapedMessage = testMessage.replace(/'/g, "\\'");

    const command = `docker exec telegram-mcp-container python -c "
import sys
sys.path.append('/app')
from main import send_message
try:
    result = send_message(${testChatId}, '''${escapedMessage}''')
    print('SUCCESS')
except Exception as e:
    print(f'ERROR: {str(e)}')
    sys.exit(1)
"`;

    const { stdout, stderr } = await execAsync(command);
    
    if (stderr && !stdout.includes('SUCCESS')) {
      throw new Error(stderr);
    }

    return NextResponse.json({
      success: true,
      message: 'Test message sent successfully!'
    });

  } catch (error) {
    console.error('Telegram connection test error:', error);
    return NextResponse.json(
      { success: false, error: `Connection test failed: ${error}` },
      { status: 500 }
    );
  }
}