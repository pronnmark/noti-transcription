'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { IOSCard, IOSCardContent, IOSCardHeader, IOSCardTitle, IOSCardDescription } from '@/components/ui/ios-card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, ArrowLeft, Edit2, Save, X, Users, Clock, FileText, Trash2, Download, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useMediaQuery } from '@/hooks/use-media-query';
import { cn } from '@/lib/utils';

interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
  speaker?: string;
}

interface TranscriptData {
  segments: TranscriptSegment[];
  hasSpeakers?: boolean;
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
  

  useEffect(() => {
    loadTranscript();
    loadFileInfo();
  }, [id]);

  async function loadTranscript() {
    try {
      const response = await fetch(`/api/transcript/${id}`);
      if (response.ok) {
        const data = await response.json();
        setTranscript(data);
        
        // Extract unique speakers
        const speakers = new Set<string>();
        data.segments.forEach((segment: TranscriptSegment) => {
          if (segment.speaker) {
            speakers.add(segment.speaker);
          }
        });
        
        // Initialize speaker labels
        const labels: Record<string, string> = {};
        speakers.forEach(speaker => {
          labels[speaker] = speaker;
        });
        setSpeakerLabels(labels);
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
      minute: '2-digit'
    });
  }

  function handleSpeakerEdit(speaker: string) {
    setEditingSpeaker(speaker);
    setEditValue(speakerLabels[speaker] || speaker);
  }

  function handleSpeakerSave() {
    if (editingSpeaker && editValue.trim()) {
      setSpeakerLabels(prev => ({
        ...prev,
        [editingSpeaker]: editValue.trim()
      }));
      toast.success('Speaker label updated');
    }
    setEditingSpeaker(null);
    setEditValue('');
  }

  function handleSpeakerCancel() {
    setEditingSpeaker(null);
    setEditValue('');
  }

  function getSpeakerColor(speaker: string): string {
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
    
    const speakerIndex = Object.keys(speakerLabels).indexOf(speaker);
    return colors[speakerIndex % colors.length];
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
      `Speakers: ${uniqueSpeakers.map(s => speakerLabels[s] || s).join(', ')}` : 
      'No speaker information';

    if (format === 'json') {
      return JSON.stringify({
        file: {
          name: fileInfo.originalFileName,
          duration: fileInfo.duration,
          language: fileInfo.language,
          transcribedAt: fileInfo.transcribedAt
        },
        speakers: hasSpeakers ? Object.fromEntries(
          uniqueSpeakers.map(s => [s, speakerLabels[s] || s])
        ) : null,
        transcript: transcript.segments.map(segment => ({
          start: segment.start,
          end: segment.end,
          speaker: segment.speaker ? speakerLabels[segment.speaker] || segment.speaker : null,
          text: segment.text
        }))
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
          const speakerName = speakerLabels[segment.speaker] || segment.speaker;
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
        const speakerName = speakerLabels[segment.speaker] || segment.speaker;
        content += `[${timestamp}] ${speakerName}: ${segment.text}\n\n`;
      } else {
        content += `[${timestamp}] ${segment.text}\n\n`;
      }
    });

    return content;
  }

  function handleExport(format: 'markdown' | 'json' | 'txt') {
    const content = formatTranscriptForExport(format);
    const baseFilename = fileInfo?.originalFileName?.replace(/\.[^/.]+$/, "") || "transcript";
    
    const mimeTypes = {
      markdown: 'text/markdown',
      json: 'application/json',
      txt: 'text/plain'
    };

    const extensions = {
      markdown: 'md',
      json: 'json', 
      txt: 'txt'
    };

    const filename = `${baseFilename}.${extensions[format]}`;
    downloadFile(content, filename, mimeTypes[format]);
    toast.success(`Exported as ${format.toUpperCase()}`);
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
  const uniqueSpeakers = Array.from(new Set(transcript.segments.map(s => s.speaker).filter(Boolean)));

  return (
    <div className={cn(
      "flex flex-col",
      // Mobile: Natural document flow with minimum screen height
      // Desktop: Fixed viewport height with internal scrolling
      isMobile ? "min-h-screen" : "h-full"
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
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline">
                    <Download className="mr-2 h-4 w-4" />
                    Export
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleExport('markdown')}>
                    <FileText className="mr-2 h-4 w-4" />
                    Markdown (.md)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport('json')}>
                    <FileText className="mr-2 h-4 w-4" />
                    JSON (.json)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport('txt')}>
                    <FileText className="mr-2 h-4 w-4" />
                    Text (.txt)
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
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
        "flex-1",
        // Mobile: No overflow constraints, natural document flow
        // Desktop: Overflow hidden for internal scrolling
        isMobile ? "" : "overflow-hidden"
      )}>
        <div className={cn(
          "pwa-scrollable",
          // Mobile: Natural document flow with safe area padding
          // Desktop: Fixed height with internal scrolling
          isMobile 
            ? "px-4 py-6 space-y-6 pb-safe" 
            : "h-full overflow-y-auto p-6"
        )}>
          {isMobile ? (
            // Mobile Layout - Transcript first, then tools
            <div className="space-y-6">
              {/* Transcript Section */}
              <IOSCard variant="default">
                <IOSCardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <IOSCardTitle>Transcript</IOSCardTitle>
                      <IOSCardDescription>
                        {fileInfo?.originalFileName}
                      </IOSCardDescription>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="touch-target-44">
                          <Download className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleExport('markdown')}>
                          <FileText className="mr-2 h-4 w-4" />
                          Markdown
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleExport('json')}>
                          <FileText className="mr-2 h-4 w-4" />
                          JSON
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleExport('txt')}>
                          <FileText className="mr-2 h-4 w-4" />
                          Text
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </IOSCardHeader>
                <IOSCardContent>
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
                                <div className={`w-2 h-2 rounded-full ${getSpeakerColor(segment.speaker).replace('text-', 'bg-')}`}></div>
                                {speakerLabels[segment.speaker] || segment.speaker}
                              </div>
                            )}
                            <p className="text-sm leading-relaxed text-foreground">{segment.text}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </IOSCardContent>
              </IOSCard>

              {/* Recording Details - Enhanced mobile version */}
              <IOSCard>
                <IOSCardHeader>
                  <IOSCardTitle className="flex items-center gap-2 text-sm">
                    <FileText className="h-4 w-4" />
                    Recording Details
                  </IOSCardTitle>
                </IOSCardHeader>
                <IOSCardContent className="py-3">
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500 block text-xs">Duration</span>
                        <span className="font-semibold text-gray-900">{formatDuration(fileInfo?.duration)}</span>
                      </div>
                      <div>
                        <span className="text-gray-500 block text-xs">File Size</span>
                        <span className="font-semibold text-gray-900">{formatFileSize(fileInfo?.size)}</span>
                      </div>
                      <div>
                        <span className="text-gray-500 block text-xs">Segments</span>
                        <span className="font-semibold text-gray-900">{transcript.segments.length}</span>
                      </div>
                      {hasSpeakers && (
                        <div>
                          <span className="text-gray-500 block text-xs">Speakers</span>
                          <span className="font-semibold text-gray-900">{uniqueSpeakers.length}</span>
                        </div>
                      )}
                    </div>
                    
                    <div className="pt-2 border-t border-gray-100">
                      <div className="grid grid-cols-1 gap-2 text-xs">
                        <div>
                          <span className="text-gray-500">Uploaded:</span>
                          <span className="ml-2 text-gray-700">{formatDate(fileInfo?.uploadedAt)}</span>
                        </div>
                        {fileInfo?.transcribedAt && (
                          <div>
                            <span className="text-gray-500">Transcribed:</span>
                            <span className="ml-2 text-gray-700">{formatDate(fileInfo.transcribedAt)}</span>
                          </div>
                        )}
                        <div>
                          <span className="text-gray-500">Model:</span>
                          <span className="ml-2 text-gray-700">{fileInfo?.modelSize || 'large-v3'}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </IOSCardContent>
              </IOSCard>

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
                    <div key={speaker} className="flex items-center gap-2">
                      {editingSpeaker === speaker ? (
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
                          <span className={`text-sm font-medium ${getSpeakerColor(speaker!)}`}>
                            {speakerLabels[speaker!] || speaker}
                          </span>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleSpeakerEdit(speaker!)}
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
                                    <div className={`w-2 h-2 rounded-full ${getSpeakerColor(segment.speaker).replace('text-', 'bg-')}`}></div>
                                    {speakerLabels[segment.speaker] || segment.speaker}
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