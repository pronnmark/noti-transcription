'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
// import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Loader2, Trash2, FileText, ChevronDown, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { ClientOnly } from '@/components/client-only';

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
  extractCount?: number;
  duration?: number;
  aiExtract?: string;
  aiExtractedAt?: string;
}

interface Extract {
  id: string;
  fileId: string;
  filename?: string;
  content: string;
  model: string;
  prompt: string;
  createdAt: string;
  updatedAt: string;
}

interface FileWithExtracts {
  file: AudioFile;
  extracts: Extract[];
}

export default function AIExtractsPage() {
  const [fileGroups, setFileGroups] = useState<FileWithExtracts[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingExtracts, setDeletingExtracts] = useState<Set<string>>(new Set());
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());
  const [expandedExtracts, setExpandedExtracts] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadExtracts();
  }, []);

  async function loadExtracts() {
    try {
      // Load files first to get those with extracts
      const filesResponse = await fetch('/api/files');
      if (filesResponse.ok) {
        const filesData = await filesResponse.json();
        const filesWithExtracts = filesData.files.filter((f: AudioFile) => f.hasAiExtract);

        // Load extracts for each file and group by file
        const fileGroups: FileWithExtracts[] = [];

        for (const file of filesWithExtracts) {
          try {
            const extractResponse = await fetch(`/api/extract?fileId=${file.id}`);
            if (extractResponse.ok) {
              const extractData = await extractResponse.json();
              // Add filename to each extract
              const extractsWithFilename = extractData.extracts.map((extract: Extract) => ({
                ...extract,
                filename: file.originalName,
              }));

              // Sort extracts by creation date (newest first)
              extractsWithFilename.sort((a: Extract, b: Extract) => b.createdAt.localeCompare(a.createdAt));

              fileGroups.push({
                file,
                extracts: extractsWithFilename,
              });
            }
          } catch (error) {
            // Failed to load extracts for file - already handled by empty array
            // Add file with empty extracts array if extraction fails
            fileGroups.push({
              file,
              extracts: [],
            });
          }
        }

        // Sort file groups by most recent extract date
        fileGroups.sort((a, b) => {
          const aLatest = a.extracts.length > 0 ? a.extracts[0].createdAt : a.file.createdAt;
          const bLatest = b.extracts.length > 0 ? b.extracts[0].createdAt : b.file.createdAt;
          return bLatest.localeCompare(aLatest);
        });

        setFileGroups(fileGroups);
      }
    } catch (error) {
      toast.error('Failed to load extracts');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDeleteExtract(extractId: string, filename: string) {
    if (!confirm(`Are you sure you want to delete this extract for "${filename}"?`)) {
      return;
    }

    setDeletingExtracts(prev => new Set(prev).add(extractId));

    try {
      const response = await fetch(`/api/extract/${extractId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Delete failed');
      }

      toast.success(`Extract deleted successfully`);
      await loadExtracts();
    } catch (error) {
      toast.error(`Failed to delete extract`);
      // Delete error already shown via toast
    } finally {
      setDeletingExtracts(prev => {
        const newSet = new Set(prev);
        newSet.delete(extractId);
        return newSet;
      });
    }
  }

  function formatDate(dateString?: string) {
    if (!dateString) return 'Unknown';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function formatDuration(seconds?: number): string {
    if (!seconds || seconds <= 0) return '0:00';
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
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <Sparkles className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
            AI Extracts
          </h1>
          <p className="text-muted-foreground mt-1">AI-generated summaries and insights from your transcripts</p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-4 sm:p-6 overflow-hidden">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              AI Extracts
            </CardTitle>
            <CardDescription>
              AI-generated summaries and insights from your transcripts
            </CardDescription>
          </CardHeader>
          <CardContent>
            {fileGroups.length === 0 ? (
              <div className="text-center py-12">
                <Sparkles className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No AI extracts yet</p>
                <p className="text-sm text-muted-foreground mt-2">
                  AI extracts will appear here after you process your transcripts
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {fileGroups.map((fileGroup) => {
                  const isFileExpanded = expandedFiles.has(fileGroup.file.id);
                  const toggleFileExpanded = () => {
                    setExpandedFiles(prev => {
                      const newSet = new Set(prev);
                      if (newSet.has(fileGroup.file.id)) {
                        newSet.delete(fileGroup.file.id);
                      } else {
                        newSet.add(fileGroup.file.id);
                      }
                      return newSet;
                    });
                  };

                  return (
                    <Collapsible key={fileGroup.file.id} open={isFileExpanded} onOpenChange={toggleFileExpanded}>
                      <div className="border rounded-lg">
                        {/* File Header */}
                        <div className="flex items-center justify-between p-4 bg-muted/30">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <FileText className="h-5 w-5 text-primary flex-shrink-0" />
                            <div className="min-w-0 flex-1">
                              <h3 className="font-medium truncate">{fileGroup.file.originalName}</h3>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant="secondary" className="text-xs">
                                  {fileGroup.extracts.length} extract{fileGroup.extracts.length !== 1 ? 's' : ''}
                                </Badge>
                                {fileGroup.file.duration && (
                                  <span className="text-xs text-muted-foreground">
                                    {formatDuration(fileGroup.file.duration)}
                                  </span>
                                )}
                                <ClientOnly fallback={<span>Loading...</span>}>
                                  <span className="text-xs text-muted-foreground">
                                    {formatDate(fileGroup.file.createdAt)}
                                  </span>
                                </ClientOnly>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => window.location.href = `/transcript/${fileGroup.file.id}`}
                            >
                              View Transcript
                            </Button>
                            <CollapsibleTrigger asChild>
                              <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                                {isFileExpanded ? (
                                  <ChevronDown className="h-4 w-4" />
                                ) : (
                                  <ChevronRight className="h-4 w-4" />
                                )}
                              </Button>
                            </CollapsibleTrigger>
                          </div>
                        </div>

                        {/* File Extracts */}
                        <CollapsibleContent className="px-4 pb-4">
                          <div className="space-y-3 pt-3">
                            {fileGroup.extracts.length === 0 ? (
                              <div className="text-center py-6 text-muted-foreground">
                                <Sparkles className="h-8 w-8 mx-auto mb-2" />
                                <p className="text-sm">No extracts for this file yet</p>
                              </div>
                            ) : (
                              fileGroup.extracts.map((extract) => {
                                const isExtractExpanded = expandedExtracts.has(extract.id);
                                const toggleExtractExpanded = () => {
                                  setExpandedExtracts(prev => {
                                    const newSet = new Set(prev);
                                    if (newSet.has(extract.id)) {
                                      newSet.delete(extract.id);
                                    } else {
                                      newSet.add(extract.id);
                                    }
                                    return newSet;
                                  });
                                };

                                return (
                                  <Collapsible key={extract.id} open={isExtractExpanded} onOpenChange={toggleExtractExpanded}>
                                    <div className="border rounded-lg ml-4">
                                      <div className="flex items-center justify-between p-3">
                                        <div className="flex items-center gap-3 flex-1 min-w-0">
                                          <Sparkles className="h-4 w-4 text-primary flex-shrink-0" />
                                          <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2">
                                              <Badge variant="secondary" className="text-xs">
                                                {extract.model}
                                              </Badge>
                                              <ClientOnly fallback={<span>Loading...</span>}>
                                                <span className="text-xs text-muted-foreground">
                                                  {formatDate(extract.createdAt)}
                                                </span>
                                              </ClientOnly>
                                            </div>
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => window.location.href = `/extract/${extract.id}`}
                                          >
                                            View Full
                                          </Button>
                                          <CollapsibleTrigger asChild>
                                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                                              {isExtractExpanded ? (
                                                <ChevronDown className="h-4 w-4" />
                                              ) : (
                                                <ChevronRight className="h-4 w-4" />
                                              )}
                                            </Button>
                                          </CollapsibleTrigger>
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-8 w-8 p-0 text-muted-foreground hover:text-red-600"
                                            onClick={() => handleDeleteExtract(extract.id, extract.filename || 'Unknown File')}
                                            disabled={deletingExtracts.has(extract.id)}
                                          >
                                            {deletingExtracts.has(extract.id) ? (
                                              <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : (
                                              <Trash2 className="h-4 w-4" />
                                            )}
                                          </Button>
                                        </div>
                                      </div>

                                      <CollapsibleContent className="px-3 pb-3">
                                        <div className="space-y-3 border-t pt-3">
                                          <div className="text-sm bg-muted/50 rounded-lg p-3 max-h-40 overflow-y-auto">
                                            <p className="whitespace-pre-wrap">{extract.content}</p>
                                          </div>
                                          <div className="text-xs text-muted-foreground bg-muted/30 rounded p-2">
                                            <strong>Prompt:</strong> {extract.prompt}
                                          </div>
                                        </div>
                                      </CollapsibleContent>
                                    </div>
                                  </Collapsible>
                                );
                              })
                            )}
                          </div>
                        </CollapsibleContent>
                      </div>
                    </Collapsible>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
