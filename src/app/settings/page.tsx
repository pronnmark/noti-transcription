'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Save, RefreshCw, Eye, EyeOff } from 'lucide-react';

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
  const [transcriptionSettings, setTranscriptionSettings] = useState<TranscriptionSettings>({
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

  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    try {
      const response = await fetch('/api/settings');
      if (response.ok) {
        const data = await response.json();

        if (data.transcription) {
          setTranscriptionSettings(prev => ({ ...prev, ...data.transcription }));
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
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
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
          errors.customAiBaseUrl = 'Base URL should include /v1 endpoint (e.g., https://api.openai.com/v1)';
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

    if ((hasBaseUrl || hasApiKey || hasModel) && (!hasBaseUrl || !hasApiKey || !hasModel)) {
      if (!hasBaseUrl) errors.customAiBaseUrl = 'Base URL is required when using custom AI';
      if (!hasApiKey) errors.customAiApiKey = 'API key is required when using custom AI';
      if (!hasModel) errors.customAiModel = 'Model name is required when using custom AI';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  }

  return (
    <div className="standard-page-bg min-h-screen overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
      {/* Header - Now part of scrollable content */}
      <div className="space-y-2 buzz-header-desktop">
        <h1 className="text-3xl font-semibold text-foreground">Settings</h1>
        <p className="text-muted-foreground text-base">Configure your transcription preferences</p>
      </div>
      <Tabs defaultValue="essential" className="space-y-4 sm:space-y-6">
        <TabsList>
          <TabsTrigger value="essential">Essential</TabsTrigger>
          <TabsTrigger value="advanced">Advanced</TabsTrigger>
        </TabsList>

        <TabsContent value="essential" className="space-y-4 sm:space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Basic Transcription</CardTitle>
              <CardDescription>Essential settings for speech-to-text transcription</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="modelSize">Model Size</Label>
                  <Select
                    value={transcriptionSettings.modelSize}
                    onValueChange={(value) => setTranscriptionSettings(prev => ({ ...prev, modelSize: value }))}
                  >
                    <SelectTrigger id="modelSize">
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

                <div className="space-y-2">
                  <Label htmlFor="language">Language</Label>
                  <Select
                    value={transcriptionSettings.language}
                    onValueChange={(value) => setTranscriptionSettings(prev => ({ ...prev, language: value }))}
                  >
                    <SelectTrigger id="language">
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
              <CardDescription>Identify different speakers in conversations</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="diarization">Enable Speaker Detection</Label>
                  <p className="text-sm text-muted-foreground">
                      Automatically identify different speakers
                  </p>
                </div>
                <Switch
                  id="diarization"
                  checked={transcriptionSettings.enableSpeakerDiarization}
                  onCheckedChange={(checked) => setTranscriptionSettings(prev => ({ ...prev, enableSpeakerDiarization: checked }))}
                />
              </div>

              {transcriptionSettings.enableSpeakerDiarization && (
                <div className="space-y-2">
                  <Label htmlFor="huggingfaceToken">HuggingFace Token</Label>
                  <div className="flex gap-2 min-w-0">
                    <Input
                      className="flex-1 min-w-0"
                      id="huggingfaceToken"
                      type={showTokens.huggingfaceToken ? 'text' : 'password'}
                      value={transcriptionSettings.huggingfaceToken}
                      onChange={(e) => setTranscriptionSettings(prev => ({ ...prev, huggingfaceToken: e.target.value }))}
                      placeholder="hf_..."
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => toggleTokenVisibility('huggingfaceToken')}
                    >
                      {showTokens.huggingfaceToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground">
                      Required for speaker detection. Get one from huggingface.co
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>OpenAI-Compatible AI API</CardTitle>
              <CardDescription>Configure any OpenAI-compatible AI service for summarization and note extraction</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="standard-card p-4 bg-muted/20">
                <h4 className="font-medium mb-2">Supported Providers</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                  <div className="break-all"><strong>OpenAI:</strong> https://api.openai.com/v1</div>
                  <div className="break-all"><strong>Anthropic:</strong> https://api.anthropic.com/v1</div>
                  <div className="break-all"><strong>OpenRouter:</strong> https://openrouter.ai/api/v1</div>
                  <div className="break-all"><strong>Local (LM Studio):</strong> http://localhost:1234/v1</div>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                    All providers must support OpenAI's /chat/completions API format
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="customAiBaseUrl">API Base URL</Label>
                <Input
                  id="customAiBaseUrl"
                  type="url"
                  value={aiSettings.customAiBaseUrl}
                  onChange={(e) => {
                    setAISettings(prev => ({ ...prev, customAiBaseUrl: e.target.value }));
                    // Clear validation error when user starts typing
                    if (validationErrors.customAiBaseUrl) {
                      setValidationErrors(prev => ({ ...prev, customAiBaseUrl: '' }));
                    }
                  }}
                  placeholder="https://api.openai.com/v1"
                  className={validationErrors.customAiBaseUrl ? 'border-red-500' : ''}
                />
                {validationErrors.customAiBaseUrl && (
                  <p className="text-sm text-red-500">{validationErrors.customAiBaseUrl}</p>
                )}
                <p className="text-sm text-muted-foreground">
                    Complete base URL including /v1 endpoint (must support OpenAI chat/completions format)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="customAiApiKey">API Key</Label>
                <div className="flex gap-2 min-w-0">
                  <Input
                    className="flex-1 min-w-0"
                    id="customAiApiKey"
                    type={showTokens.customAiApiKey ? 'text' : 'password'}
                    value={aiSettings.customAiApiKey}
                    onChange={(e) => {
                      setAISettings(prev => ({ ...prev, customAiApiKey: e.target.value }));
                      // Clear validation error when user starts typing
                      if (validationErrors.customAiApiKey) {
                        setValidationErrors(prev => ({ ...prev, customAiApiKey: '' }));
                      }
                    }}
                    placeholder="sk-... (OpenAI) or claude-... (Anthropic)"
                    className={validationErrors.customAiApiKey ? 'border-red-500' : ''}
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => toggleTokenVisibility('customAiApiKey')}
                  >
                    {showTokens.customAiApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                {validationErrors.customAiApiKey && (
                  <p className="text-sm text-red-500">{validationErrors.customAiApiKey}</p>
                )}
                <p className="text-sm text-muted-foreground">
                    API key from your chosen provider (get from provider's dashboard)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="customAiModel">Model Name</Label>
                <Input
                  id="customAiModel"
                  type="text"
                  value={aiSettings.customAiModel}
                  onChange={(e) => {
                    setAISettings(prev => ({ ...prev, customAiModel: e.target.value }));
                    // Clear validation error when user starts typing
                    if (validationErrors.customAiModel) {
                      setValidationErrors(prev => ({ ...prev, customAiModel: '' }));
                    }
                  }}
                  placeholder="gpt-3.5-turbo"
                  className={validationErrors.customAiModel ? 'border-red-500' : ''}
                />
                {validationErrors.customAiModel && (
                  <p className="text-sm text-red-500">{validationErrors.customAiModel}</p>
                )}
                <div className="text-sm text-muted-foreground">
                  <p>Common models by provider:</p>
                  <div className="mt-1 grid grid-cols-1 gap-1 text-xs">
                    <div><strong>OpenAI:</strong> gpt-3.5-turbo, gpt-4, gpt-4-turbo</div>
                    <div><strong>Anthropic:</strong> claude-3-sonnet-20240229, claude-3-haiku-20240307</div>
                    <div><strong>OpenRouter:</strong> anthropic/claude-3-sonnet, openai/gpt-4</div>
                    <div><strong>Local:</strong> llama-3.1-8b, mixtral-8x7b-instruct</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

        </TabsContent>

        <TabsContent value="advanced" className="space-y-4 sm:space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Advanced Transcription</CardTitle>
              <CardDescription>Fine-tune transcription performance and processing</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="device">Processing Device</Label>
                <Select
                  value={transcriptionSettings.preferredDevice}
                  onValueChange={(value) => setTranscriptionSettings(prev => ({ ...prev, preferredDevice: value }))}
                >
                  <SelectTrigger id="device">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Auto (GPU with CPU fallback)</SelectItem>
                    <SelectItem value="cuda">GPU Only</SelectItem>
                    <SelectItem value="cpu">CPU Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="batchSize">Batch Size</Label>
                  <Input
                    id="batchSize"
                    type="number"
                    value={transcriptionSettings.batchSize}
                    onChange={(e) => setTranscriptionSettings(prev => ({ ...prev, batchSize: parseInt(e.target.value) || 16 }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="threads">CPU Threads</Label>
                  <Input
                    id="threads"
                    type="number"
                    value={transcriptionSettings.threads}
                    onChange={(e) => setTranscriptionSettings(prev => ({ ...prev, threads: parseInt(e.target.value) || 4 }))}
                  />
                </div>
              </div>

              {transcriptionSettings.enableSpeakerDiarization && (
                <div className="space-y-2">
                  <Label htmlFor="speakerCount">Number of Speakers (optional)</Label>
                  <Input
                    id="speakerCount"
                    type="number"
                    min="2"
                    max="20"
                    value={transcriptionSettings.speakerCount || ''}
                    onChange={(e) => setTranscriptionSettings(prev => ({
                      ...prev,
                      speakerCount: e.target.value ? parseInt(e.target.value) : undefined,
                    }))}
                    placeholder="Auto-detect"
                  />
                  <p className="text-sm text-muted-foreground">
                      Specify exact number if known. Leave empty to auto-detect.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>AI Models & Prompts</CardTitle>
              <CardDescription>Configure AI model selection and default prompts</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="aiModel">AI Model (OpenRouter)</Label>
                <Input
                  id="aiModel"
                  type="text"
                  value={aiSettings.aiExtractModel}
                  onChange={(e) => setAISettings(prev => ({ ...prev, aiExtractModel: e.target.value }))}
                  placeholder="e.g. anthropic/claude-sonnet-4"
                />
                <p className="text-sm text-muted-foreground">
                    Enter any valid OpenRouter model ID.
                </p>
              </div>


              <div className="space-y-2">
                <Label htmlFor="openaiKey">OpenAI API Key (Optional)</Label>
                <div className="flex gap-2 min-w-0">
                  <Input
                    className="flex-1 min-w-0"
                    id="openaiKey"
                    type={showTokens.openaiApiKey ? 'text' : 'password'}
                    value={aiSettings.openaiApiKey}
                    onChange={(e) => setAISettings(prev => ({ ...prev, openaiApiKey: e.target.value }))}
                    placeholder="sk-..."
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => toggleTokenVisibility('openaiApiKey')}
                  >
                    {showTokens.openaiApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
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
          <CardDescription>User account and application information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-xl">
            <div>
              <p className="text-sm font-medium">Application Version</p>
              <p className="text-xs text-muted-foreground">v1.0.0</p>
            </div>
            <Button
              variant="destructive"
              onClick={async () => {
                try {
                  const response = await fetch('/api/auth/logout', { method: 'POST' });
                  if (response.ok) {
                    toast.success('Logged out successfully');
                    window.location.href = '/login';
                  }
                } catch (error) {
                  console.error('Logout failed:', error);
                  toast.error('Logout failed');
                }
              }}
              className="touch-target-44"
            >
                Logout
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-4 mt-6">
        <Button variant="outline" onClick={loadSettings}>
          <RefreshCw className="h-4 w-4 mr-2" />
            Reset
        </Button>
        <Button onClick={saveSettings} disabled={isSaving}>
          <Save className="h-4 w-4 mr-2" />
          {isSaving ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>
    </div>
  );
}
