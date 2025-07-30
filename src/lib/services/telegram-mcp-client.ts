// Removed client-side import to support both server and client usage

// Telegram MCP tool names
const TELEGRAM_TOOLS = {
  GET_ME: 'mcp__telegram-mcp__get_me',
  SEND_MESSAGE: 'mcp__telegram-mcp__send_message',
  SEND_MESSAGE_TO_USER: 'mcp__telegram-mcp__send_message_to_user',
  SEND_MESSAGE_TO_GROUP: 'mcp__telegram-mcp__send_message_to_group',
  GET_CHAT: 'mcp__telegram-mcp__get_chat',
  RESOLVE_USERNAME: 'mcp__telegram-mcp__resolve_username',
  GET_USER_STATUS: 'mcp__telegram-mcp__get_user_status',
  GET_USER_PHOTOS: 'mcp__telegram-mcp__get_user_photos',
  GET_BOT_INFO: 'mcp__telegram-mcp__get_bot_info',
  SET_BOT_COMMANDS: 'mcp__telegram-mcp__set_bot_commands',
} as const;

interface MCPToolResponse<T = any> {
  success: boolean;
  result?: T;
  error?: string;
}

interface TelegramBotInfo {
  id: number;
  is_bot: boolean;
  first_name: string;
  username?: string;
  can_join_groups?: boolean;
  can_read_all_group_messages?: boolean;
  supports_inline_queries?: boolean;
}

interface TelegramChat {
  id: number;
  type: string;
  title?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
}

interface TelegramMessage {
  message_id: number;
  chat: TelegramChat;
  text: string;
  date: number;
}

class TelegramMCPClient {
  private async callMCPTool<T = any>(
    toolName: string,
    args: Record<string, any> = {},
    sessionToken?: string | null
  ): Promise<MCPToolResponse<T>> {
    try {
      // For client-side usage, try to get token from localStorage if not provided
      if (!sessionToken && typeof window !== 'undefined') {
        sessionToken = localStorage.getItem('noti-session');
      }

      if (!sessionToken) {
        return { success: false, error: 'Not authenticated' };
      }

      // Construct absolute URL for server-side usage
      const baseUrl =
        typeof window === 'undefined'
          ? process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:5173'
          : '';
      const apiUrl = `${baseUrl}/api/mcp/tools`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-session-token': sessionToken,
        },
        body: JSON.stringify({
          toolName,
          args,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        return { success: false, error: `HTTP ${response.status}: ${error}` };
      }

      const data = await response.json();

      // Handle MCP tool response format
      if (data.error) {
        return { success: false, error: data.error };
      }

      // Parse the result if it's a string containing JSON
      let result = data.result;
      if (typeof result === 'string') {
        try {
          result = JSON.parse(result);
        } catch {
          // Keep as string if not valid JSON
        }
      }

      return { success: true, result };
    } catch (error) {
      console.error(`Error calling MCP tool ${toolName}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async getBotInfo(
    sessionToken?: string | null
  ): Promise<MCPToolResponse<TelegramBotInfo>> {
    return this.callMCPTool<TelegramBotInfo>(
      TELEGRAM_TOOLS.GET_ME,
      {},
      sessionToken
    );
  }

  async sendMessage(
    chatId: number | string,
    message: string,
    sessionToken?: string | null
  ): Promise<MCPToolResponse<TelegramMessage>> {
    // Convert string chatId to number if needed
    const numericChatId =
      typeof chatId === 'string' ? parseInt(chatId, 10) : chatId;

    if (isNaN(numericChatId)) {
      return { success: false, error: 'Invalid chat ID' };
    }

    return this.callMCPTool<TelegramMessage>(
      TELEGRAM_TOOLS.SEND_MESSAGE,
      {
        chat_id: numericChatId,
        message,
      },
      sessionToken
    );
  }

  async sendMessageToUser(
    username: string,
    message: string,
    sessionToken?: string | null
  ): Promise<MCPToolResponse<TelegramMessage>> {
    return this.callMCPTool<TelegramMessage>(
      TELEGRAM_TOOLS.SEND_MESSAGE_TO_USER,
      {
        username,
        message,
      },
      sessionToken
    );
  }

  async sendMessageToGroup(
    groupName: string,
    message: string,
    sessionToken?: string | null
  ): Promise<MCPToolResponse<TelegramMessage>> {
    return this.callMCPTool<TelegramMessage>(
      TELEGRAM_TOOLS.SEND_MESSAGE_TO_GROUP,
      {
        group_name: groupName,
        message,
      },
      sessionToken
    );
  }

  async getChat(
    chatId: number | string,
    sessionToken?: string | null
  ): Promise<MCPToolResponse<TelegramChat>> {
    const numericChatId =
      typeof chatId === 'string' ? parseInt(chatId, 10) : chatId;

    if (isNaN(numericChatId)) {
      return { success: false, error: 'Invalid chat ID' };
    }

    return this.callMCPTool<TelegramChat>(
      TELEGRAM_TOOLS.GET_CHAT,
      {
        chat_id: numericChatId,
      },
      sessionToken
    );
  }

  async resolveUsername(
    username: string,
    sessionToken?: string | null
  ): Promise<MCPToolResponse<{ id: number; type: string }>> {
    return this.callMCPTool<{ id: number; type: string }>(
      TELEGRAM_TOOLS.RESOLVE_USERNAME,
      {
        username,
      },
      sessionToken
    );
  }

  async getUserStatus(
    userId: number,
    sessionToken?: string | null
  ): Promise<MCPToolResponse<{ status: string; was_online?: number }>> {
    return this.callMCPTool<{ status: string; was_online?: number }>(
      TELEGRAM_TOOLS.GET_USER_STATUS,
      {
        user_id: userId,
      },
      sessionToken
    );
  }

  async getUserPhotos(
    userId: number,
    limit: number = 10,
    sessionToken?: string | null
  ): Promise<MCPToolResponse<any[]>> {
    return this.callMCPTool<any[]>(
      TELEGRAM_TOOLS.GET_USER_PHOTOS,
      {
        user_id: userId,
        limit,
      },
      sessionToken
    );
  }

  async getBotInfoByUsername(
    botUsername: string,
    sessionToken?: string | null
  ): Promise<MCPToolResponse<TelegramBotInfo>> {
    return this.callMCPTool<TelegramBotInfo>(
      TELEGRAM_TOOLS.GET_BOT_INFO,
      {
        bot_username: botUsername,
      },
      sessionToken
    );
  }

  async setBotCommands(
    botUsername: string,
    commands: Array<{ command: string; description: string }>,
    sessionToken?: string | null
  ): Promise<MCPToolResponse<boolean>> {
    return this.callMCPTool<boolean>(
      TELEGRAM_TOOLS.SET_BOT_COMMANDS,
      {
        bot_username: botUsername,
        commands,
      },
      sessionToken
    );
  }

  // Helper method to format messages with Markdown
  formatMessage(
    content: string,
    options?: {
      title?: string;
      fileName?: string;
      footer?: string;
      emoji?: string;
    }
  ): string {
    const parts: string[] = [];

    if (options?.emoji && options?.title) {
      parts.push(`${options.emoji} **${options.title}**`);
    } else if (options?.title) {
      parts.push(`**${options.title}**`);
    }

    if (options?.fileName) {
      parts.push(`📁 ${options.fileName}`);
    }

    if (parts.length > 0) {
      parts.push(''); // Empty line
    }

    parts.push(content);

    if (options?.footer) {
      parts.push(''); // Empty line
      parts.push(options.footer);
    }

    return parts.join('\n');
  }
}

// Export singleton instance
export const telegramMCP = new TelegramMCPClient();

// Export types
export type { TelegramBotInfo, TelegramChat, TelegramMessage, MCPToolResponse };
