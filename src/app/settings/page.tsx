'use client';

import { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import {
  Save,
  RefreshCw,
  Eye,
  EyeOff,
  Plus,
  Edit2,
  Trash2,
  Send,
  TestTube,
} from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface TranscriptionSettings {
  modelSize: string;
  language: string;
  enableSpeakerDiarization: boolean;
  huggingfaceToken: string;
  preferredDevice: string;
  computeType: string;
  batchSize: number;
  threads: number;
  speakerCount?: number;
}

interface AISettings {
  customAiBaseUrl: string;
  customAiApiKey: string;
  customAiModel: string;
  customAiProvider: string;
  openaiApiKey: string;
  aiExtractEnabled: boolean;
  aiExtractModel: string;
}

interface SummarizationTemplate {
  id: string;
  name: string;
  description: string;
  prompt: string;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface TelegramSettings {
  id: number | null;
  hasBotToken: boolean;
  botTokenSource: 'database' | 'environment';
  chatConfigurations: ChatConfiguration[];
  defaultChatId: string | null;
  isEnabled: boolean;
  botInfo?: {
    id: number;
    name: string;
    username: string;
    canJoinGroups: boolean;
    canReadAllGroupMessages: boolean;
  } | null;
}

interface ChatConfiguration {
  name: string;
  chatId: string;
  type: 'user' | 'group' | 'channel';
}


const MODEL_SIZES = [
  { value: 'tiny', label: 'Tiny (39M)' },
  { value: 'base', label: 'Base (74M)' },
  { value: 'small', label: 'Small (244M)' },
  { value: 'medium', label: 'Medium (769M)' },
  { value: 'large', label: 'Large (1550M)' },
  { value: 'large-v2', label: 'Large V2 (1550M)' },
  { value: 'large-v3', label: 'Large V3 (1550M) - Recommended' },
];

const LANGUAGES = [
  { value: 'auto', label: 'Auto-detect' },
  { value: 'sv', label: 'Swedish' },
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Spanish' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'it', label: 'Italian' },
  { value: 'pt', label: 'Portuguese' },
  { value: 'ru', label: 'Russian' },
  { value: 'ja', label: 'Japanese' },
  { value: 'zh', label: 'Chinese' },
];

export default function SettingsPage() {
  const [transcriptionSettings, setTranscriptionSettings] =
    useState<TranscriptionSettings>({
      modelSize: 'large-v3',
      language: 'sv',
      enableSpeakerDiarization: true,
      huggingfaceToken: '',
      preferredDevice: 'auto',
      computeType: 'float32',
      batchSize: 16,
      threads: 4,
      speakerCount: undefined,
    });

  const [aiSettings, setAISettings] = useState<AISettings>({
    customAiBaseUrl: '',
    customAiApiKey: '',
    customAiModel: '',
    customAiProvider: 'custom',
    openaiApiKey: '',
    aiExtractEnabled: false,
    aiExtractModel: '',
  });

  const [showTokens, setShowTokens] = useState<Record<string, boolean>>({
    huggingfaceToken: false,
    customAiApiKey: false,
    openaiApiKey: false,
  });

  const [isSaving, setIsSaving] = useState(false);

  const [validationErrors, setValidationErrors] = useState<
    Record<string, string>
  >({});

  const [templates, setTemplates] = useState<SummarizationTemplate[]>([]);
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] =
    useState<SummarizationTemplate | null>(null);
  const [templateForm, setTemplateForm] = useState({
    name: '',
    description: '',
    prompt: '',
    isDefault: false,
  });

  const [telegramSettings, setTelegramSettings] = useState<TelegramSettings>({
    id: null,
    hasBotToken: false,
    botTokenSource: 'environment',
    chatConfigurations: [],
    defaultChatId: null,
    isEnabled: true,
  });

  const [telegramForm, setTelegramForm] = useState({
    botToken: '',
    newChatName: '',
    newChatId: '',
    newChatType: 'group' as 'user' | 'group' | 'channel',
    testChatId: '',
  });


  const [isTesting, setIsTesting] = useState(false);

  useEffect(() => {
    loadSettings();
    loadTemplates();
    loadTelegramSettings();
  }, []);

  async function loadSettings() {
    try {
      const { getSessionToken } = await import('@/lib/auth-client');
      const sessionToken = getSessionToken();

      const response = await fetch('/api/settings', {
        headers: {
          ...(sessionToken && { 'x-session-token': sessionToken }),
        },
      });
      if (response.ok) {
        const data = await response.json();

        if (data.transcription) {
          setTranscriptionSettings(prev => ({
            ...prev,
            ...data.transcription,
          }));
        }
        if (data.ai) {
          setAISettings(prev => ({ ...prev, ...data.ai }));
        }
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  }

  async function saveSettings() {
    setIsSaving(true);

    // Validate AI settings before saving
    if (!validateAISettings()) {
      setIsSaving(false);
      toast.error('Please fix validation errors before saving');
      return;
    }

    try {
      const { getSessionToken } = await import('@/lib/auth-client');
      const sessionToken = getSessionToken();

      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(sessionToken && { 'x-session-token': sessionToken }),
        },
        body: JSON.stringify({
          transcription: transcriptionSettings,
          ai: aiSettings,
        }),
      });

      if (response.ok) {
        toast.success('Settings saved successfully');
      } else {
        throw new Error('Failed to save settings');
      }
    } catch (error) {
      toast.error('Failed to save settings');
      console.error('Save settings error:', error);
    } finally {
      setIsSaving(false);
    }
  }

  function toggleTokenVisibility(field: string) {
    setShowTokens(prev => ({ ...prev, [field]: !prev[field] }));
  }

  function validateAISettings(): boolean {
    const errors: Record<string, string> = {};

    // Validate base URL
    if (aiSettings.customAiBaseUrl) {
      try {
        const url = new URL(aiSettings.customAiBaseUrl);
        if (!url.protocol.startsWith('http')) {
          errors.customAiBaseUrl = 'Base URL must use HTTP or HTTPS protocol';
        } else if (!aiSettings.customAiBaseUrl.includes('/v1')) {
          errors.customAiBaseUrl =
            'Base URL should include /v1 endpoint (e.g., https://api.openai.com/v1)';
        }
      } catch {
        errors.customAiBaseUrl = 'Please enter a valid URL';
      }
    }

    // Validate API key
    if (aiSettings.customAiApiKey) {
      if (aiSettings.customAiApiKey.length < 10) {
        errors.customAiApiKey = 'API key seems too short';
      } else if (aiSettings.customAiApiKey.includes(' ')) {
        errors.customAiApiKey = 'API key should not contain spaces';
      }
    }

    // Validate model name
    if (aiSettings.customAiModel) {
      if (aiSettings.customAiModel.includes(' ')) {
        errors.customAiModel = 'Model name should not contain spaces';
      } else if (aiSettings.customAiModel.length < 3) {
        errors.customAiModel = 'Model name seems too short';
      }
    }

    // Check if all required fields are provided together
    const hasBaseUrl = !!aiSettings.customAiBaseUrl;
    const hasApiKey = !!aiSettings.customAiApiKey;
    const hasModel = !!aiSettings.customAiModel;

    if (
      (hasBaseUrl || hasApiKey || hasModel) &&
      (!hasBaseUrl || !hasApiKey || !hasModel)
    ) {
      if (!hasBaseUrl) {
        errors.customAiBaseUrl = 'Base URL is required when using custom AI';
      }
      if (!hasApiKey) {
        errors.customAiApiKey = 'API key is required when using custom AI';
      }
      if (!hasModel) {
        errors.customAiModel = 'Model name is required when using custom AI';
      }
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function loadTemplates() {
    try {
      const { getSessionToken } = await import('@/lib/auth-client');
      const sessionToken = getSessionToken();

      const response = await fetch('/api/summarization-prompts', {
        headers: {
          ...(sessionToken && { 'x-session-token': sessionToken }),
        },
      });
      if (response.ok) {
        const data = await response.json();
        setTemplates(data.prompts || []);
      }
    } catch (error) {
      console.error('Failed to load templates:', error);
    }
  }

  function openTemplateDialog(template?: SummarizationTemplate) {
    if (template) {
      setEditingTemplate(template);
      setTemplateForm({
        name: template.name,
        description: template.description,
        prompt: template.prompt,
        isDefault: template.isDefault,
      });
    } else {
      setEditingTemplate(null);
      setTemplateForm({
        name: '',
        description: '',
        prompt: '',
        isDefault: false,
      });
    }
    setIsTemplateDialogOpen(true);
  }

  async function saveTemplate() {
    if (!templateForm.name.trim() || !templateForm.prompt.trim()) {
      toast.error('Name and prompt are required');
      return;
    }

    try {
      const url = editingTemplate
        ? '/api/summarization-prompts'
        : '/api/summarization-prompts';

      const method = editingTemplate ? 'PUT' : 'POST';
      const body = editingTemplate
        ? { id: editingTemplate.id, ...templateForm }
        : templateForm;

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        toast.success(
          `Template ${editingTemplate ? 'updated' : 'created'} successfully`
        );
        setIsTemplateDialogOpen(false);
        loadTemplates();
      } else {
        throw new Error('Failed to save template');
      }
    } catch (error) {
      toast.error('Failed to save template');
      console.error('Save template error:', error);
    }
  }

  async function deleteTemplate(id: string) {
    if (!confirm('Are you sure you want to delete this template?')) {
      return;
    }

    try {
      const { getSessionToken } = await import('@/lib/auth-client');
      const sessionToken = getSessionToken();

      const response = await fetch(`/api/summarization-prompts?id=${id}`, {
        method: 'DELETE',
        headers: {
          ...(sessionToken && { 'x-session-token': sessionToken }),
        },
      });

      if (response.ok) {
        toast.success('Template deleted successfully');
        loadTemplates();
      } else {
        throw new Error('Failed to delete template');
      }
    } catch (error) {
      toast.error('Failed to delete template');
      console.error('Delete template error:', error);
    }
  }

  // Telegram settings functions
  async function loadTelegramSettings() {
    try {
      const { getSessionToken } = await import('@/lib/auth-client');
      const sessionToken = getSessionToken();

      const response = await fetch('/api/telegram/settings', {
        headers: {
          ...(sessionToken && { 'x-session-token': sessionToken }),
        },
      });
      if (response.ok) {
        const data = await response.json();
        setTelegramSettings(data.settings);
      }
    } catch (error) {
      console.error('Failed to load Telegram settings:', error);
    }
  }

  async function saveTelegramSettings() {
    try {
      const { getSessionToken } = await import('@/lib/auth-client');
      const sessionToken = getSessionToken();

      const response = await fetch('/api/telegram/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(sessionToken && { 'x-session-token': sessionToken }),
        },
        body: JSON.stringify({
          botToken: telegramForm.botToken || null,
          chatConfigurations: telegramSettings.chatConfigurations,
          defaultChatId: telegramSettings.defaultChatId,
          isEnabled: telegramSettings.isEnabled,
        }),
      });

      if (response.ok) {
        toast.success('Telegram settings saved successfully');
        loadTelegramSettings();
        setTelegramForm(prev => ({ ...prev, botToken: '' })); // Clear form token
      } else {
        throw new Error('Failed to save Telegram settings');
      }
    } catch (error) {
      toast.error('Failed to save Telegram settings');
      console.error('Save Telegram settings error:', error);
    }
  }

  function addChatConfiguration() {
    if (!telegramForm.newChatName.trim() || !telegramForm.newChatId.trim()) {
      toast.error('Chat name and ID are required');
      return;
    }

    const newChat: ChatConfiguration = {
      name: telegramForm.newChatName.trim(),
      chatId: telegramForm.newChatId.trim(),
      type: telegramForm.newChatType,
    };

    setTelegramSettings(prev => ({
      ...prev,
      chatConfigurations: [...prev.chatConfigurations, newChat],
    }));

    // Clear form
    setTelegramForm(prev => ({
      ...prev,
      newChatName: '',
      newChatId: '',
      newChatType: 'group',
    }));
  }

  function removeChatConfiguration(index: number) {
    setTelegramSettings(prev => ({
      ...prev,
      chatConfigurations: prev.chatConfigurations.filter((_, i) => i !== index),
    }));
  }

  async function testTelegramConnection() {
    if (!telegramForm.testChatId.trim()) {
      toast.error('Please enter a chat ID to test');
      return;
    }

    setIsTesting(true);
    try {
      const { getSessionToken } = await import('@/lib/auth-client');
      const sessionToken = getSessionToken();

      const response = await fetch('/api/telegram/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(sessionToken && { 'x-session-token': sessionToken }),
        },
        body: JSON.stringify({
          testChatId: telegramForm.testChatId.trim(),
        }),
      });

      if (response.ok) {
        toast.success('Test message sent successfully! Check your Telegram.');
      } else {
        const data = await response.json();
        toast.error(`Test failed: ${data.error}`);
      }
    } catch (error) {
      toast.error('Failed to test connection');
      console.error('Test connection error:', error);
    } finally {
      setIsTesting(false);
    }
  }

  return (
    <div className='standard-page-bg min-h-screen space-y-4 overflow-y-auto p-4 sm:space-y-6 sm:p-6'>
      {/* Header - Now part of scrollable content */}
      <div className='buzz-header-desktop space-y-2'>
        <h1 className='text-3xl font-semibold text-foreground'>Settings</h1>
        <p className='text-base text-muted-foreground'>
          Configure your transcription preferences
        </p>
      </div>
      <Tabs defaultValue='basic' className='space-y-4 sm:space-y-6'>
        <TabsList>
          <TabsTrigger value='basic'>Basic</TabsTrigger>
          <TabsTrigger value='advanced'>Advanced</TabsTrigger>
        </TabsList>

        <TabsContent value='basic' className='space-y-4 sm:space-y-6'>
          <Card>
            <CardHeader>
              <CardTitle>Basic Transcription</CardTitle>
              <CardDescription>
                Essential settings for speech-to-text transcription
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-4'>
              <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
                <div className='space-y-2'>
                  <Label htmlFor='modelSize'>Model Size</Label>
                  <Select
                    value={transcriptionSettings.modelSize}
                    onValueChange={value =>
                      setTranscriptionSettings(prev => ({
                        ...prev,
                        modelSize: value,
                      }))
                    }
                  >
                    <SelectTrigger id='modelSize'>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MODEL_SIZES.map(model => (
                        <SelectItem key={model.value} value={model.value}>
                          {model.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className='space-y-2'>
                  <Label htmlFor='language'>Language</Label>
                  <Select
                    value={transcriptionSettings.language}
                    onValueChange={value =>
                      setTranscriptionSettings(prev => ({
                        ...prev,
                        language: value,
                      }))
                    }
                  >
                    <SelectTrigger id='language'>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LANGUAGES.map(lang => (
                        <SelectItem key={lang.value} value={lang.value}>
                          {lang.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Speaker Detection</CardTitle>
              <CardDescription>
                Identify different speakers in conversations
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-4'>
              <div className='flex items-center justify-between'>
                <div className='space-y-0.5'>
                  <Label htmlFor='diarization'>Enable Speaker Detection</Label>
                  <p className='text-sm text-muted-foreground'>
                    Automatically identify different speakers
                  </p>
                </div>
                <Switch
                  id='diarization'
                  checked={transcriptionSettings.enableSpeakerDiarization}
                  onCheckedChange={checked =>
                    setTranscriptionSettings(prev => ({
                      ...prev,
                      enableSpeakerDiarization: checked,
                    }))
                  }
                />
              </div>

              {transcriptionSettings.enableSpeakerDiarization && (
                <div className='space-y-2'>
                  <Label htmlFor='huggingfaceToken'>HuggingFace Token</Label>
                  <div className='flex min-w-0 gap-2'>
                    <Input
                      className='min-w-0 flex-1'
                      id='huggingfaceToken'
                      type={showTokens.huggingfaceToken ? 'text' : 'password'}
                      value={transcriptionSettings.huggingfaceToken}
                      onChange={e =>
                        setTranscriptionSettings(prev => ({
                          ...prev,
                          huggingfaceToken: e.target.value,
                        }))
                      }
                      placeholder='hf_...'
                    />
                    <Button
                      variant='outline'
                      size='icon'
                      onClick={() => toggleTokenVisibility('huggingfaceToken')}
                    >
                      {showTokens.huggingfaceToken ? (
                        <EyeOff className='h-4 w-4' />
                      ) : (
                        <Eye className='h-4 w-4' />
                      )}
                    </Button>
                  </div>
                  <p className='text-sm text-muted-foreground'>
                    Required for speaker detection. Get one from huggingface.co
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>OpenAI-Compatible AI API</CardTitle>
              <CardDescription>
                Configure any OpenAI-compatible AI service for summarization
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-4'>
              <div className='standard-card bg-muted/20 p-4'>
                <h4 className='mb-2 font-medium'>Supported Providers</h4>
                <div className='grid grid-cols-1 gap-2 text-sm sm:grid-cols-2'>
                  <div className='break-all'>
                    <strong>OpenAI:</strong> https://api.openai.com/v1
                  </div>
                  <div className='break-all'>
                    <strong>Anthropic:</strong> https://api.anthropic.com/v1
                  </div>
                  <div className='break-all'>
                    <strong>OpenRouter:</strong> https://openrouter.ai/api/v1
                  </div>
                  <div className='break-all'>
                    <strong>Local (LM Studio):</strong> http://localhost:1234/v1
                  </div>
                </div>
                <p className='mt-2 text-xs text-muted-foreground'>
                  All providers must support OpenAI's /chat/completions API
                  format
                </p>
              </div>

              <div className='space-y-2'>
                <Label htmlFor='customAiBaseUrl'>API Base URL</Label>
                <Input
                  id='customAiBaseUrl'
                  type='url'
                  value={aiSettings.customAiBaseUrl}
                  onChange={e => {
                    setAISettings(prev => ({
                      ...prev,
                      customAiBaseUrl: e.target.value,
                    }));
                    // Clear validation error when user starts typing
                    if (validationErrors.customAiBaseUrl) {
                      setValidationErrors(prev => ({
                        ...prev,
                        customAiBaseUrl: '',
                      }));
                    }
                  }}
                  placeholder='https://api.openai.com/v1'
                  className={
                    validationErrors.customAiBaseUrl ? 'border-red-500' : ''
                  }
                />
                {validationErrors.customAiBaseUrl && (
                  <p className='text-sm text-red-500'>
                    {validationErrors.customAiBaseUrl}
                  </p>
                )}
                <p className='text-sm text-muted-foreground'>
                  Complete base URL including /v1 endpoint (must support OpenAI
                  chat/completions format)
                </p>
              </div>

              <div className='space-y-2'>
                <Label htmlFor='customAiApiKey'>API Key</Label>
                <div className='flex min-w-0 gap-2'>
                  <Input
                    className={`min-w-0 flex-1 ${validationErrors.customAiApiKey ? 'border-red-500' : ''}`}
                    id='customAiApiKey'
                    type={showTokens.customAiApiKey ? 'text' : 'password'}
                    value={aiSettings.customAiApiKey}
                    onChange={e => {
                      setAISettings(prev => ({
                        ...prev,
                        customAiApiKey: e.target.value,
                      }));
                      // Clear validation error when user starts typing
                      if (validationErrors.customAiApiKey) {
                        setValidationErrors(prev => ({
                          ...prev,
                          customAiApiKey: '',
                        }));
                      }
                    }}
                    placeholder='sk-... (OpenAI) or claude-... (Anthropic)'
                  />
                  <Button
                    variant='outline'
                    size='icon'
                    onClick={() => toggleTokenVisibility('customAiApiKey')}
                  >
                    {showTokens.customAiApiKey ? (
                      <EyeOff className='h-4 w-4' />
                    ) : (
                      <Eye className='h-4 w-4' />
                    )}
                  </Button>
                </div>
                {validationErrors.customAiApiKey && (
                  <p className='text-sm text-red-500'>
                    {validationErrors.customAiApiKey}
                  </p>
                )}
                <p className='text-sm text-muted-foreground'>
                  API key from your chosen provider (get from provider's
                  dashboard)
                </p>
              </div>

              <div className='space-y-2'>
                <Label htmlFor='customAiModel'>Model Name</Label>
                <Input
                  id='customAiModel'
                  type='text'
                  value={aiSettings.customAiModel}
                  onChange={e => {
                    setAISettings(prev => ({
                      ...prev,
                      customAiModel: e.target.value,
                    }));
                    // Clear validation error when user starts typing
                    if (validationErrors.customAiModel) {
                      setValidationErrors(prev => ({
                        ...prev,
                        customAiModel: '',
                      }));
                    }
                  }}
                  placeholder='gpt-3.5-turbo'
                  className={
                    validationErrors.customAiModel ? 'border-red-500' : ''
                  }
                />
                {validationErrors.customAiModel && (
                  <p className='text-sm text-red-500'>
                    {validationErrors.customAiModel}
                  </p>
                )}
                <div className='text-sm text-muted-foreground'>
                  <p>Common models by provider:</p>
                  <div className='mt-1 grid grid-cols-1 gap-1 text-xs'>
                    <div>
                      <strong>OpenAI:</strong> gpt-3.5-turbo, gpt-4, gpt-4-turbo
                    </div>
                    <div>
                      <strong>Anthropic:</strong> claude-3-sonnet-20240229,
                      claude-3-haiku-20240307
                    </div>
                    <div>
                      <strong>OpenRouter:</strong> anthropic/claude-3-sonnet,
                      openai/gpt-4
                    </div>
                    <div>
                      <strong>Local:</strong> llama-3.1-8b,
                      mixtral-8x7b-instruct
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

          <Card>
            <CardHeader className='flex flex-row items-center justify-between'>
              <div>
                <CardTitle>Summary Templates</CardTitle>
                <CardDescription>
                  Create and manage custom templates for AI summarization
                </CardDescription>
              </div>
              <Button
                onClick={() => openTemplateDialog()}
                className='flex items-center gap-2'
              >
                <Plus className='h-4 w-4' />
                New Template
              </Button>
            </CardHeader>
            <CardContent className='space-y-4'>
              {templates.length === 0 ? (
                <div className='py-8 text-center text-muted-foreground'>
                  <p>No templates created yet.</p>
                  <p className='text-sm'>
                    Create your first template to get started.
                  </p>
                </div>
              ) : (
                <div className='space-y-4'>
                  {templates.map(template => (
                    <div
                      key={template.id}
                      className='space-y-2 rounded-lg border p-4'
                    >
                      <div className='flex items-start justify-between'>
                        <div className='flex-1'>
                          <div className='flex items-center gap-2'>
                            <h4 className='font-medium'>{template.name}</h4>
                            {template.isDefault && (
                              <span className='rounded bg-primary/20 px-2 py-1 text-xs text-primary'>
                                Default
                              </span>
                            )}
                          </div>
                          {template.description && (
                            <p className='mt-1 text-sm text-muted-foreground'>
                              {template.description}
                            </p>
                          )}
                          <div className='mt-2 rounded bg-muted/50 p-2 text-xs text-muted-foreground'>
                            <p className='line-clamp-2'>{template.prompt}</p>
                          </div>
                        </div>
                        <div className='ml-4 flex items-center gap-2'>
                          <Button
                            variant='outline'
                            size='icon'
                            onClick={() => openTemplateDialog(template)}
                          >
                            <Edit2 className='h-4 w-4' />
                          </Button>
                          <Button
                            variant='outline'
                            size='icon'
                            onClick={() => deleteTemplate(template.id)}
                            className='text-destructive hover:text-destructive'
                          >
                            <Trash2 className='h-4 w-4' />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

          <Card>
            <CardHeader>
              <CardTitle>Telegram Integration</CardTitle>
              <CardDescription>
                Configure Telegram bot and chat settings for sharing summaries
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-4'>
              <div className='flex items-center justify-between'>
                <div className='space-y-0.5'>
                  <Label htmlFor='telegramEnabled'>
                    Enable Telegram Integration
                  </Label>
                  <p className='text-sm text-muted-foreground'>
                    Allow sharing summaries to Telegram chats
                  </p>
                </div>
                <Switch
                  id='telegramEnabled'
                  checked={telegramSettings.isEnabled}
                  onCheckedChange={checked =>
                    setTelegramSettings(prev => ({
                      ...prev,
                      isEnabled: checked,
                    }))
                  }
                />
              </div>

              {telegramSettings.isEnabled && (
                <>
                  <div className='standard-card bg-muted/20 p-4'>
                    <h4 className='mb-2 font-medium'>Bot Configuration</h4>
                    <p className='mb-2 text-sm text-muted-foreground'>
                      Current bot token source:{' '}
                      <strong>{telegramSettings.botTokenSource}</strong>
                      {telegramSettings.botTokenSource === 'environment' &&
                        ' (from .env file)'}
                    </p>
                    {telegramSettings.hasBotToken ? (
                      <>
                        <p className='mb-2 text-sm text-green-600'>
                          ✓ Bot token is configured
                        </p>
                        {telegramSettings.botInfo && (
                          <div className='mt-3 space-y-1 rounded-lg bg-background p-3'>
                            <p className='text-sm'>
                              <span className='text-muted-foreground'>
                                Bot Name:
                              </span>{' '}
                              <strong>{telegramSettings.botInfo.name}</strong>
                            </p>
                            <p className='text-sm'>
                              <span className='text-muted-foreground'>
                                Username:
                              </span>{' '}
                              <strong>
                                @{telegramSettings.botInfo.username}
                              </strong>
                            </p>
                            <p className='text-sm'>
                              <span className='text-muted-foreground'>
                                Features:
                              </span>{' '}
                              {telegramSettings.botInfo.canJoinGroups &&
                                '✓ Groups'}{' '}
                              {telegramSettings.botInfo
                                .canReadAllGroupMessages && '✓ All Messages'}
                            </p>
                          </div>
                        )}
                      </>
                    ) : (
                      <p className='text-sm text-yellow-600'>
                        ⚠ No bot token found in environment or database
                      </p>
                    )}
                  </div>

                  <div className='space-y-2'>
                    <Label htmlFor='botToken'>
                      Override Bot Token (Optional)
                    </Label>
                    <div className='flex gap-2'>
                      <Input
                        id='botToken'
                        type='password'
                        value={telegramForm.botToken}
                        onChange={e =>
                          setTelegramForm(prev => ({
                            ...prev,
                            botToken: e.target.value,
                          }))
                        }
                        placeholder='Bot token (leave empty to use environment variable)'
                        className='flex-1'
                      />
                    </div>
                    <p className='text-sm text-muted-foreground'>
                      Leave empty to use TELEGRAM_BOT_TOKEN from environment.
                      Override here to use a different bot for this instance.
                    </p>
                  </div>

                  <div className='space-y-4'>
                    <h4 className='font-medium'>Chat Configurations</h4>

                    {telegramSettings.chatConfigurations.length === 0 ? (
                      <div className='rounded-lg border py-4 text-center text-muted-foreground'>
                        <p>No chat configurations added yet.</p>
                        <p className='text-sm'>
                          Add chats below to enable targeted sharing.
                        </p>
                      </div>
                    ) : (
                      <div className='space-y-2'>
                        {telegramSettings.chatConfigurations.map(
                          (chat, index) => (
                            <div
                              key={index}
                              className='flex items-center justify-between rounded-lg border p-3'
                            >
                              <div className='flex-1'>
                                <div className='flex items-center gap-2'>
                                  <span className='font-medium'>
                                    {chat.name}
                                  </span>
                                  <span className='rounded bg-muted px-2 py-1 text-xs'>
                                    {chat.type}
                                  </span>
                                </div>
                                <p className='text-sm text-muted-foreground'>
                                  {chat.chatId}
                                </p>
                              </div>
                              <div className='flex items-center gap-2'>
                                <Button
                                  variant='outline'
                                  size='sm'
                                  onClick={() =>
                                    setTelegramSettings(prev => ({
                                      ...prev,
                                      defaultChatId: chat.chatId,
                                    }))
                                  }
                                  disabled={
                                    telegramSettings.defaultChatId ===
                                    chat.chatId
                                  }
                                >
                                  {telegramSettings.defaultChatId ===
                                  chat.chatId
                                    ? 'Default'
                                    : 'Set Default'}
                                </Button>
                                <Button
                                  variant='outline'
                                  size='icon'
                                  onClick={() => removeChatConfiguration(index)}
                                  className='text-destructive hover:text-destructive'
                                >
                                  <Trash2 className='h-4 w-4' />
                                </Button>
                              </div>
                            </div>
                          )
                        )}
                      </div>
                    )}

                    <div className='space-y-4 rounded-lg border p-4'>
                      <h5 className='font-medium'>Add New Chat</h5>
                      <div className='grid grid-cols-1 gap-4 sm:grid-cols-3'>
                        <div className='space-y-2'>
                          <Label htmlFor='newChatName'>Chat Name</Label>
                          <Input
                            id='newChatName'
                            value={telegramForm.newChatName}
                            onChange={e =>
                              setTelegramForm(prev => ({
                                ...prev,
                                newChatName: e.target.value,
                              }))
                            }
                            placeholder='e.g., Family Group'
                          />
                        </div>
                        <div className='space-y-2'>
                          <Label htmlFor='newChatId'>Chat ID</Label>
                          <Input
                            id='newChatId'
                            value={telegramForm.newChatId}
                            onChange={e =>
                              setTelegramForm(prev => ({
                                ...prev,
                                newChatId: e.target.value,
                              }))
                            }
                            placeholder='e.g., -123456789'
                          />
                        </div>
                        <div className='space-y-2'>
                          <Label htmlFor='newChatType'>Type</Label>
                          <Select
                            value={telegramForm.newChatType}
                            onValueChange={(
                              value: 'user' | 'group' | 'channel'
                            ) =>
                              setTelegramForm(prev => ({
                                ...prev,
                                newChatType: value,
                              }))
                            }
                          >
                            <SelectTrigger id='newChatType'>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value='user'>User</SelectItem>
                              <SelectItem value='group'>Group</SelectItem>
                              <SelectItem value='channel'>Channel</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <Button onClick={addChatConfiguration} className='w-full'>
                        <Plus className='mr-2 h-4 w-4' />
                        Add Chat Configuration
                      </Button>
                    </div>

                    <div className='space-y-4 rounded-lg border p-4'>
                      <h5 className='font-medium'>Test Connection</h5>
                      <div className='flex gap-2'>
                        <Input
                          value={telegramForm.testChatId}
                          onChange={e =>
                            setTelegramForm(prev => ({
                              ...prev,
                              testChatId: e.target.value,
                            }))
                          }
                          placeholder='Enter chat ID to test (e.g., -123456789)'
                          className='flex-1'
                        />
                        <Button
                          onClick={testTelegramConnection}
                          disabled={isTesting}
                          variant='outline'
                        >
                          {isTesting ? (
                            <RefreshCw className='mr-2 h-4 w-4 animate-spin' />
                          ) : (
                            <TestTube className='mr-2 h-4 w-4' />
                          )}
                          {isTesting ? 'Testing...' : 'Test'}
                        </Button>
                      </div>
                      <p className='text-xs text-muted-foreground'>
                        This will send a test message to verify your bot
                        configuration.
                      </p>
                    </div>

                    <Button onClick={saveTelegramSettings} className='w-full'>
                      <Save className='mr-2 h-4 w-4' />
                      Save Telegram Settings
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>


        <TabsContent value='advanced' className='space-y-4 sm:space-y-6'>
          <Card>
            <CardHeader>
              <CardTitle>Advanced Transcription</CardTitle>
              <CardDescription>
                Fine-tune transcription performance and processing
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-4'>
              <div className='space-y-2'>
                <Label htmlFor='device'>Processing Device</Label>
                <Select
                  value={transcriptionSettings.preferredDevice}
                  onValueChange={value =>
                    setTranscriptionSettings(prev => ({
                      ...prev,
                      preferredDevice: value,
                    }))
                  }
                >
                  <SelectTrigger id='device'>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='auto'>
                      Auto (GPU with CPU fallback)
                    </SelectItem>
                    <SelectItem value='cuda'>GPU Only</SelectItem>
                    <SelectItem value='cpu'>CPU Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
                <div className='space-y-2'>
                  <Label htmlFor='batchSize'>Batch Size</Label>
                  <Input
                    id='batchSize'
                    type='number'
                    value={transcriptionSettings.batchSize}
                    onChange={e =>
                      setTranscriptionSettings(prev => ({
                        ...prev,
                        batchSize: parseInt(e.target.value) || 16,
                      }))
                    }
                  />
                </div>

                <div className='space-y-2'>
                  <Label htmlFor='threads'>CPU Threads</Label>
                  <Input
                    id='threads'
                    type='number'
                    value={transcriptionSettings.threads}
                    onChange={e =>
                      setTranscriptionSettings(prev => ({
                        ...prev,
                        threads: parseInt(e.target.value) || 4,
                      }))
                    }
                  />
                </div>
              </div>

              {transcriptionSettings.enableSpeakerDiarization && (
                <div className='space-y-2'>
                  <Label htmlFor='speakerCount'>
                    Number of Speakers (optional)
                  </Label>
                  <Input
                    id='speakerCount'
                    type='number'
                    min='2'
                    max='20'
                    value={transcriptionSettings.speakerCount || ''}
                    onChange={e =>
                      setTranscriptionSettings(prev => ({
                        ...prev,
                        speakerCount: e.target.value
                          ? parseInt(e.target.value)
                          : undefined,
                      }))
                    }
                    placeholder='Auto-detect'
                  />
                  <p className='text-sm text-muted-foreground'>
                    Specify exact number if known. Leave empty to auto-detect.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>AI Models & Prompts</CardTitle>
              <CardDescription>
                Configure AI model selection and default prompts
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-4'>
              <div className='space-y-2'>
                <Label htmlFor='aiModel'>AI Model (OpenRouter)</Label>
                <Input
                  id='aiModel'
                  type='text'
                  value={aiSettings.aiExtractModel}
                  onChange={e =>
                    setAISettings(prev => ({
                      ...prev,
                      aiExtractModel: e.target.value,
                    }))
                  }
                  placeholder='e.g. anthropic/claude-sonnet-4'
                />
                <p className='text-sm text-muted-foreground'>
                  Enter any valid OpenRouter model ID.
                </p>
              </div>

              <div className='space-y-2'>
                <Label htmlFor='openaiKey'>OpenAI API Key (Optional)</Label>
                <div className='flex min-w-0 gap-2'>
                  <Input
                    className='min-w-0 flex-1'
                    id='openaiKey'
                    type={showTokens.openaiApiKey ? 'text' : 'password'}
                    value={aiSettings.openaiApiKey}
                    onChange={e =>
                      setAISettings(prev => ({
                        ...prev,
                        openaiApiKey: e.target.value,
                      }))
                    }
                    placeholder='sk-...'
                  />
                  <Button
                    variant='outline'
                    size='icon'
                    onClick={() => toggleTokenVisibility('openaiApiKey')}
                  >
                    {showTokens.openaiApiKey ? (
                      <EyeOff className='h-4 w-4' />
                    ) : (
                      <Eye className='h-4 w-4' />
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Account & System Section */}
      <Card>
        <CardHeader>
          <CardTitle>Account & System</CardTitle>
          <CardDescription>
            User account and application information
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='flex items-center justify-between rounded-xl bg-muted/50 p-4'>
            <div>
              <p className='text-sm font-medium'>Application Version</p>
              <p className='text-xs text-muted-foreground'>v1.0.0</p>
            </div>
            <Button
              variant='destructive'
              onClick={async () => {
                try {
                  const response = await fetch('/api/auth/logout', {
                    method: 'POST',
                  });
                  if (response.ok) {
                    toast.success('Logged out successfully');
                    window.location.href = '/login';
                  }
                } catch (error) {
                  console.error('Logout failed:', error);
                  toast.error('Logout failed');
                }
              }}
              className='touch-target-44'
            >
              Logout
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className='mt-6 flex justify-end gap-4'>
        <Button variant='outline' onClick={loadSettings}>
          <RefreshCw className='mr-2 h-4 w-4' />
          Reset
        </Button>
        <Button onClick={saveSettings} disabled={isSaving}>
          <Save className='mr-2 h-4 w-4' />
          {isSaving ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>

      {/* Template Creation/Edit Dialog */}
      <Dialog
        open={isTemplateDialogOpen}
        onOpenChange={setIsTemplateDialogOpen}
      >
        <DialogContent className='max-w-2xl'>
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? 'Edit Template' : 'Create New Template'}
            </DialogTitle>
            <DialogDescription>
              {editingTemplate
                ? 'Update your summary template settings'
                : 'Create a custom template for AI summarization'}
            </DialogDescription>
          </DialogHeader>
          <div className='space-y-4'>
            <div className='space-y-2'>
              <Label htmlFor='templateName'>Template Name</Label>
              <Input
                id='templateName'
                value={templateForm.name}
                onChange={e =>
                  setTemplateForm(prev => ({ ...prev, name: e.target.value }))
                }
                placeholder='e.g., Meeting Summary, Interview Notes'
              />
            </div>

            <div className='space-y-2'>
              <Label htmlFor='templateDescription'>
                Description (Optional)
              </Label>
              <Input
                id='templateDescription'
                value={templateForm.description}
                onChange={e =>
                  setTemplateForm(prev => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                placeholder='Brief description of when to use this template'
              />
            </div>

            <div className='space-y-2'>
              <Label htmlFor='templatePrompt'>Template Prompt</Label>
              <Textarea
                id='templatePrompt'
                value={templateForm.prompt}
                onChange={e =>
                  setTemplateForm(prev => ({ ...prev, prompt: e.target.value }))
                }
                placeholder='Enter your custom prompt for summarization...'
                rows={8}
                className='min-h-32'
              />
              <p className='text-xs text-muted-foreground'>
                This prompt will be used to instruct the AI on how to summarize
                transcriptions. Be specific about the format and content you
                want.
              </p>
            </div>

            <div className='flex items-center space-x-2'>
              <Switch
                id='templateDefault'
                checked={templateForm.isDefault}
                onCheckedChange={checked =>
                  setTemplateForm(prev => ({ ...prev, isDefault: checked }))
                }
              />
              <Label htmlFor='templateDefault'>Set as default template</Label>
            </div>
          </div>

          <div className='mt-6 flex justify-end gap-2'>
            <Button
              variant='outline'
              onClick={() => setIsTemplateDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={saveTemplate}>
              {editingTemplate ? 'Update Template' : 'Create Template'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
