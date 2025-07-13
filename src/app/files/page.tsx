'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Upload, FileAudio, Loader2, Plus, Clock, CheckCircle, XCircle, Sparkles, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
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

export default function FilesPage() {
  const [files, setFiles] = useState<AudioFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState<Set<string>>(new Set());
  const [deletingFiles, setDeletingFiles] = useState<Set<string>>(new Set());
  const [extractingFiles, setExtractingFiles] = useState<Set<string>>(new Set());

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
        setFiles(data.files);
      }
    } catch (error) {
      console.error('Failed to load files:', error);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleFileUpload(file: File) {
    const tempId = Math.random().toString();
    setUploadingFiles(prev => new Set(prev).add(tempId));
    
    const formData = new FormData();
    formData.append('audio', file);

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const result = await response.json();
      toast.success(`${file.name} uploaded successfully!`);
      await loadFiles();
    } catch (error) {
      toast.error(`Failed to upload ${file.name}`);
      console.error('Upload error:', error);
    } finally {
      setUploadingFiles(prev => {
        const newSet = new Set(prev);
        newSet.delete(tempId);
        return newSet;
      });
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
  }

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files).filter(file =>
      file.type.startsWith('audio/')
    );

    for (const file of files) {
      await handleFileUpload(file);
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
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

  function getStatusIcon(status?: string) {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'processing':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  }

  function formatFileSize(bytes: number) {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  }

  function formatDuration(seconds?: number) {
    if (!seconds) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
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
        <h1 className="text-2xl sm:text-3xl font-bold">Files</h1>
        <p className="text-muted-foreground mt-1">Upload and manage your audio files</p>
      </div>

      {/* Content */}
      <div className="flex-1 p-4 sm:p-6 overflow-hidden">
        <div className="space-y-6">
          {/* Upload Area */}
          <Card
            className={cn(
              "border-2 border-dashed transition-colors",
              isDragging && "border-primary bg-primary/5"
            )}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <CardContent className="flex flex-col items-center justify-center py-8 sm:py-12">
              <Upload className="h-8 w-8 sm:h-12 sm:w-12 text-muted-foreground mb-4" />
              <p className="text-base sm:text-lg font-medium mb-2 text-center">Drop audio files here or click to upload</p>
              <p className="text-sm text-muted-foreground mb-4 text-center">Supports MP3, WAV, M4A, and more</p>
              <Button variant="outline" className="relative">
                <Plus className="mr-2 h-4 w-4" />
                Choose Files
                <input
                  type="file"
                  accept="audio/*"
                  onChange={handleFileSelect}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
              </Button>
            </CardContent>
          </Card>

          {/* Files Grid */}
          <ScrollArea className="h-[calc(100vh-320px)]">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {files.map((file) => (
                <Card key={file.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <FileAudio className="h-8 w-8 text-primary" />
                      <div className="flex items-center gap-2">
                        {getStatusIcon(file.transcriptionStatus)}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0 text-muted-foreground hover:text-red-600"
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
                    </div>
                    <CardTitle className="text-sm font-medium truncate mt-2">
                      {file.originalName}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Size</span>
                      <span>{formatFileSize(file.size)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Duration</span>
                      <span>{formatDuration(file.duration)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Status</span>
                      <span className="capitalize">{file.transcriptionStatus || 'pending'}</span>
                    </div>
                    {file.notesCount && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Notes</span>
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
                    <div className="flex gap-2 mt-4">
                      {file.transcriptionStatus === 'completed' && (
                        <>
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="flex-1"
                            onClick={() => window.location.href = `/transcript/${file.id}`}
                          >
                            View
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="flex-1"
                            onClick={() => handleExtractAI(file.id, file.originalName)}
                            disabled={extractingFiles.has(file.id)}
                          >
                            {extractingFiles.has(file.id) ? (
                              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                            ) : (
                              <Sparkles className="h-3 w-3 mr-1" />
                            )}
                            Extract
                          </Button>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            {files.length === 0 && (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No files uploaded yet</p>
              </div>
            )}
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}