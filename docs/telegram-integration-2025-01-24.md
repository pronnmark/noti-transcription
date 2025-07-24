# Telegram Integration Technical Documentation
**Created:** January 24, 2025  
**Feature:** Telegram Summary Sharing Integration  
**Version:** 1.0.0  

## Overview

The Telegram integration allows users to share audio transcription summaries directly to Telegram chats through a one-click interface. The implementation leverages the existing Telegram MCP Docker container and follows KISS (Keep It Simple, Stupid) principles for minimal complexity and maximum reliability.

## Architecture

### High-Level Architecture
```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────────┐
│   Noti Web UI   │───▶│  Next.js API     │───▶│ Telegram MCP        │
│                 │    │  Endpoints       │    │ Docker Container    │
│ - Settings Page │    │                  │    │                     │
│ - Share Buttons │    │ - /telegram/     │    │ - send_message()    │
│ - Chat Picker   │    │   share          │    │ - Bot API calls     │
└─────────────────┘    │ - /telegram/     │    │                     │
                       │   settings       │    │                     │
                       └──────────────────┘    └─────────────────────┘
           │                     │                        │
           ▼                     ▼                        ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────────┐
│   SQLite DB     │    │   Environment    │    │   Telegram API      │
│                 │    │   Variables      │    │                     │
│ - telegram_     │    │                  │    │ - Bot Token Auth    │
│   settings      │    │ - TELEGRAM_BOT_  │    │ - Message Delivery  │
│ - telegram_     │    │   TOKEN          │    │ - Error Responses   │
│   shares        │    │ - TELEGRAM_      │    │                     │
└─────────────────┘    │   DEFAULT_CHAT_ID│    └─────────────────────┘
                       └──────────────────┘
```

### Technology Stack
- **Frontend**: React/Next.js 15 with TypeScript
- **Backend**: Next.js API Routes
- **Database**: SQLite with Drizzle ORM
- **Integration**: Docker exec to Telegram MCP container
- **Communication**: Standard MCP protocol via stdio

## Database Schema

### Tables Created

#### `telegram_settings` Table
```sql
CREATE TABLE telegram_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bot_token TEXT,                    -- Optional bot token override
  chat_configurations TEXT,          -- JSON array of chat configs
  default_chat_id TEXT,             -- Default target chat
  is_enabled BOOLEAN DEFAULT TRUE,  -- Feature toggle
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### `telegram_shares` Table
```sql
CREATE TABLE telegram_shares (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_id INTEGER NOT NULL,                    -- Reference to audio file
  summarization_id TEXT,                       -- Reference to summary
  chat_id TEXT NOT NULL,                       -- Target Telegram chat
  chat_name TEXT,                              -- Friendly chat name
  message_text TEXT NOT NULL,                  -- Sent message content
  status TEXT DEFAULT 'pending',               -- pending|sent|failed
  error TEXT,                                  -- Error message if failed
  telegram_message_id TEXT,                    -- Telegram's message ID
  shared_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### Type Definitions
```typescript
interface ChatConfiguration {
  name: string;
  chatId: string;
  type: 'user' | 'group' | 'channel';
}

interface TelegramSettings {
  id: number | null;
  hasBotToken: boolean;
  botTokenSource: 'database' | 'environment';
  chatConfigurations: ChatConfiguration[];
  defaultChatId: string | null;
  isEnabled: boolean;
}
```

## API Endpoints

### POST `/api/telegram/share`
**Purpose**: Send a summary to a Telegram chat

**Request Body**:
```typescript
{
  fileId: number;           // Audio file ID
  fileName: string;         // Original file name
  content: string;          // Summary content
  summarizationId?: string; // Optional summary ID
  chatId?: string;          // Target chat (optional if default set)
}
```

**Response**:
```typescript
{
  success: boolean;
  shareId?: number;     // Share record ID
  message?: string;     // Success message
  error?: string;       // Error message
}
```

**Implementation Flow**:
1. Validate required fields
2. Load Telegram settings from database
3. Determine bot token (DB override or env fallback)
4. Determine target chat ID
5. Format message for Telegram
6. Create share record in database
7. Execute Docker command to send message
8. Update share status based on result

### GET/POST `/api/telegram/settings`
**Purpose**: Manage Telegram configuration

**GET Response**:
```typescript
{
  success: boolean;
  settings: {
    id: number | null;
    hasBotToken: boolean;
    botTokenSource: 'database' | 'environment';
    chatConfigurations: ChatConfiguration[];
    defaultChatId: string | null;
    isEnabled: boolean;
  }
}
```

**POST Request Body**:
```typescript
{
  botToken?: string;                    // Optional bot token override
  chatConfigurations: ChatConfiguration[];
  defaultChatId?: string;
  isEnabled: boolean;
}
```

### PUT `/api/telegram/settings`
**Purpose**: Test Telegram bot connection

**Request Body**:
```typescript
{
  testChatId: string; // Chat ID to send test message to
}
```

## Components

### TelegramShareButton Component
**Location**: `src/components/ui/telegram-share-button.tsx`

**Props**:
```typescript
interface TelegramShareButtonProps {
  fileId: number;
  fileName: string;
  content: string;
  summarizationId?: string;
  className?: string;
  variant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'link' | 'destructive';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}
```

**Behavior**:
- Loads Telegram settings on mount
- Shows different UI states based on configuration:
  - Hidden if Telegram disabled or no bot token
  - Simple button if only default chat available
  - Dropdown picker if multiple chats configured
- Handles sharing with loading states and error feedback
- Prevents event propagation when embedded in clickable cards

### Settings UI Integration
**Location**: `src/app/settings/page.tsx`

**Features**:
- New "Telegram" tab in settings interface
- Enable/disable toggle for entire feature
- Bot token configuration with environment fallback indication
- Chat configuration management (add/remove/set default)
- Connection testing with real message sending
- Responsive design following existing patterns

## Integration Points

### Summary Pages
1. **AI Summarization Page** (`src/app/ai/summarization/page.tsx`)
   - Share button added to each summary card
   - Appears on hover with delete button
   - Prevents click-through to summary detail

2. **Individual Summary Page** (`src/app/summary/[summaryId]/page.tsx`)
   - Share button in action bar with Copy and Regenerate
   - Consistent styling and behavior

### Docker Integration
**Command Execution**:
```bash
docker exec telegram-mcp-container python -c "
import sys
sys.path.append('/app')
from main import send_message
try:
    result = send_message(${chatId}, '''${message}''')
    print('SUCCESS')
except Exception as e:
    print(f'ERROR: {str(e)}')
    sys.exit(1)
"
```

**Error Handling**:
- Captures both stdout and stderr
- Distinguishes between Docker errors and Telegram API errors
- Updates database with appropriate status and error messages

## Message Formatting

### Standard Message Template
```
🎙️ **Audio Summary**
📁 {fileName}

{summaryContent}

Generated by Noti Audio Transcription
```

**Features**:
- Emoji indicators for visual appeal
- Clear file identification
- Full summary content preservation
- Branding footer

**Character Limit Handling**:
- Telegram has 4096 character limit per message
- Current implementation sends full content
- Future enhancement: automatic truncation with "read more" link

## Environment Variables

### Required Configuration
```bash
# Bot token from @BotFather (required)
TELEGRAM_BOT_TOKEN=your-bot-token-here

# Default chat ID (optional - can be set in UI)
TELEGRAM_DEFAULT_CHAT_ID=your-default-chat-id-here
```

### Setup Instructions
1. **Create Telegram Bot**:
   - Message @BotFather on Telegram
   - Send `/newbot` command
   - Follow prompts to create bot
   - Copy the provided bot token

2. **Get Chat IDs**:
   - Add bot to desired groups/channels
   - Use @userinfobot to get user/chat IDs
   - Or check Telegram MCP container logs when messages are sent

3. **Docker Container**:
   - Ensure Telegram MCP container is running
   - Container should be named `telegram-mcp-container`
   - Bot token should be configured in the MCP container

## Security Considerations

### Token Storage
- Bot tokens stored encrypted in database
- Environment variables as secure fallback
- No tokens logged in application logs or error messages

### Input Validation
- All chat IDs validated before Docker execution
- Message content escaped for shell execution
- SQL injection prevention through parameterized queries

### Access Control
- Feature respects existing authentication middleware
- Chat access validated through Telegram API calls
- Test functionality requires explicit user action

## Error Handling

### Error Categories
1. **Configuration Errors**:
   - Missing bot token
   - Invalid chat IDs
   - Docker container not running

2. **Telegram API Errors**:
   - Bot not in target chat
   - Insufficient permissions
   - Rate limiting
   - Network connectivity

3. **Application Errors**:
   - Database failures
   - Invalid summary content
   - Malformed requests

### Error Reporting
- User-friendly error messages in UI
- Detailed error logging for debugging
- Database tracking of failed share attempts
- Automatic retry mechanism not implemented (future enhancement)

## Performance Considerations

### Async Processing
- Share operations don't block UI
- Loading states provide user feedback
- Background database updates

### Caching Strategy
- Settings loaded once and cached in component state
- Chat configurations cached until settings change
- No API rate limiting implemented (relies on Telegram's limits)

### Resource Usage
- Docker exec creates new process per share
- Memory usage minimal (text-only messages)
- Database operations lightweight (simple inserts/updates)

## Testing

### Manual Testing Checklist
- [ ] Settings UI loads and saves correctly
- [ ] Bot token fallback behavior works
- [ ] Chat configuration CRUD operations
- [ ] Connection test sends real message
- [ ] Share button appears on summary pages
- [ ] Share functionality works with different chat types
- [ ] Error handling displays appropriate messages
- [ ] Database records created correctly

### Integration Testing
- [ ] Docker container communication
- [ ] Telegram API responses
- [ ] Database schema migrations
- [ ] Environment variable precedence

## Future Enhancements

### Planned Features
1. **Message Templates**: Customizable message formatting
2. **Bulk Sharing**: Share multiple summaries at once
3. **Scheduling**: Delayed message sending
4. **Media Support**: Attach audio files to messages
5. **Analytics**: Usage tracking and statistics

### Technical Improvements
1. **Retry Logic**: Automatic retry for failed shares
2. **Rate Limiting**: Respect Telegram API limits
3. **Queue System**: Background processing for large batches
4. **Health Monitoring**: Container status checking
5. **Message Chunking**: Handle long summaries automatically

## Troubleshooting

### Common Issues

**"No bot token configured"**
- Check TELEGRAM_BOT_TOKEN environment variable
- Verify bot token in settings UI
- Ensure .env file is loaded correctly

**"Failed to send message: Docker exec failed"**
- Verify telegram-mcp-container is running
- Check Docker container logs for errors
- Ensure container has bot token configured

**"Bot not in chat"**
- Add bot to target group/channel
- Verify bot has send message permissions
- Check chat ID is correct format

**Connection test works but sharing fails**
- Compare test chat ID with share chat ID
- Check message content for special characters
- Verify summary content isn't too long

### Debug Commands
```bash
# Check container status
docker ps | grep telegram-mcp

# View container logs
docker logs telegram-mcp-container

# Test direct container communication
docker exec telegram-mcp-container python -c "from main import get_me; print(get_me())"

# Check database records
sqlite3 sqlite.db ".tables" | grep telegram
sqlite3 sqlite.db "SELECT * FROM telegram_settings;"
```

## Maintenance

### Regular Tasks
- Monitor share success rates
- Clean up old share records (>30 days)
- Update bot token if rotated
- Verify Docker container health

### Database Maintenance
```sql
-- Clean old share records
DELETE FROM telegram_shares 
WHERE shared_at < datetime('now', '-30 days');

-- Check share success rate
SELECT 
  status,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) as percentage
FROM telegram_shares 
GROUP BY status;
```

## Conclusion

The Telegram integration provides a seamless way for users to share their audio summaries while maintaining the application's commitment to simplicity and reliability. The implementation follows established patterns in the codebase and provides a solid foundation for future enhancements.