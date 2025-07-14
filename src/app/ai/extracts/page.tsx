'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sparkles, Loader2, Trash2, FileText } from 'lucide-react';
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

export default function AIExtractsPage() {
  const [extracts, setExtracts] = useState<Extract[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingExtracts, setDeletingExtracts] = useState<Set<string>>(new Set());

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
        
        // Load extracts for each file
        const allExtracts: Extract[] = [];
        
        for (const file of filesWithExtracts) {
          try {
            const extractResponse = await fetch(`/api/extract?fileId=${file.id}`);
            if (extractResponse.ok) {
              const extractData = await extractResponse.json();
              // Add filename to each extract
              const extractsWithFilename = extractData.extracts.map((extract: Extract) => ({
                ...extract,
                filename: file.originalName
              }));
              allExtracts.push(...extractsWithFilename);
            }
          } catch (error) {
            console.error(`Failed to load extracts for file ${file.id}:`, error);
          }
        }
        
        // Sort by creation date (newest first)
        allExtracts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        
        setExtracts(allExtracts);
      }
    } catch (error) {
      console.error('Failed to load extracts:', error);
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
      console.error('Delete error:', error);
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
        <ScrollArea className="h-full">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {extracts.map((extract) => (
              <Card key={extract.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-lg truncate">{extract.filename || 'Unknown File'}</CardTitle>
                      <CardDescription>
                        <Sparkles className="h-3 w-3 inline mr-1" />
                        {extract.model}
                      </CardDescription>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0 text-muted-foreground hover:text-red-600 flex-shrink-0"
                      onClick={() => handleDeleteExtract(extract.id, extract.filename || 'Unknown File')}
                      disabled={deletingExtracts.has(extract.id)}
                    >
                      {deletingExtracts.has(extract.id) ? (
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
                      <span>{formatDate(extract.createdAt)}</span>
                    </div>
                  </div>
                  <div className="text-sm bg-muted/50 rounded-lg p-3 max-h-32 overflow-y-auto">
                    <p className="line-clamp-4">{extract.content}</p>
                  </div>
                  <div className="text-xs text-muted-foreground bg-muted/30 rounded p-2">
                    <strong>Prompt:</strong> {extract.prompt}
                  </div>
                  <div className="space-y-2">
                    <Button 
                      className="w-full" 
                      variant="default"
                      onClick={() => window.location.href = `/extract/${extract.id}`}
                    >
                      <Sparkles className="h-4 w-4 mr-2" />
                      View Full Extract
                    </Button>
                    <Button 
                      className="w-full" 
                      variant="outline"
                      onClick={() => window.location.href = `/transcript/${extract.fileId}`}
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      View Transcript
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          {extracts.length === 0 && (
            <div className="text-center py-12">
              <Sparkles className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No AI extracts yet</p>
              <p className="text-sm text-muted-foreground mt-2">
                AI extracts will appear here after you process your transcripts
              </p>
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  );
}