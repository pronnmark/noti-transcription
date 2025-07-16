'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { FileText, Loader2, Sparkles, Trash2, ListTodo, MoreHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import { ClientOnly } from '@/components/client-only';
import { useMediaQuery } from '@/hooks/use-media-query';
import { cn } from '@/lib/utils';

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
  const isMobile = useMediaQuery('(max-width: 767px)');

  useEffect(() => {
    loadFiles();
    // Poll for updates every 30 seconds to reduce server load  
    const interval = setInterval(loadFiles, 30000);
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
      {/* Header - Hidden on mobile as it's handled by responsive layout */}
      {!isMobile && (
        <div className="border-b p-4 sm:p-6">
          <h1 className="text-2xl sm:text-3xl font-bold">Transcripts</h1>
          <p className="text-muted-foreground mt-1">View and manage your completed transcriptions</p>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 p-4 sm:p-6 overflow-hidden">
        <Card>
          <CardHeader>
            <CardTitle>Transcripts</CardTitle>
            <CardDescription>
              View and manage your completed transcriptions
            </CardDescription>
          </CardHeader>
          <CardContent>
            {files.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No transcripts available yet</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Upload audio files and wait for transcription to complete
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>File</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Features</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {files.map((file) => (
                    <TableRow key={file.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <FileText className="h-4 w-4 text-primary flex-shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-sm truncate">{file.originalName}</p>
                            <p className="text-xs text-muted-foreground">Transcribed</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{formatDuration(file.duration)}</span>
                      </TableCell>
                      <TableCell>
                        <ClientOnly fallback={<span>Loading...</span>}>
                          <span className="text-sm">{formatDate(file.updatedAt)}</span>
                        </ClientOnly>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {file.hasAiExtract && (
                            <Badge variant="default" className="text-xs">
                              AI Extract
                            </Badge>
                          )}
                          {file.notesCount && (
                            <Badge variant="secondary" className="text-xs">
                              {(() => {
                                try {
                                  const counts = JSON.parse(file.notesCount);
                                  const total = Object.values(counts).reduce((a: number, b: any) => a + b, 0);
                                  return `${total} notes`;
                                } catch (e) {
                                  return '0 notes';
                                }
                              })()}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => window.location.href = `/transcript/${file.id}`}
                          >
                            <FileText className="h-4 w-4 mr-2" />
                            View
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem 
                                onClick={() => handleExtractAI(file.id, file.originalName)}
                                disabled={extractingFiles.has(file.id) || file.hasAiExtract}
                              >
                                {extractingFiles.has(file.id) ? (
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                ) : (
                                  <Sparkles className="h-4 w-4 mr-2" />
                                )}
                                {file.hasAiExtract ? 'AI Extracted' : 'Extract AI'}
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => handleExtractNotes(file.id, file.originalName)}
                                disabled={extractingNotes.has(file.id)}
                              >
                                {extractingNotes.has(file.id) ? (
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                ) : (
                                  <ListTodo className="h-4 w-4 mr-2" />
                                )}
                                Extract Notes
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => handleDeleteFile(file.id, file.originalName)}
                                disabled={deletingFiles.has(file.id)}
                                className="text-red-600"
                              >
                                {deletingFiles.has(file.id) ? (
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4 mr-2" />
                                )}
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}