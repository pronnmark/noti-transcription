'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, ArrowLeft, Edit2, Save, X, Users, Clock, FileText, Trash2, ListTodo } from 'lucide-react';
import { toast } from 'sonner';

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
}

export default function TranscriptPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

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
      router.push('/'); // Redirect to dashboard
    } catch (error) {
      toast.error(`Failed to delete ${fileInfo.originalFileName}`);
      console.error('Delete error:', error);
    } finally {
      setIsDeleting(false);
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
  const uniqueSpeakers = Array.from(new Set(transcript.segments.map(s => s.speaker).filter(Boolean)));

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Button variant="ghost" size="sm" onClick={() => router.push('/')}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <h1 className="text-2xl font-bold">Transcript</h1>
            </div>
            {fileInfo && (
              <p className="text-muted-foreground">{fileInfo.originalFileName}</p>
            )}
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline"
              onClick={() => {
                // Navigate to notes page with this file selected
                window.location.href = `/ai/notes?file=${id}`;
              }}
            >
              <ListTodo className="mr-2 h-4 w-4" />
              Extract Notes
            </Button>
            <Button variant="outline">
              <FileText className="mr-2 h-4 w-4" />
              Export
            </Button>
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

      {/* Content */}
      <div className="flex-1 p-6 overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-full">
          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-4">
            {/* File Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">File Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Duration:</span>
                  <span className="ml-2">{formatDuration(fileInfo?.duration)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Language:</span>
                  <span className="ml-2">{fileInfo?.language || 'Swedish'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Model:</span>
                  <span className="ml-2">{fileInfo?.modelSize || 'large-v3'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Segments:</span>
                  <span className="ml-2">{transcript.segments.length}</span>
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
          <div className="lg:col-span-3">
            <Card className="h-full">
              <CardHeader>
                <CardTitle>Transcript</CardTitle>
                <CardDescription>
                  {hasSpeakers ? 'Speaker diarization enabled' : 'No speaker information available'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[calc(100vh-300px)]">
                  <div className="space-y-4 pr-4">
                    {transcript.segments.map((segment, index) => (
                      <div key={index} className="group">
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0 w-16 text-right">
                            <span className="text-xs text-muted-foreground">
                              {formatTime(segment.start)}
                            </span>
                          </div>
                          <div className="flex-1">
                            {segment.speaker && (
                              <div className={`text-sm font-medium mb-1 ${getSpeakerColor(segment.speaker)}`}>
                                {speakerLabels[segment.speaker] || segment.speaker}
                              </div>
                            )}
                            <p className="text-sm leading-relaxed">{segment.text}</p>
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
      </div>
    </div>
  );
}