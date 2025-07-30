'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Send, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

interface TelegramShareButtonProps {
  fileId: number;
  fileName: string;
  content: string;
  summarizationId?: string;
  className?: string;
  variant?:
    | 'default'
    | 'outline'
    | 'secondary'
    | 'ghost'
    | 'link'
    | 'destructive';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

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

export function TelegramShareButton({
  fileId,
  fileName,
  content,
  summarizationId,
  className,
  variant = 'outline',
  size = 'sm',
}: TelegramShareButtonProps) {
  const [isSharing, setIsSharing] = useState(false);
  const [telegramSettings, setTelegramSettings] =
    useState<TelegramSettings | null>(null);
  const [selectedChatId, setSelectedChatId] = useState<string>('');
  const [showChatPicker, setShowChatPicker] = useState(false);

  useEffect(() => {
    loadTelegramSettings();
  }, []);

  async function loadTelegramSettings() {
    try {
      const response = await fetch('/api/telegram/settings');
      if (response.ok) {
        const data = await response.json();
        setTelegramSettings(data.settings);

        // Set default chat if available
        if (data.settings.defaultChatId) {
          setSelectedChatId(data.settings.defaultChatId);
        }
      }
    } catch (error) {
      console.error('Failed to load Telegram settings:', error);
    }
  }

  async function shareToTelegram(chatId?: string) {
    if (!telegramSettings?.isEnabled) {
      toast.error('Telegram integration is disabled');
      return;
    }

    if (!telegramSettings.hasBotToken) {
      toast.error('No Telegram bot token configured. Check settings.');
      return;
    }

    const targetChatId =
      chatId || selectedChatId || telegramSettings.defaultChatId;
    if (!targetChatId) {
      toast.error('Please select a chat to share to');
      return;
    }

    setIsSharing(true);
    try {
      const response = await fetch('/api/telegram/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileId,
          fileName,
          content,
          summarizationId,
          chatId: targetChatId,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        toast.success('Summary shared to Telegram successfully!');
        setShowChatPicker(false);
      } else {
        const data = await response.json();
        toast.error(`Failed to share: ${data.error}`);
      }
    } catch (error) {
      toast.error('Failed to share to Telegram');
      console.error('Share error:', error);
    } finally {
      setIsSharing(false);
    }
  }

  // Don't render if Telegram is not configured or disabled
  if (!telegramSettings?.isEnabled || !telegramSettings.hasBotToken) {
    return null;
  }

  // If no chat configurations and no default, show simple share button
  if (
    telegramSettings.chatConfigurations.length === 0 &&
    !telegramSettings.defaultChatId
  ) {
    return (
      <Button
        variant={variant}
        size={size}
        onClick={() =>
          toast.error('No Telegram chats configured. Check settings.')
        }
        className={className}
      >
        <Send className='mr-2 h-4 w-4' />
        Share to Telegram
      </Button>
    );
  }

  // If only one option (default chat), show simple share button
  if (
    telegramSettings.chatConfigurations.length === 0 &&
    telegramSettings.defaultChatId
  ) {
    return (
      <Button
        variant={variant}
        size={size}
        onClick={() => shareToTelegram()}
        disabled={isSharing}
        className={className}
      >
        {isSharing ? (
          <RefreshCw className='mr-2 h-4 w-4 animate-spin' />
        ) : (
          <Send className='mr-2 h-4 w-4' />
        )}
        {isSharing ? 'Sharing...' : 'Share to Telegram'}
      </Button>
    );
  }

  // Multiple chat options - show dropdown
  if (!showChatPicker) {
    return (
      <Button
        variant={variant}
        size={size}
        onClick={() => setShowChatPicker(true)}
        className={className}
      >
        <Send className='mr-2 h-4 w-4' />
        Share to Telegram
      </Button>
    );
  }

  return (
    <div className='flex items-center gap-2'>
      <Select value={selectedChatId} onValueChange={setSelectedChatId}>
        <SelectTrigger className='w-48'>
          <SelectValue placeholder='Select chat...' />
        </SelectTrigger>
        <SelectContent>
          {telegramSettings.defaultChatId && (
            <SelectItem value={telegramSettings.defaultChatId}>
              Default Chat
            </SelectItem>
          )}
          {telegramSettings.chatConfigurations.map(chat => (
            <SelectItem key={chat.chatId} value={chat.chatId}>
              {chat.name} ({chat.type})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button
        variant={variant}
        size={size}
        onClick={() => shareToTelegram()}
        disabled={isSharing || !selectedChatId}
      >
        {isSharing ? (
          <RefreshCw className='mr-2 h-4 w-4 animate-spin' />
        ) : (
          <Send className='mr-2 h-4 w-4' />
        )}
        {isSharing ? 'Sharing...' : 'Share'}
      </Button>

      <Button
        variant='ghost'
        size='sm'
        onClick={() => setShowChatPicker(false)}
      >
        Cancel
      </Button>
    </div>
  );
}
