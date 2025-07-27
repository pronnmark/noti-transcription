'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, ArrowLeft, Edit2, Save, X, Users, Clock, FileText, Trash2, Download, RefreshCw, Copy, Sparkles, Plus, Send } from 'lucide-react';
import { toast } from 'sonner';
import { useMediaQuery } from '@/hooks/use-media-query';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';

interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
  speaker?: string;
  displayName?: string;
}

interface Speaker {
  id: string;
  displayName: string;
  hasCustomName: boolean;
}

interface TranscriptData {
  segments: TranscriptSegment[];
  speakers: Speaker[];
  hasSpeakers?: boolean;
  customSpeakerNames: Record<string, string>;
}

interface FileInfo {
  id: string;
  originalFileName: string;
  fileName: string;
  duration?: number;
  uploadedAt: string;
  transcribedAt?: string;
  language?: string;
  modelSize?: string;
  size?: number;
  mimeType?: string;
  transcriptionStatus?: string;
}

interface Summary {
  id: string;
  content: string;
  model: string;
  prompt: string;
  createdAt: string;
  updatedAt: string;
  template?: {
    id: string;
    name: string;
    description: string;
    isDefault: boolean;
  };
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

export default function TranscriptPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const isMobile = useMediaQuery('(max-width: 767px)');

  const [transcript, setTranscript] = useState<TranscriptData | null>(null);
  const [fileInfo, setFileInfo] = useState<FileInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [speakerLabels, setSpeakerLabels] = useState<Record<string, string>>({});
  const [editingSpeaker, setEditingSpeaker] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [summaries, setSummaries] = useState<Summary[]>([]);
  const [templates, setTemplates] = useState<SummarizationTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [isCreatingSummary, setIsCreatingSummary] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [deletingSummaryId, setDeletingSummaryId] = useState<string | null>(null);
  const [showTelegramDialog, setShowTelegramDialog] = useState(false);
  const [telegramTarget, setTelegramTarget] = useState<'group' | 'user'>('group');
  const [telegramUsername, setTelegramUsername] = useState('');
  const [telegramGroupName, setTelegramGroupName] = useState('devdash');
  const [includeTimestamps, setIncludeTimestamps] = useState(false);
  const [isSendingTelegram, setIsSendingTelegram] = useState(false);

  useEffect(() => {
    loadTranscript();
    loadFileInfo();
    loadSummaries();
    loadTemplates();
  }, [id]);

  async function loadTranscript() {
    try {
      const response = await fetch(`/api/transcript/${id}`);
      if (response.ok) {
        const data = await response.json();
        setTranscript(data);

        // Set speaker labels from the API response
        setSpeakerLabels(data.customSpeakerNames || {});
      } else {
        toast.error('Failed to load transcript');
      }
    } catch (error) {
      console.error('Failed to load transcript:', error);
      toast.error('Failed to load transcript');
    } finally {
      setIsLoading(false);
    }
  }

  async function loadFileInfo() {
    try {
      const response = await fetch(`/api/files/${id}`);
      if (response.ok) {
        const data = await response.json();
        setFileInfo(data);
      }
    } catch (error) {
      console.error('Failed to load file info:', error);
    }
  }

  async function loadSummaries() {
    try {
      const response = await fetch(`/api/summarization/${id}`);
      if (response.ok) {
        const data = await response.json();
        setSummaries(data.summarizations || []);
      }
    } catch (error) {
      console.error('Failed to load summaries:', error);
    }
  }

  async function loadTemplates() {
    try {
      const response = await fetch('/api/summarization-prompts');
      if (response.ok) {
        const data = await response.json();
        setTemplates(data.prompts || []);
        // Set default template if available
        const defaultTemplate = data.prompts?.find((t: SummarizationTemplate) => t.isDefault);
        if (defaultTemplate) {
          setSelectedTemplate(defaultTemplate.id);
        }
      }
    } catch (error) {
      console.error('Failed to load templates:', error);
    }
  }

  async function handleCreateSummary() {
    if (!selectedTemplate || !fileInfo) return;

    setIsCreatingSummary(true);
    try {
      const response = await fetch(`/api/summarization/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId: selectedTemplate }),
      });

      if (response.ok) {
        toast.success('Summary created successfully');
        await loadSummaries();
        setShowCreateDialog(false);
      } else {
        const error = await response.json();
        toast.error(error.message || 'Failed to create summary');
      }
    } catch (error) {
      console.error('Failed to create summary:', error);
      toast.error('Failed to create summary');
    } finally {
      setIsCreatingSummary(false);
    }
  }

  async function handleDeleteSummary(summaryId: string) {
    setDeletingSummaryId(summaryId);
    try {
      const response = await fetch(`/api/summary/${summaryId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast.success('Summary deleted');
        setSummaries(summaries.filter(s => s.id !== summaryId));
      } else {
        toast.error('Failed to delete summary');
      }
    } catch (error) {
      console.error('Failed to delete summary:', error);
      toast.error('Failed to delete summary');
    } finally {
      setDeletingSummaryId(null);
    }
  }

  function formatTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }

  function formatDuration(seconds?: number): string {
    if (!seconds) return '--:--';
    return formatTime(seconds);
  }

  function formatFileSize(bytes?: number): string {
    if (!bytes) return 'Unknown size';
    const mb = bytes / (1024 * 1024);
    if (mb >= 1) {
      return `${mb.toFixed(1)} MB`;
    }
    const kb = bytes / 1024;
    return `${kb.toFixed(1)} KB`;
  }

  function formatDate(dateString?: string): string {
    if (!dateString) return 'Unknown';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function handleSpeakerEdit(speaker: string) {
    setEditingSpeaker(speaker);
    setEditValue(speakerLabels[speaker] || speaker);
  }

  async function handleSpeakerSave() {
    if (!editingSpeaker || !editValue.trim()) {
      setEditingSpeaker(null);
      setEditValue('');
      return;
    }

    try {
      const updatedLabels = {
        ...speakerLabels,
        [editingSpeaker]: editValue.trim(),
      };

      // Save to backend
      const response = await fetch(`/api/files/${id}/speakers`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ labels: updatedLabels }),
      });

      if (response.ok) {
        setSpeakerLabels(updatedLabels);
        toast.success('Speaker name saved successfully');

        // Reload transcript to get updated display names
        await loadTranscript();
      } else {
        throw new Error('Failed to save speaker name');
      }
    } catch (error) {
      console.error('Failed to save speaker name:', error);
      toast.error('Failed to save speaker name');
    }

    setEditingSpeaker(null);
    setEditValue('');
  }

  function handleSpeakerCancel() {
    setEditingSpeaker(null);
    setEditValue('');
  }

  function getSpeakerColor(speaker: string | undefined): string {
    const colors = [
      'text-blue-600',
      'text-green-600',
      'text-purple-600',
      'text-orange-600',
      'text-pink-600',
      'text-indigo-600',
      'text-red-600',
      'text-teal-600',
    ];

    // Handle undefined/null speaker
    if (!speaker) {
      return colors[0];
    }

    const speakerIndex = Object.keys(speakerLabels).indexOf(speaker);
    // Ensure we always get a valid index (handle -1 case)
    const validIndex = speakerIndex >= 0 ? speakerIndex : Math.abs(speaker.charCodeAt(0)) % colors.length;
    return colors[validIndex % colors.length];
  }

  async function handleDeleteFile() {
    if (!fileInfo || !confirm(`Are you sure you want to delete "${fileInfo.originalFileName}"? This will permanently remove the audio file and transcript.`)) {
      return;
    }

    setIsDeleting(true);

    try {
      const response = await fetch(`/api/files/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Delete failed');
      }

      toast.success(`${fileInfo.originalFileName} deleted successfully`);
      router.push('/files'); // Redirect to files page
    } catch (error) {
      toast.error(`Failed to delete ${fileInfo.originalFileName}`);
      console.error('Delete error:', error);
    } finally {
      setIsDeleting(false);
    }
  }

  function downloadFile(content: string, filename: string, mimeType: string) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function formatTranscriptForExport(format: 'markdown' | 'json' | 'txt') {
    if (!transcript || !fileInfo) return '';

    const title = fileInfo.originalFileName;
    const duration = formatDuration(fileInfo.duration);
    const speakersText = hasSpeakers ?
      `Speakers: ${uniqueSpeakers.map(s => s.displayName).join(', ')}` :
      'No speaker information';

    if (format === 'json') {
      return JSON.stringify({
        file: {
          name: fileInfo.originalFileName,
          duration: fileInfo.duration,
          language: fileInfo.language,
          transcribedAt: fileInfo.transcribedAt,
        },
        speakers: hasSpeakers ? Object.fromEntries(
          uniqueSpeakers.map(s => [s.id, s.displayName]),
        ) : null,
        transcript: transcript.segments.map(segment => ({
          start: segment.start,
          end: segment.end,
          speaker: segment.displayName || segment.speaker,
          text: segment.text,
        })),
      }, null, 2);
    }

    if (format === 'markdown') {
      let content = `# ${title}\n\n`;
      content += `**Duration:** ${duration}\n`;
      content += `**${speakersText}**\n`;
      if (fileInfo.language) content += `**Language:** ${fileInfo.language}\n`;
      content += `\n---\n\n## Transcript\n\n`;

      transcript.segments.forEach(segment => {
        const timestamp = formatTime(segment.start);
        if (segment.speaker) {
          const speakerName = segment.displayName || segment.speaker;
          content += `**[${timestamp}] ${speakerName}:** ${segment.text}\n\n`;
        } else {
          content += `**[${timestamp}]** ${segment.text}\n\n`;
        }
      });

      return content;
    }

    // Plain text format
    let content = `${title}\n`;
    content += `Duration: ${duration}\n`;
    content += `${speakersText}\n`;
    if (fileInfo.language) content += `Language: ${fileInfo.language}\n`;
    content += `\n${'='.repeat(50)}\n\nTRANSCRIPT\n\n`;

    transcript.segments.forEach(segment => {
      const timestamp = formatTime(segment.start);
      if (segment.speaker) {
        const speakerName = segment.displayName || segment.speaker;
        content += `[${timestamp}] ${speakerName}: ${segment.text}\n\n`;
      } else {
        content += `[${timestamp}] ${segment.text}\n\n`;
      }
    });

    return content;
  }

  function handleExport(format: 'markdown' | 'json' | 'txt') {
    const content = formatTranscriptForExport(format);
    const baseFilename = fileInfo?.originalFileName?.replace(/\.[^/.]+$/, '') || 'transcript';

    const mimeTypes = {
      markdown: 'text/markdown',
      json: 'application/json',
      txt: 'text/plain',
    };

    const extensions = {
      markdown: 'md',
      json: 'json',
      txt: 'txt',
    };

    const filename = `${baseFilename}.${extensions[format]}`;
    downloadFile(content, filename, mimeTypes[format]);
    toast.success(`Exported as ${format.toUpperCase()}`);
  }

  async function handleCopy() {
    try {
      const content = formatTranscriptForExport('txt');
      await navigator.clipboard.writeText(content);
      toast.success('Transcript copied to clipboard');
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      toast.error('Failed to copy transcript');
    }
  }

  async function handleSendToTelegram() {
    setIsSendingTelegram(true);
    try {
      const body: any = {
        fileId: id,
        includeTimestamps,
      };

      if (telegramTarget === 'user') {
        body.username = telegramUsername;
      } else {
        body.groupName = telegramGroupName;
      }

      const response = await fetch('/api/telegram/share-transcript', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        toast.success('Transcript sent to Telegram!');
        setShowTelegramDialog(false);
      } else {
        toast.error(data.error || 'Failed to send to Telegram');
      }
    } catch (error) {
      console.error('Failed to send to Telegram:', error);
      toast.error('Failed to send transcript to Telegram');
    } finally {
      setIsSendingTelegram(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!transcript) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Transcript not found</p>
          <Button onClick={() => router.push('/')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  const hasSpeakers = transcript.segments.some(s => s.speaker);
  const uniqueSpeakers = transcript.speakers || [];
  const uniqueSpeakerIds = uniqueSpeakers.map(s => s.id);

  return (
    <div className={cn(
      'flex flex-col',
      // Mobile: Natural document flow with minimum screen height
      // Desktop: Fixed viewport height with internal scrolling
      isMobile ? 'min-h-screen' : 'h-full',
    )}>
      {/* Header - Hidden on mobile as it's handled by responsive layout */}
      {!isMobile && (
        <div className="border-b buzz-header-desktop">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <Button variant="ghost" size="sm" onClick={() => router.push('/')} className="hover:bg-secondary">
                  <ArrowLeft className="h-4 w-4 text-foreground" />
                </Button>
                <h1 className="text-3xl font-semibold text-foreground">Transcript</h1>
              </div>
              {fileInfo && (
                <p className="text-muted-foreground text-base">{fileInfo.originalFileName}</p>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleCopy}
              >
                <Copy className="mr-2 h-4 w-4" />
                Copy
              </Button>
              <Dialog open={showTelegramDialog} onOpenChange={setShowTelegramDialog}>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <Send className="mr-2 h-4 w-4" />
                    Telegram
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Send Transcript to Telegram</DialogTitle>
                    <DialogDescription>
                      Choose where to send this transcript
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <Label>Send to</Label>
                      <Select value={telegramTarget} onValueChange={(value: 'group' | 'user') => setTelegramTarget(value)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="group">Group</SelectItem>
                          <SelectItem value="user">User</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    {telegramTarget === 'user' ? (
                      <div className="space-y-2">
                        <Label htmlFor="telegram-username">Username</Label>
                        <Select value={telegramUsername} onValueChange={setTelegramUsername}>
                          <SelectTrigger id="telegram-username">
                            <SelectValue placeholder="Select a user" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="philip">Philip (ddphilip)</SelectItem>
                            <SelectItem value="oskar">Oskar (ddoskar)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Label htmlFor="telegram-group">Group</Label>
                        <Select value={telegramGroupName} onValueChange={setTelegramGroupName}>
                          <SelectTrigger id="telegram-group">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="devdash">DevDash</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id="include-timestamps" 
                        checked={includeTimestamps}
                        onCheckedChange={(checked) => setIncludeTimestamps(checked as boolean)}
                      />
                      <Label htmlFor="include-timestamps" className="text-sm">
                        Include timestamps
                      </Label>
                    </div>
                    
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        onClick={() => setShowTelegramDialog(false)}
                        disabled={isSendingTelegram}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleSendToTelegram}
                        disabled={isSendingTelegram || (telegramTarget === 'user' && !telegramUsername)}
                      >
                        {isSendingTelegram ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Sending...
                          </>
                        ) : (
                          <>
                            <Send className="h-4 w-4 mr-2" />
                            Send
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
              <Button
                variant="outline"
                onClick={handleDeleteFile}
                disabled={isDeleting}
                className="text-red-600 hover:text-red-700"
              >
                {isDeleting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="mr-2 h-4 w-4" />
                )}
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div className={cn(
        'flex-1',
        // Mobile: No overflow constraints, natural document flow
        // Desktop: Overflow hidden for internal scrolling
        isMobile ? '' : 'overflow-hidden',
      )}>
        <div className={cn(
          'pwa-scrollable',
          // Mobile: Natural document flow with safe area padding
          // Desktop: Fixed height with internal scrolling
          isMobile
            ? 'px-4 py-6 space-y-6'
            : 'h-full overflow-y-auto p-6',
        )}>
          {isMobile ? (
            // Mobile Layout - Details first, then transcript
            <div className="space-y-6">
              {/* Mobile Header */}
              <div className="flex items-center gap-3 mb-2">
                <Button variant="ghost" size="sm" onClick={() => router.push('/')} className="hover:bg-secondary">
                  <ArrowLeft className="h-4 w-4 text-foreground" />
                </Button>
                <div>
                  <h1 className="text-xl font-semibold text-foreground">Transcript</h1>
                  {fileInfo && (
                    <p className="text-muted-foreground text-sm">{fileInfo.originalFileName}</p>
                  )}
                </div>
              </div>
              {/* Recording Details - Compact mobile version */}
              <Card className="standard-card">
                <CardContent className="py-3 px-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium text-sm">{formatDuration(fileInfo?.duration)}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      {hasSpeakers && (
                        <>
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium text-sm">{uniqueSpeakers.length} speakers</span>
                        </>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {transcript.segments.length} segments
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Summaries - Compact Mobile Version */}
              <Card className="standard-card">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <Sparkles className="h-4 w-4" />
                      Summaries ({summaries.length})
                    </CardTitle>
                    <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                      <DialogTrigger asChild>
                        <Button size="sm" variant="outline">
                          <Plus className="h-3 w-3 mr-1" />
                          New
                        </Button>
                      </DialogTrigger>
                    </Dialog>
                  </div>
                </CardHeader>
                <CardContent className="py-0 pb-3">
                  {summaries.length === 0 ? (
                    <div className="text-center py-3">
                      <p className="text-xs text-muted-foreground">
                        Create a summary to extract key insights
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {summaries.map((summary) => (
                        <div key={summary.id} className="border rounded-md p-2">
                          <div className="flex items-center justify-between">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs font-medium text-muted-foreground">
                                  {(summary.template?.name || 'Custom').substring(0, 25)}
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground line-clamp-1">
                                {summary.content.replace(/^#.*$/gm, '').trim().substring(0, 80)}...
                              </p>
                            </div>
                            <div className="flex gap-1 ml-2">
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button size="icon" variant="ghost" className="h-6 w-6">
                                    <FileText className="h-3 w-3" />
                                  </Button>
                                </DialogTrigger>
                                <DialogContent className="max-w-[95vw] max-h-[80vh] overflow-y-auto">
                                  <DialogHeader>
                                    <DialogTitle>{summary.template?.name || 'Summary'}</DialogTitle>
                                    <DialogDescription>
                                      Created {formatDate(summary.createdAt)}
                                    </DialogDescription>
                                  </DialogHeader>
                                  <div className="mt-4 whitespace-pre-wrap text-sm">
                                    {summary.content}
                                  </div>
                                </DialogContent>
                              </Dialog>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6"
                                onClick={() => handleDeleteSummary(summary.id)}
                                disabled={deletingSummaryId === summary.id}
                              >
                                {deletingSummaryId === summary.id ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Trash2 className="h-3 w-3" />
                                )}
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Create Summary Dialog - Mobile */}
              <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                <DialogContent className="max-w-[95vw]">
                  <DialogHeader>
                    <DialogTitle>Create Summary</DialogTitle>
                    <DialogDescription>
                          Select a template to generate a summary
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <Label htmlFor="template-mobile">Template</Label>
                      <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                        <SelectTrigger id="template-mobile">
                          <SelectValue placeholder="Select a template" />
                        </SelectTrigger>
                        <SelectContent>
                          {templates.map((template) => (
                            <SelectItem key={template.id} value={template.id}>
                              {template.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {selectedTemplate && (
                      <div className="space-y-2">
                        <Label>Description</Label>
                        <p className="text-sm text-muted-foreground">
                          {templates.find(t => t.id === selectedTemplate)?.description}
                        </p>
                      </div>
                    )}
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        onClick={() => setShowCreateDialog(false)}
                        disabled={isCreatingSummary}
                      >
                            Cancel
                      </Button>
                      <Button
                        onClick={handleCreateSummary}
                        disabled={!selectedTemplate || isCreatingSummary}
                      >
                        {isCreatingSummary ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Generating...
                          </>
                        ) : (
                          'Generate'
                        )}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>

              {/* Telegram Dialog - Mobile */}
              <Dialog open={showTelegramDialog} onOpenChange={setShowTelegramDialog}>
                <DialogContent className="max-w-[95vw]">
                  <DialogHeader>
                    <DialogTitle>Send to Telegram</DialogTitle>
                    <DialogDescription>
                      Choose where to send this transcript
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <Label>Send to</Label>
                      <Select value={telegramTarget} onValueChange={(value: 'group' | 'user') => setTelegramTarget(value)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="group">Group</SelectItem>
                          <SelectItem value="user">User</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    {telegramTarget === 'user' ? (
                      <div className="space-y-2">
                        <Label htmlFor="telegram-username-mobile">Username</Label>
                        <Select value={telegramUsername} onValueChange={setTelegramUsername}>
                          <SelectTrigger id="telegram-username-mobile">
                            <SelectValue placeholder="Select a user" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="philip">Philip (ddphilip)</SelectItem>
                            <SelectItem value="oskar">Oskar (ddoskar)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Label htmlFor="telegram-group-mobile">Group</Label>
                        <Select value={telegramGroupName} onValueChange={setTelegramGroupName}>
                          <SelectTrigger id="telegram-group-mobile">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="devdash">DevDash</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id="include-timestamps-mobile" 
                        checked={includeTimestamps}
                        onCheckedChange={(checked) => setIncludeTimestamps(checked as boolean)}
                      />
                      <Label htmlFor="include-timestamps-mobile" className="text-sm">
                        Include timestamps
                      </Label>
                    </div>
                    
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        onClick={() => setShowTelegramDialog(false)}
                        disabled={isSendingTelegram}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleSendToTelegram}
                        disabled={isSendingTelegram || (telegramTarget === 'user' && !telegramUsername)}
                      >
                        {isSendingTelegram ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Sending...
                          </>
                        ) : (
                          <>
                            <Send className="h-4 w-4 mr-2" />
                            Send
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>

              {/* Transcript Section */}
              <Card className="standard-card">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Transcript</CardTitle>
                      <CardDescription>
                        {fileInfo?.originalFileName}
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="touch-target-44"
                        onClick={handleCopy}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Dialog open={showTelegramDialog} onOpenChange={setShowTelegramDialog}>
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="sm" className="touch-target-44">
                            <Send className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                      </Dialog>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Transcript segments with Design Buzz styling */}
                  <div className="space-y-4">
                    {transcript.segments.map((segment, index) => (
                      <div key={index} className="group active:bg-secondary/20 p-3 rounded-lg transition-colors duration-200">
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0 w-12 text-right">
                            <span className="text-xs text-muted-foreground font-mono bg-muted px-2 py-1 rounded">
                              {formatTime(segment.start)}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            {segment.speaker && (
                              <div className={`text-sm font-semibold mb-2 flex items-center gap-2 ${getSpeakerColor(segment.speaker)}`}>
                                <div className={`w-2 h-2 rounded-full ${getSpeakerColor(segment.speaker)?.replace('text-', 'bg-') || 'bg-blue-600'}`}></div>
                                {segment.displayName || segment.speaker}
                              </div>
                            )}
                            <p className="text-sm leading-relaxed text-foreground">{segment.text}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

            </div>
          ) : (
            // Desktop Layout - Enhanced 3-column grid for better transcript visibility
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
              {/* Sidebar */}
              <div className="lg:col-span-1 space-y-4">
                {/* Recording Information */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                  Recording Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="space-y-2">
                      <div>
                        <span className="text-muted-foreground font-medium">File Name:</span>
                        <div className="text-foreground text-xs mt-1 break-all">
                          {fileInfo?.originalFileName}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-2 pt-2 border-t">
                      <div>
                        <span className="text-muted-foreground">Duration:</span>
                        <span className="ml-2 font-medium">{formatDuration(fileInfo?.duration)}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">File Size:</span>
                        <span className="ml-2 font-medium">{formatFileSize(fileInfo?.size)}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Uploaded:</span>
                        <span className="ml-2 font-medium">{formatDate(fileInfo?.uploadedAt)}</span>
                      </div>
                      {fileInfo?.transcribedAt && (
                        <div>
                          <span className="text-muted-foreground">Transcribed:</span>
                          <span className="ml-2 font-medium">{formatDate(fileInfo.transcribedAt)}</span>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 gap-2 pt-2 border-t">
                      <div>
                        <span className="text-muted-foreground">Language:</span>
                        <span className="ml-2 font-medium">{fileInfo?.language || 'Swedish'}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Model:</span>
                        <span className="ml-2 font-medium">{fileInfo?.modelSize || 'large-v3'}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Segments:</span>
                        <span className="ml-2 font-medium">{transcript.segments.length}</span>
                      </div>
                      {hasSpeakers && (
                        <div>
                          <span className="text-muted-foreground">Speakers:</span>
                          <span className="ml-2 font-medium">{uniqueSpeakers.length}</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Speakers */}
                {hasSpeakers && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Users className="h-4 w-4" />
                    Speakers ({uniqueSpeakers.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {uniqueSpeakers.map((speaker) => (
                        <div key={speaker.id} className="flex items-center gap-2">
                          {editingSpeaker === speaker.id ? (
                            <div className="flex items-center gap-1 flex-1">
                              <Input
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                className="h-8 text-sm"
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSpeakerSave();
                                  if (e.key === 'Escape') handleSpeakerCancel();
                                }}
                              />
                              <Button size="sm" onClick={handleSpeakerSave}>
                                <Save className="h-3 w-3" />
                              </Button>
                              <Button size="sm" variant="ghost" onClick={handleSpeakerCancel}>
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between flex-1">
                              <span className={`text-sm font-medium ${getSpeakerColor(speaker.id)}`}>
                                {speaker.displayName}
                              </span>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleSpeakerEdit(speaker.id)}
                              >
                                <Edit2 className="h-3 w-3" />
                              </Button>
                            </div>
                          )}
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {/* Summaries */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Sparkles className="h-4 w-4" />
                      Summaries ({summaries.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {summaries.length === 0 ? (
                      <div className="text-center py-6">
                        <Sparkles className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground mb-3">
                          No summaries yet
                        </p>
                        <p className="text-xs text-muted-foreground mb-4">
                          Create a summary to extract key insights from this transcript
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {summaries.map((summary) => (
                          <div key={summary.id} className="border rounded-lg p-3 space-y-2">
                            <div className="flex items-start justify-between">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <Badge variant="secondary" className="text-xs">
                                    {summary.template?.name || 'Custom'}
                                  </Badge>
                                  <span className="text-xs text-muted-foreground">
                                    {formatDate(summary.createdAt)}
                                  </span>
                                </div>
                                <p className="text-sm text-muted-foreground line-clamp-3">
                                  {summary.content}
                                </p>
                              </div>
                              <div className="flex items-center gap-1 ml-2">
                                <Dialog>
                                  <DialogTrigger asChild>
                                    <Button size="sm" variant="ghost">
                                      <FileText className="h-3 w-3" />
                                    </Button>
                                  </DialogTrigger>
                                  <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                                    <DialogHeader>
                                      <DialogTitle>{summary.template?.name || 'Summary'}</DialogTitle>
                                      <DialogDescription>
                                        {summary.template?.description || 'Generated summary'}
                                      </DialogDescription>
                                    </DialogHeader>
                                    <div className="mt-4 whitespace-pre-wrap text-sm">
                                      {summary.content}
                                    </div>
                                  </DialogContent>
                                </Dialog>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleDeleteSummary(summary.id)}
                                  disabled={deletingSummaryId === summary.id}
                                >
                                  {deletingSummaryId === summary.id ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-3 w-3" />
                                  )}
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Create Summary Dialog */}
                    <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                      <DialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full mt-3"
                          disabled={isCreatingSummary}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Create Summary
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Create Summary</DialogTitle>
                          <DialogDescription>
                            Select a template to generate a summary of this transcript
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 mt-4">
                          <div className="space-y-2">
                            <Label htmlFor="template">Template</Label>
                            <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                              <SelectTrigger id="template">
                                <SelectValue placeholder="Select a template" />
                              </SelectTrigger>
                              <SelectContent>
                                {templates.map((template) => (
                                  <SelectItem key={template.id} value={template.id}>
                                    {template.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          {selectedTemplate && (
                            <div className="space-y-2">
                              <Label>Template Description</Label>
                              <p className="text-sm text-muted-foreground">
                                {templates.find(t => t.id === selectedTemplate)?.description}
                              </p>
                            </div>
                          )}
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              onClick={() => setShowCreateDialog(false)}
                              disabled={isCreatingSummary}
                            >
                              Cancel
                            </Button>
                            <Button
                              onClick={handleCreateSummary}
                              disabled={!selectedTemplate || isCreatingSummary}
                            >
                              {isCreatingSummary ? (
                                <>
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                  Generating...
                                </>
                              ) : (
                                'Generate Summary'
                              )}
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </CardContent>
                </Card>

              </div>

              {/* Transcript */}
              <div className="lg:col-span-2">
                <Card className="h-full buzz-shadow-sm">
                  <CardHeader className="buzz-content-spacing border-b">
                    <CardTitle className="text-foreground flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      Transcript Content
                    </CardTitle>
                    <CardDescription className="text-muted-foreground">
                      {hasSpeakers ? `${uniqueSpeakers.length} speakers detected` : 'No speaker information available'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    <ScrollArea className="h-[calc(100vh-300px)]">
                      <div className="space-y-4 p-6">
                        {transcript.segments.map((segment, index) => (
                          <div key={index} className="group hover:bg-secondary/30 p-3 rounded-lg transition-colors duration-200">
                            <div className="flex items-start gap-4">
                              <div className="flex-shrink-0 w-16 text-right">
                                <span className="text-xs text-muted-foreground font-mono bg-muted px-2 py-1 rounded">
                                  {formatTime(segment.start)}
                                </span>
                              </div>
                              <div className="flex-1 min-w-0">
                                {segment.speaker && (
                                  <div className={`text-sm font-semibold mb-2 flex items-center gap-2 ${getSpeakerColor(segment.speaker)}`}>
                                    <div className={`w-2 h-2 rounded-full ${getSpeakerColor(segment.speaker)?.replace('text-', 'bg-') || 'bg-blue-600'}`}></div>
                                    {segment.displayName || segment.speaker}
                                  </div>
                                )}
                                <p className="text-sm leading-relaxed text-foreground">{segment.text}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
