import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { telegramShares, audioFiles, aiExtracts, summarizationTemplates, extractionTemplates } from '@/lib/database/schema';
import { eq, desc, and } from 'drizzle-orm';
import { telegramMCP } from '@/lib/services/telegram-mcp-client';
import { getSessionTokenFromRequest, unauthorizedResponse } from '@/lib/auth-server';

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const sessionToken = getSessionTokenFromRequest(request);
    if (!sessionToken) {
      return unauthorizedResponse();
    }
    
    const { fileId, extractId, chatId, username, groupName, summaryType = 'latest' } = await request.json();

    if (!fileId) {
      return NextResponse.json(
        { success: false, error: 'Missing required field: fileId' },
        { status: 400 },
      );
    }

    // Get file information
    const fileData = await db.select().from(audioFiles).where(eq(audioFiles.id, fileId)).limit(1);
    if (!fileData.length) {
      return NextResponse.json(
        { success: false, error: 'File not found' },
        { status: 404 },
      );
    }

    // Get AI extract - either specific one or latest
    // Build query based on whether we want a specific extract or latest
    const extractData = extractId 
      ? await db.select({
          id: aiExtracts.id,
          content: aiExtracts.content,
          model: aiExtracts.model,
          prompt: aiExtracts.prompt,
          createdAt: aiExtracts.createdAt,
          templateName: extractionTemplates.name,
          templateDescription: extractionTemplates.description,
        })
        .from(aiExtracts)
        .leftJoin(extractionTemplates, eq(aiExtracts.templateId, extractionTemplates.id))
        .where(and(eq(aiExtracts.fileId, fileId), eq(aiExtracts.id, extractId)))
        .limit(1)
      : await db.select({
          id: aiExtracts.id,
          content: aiExtracts.content,
          model: aiExtracts.model,
          prompt: aiExtracts.prompt,
          createdAt: aiExtracts.createdAt,
          templateName: extractionTemplates.name,
          templateDescription: extractionTemplates.description,
        })
        .from(aiExtracts)
        .leftJoin(extractionTemplates, eq(aiExtracts.templateId, extractionTemplates.id))
        .where(eq(aiExtracts.fileId, fileId))
        .orderBy(desc(aiExtracts.createdAt))
        .limit(1);

    if (!extractData.length) {
      return NextResponse.json(
        { success: false, error: 'No AI summary found for this file' },
        { status: 404 },
      );
    }

    const extract = extractData[0];
    const file = fileData[0];

    // Function to escape markdown characters for Telegram
    const escapeMarkdown = (text: string): string => {
      return text
        .replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&')
        .replace(/\n/g, '\n');
    };

    // Format the summary content
    let summaryContent = extract.content || '';
    
    // Try to parse JSON content for better formatting
    try {
      const parsedContent = JSON.parse(summaryContent);
      if (typeof parsedContent === 'object') {
        // Format structured content
        summaryContent = '';
        for (const [key, value] of Object.entries(parsedContent)) {
          if (typeof value === 'string' && value.trim()) {
            const formattedKey = key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1');
            summaryContent += `*${escapeMarkdown(formattedKey)}:*\n${escapeMarkdown(value.trim())}\n\n`;
          }
        }
      }
    } catch {
      // Content is not JSON, use as-is but escape it
      summaryContent = escapeMarkdown(summaryContent);
    }

    // Truncate if too long (Telegram limit is 4096 characters)
    const maxLength = 3500; // Leave room for header/footer
    if (summaryContent.length > maxLength) {
      summaryContent = summaryContent.substring(0, maxLength) + '\n\n... _(truncated)_';
    }

    // Format the complete message
    const fileName = file.originalFileName || file.fileName;
    const duration = file.duration ? formatDuration(file.duration) : 'Unknown';
    const templateInfo = extract.templateName ? ` (${extract.templateName})` : '';
    const createdDate = new Date(extract.createdAt).toLocaleDateString();
    
    const message = telegramMCP.formatMessage(summaryContent, {
      title: `AI Summary${templateInfo}`,
      fileName: `${fileName} (${duration})`,
      footer: `_Generated ${createdDate} • Noti AI Transcription_`,
      emoji: '🤖',
    });

    // Send message based on provided target
    let result;
    let targetIdentifier = '';
    
    if (chatId) {
      result = await telegramMCP.sendMessage(chatId, message, sessionToken);
      targetIdentifier = chatId.toString();
    } else if (username) {
      result = await telegramMCP.sendMessageToUser(username, message, sessionToken);
      targetIdentifier = username;
    } else if (groupName) {
      result = await telegramMCP.sendMessageToGroup(groupName, message, sessionToken);
      targetIdentifier = groupName;
    } else {
      // Default to group chat if no target specified
      const defaultChatId = process.env.TELEGRAM_DEFAULT_CHAT_ID || '-4924104491';
      result = await telegramMCP.sendMessage(defaultChatId, message, sessionToken);
      targetIdentifier = defaultChatId;
    }

    if (!result.success) {
      // If the error is about chat not found, provide helpful instructions
      let errorMessage = result.error || 'Failed to send message';
      
      if (errorMessage.includes('chat not found')) {
        const botUsername = 'devdashbotBot';
        errorMessage += `\n\nTo fix this:\n1. Send /start to @${botUsername} in Telegram\n2. Or add the bot to your group\n3. Or use the Telegram setup page to configure chats`;
      }
      
      return NextResponse.json(
        { 
          success: false, 
          error: errorMessage,
          setup_help: {
            bot_username: 'devdashbotBot',
            instructions: 'Visit /api/telegram/setup for configuration help'
          }
        },
        { status: 500 },
      );
    }

    // Record the share in database
    const telegramMessage = result.result;
    await db.insert(telegramShares).values({
      fileId,
      chatId: telegramMessage?.chat?.id?.toString() || targetIdentifier,
      chatName: telegramMessage?.chat?.title || telegramMessage?.chat?.username || targetIdentifier,
      messageText: message,
      status: 'sent',
      telegramMessageId: telegramMessage?.message_id?.toString() || 'sent',
    });

    return NextResponse.json({
      success: true,
      message: 'AI summary shared to Telegram successfully',
      telegramMessageId: telegramMessage?.message_id,
      summaryInfo: {
        id: extract.id,
        templateName: extract.templateName,
        model: extract.model,
        createdAt: extract.createdAt,
      },
      chat: {
        id: telegramMessage?.chat?.id,
        title: telegramMessage?.chat?.title,
        username: telegramMessage?.chat?.username,
      },
    });

  } catch (error) {
    console.error('Telegram summary share error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    );
  }
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}