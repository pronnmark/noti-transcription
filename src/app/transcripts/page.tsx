'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileText, Loader2, Sparkles, Trash2, ListTodo } from 'lucide-react';
import { toast } from 'sonner';

interface AudioFile {
  id: string;
  filename: string;
  originalName: string;
  size: number;
  mimeType: string;
  createdAt: string;
  updatedAt: string;
  transcriptionStatus?: 'pending' | 'processing' | 'completed' | 'error';
  hasTranscript?: boolean;
  hasAiExtract?: boolean;
  duration?: number;
  notesStatus?: 'pending' | 'processing' | 'completed' | 'failed';
  notesCount?: any;
}

export default function TranscriptsPage() {
  const [files, setFiles] = useState<AudioFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingFiles, setDeletingFiles] = useState<Set<string>>(new Set());
  const [extractingFiles, setExtractingFiles] = useState<Set<string>>(new Set());
  const [extractingNotes, setExtractingNotes] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadFiles();
    // Poll for updates every 5 seconds
    const interval = setInterval(loadFiles, 5000);
    return () => clearInterval(interval);
  }, []);

  async function loadFiles() {
    try {
      const response = await fetch('/api/files');
      if (response.ok) {
        const data = await response.json();
        setFiles(data.files.filter((f: AudioFile) => f.transcriptionStatus === 'completed'));
      }
    } catch (error) {
      console.error('Failed to load files:', error);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDeleteFile(fileId: string, fileName: string) {
    if (!confirm(`Are you sure you want to delete "${fileName}"? This will permanently remove the audio file and transcript.`)) {
      return;
    }

    setDeletingFiles(prev => new Set(prev).add(fileId));

    try {
      const response = await fetch(`/api/files/${fileId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Delete failed');
      }

      toast.success(`${fileName} deleted successfully`);
      await loadFiles();
    } catch (error) {
      toast.error(`Failed to delete ${fileName}`);
      console.error('Delete error:', error);
    } finally {
      setDeletingFiles(prev => {
        const newSet = new Set(prev);
        newSet.delete(fileId);
        return newSet;
      });
    }
  }

  async function handleExtractAI(fileId: string, fileName: string) {
    setExtractingFiles(prev => new Set(prev).add(fileId));

    try {
      const response = await fetch('/api/extract', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ fileId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.details || error.error || 'AI extraction failed');
      }

      const result = await response.json();
      toast.success(`AI extraction completed for ${fileName}`);
      await loadFiles();
    } catch (error) {
      toast.error(`Failed to extract AI summary: ${error instanceof Error ? error.message : 'Unknown error'}`);
      console.error('Extract error:', error);
    } finally {
      setExtractingFiles(prev => {
        const newSet = new Set(prev);
        newSet.delete(fileId);
        return newSet;
      });
    }
  }

  async function handleExtractNotes(fileId: string, fileName: string) {
    setExtractingNotes(prev => new Set(prev).add(fileId));

    try {
      const response = await fetch('/api/notes/extract', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ fileId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Notes extraction failed');
      }

      const result = await response.json();
      toast.success(`Extracted ${result.notesCount} notes from ${fileName}`);
      await loadFiles();
    } catch (error) {
      toast.error(`Failed to extract notes: ${error instanceof Error ? error.message : 'Unknown error'}`);
      console.error('Extract notes error:', error);
    } finally {
      setExtractingNotes(prev => {
        const newSet = new Set(prev);
        newSet.delete(fileId);
        return newSet;
      });
    }
  }

  function formatDuration(seconds?: number) {
    if (!seconds) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  function formatDate(dateString: string) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b p-4 sm:p-6">
        <h1 className="text-2xl sm:text-3xl font-bold">Transcripts</h1>
        <p className="text-muted-foreground mt-1">View and manage your completed transcriptions</p>
      </div>

      {/* Content */}
      <div className="flex-1 p-4 sm:p-6 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {files.map((file) => (
              <Card key={file.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-lg truncate">{file.originalName}</CardTitle>
                      <CardDescription>
                        Transcribed • {formatDuration(file.duration)}
                      </CardDescription>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0 text-muted-foreground hover:text-red-600 flex-shrink-0"
                      onClick={() => handleDeleteFile(file.id, file.originalName)}
                      disabled={deletingFiles.has(file.id)}
                    >
                      {deletingFiles.has(file.id) ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Trash2 className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="text-sm text-muted-foreground">
                    <div className="flex justify-between">
                      <span>Created</span>
                      <span>{formatDate(file.updatedAt)}</span>
                    </div>
                    {file.notesCount && (
                      <div className="flex justify-between mt-1">
                        <span>Notes</span>
                        <span>{(() => {
                          try {
                            const counts = JSON.parse(file.notesCount);
                            return Object.values(counts).reduce((a: number, b: any) => a + b, 0);
                          } catch (e) {
                            return 0;
                          }
                        })()}</span>
                      </div>
                    )}
                    {file.hasAiExtract && (
                      <div className="flex justify-between mt-1">
                        <span>AI Extract</span>
                        <span className="text-green-600">Available</span>
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Button 
                      className="w-full" 
                      variant="outline"
                      onClick={() => window.location.href = `/transcript/${file.id}`}
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      View Transcript
                    </Button>
                    <div className="grid grid-cols-2 gap-2">
                      <Button 
                        className="w-full" 
                        variant="outline"
                        size="sm"
                        onClick={() => handleExtractAI(file.id, file.originalName)}
                        disabled={extractingFiles.has(file.id) || file.hasAiExtract}
                      >
                        {extractingFiles.has(file.id) ? (
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        ) : (
                          <Sparkles className="h-3 w-3 mr-1" />
                        )}
                        {file.hasAiExtract ? 'Extracted' : 'Extract'}
                      </Button>
                      <Button 
                        className="w-full" 
                        variant="outline"
                        size="sm"
                        onClick={() => handleExtractNotes(file.id, file.originalName)}
                        disabled={extractingNotes.has(file.id)}
                      >
                        {extractingNotes.has(file.id) ? (
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        ) : (
                          <ListTodo className="h-3 w-3 mr-1" />
                        )}
                        Notes
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          {files.length === 0 && (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No transcripts available yet</p>
              <p className="text-sm text-muted-foreground mt-2">
                Upload audio files and wait for transcription to complete
              </p>
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  );
}