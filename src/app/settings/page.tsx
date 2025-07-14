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
  geminiApiKey: string;
  openaiApiKey: string;
  openrouterApiKey: string;
  aiExtractEnabled: boolean;
  aiExtractModel: string;
  aiExtractPrompt: string;
}

interface StorageSettings {
  obsidianEnabled: boolean;
  obsidianVaultPath: string;
  obsidianFolder: string;
}

interface NotesSettings {
  tasksPrompt: string;
  questionsPrompt: string;
  decisionsPrompt: string;
  followupsPrompt: string;
  mentionsPrompt: string;
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
    geminiApiKey: '',
    openaiApiKey: '',
    openrouterApiKey: '',
    aiExtractEnabled: false,
    aiExtractModel: 'anthropic/claude-sonnet-4',
    aiExtractPrompt: 'Summarize the key points from this transcript.',
  });

  const [storageSettings, setStorageSettings] = useState<StorageSettings>({
    obsidianEnabled: false,
    obsidianVaultPath: '',
    obsidianFolder: '',
  });

  const [notesSettings, setNotesSettings] = useState<NotesSettings>({
    tasksPrompt: '',
    questionsPrompt: '',
    decisionsPrompt: '',
    followupsPrompt: '',
    mentionsPrompt: '',
  });

  const [showTokens, setShowTokens] = useState<Record<string, boolean>>({
    huggingfaceToken: false,
    geminiApiKey: false,
    openaiApiKey: false,
    openrouterApiKey: false,
  });

  const [isSaving, setIsSaving] = useState(false);

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
        if (data.storage) {
          setStorageSettings(prev => ({ ...prev, ...data.storage }));
        }
        if (data.notes) {
          setNotesSettings(prev => ({ ...prev, ...data.notes }));
        }
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  }

  async function saveSettings() {
    setIsSaving(true);
    
    try {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transcription: transcriptionSettings,
          ai: aiSettings,
          storage: storageSettings,
          notes: notesSettings,
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

  return (
    <div className="h-full flex flex-col">
      <div className="border-b p-6">
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground mt-1">Configure your transcription preferences</p>
      </div>

      <div className="flex-1 p-6 overflow-auto">
        <Tabs defaultValue="transcription" className="space-y-6">
          <TabsList>
            <TabsTrigger value="transcription">Transcription</TabsTrigger>
            <TabsTrigger value="ai">AI Processing</TabsTrigger>
            <TabsTrigger value="notes">Notes Extraction</TabsTrigger>
            <TabsTrigger value="storage">Storage</TabsTrigger>
          </TabsList>

          <TabsContent value="transcription" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Whisper Settings</CardTitle>
                <CardDescription>Configure the transcription model and parameters</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
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

                <div className="grid grid-cols-2 gap-4">
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
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Speaker Diarization</CardTitle>
                <CardDescription>Identify different speakers in the audio</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="diarization">Enable Speaker Diarization</Label>
                    <p className="text-sm text-muted-foreground">
                      Automatically detect and label different speakers
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
                    <Label htmlFor="speakerCount">Number of Speakers (optional)</Label>
                    <Input
                      id="speakerCount"
                      type="number"
                      min="2"
                      max="20"
                      value={transcriptionSettings.speakerCount || ''}
                      onChange={(e) => setTranscriptionSettings(prev => ({ 
                        ...prev, 
                        speakerCount: e.target.value ? parseInt(e.target.value) : undefined 
                      }))}
                      placeholder="Auto-detect"
                    />
                    <p className="text-sm text-muted-foreground">
                      Specify the exact number of speakers if known. Leave empty to auto-detect.
                    </p>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="huggingfaceToken">HuggingFace Token</Label>
                  <div className="flex gap-2">
                    <Input
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
                    Required for speaker diarization. Get one from huggingface.co
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="ai" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>AI Extraction</CardTitle>
                <CardDescription>Configure AI-powered transcript analysis</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="aiExtract">Enable AI Extraction</Label>
                    <p className="text-sm text-muted-foreground">
                      Automatically generate summaries and insights
                    </p>
                  </div>
                  <Switch
                    id="aiExtract"
                    checked={aiSettings.aiExtractEnabled}
                    onCheckedChange={(checked) => setAISettings(prev => ({ ...prev, aiExtractEnabled: checked }))}
                  />
                </div>

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
                    Enter any valid OpenRouter model ID. Check OpenRouter docs for available models.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="aiPrompt">Default Extraction Prompt</Label>
                  <textarea
                    id="aiPrompt"
                    className="w-full min-h-[100px] px-3 py-2 text-sm rounded-md border border-input bg-background"
                    value={aiSettings.aiExtractPrompt}
                    onChange={(e) => setAISettings(prev => ({ ...prev, aiExtractPrompt: e.target.value }))}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>API Keys</CardTitle>
                <CardDescription>Configure API keys for AI services</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="geminiKey">Gemini API Key</Label>
                  <div className="flex gap-2">
                    <Input
                      id="geminiKey"
                      type={showTokens.geminiApiKey ? 'text' : 'password'}
                      value={aiSettings.geminiApiKey}
                      onChange={(e) => setAISettings(prev => ({ ...prev, geminiApiKey: e.target.value }))}
                      placeholder="AIza..."
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => toggleTokenVisibility('geminiApiKey')}
                    >
                      {showTokens.geminiApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="openaiKey">OpenAI API Key</Label>
                  <div className="flex gap-2">
                    <Input
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

                <div className="space-y-2">
                  <Label htmlFor="openrouterKey">OpenRouter API Key</Label>
                  <div className="flex gap-2">
                    <Input
                      id="openrouterKey"
                      type={showTokens.openrouterApiKey ? 'text' : 'password'}
                      value={aiSettings.openrouterApiKey}
                      onChange={(e) => setAISettings(prev => ({ ...prev, openrouterApiKey: e.target.value }))}
                      placeholder="sk-or-..."
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => toggleTokenVisibility('openrouterApiKey')}
                    >
                      {showTokens.openrouterApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="storage" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Obsidian Integration</CardTitle>
                <CardDescription>Save transcripts to your Obsidian vault</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="obsidian">Enable Obsidian Integration</Label>
                    <p className="text-sm text-muted-foreground">
                      Automatically save transcripts as markdown files
                    </p>
                  </div>
                  <Switch
                    id="obsidian"
                    checked={storageSettings.obsidianEnabled}
                    onCheckedChange={(checked) => setStorageSettings(prev => ({ ...prev, obsidianEnabled: checked }))}
                  />
                </div>

                {storageSettings.obsidianEnabled && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="vaultPath">Vault Path</Label>
                      <Input
                        id="vaultPath"
                        value={storageSettings.obsidianVaultPath}
                        onChange={(e) => setStorageSettings(prev => ({ ...prev, obsidianVaultPath: e.target.value }))}
                        placeholder="/path/to/your/vault"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="obsidianFolder">Folder Name</Label>
                      <Input
                        id="obsidianFolder"
                        value={storageSettings.obsidianFolder}
                        onChange={(e) => setStorageSettings(prev => ({ ...prev, obsidianFolder: e.target.value }))}
                        placeholder="Transcripts"
                      />
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notes" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Notes Extraction Prompts</CardTitle>
                <CardDescription>
                  Customize the AI prompts used to extract different types of notes from transcripts.
                  Leave empty to use default prompts.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="tasksPrompt">Tasks Prompt</Label>
                  <textarea
                    id="tasksPrompt"
                    className="w-full min-h-[100px] p-3 border rounded-md resize-vertical"
                    value={notesSettings.tasksPrompt}
                    onChange={(e) => setNotesSettings(prev => ({ ...prev, tasksPrompt: e.target.value }))}
                    placeholder="Leave empty to use default prompt for extracting tasks and action items..."
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="questionsPrompt">Questions Prompt</Label>
                  <textarea
                    id="questionsPrompt"
                    className="w-full min-h-[100px] p-3 border rounded-md resize-vertical"
                    value={notesSettings.questionsPrompt}
                    onChange={(e) => setNotesSettings(prev => ({ ...prev, questionsPrompt: e.target.value }))}
                    placeholder="Leave empty to use default prompt for extracting unanswered questions..."
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="decisionsPrompt">Decisions Prompt</Label>
                  <textarea
                    id="decisionsPrompt"
                    className="w-full min-h-[100px] p-3 border rounded-md resize-vertical"
                    value={notesSettings.decisionsPrompt}
                    onChange={(e) => setNotesSettings(prev => ({ ...prev, decisionsPrompt: e.target.value }))}
                    placeholder="Leave empty to use default prompt for extracting decisions made..."
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="followupsPrompt">Follow-ups Prompt</Label>
                  <textarea
                    id="followupsPrompt"
                    className="w-full min-h-[100px] p-3 border rounded-md resize-vertical"
                    value={notesSettings.followupsPrompt}
                    onChange={(e) => setNotesSettings(prev => ({ ...prev, followupsPrompt: e.target.value }))}
                    placeholder="Leave empty to use default prompt for extracting follow-up items..."
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="mentionsPrompt">Mentions Prompt</Label>
                  <textarea
                    id="mentionsPrompt"
                    className="w-full min-h-[100px] p-3 border rounded-md resize-vertical"
                    value={notesSettings.mentionsPrompt}
                    onChange={(e) => setNotesSettings(prev => ({ ...prev, mentionsPrompt: e.target.value }))}
                    placeholder="Leave empty to use default prompt for extracting important mentions..."
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

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
    </div>
  );
}