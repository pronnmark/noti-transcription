import { NextRequest, NextResponse } from 'next/server';
import {
  getSessionTokenFromRequest,
  unauthorizedResponse,
} from '@/lib/auth-server';

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const sessionToken = getSessionTokenFromRequest(request);
    if (!sessionToken) {
      return unauthorizedResponse();
    }

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      return NextResponse.json(
        { error: 'Telegram bot token not configured' },
        { status: 500 }
      );
    }

    // Get recent updates with higher limit to find more chats
    const updatesResponse = await fetch(
      `https://api.telegram.org/bot${botToken}/getUpdates?limit=100&offset=-100`
    );
    const updatesData = await updatesResponse.json();

    const discoveredChats: any[] = [];
    const seenChats = new Set();

    if (updatesData.ok && updatesData.result) {
      updatesData.result.forEach((update: any) => {
        if (update.message && update.message.chat) {
          const chat = update.message.chat;
          const chatKey = `${chat.id}`;

          if (!seenChats.has(chatKey)) {
            seenChats.add(chatKey);

            // Extract useful info for username mapping
            const chatInfo = {
              id: chat.id,
              type: chat.type,
              title:
                chat.title ||
                `${chat.first_name || ''} ${chat.last_name || ''}`.trim(),
              username: chat.username,
              first_name: chat.first_name,
              last_name: chat.last_name,
              // Generate mapping suggestion
              mapping_suggestion: chat.username
                ? `'${chat.username.toLowerCase()}': '${chat.id}',`
                : null,
              last_message_date: update.message.date,
              last_message_text:
                update.message.text?.substring(0, 50) +
                (update.message.text?.length > 50 ? '...' : ''),
            };

            discoveredChats.push(chatInfo);
          }
        }
      });
    }

    // Sort by last message date (most recent first)
    discoveredChats.sort((a, b) => b.last_message_date - a.last_message_date);

    // Generate code snippet for easy copying
    const mappingCode = discoveredChats
      .filter(chat => chat.username)
      .map(
        chat =>
          `  '${chat.username.toLowerCase()}': '${chat.id}', // ${chat.title}`
      )
      .join('\n');

    return NextResponse.json({
      discovered_chats: discoveredChats,
      total_found: discoveredChats.length,
      mapping_code: mappingCode
        ? `// Add these to knownUsers mapping:\n${mappingCode}`
        : 'No usernames found to map',
      instructions: {
        note: 'Users need to send /start to @devdashbotBot to appear here',
        add_user:
          'Ask ddoskar to send /start to @devdashbotBot, then refresh this endpoint',
        update_code:
          'Copy the mapping_code and add it to src/app/api/mcp/tools/route.ts knownUsers object',
      },
    });
  } catch (error) {
    console.error('Chat discovery error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
