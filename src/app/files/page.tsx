'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { FileAudio, Plus, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useMediaQuery } from '@/hooks/use-media-query';
import { MultiFileUpload } from '@/components/ui/multi-file-upload';

interface AudioFile {
  id: string;
  filename: string;
  originalName: string;
  size: number;
  mimeType: string;
  createdAt: string;
  updatedAt: string;
  recordedAt?: string;
  transcriptionStatus?: 'pending' | 'processing' | 'completed' | 'error';
  hasTranscript?: boolean;
  hasAiExtract?: boolean;
  extractCount?: number;
  duration?: number;
  labels?: string[];
  speakerCount?: number;
  diarizationStatus?: 'not_attempted' | 'in_progress' | 'success' | 'failed' | 'no_speakers_detected';
  hasSpeakers?: boolean;
}

interface SummaryStatusProps {
  hasAiExtract: boolean;
  extractCount: number;
}

function SummaryStatus({ hasAiExtract, extractCount }: SummaryStatusProps) {
  if (!hasAiExtract || extractCount === 0) {
    // Hollow circle for no summaries
    return (
      <div className="flex items-center gap-1">
        <div
          className="w-2 h-2 rounded-full border border-gray-400 bg-transparent"
          title="No summaries generated"
        />
      </div>
    );
  }

  // Filled circles for summaries - one per summary
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: Math.min(extractCount, 5) }, (_, i) => (
        <div
          key={i}
          className="w-2 h-2 rounded-full bg-gray-800"
          title={`${extractCount} ${extractCount === 1 ? 'summary' : 'summaries'} generated`}
        />
      ))}
      {extractCount > 5 && (
        <span className="text-xs text-gray-600 ml-1">+{extractCount - 5}</span>
      )}
    </div>
  );
}

export default function FilesPage() {
  const [files, setFiles] = useState<AudioFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const _isMobile = useMediaQuery('(max-width: 767px)');

  useEffect(() => {
    loadFiles();
    const interval = setInterval(loadFiles, 30000);
    return () => clearInterval(interval);
  }, []);

  async function loadFiles() {
    try {
      const response = await fetch('/api/files');
      if (response.ok) {
        const data = await response.json();
        setFiles(data.files || []);
      } else {
        toast.error('Failed to load files');
        setFiles([]);
      }
    } catch (_error) {
      console.error('Failed to load files:', _error);
      toast.error('Failed to load files');
      setFiles([]);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleFileUpload(file: File) {
    setUploading(true);
    toast.info(`Uploading ${file.name}...`);

    const formData = new FormData();
    formData.append('audio', file);
    formData.append('speakerCount', '2'); // Default speaker count

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (response.status === 409) {
        const duplicateData = await response.json();
        const shouldUpload = confirm(
          `File "${duplicateData.existingFile.originalFileName}" already exists.\n\nUpload anyway?`,
        );

        if (shouldUpload) {
          formData.append('allowDuplicates', 'true');
          return handleFileUpload(file);
        } else {
          toast.info('Upload cancelled');
          return;
        }
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Upload failed');
      }

      toast.success(`${file.name} uploaded successfully`);
      await loadFiles();
    } catch (error) {
      toast.error(`Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setUploading(false);
    }
  }

  async function handleDeleteFile(fileId: string, fileName: string) {
    if (!confirm(`Delete "${fileName}"? This cannot be undone.`)) return;

    setDeletingId(fileId);
    try {
      const response = await fetch(`/api/files/${fileId}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Delete failed');

      toast.success('File deleted');
      await loadFiles();
    } catch (error) {
      toast.error('Failed to delete file');
    } finally {
      setDeletingId(null);
    }
  }

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const fileDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    if (fileDate.getTime() === today.getTime()) {
      return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
    }

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      ...(date.getFullYear() !== now.getFullYear() && { year: 'numeric' }),
    });
  };

  const getDateGroup = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const fileDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    if (fileDate.getTime() === today.getTime()) {
      return 'Today';
    } else if (fileDate.getTime() === yesterday.getTime()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
        ...(date.getFullYear() !== now.getFullYear() && { year: 'numeric' }),
      });
    }
  };

  // Group files by date
  const groupedFiles = files.reduce((groups: Record<string, AudioFile[]>, file) => {
    const dateGroup = getDateGroup(file.recordedAt || file.createdAt);
    if (!groups[dateGroup]) {
      groups[dateGroup] = [];
    }
    groups[dateGroup].push(file);
    return groups;
  }, {});

  // Sort date groups (Today first, then Yesterday, then chronological)
  const sortedDateGroups = Object.keys(groupedFiles).sort((a, b) => {
    if (a === 'Today') return -1;
    if (b === 'Today') return 1;
    if (a === 'Yesterday') return -1;
    if (b === 'Yesterday') return 1;
    return new Date(b).getTime() - new Date(a).getTime();
  });

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="standard-page-bg">
      <div className="safe-area-inset">
        {/* Header */}
        <div className="standard-section-bg">
          <div className="px-4 pt-6 pb-4">
            <h1 className="text-2xl font-semibold text-gray-900">Files</h1>
          </div>
        </div>

        {/* Content */}
        <div className="px-4 py-6">
          {/* Multi-file Upload Component */}
          <div className="mb-6">
            <MultiFileUpload
              onUploadComplete={(results) => {
                // Reload files after successful uploads
                const successCount = results.filter(r => r.success).length;
                if (successCount > 0) {
                  loadFiles();
                }
              }}
            />
          </div>

          {files.length === 0 ? (
            /* Empty State */
            <div className="text-center py-20">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <FileAudio className="h-8 w-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No files yet</h3>
              <p className="text-gray-500 mb-6">Upload your first audio file to get started</p>
            </div>
          ) : (
            /* Files List - Grouped by Date */
            <div className="space-y-6">
              {sortedDateGroups.map((dateGroup) => (
                <div key={dateGroup}>
                  {/* Date Header */}
                  <div className="flex items-center mb-3">
                    <h2 className="text-sm font-medium text-gray-600">{dateGroup}</h2>
                    <div className="flex-1 ml-3 border-t border-gray-200" />
                  </div>

                  {/* Files for this date */}
                  <div className="space-y-2">
                    {groupedFiles[dateGroup]
                      .sort((a, b) => new Date(b.recordedAt || b.createdAt).getTime() - new Date(a.recordedAt || a.createdAt).getTime())
                      .map((file) => (
                        <div
                          key={file.id}
                          className={cn(
                            'standard-card p-3',
                            file.transcriptionStatus === 'completed'
                              ? 'standard-card-hover cursor-pointer'
                              : '',
                          )}
                          onClick={() => {
                            if (file.transcriptionStatus === 'completed') {
                              window.location.href = `/transcript/${file.id}`;
                            }
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-medium text-gray-900 truncate">
                                  {file.originalName}
                                </p>
                                <SummaryStatus
                                  hasAiExtract={file.hasAiExtract || false}
                                  extractCount={file.extractCount || 0}
                                />
                              </div>
                              <div className="flex items-center gap-3 mt-1">
                                <span className="text-xs text-gray-500">
                                  {formatDate(file.recordedAt || file.createdAt)}
                                </span>
                                {file.duration && (
                                  <span className="text-xs text-gray-500">
                                    {formatDuration(file.duration)}
                                  </span>
                                )}
                                {file.transcriptionStatus === 'processing' && (
                                  <span className="text-xs text-blue-600">Processing...</span>
                                )}
                              </div>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="w-8 h-8 p-0 text-gray-400 hover:text-red-600"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteFile(file.id, file.originalName);
                              }}
                              disabled={deletingId === file.id}
                            >
                              {deletingId === file.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Trash2 className="h-3 w-3" />
                              )}
                            </Button>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Bottom Padding for Floating Button */}
          <div className="h-20" />
        </div>
      </div>

      {/* Floating Upload Button */}
      <div className="fixed bottom-20 md:bottom-6 right-4 z-50">
        <label className="relative block">
          <Button
            size="icon"
            className={cn(
              'w-14 h-14 rounded-full shadow-lg hover:shadow-xl',
              'bg-blue-600 hover:bg-blue-700 text-white',
              'transition-all duration-200 active:scale-95',
              'flex items-center justify-center',
              uploading && 'pointer-events-none opacity-75',
            )}
            disabled={uploading}
            asChild
          >
            <span>
              {uploading ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <Plus className="h-6 w-6" />
              )}
            </span>
          </Button>
          <input
            type="file"
            accept="audio/*,.m4a,.mp3,.wav,.aac,.ogg,.flac"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                handleFileUpload(file);
                e.target.value = '';
              }
            }}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            disabled={uploading}
          />
        </label>
      </div>
    </div>
  );
}
