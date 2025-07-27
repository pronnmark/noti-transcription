import { NextRequest, NextResponse } from 'next/server';
import { getSessionTokenFromRequest, unauthorizedResponse } from '@/lib/auth-server';

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

    // Get bot info
    const botResponse = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
    const botData = await botResponse.json();

    if (!botData.ok) {
      return NextResponse.json(
        { error: `Failed to get bot info: ${botData.description}` },
        { status: 500 }
      );
    }

    const bot = botData.result;

    // Get recent updates to see what chats the bot has access to
    const updatesResponse = await fetch(`https://api.telegram.org/bot${botToken}/getUpdates?limit=100`);
    const updatesData = await updatesResponse.json();

    const availableChats: any[] = [];
    const seenChats = new Set();

    if (updatesData.ok && updatesData.result) {
      updatesData.result.forEach((update: any) => {
        if (update.message && update.message.chat) {
          const chat = update.message.chat;
          const chatKey = `${chat.id}`;
          
          if (!seenChats.has(chatKey)) {
            seenChats.add(chatKey);
            availableChats.push({
              id: chat.id,
              type: chat.type,
              title: chat.title || `${chat.first_name || ''} ${chat.last_name || ''}`.trim(),
              username: chat.username,
              first_name: chat.first_name,
              last_name: chat.last_name,
            });
          }
        }
      });
    }

    return NextResponse.json({
      bot: {
        id: bot.id,
        username: bot.username,
        first_name: bot.first_name,
        can_join_groups: bot.can_join_groups,
        can_read_all_group_messages: bot.can_read_all_group_messages,
      },
      available_chats: availableChats,
      setup_instructions: {
        for_users: `Send /start to @${bot.username} in Telegram to enable direct messages`,
        for_groups: `Add @${bot.username} to your Telegram group and send a message to make it available`,
        bot_url: `https://t.me/${bot.username}`,
      },
    });

  } catch (error) {
    console.error('Telegram setup error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const sessionToken = getSessionTokenFromRequest(request);
    if (!sessionToken) {
      return unauthorizedResponse();
    }

    const { chatId, message } = await request.json();

    if (!chatId || !message) {
      return NextResponse.json(
        { error: 'Chat ID and message are required' },
        { status: 400 }
      );
    }

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      return NextResponse.json(
        { error: 'Telegram bot token not configured' },
        { status: 500 }
      );
    }

    // Test sending a message to the specified chat
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'Markdown'
      }),
    });

    const data = await response.json();

    if (!data.ok) {
      return NextResponse.json(
        { 
          success: false, 
          error: data.description,
          chat_id: chatId 
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message_id: data.result.message_id,
      chat: data.result.chat,
      chat_id: chatId,
    });

  } catch (error) {
    console.error('Telegram test message error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}