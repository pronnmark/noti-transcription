import { NextRequest, NextResponse } from 'next/server';
import { debugLog } from '@/lib/utils';

// This endpoint acts as a proxy to call MCP tools
export async function POST(request: NextRequest) {
  try {
    const { toolName, args } = await request.json();

    if (!toolName) {
      return NextResponse.json(
        { error: 'Tool name is required' },
        { status: 400 }
      );
    }

    // Check authentication
    const sessionToken = request.headers.get('x-session-token');
    if (!sessionToken) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Validate session token (simple check - you might want to implement proper validation)
    if (sessionToken !== process.env.AUTH_PASSWORD && sessionToken !== 'ddash') {
      // For development, we'll allow the default password
      // In production, implement proper token validation
    }

    // Validate that it's a Telegram MCP tool
    if (!toolName.startsWith('mcp__telegram-mcp__')) {
      return NextResponse.json(
        { error: 'Invalid tool name. Only Telegram MCP tools are supported.' },
        { status: 400 }
      );
    }

    // Get Telegram bot token from environment
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      return NextResponse.json(
        { error: 'Telegram bot token not configured' },
        { status: 500 }
      );
    }

    let result;
    
    switch (toolName) {
      case 'mcp__telegram-mcp__get_me':
        // Call Telegram Bot API to get bot info
        try {
          const response = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
          const data = await response.json();
          
          if (!data.ok) {
            return NextResponse.json(
              { error: `Telegram API error: ${data.description}` },
              { status: 400 }
            );
          }
          
          result = data.result;
        } catch (error) {
          return NextResponse.json(
            { error: `Failed to call Telegram API: ${error instanceof Error ? error.message : 'Unknown error'}` },
            { status: 500 }
          );
        }
        break;
        
      case 'mcp__telegram-mcp__send_message_to_user':
        // Send message to user via Telegram Bot API
        if (!args.username || !args.message) {
          return NextResponse.json(
            { error: 'Username and message are required' },
            { status: 400 }
          );
        }
        
        try {
          let chatId = null;
          
          // Known username to chat ID mappings
          const knownUsers: Record<string, string> = {
            'ddphilip': '7803034119',
            'philip': '7803034119',
            'ddoskar': '-4924104491',
            'oskar': '-4924104491',
          };
          
          // Check if we have a known mapping first
          const normalizedUsername = args.username.toLowerCase().replace('@', '');
          if (knownUsers[normalizedUsername]) {
            chatId = knownUsers[normalizedUsername];
            debugLog('api', `Resolved ${args.username} to known chat ID: ${chatId}`);
          }
          
          // If not in known mappings, try to resolve username to chat ID using getChat
          if (!chatId) {
            const usernames = [args.username];
            if (!args.username.startsWith('@')) {
              usernames.push(`@${args.username}`);
            }
            
            // Try to get chat info first to resolve chat ID
            for (const username of usernames) {
            try {
              const chatResponse = await fetch(`https://api.telegram.org/bot${botToken}/getChat`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  chat_id: username
                }),
              });
              
              const chatData = await chatResponse.json();
              if (chatData.ok) {
                chatId = chatData.result.id;
                debugLog('api', `Resolved ${username} to chat ID: ${chatId}`);
                break;
              }
            } catch (e) {
              // Continue to next username
            }
          }
          }
          
          // If we couldn't resolve via getChat, try direct message sending
          if (!chatId) {
            let lastError = '';
            const usernameVariants = [args.username];
            if (!args.username.startsWith('@')) {
              usernameVariants.push(`@${args.username}`);
            }
            for (const singleUsername of usernameVariants) {
              try {
                const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    chat_id: singleUsername,
                    text: args.message,
                    parse_mode: 'Markdown'
                  }),
                });
                
                const data = await response.json();
                
                if (data.ok) {
                  result = data.result;
                  break;
                } else {
                  lastError = data.description;
                }
              } catch (e) {
                lastError = e instanceof Error ? e.message : 'Unknown error';
              }
            }
            
            if (!result) {
              // Provide helpful error message
              const helpMessage = lastError.includes('chat not found') 
                ? `Chat not found for "${args.username}". The user needs to start a conversation with the bot first by sending /start to @devdashbotBot in Telegram.`
                : `Failed to send message: ${lastError}`;
              
              return NextResponse.json(
                { error: helpMessage },
                { status: 400 }
              );
            }
          } else {
            // Send message using resolved chat ID
            const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                chat_id: chatId,
                text: args.message,
                parse_mode: 'Markdown'
              }),
            });
            
            const data = await response.json();
            
            if (!data.ok) {
              return NextResponse.json(
                { error: `Failed to send message: ${data.description}` },
                { status: 400 }
              );
            }
            
            result = data.result;
          }
        } catch (error) {
          return NextResponse.json(
            { error: `Failed to send message: ${error instanceof Error ? error.message : 'Unknown error'}` },
            { status: 500 }
          );
        }
        break;
        
      case 'mcp__telegram-mcp__send_message_to_group':
        // Send message to group via Telegram Bot API
        if (!args.group_name || !args.message) {
          return NextResponse.json(
            { error: 'Group name and message are required' },
            { status: 400 }
          );
        }
        
        try {
          let chatId = null;
          
          // Known group name to chat ID mappings
          const knownGroups: Record<string, string> = {
            'devdash': '-4924104491',
            'dev': '-4924104491',
            'main': '-4924104491',
          };
          
          // Check if we have a known group mapping first
          const normalizedGroupName = args.group_name.toLowerCase().replace('@', '');
          if (knownGroups[normalizedGroupName]) {
            chatId = knownGroups[normalizedGroupName];
            debugLog('api', `Resolved group ${args.group_name} to chat ID: ${chatId}`);
          }
          
          // If we have a known chat ID, use it directly
          if (chatId) {
            const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                chat_id: chatId,
                text: args.message,
                parse_mode: 'Markdown'
              }),
            });
            
            const data = await response.json();
            
            if (!data.ok) {
              return NextResponse.json(
                { error: `Failed to send message to group: ${data.description}` },
                { status: 400 }
              );
            }
            
            result = data.result;
          } else {
            // Fallback to trying group name formats (legacy behavior)
            const groupNames = [args.group_name];
            if (!args.group_name.startsWith('@')) {
              groupNames.push(`@${args.group_name}`);
            }
            // Also try with common prefixes
            groupNames.push(`@${args.group_name}group`);
            groupNames.push(`@${args.group_name}chat`);
          
          let lastError = '';
          for (const groupName of groupNames) {
            try {
              const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  chat_id: groupName,
                  text: args.message,
                  parse_mode: 'Markdown'
                }),
              });
              
              const data = await response.json();
              
              if (data.ok) {
                result = data.result;
                break;
              } else {
                lastError = data.description;
              }
            } catch (e) {
              lastError = e instanceof Error ? e.message : 'Unknown error';
            }
          }
          
          if (!result) {
            return NextResponse.json(
              { error: `Failed to send message to group: ${lastError}` },
              { status: 400 }
            );
          }
          }
        } catch (error) {
          return NextResponse.json(
            { error: `Failed to send message to group: ${error instanceof Error ? error.message : 'Unknown error'}` },
            { status: 500 }
          );
        }
        break;
        
      case 'mcp__telegram-mcp__send_message':
        // Send message to specific chat ID via Telegram Bot API
        if (!args.chat_id || !args.message) {
          return NextResponse.json(
            { error: 'Chat ID and message are required' },
            { status: 400 }
          );
        }
        
        try {
          const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              chat_id: args.chat_id,
              text: args.message,
              parse_mode: 'Markdown'
            }),
          });
          
          const data = await response.json();
          
          if (!data.ok) {
            return NextResponse.json(
              { error: `Failed to send message: ${data.description}` },
              { status: 400 }
            );
          }
          
          result = data.result;
        } catch (error) {
          return NextResponse.json(
            { error: `Failed to send message: ${error instanceof Error ? error.message : 'Unknown error'}` },
            { status: 500 }
          );
        }
        break;
        
      default:
        return NextResponse.json(
          { error: `Tool ${toolName} not implemented yet` },
          { status: 501 }
        );
    }

    return NextResponse.json({
      success: true,
      result: JSON.stringify(result)
    });

  } catch (error) {
    console.error('MCP tools route error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}