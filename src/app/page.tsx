'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Upload, FileText, ListTodo } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ClientOnly } from '@/components/client-only';
import { useMediaQuery } from '@/hooks/use-media-query';

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

export default function HomePage() {
  const [files, setFiles] = useState<AudioFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [recentFiles, setRecentFiles] = useState<AudioFile[]>([]);
  const isMobile = useMediaQuery('(max-width: 767px)');

  useEffect(() => {
    loadFiles();
    // Poll for updates every 10 seconds
    const interval = setInterval(loadFiles, 10000);
    return () => clearInterval(interval);
  }, []);

  async function loadFiles() {
    try {
      const response = await fetch('/api/files');
      if (response.ok) {
        const data = await response.json();
        setFiles(data.files);
        // Get 5 most recent files - sort by string comparison to avoid Date issues
        const sorted = [...data.files].sort((a, b) => 
          b.updatedAt.localeCompare(a.updatedAt)
        );
        setRecentFiles(sorted.slice(0, 5));
      }
    } catch (error) {
      console.error('Failed to load files:', error);
    } finally {
      setIsLoading(false);
    }
  }

  // Calculate statistics
  const totalFiles = files.length;
  const transcribedFiles = files.filter(f => f.transcriptionStatus === 'completed').length;
  const processingFiles = files.filter(f => f.transcriptionStatus === 'processing').length;

  function formatDuration(seconds: number): string {
    if (seconds < 60) return `${Math.floor(seconds)}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  }

  function formatDate(dateString: string) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    
    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffHours < 48) return 'Yesterday';
    
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header - Hidden on mobile */}
      {!isMobile && (
        <div className="border-b p-4 sm:p-6">
          <h1 className="text-2xl sm:text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Welcome to Noti - Your AI-powered transcription hub</p>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 p-4 sm:p-6 overflow-auto">
        <div className="space-y-4 sm:space-y-6 max-w-7xl mx-auto">
          {/* Quick Actions - Compact */}
          <div className={cn(
            "grid gap-3",
            isMobile ? "grid-cols-2" : "grid-cols-4"
          )}>
            <Button 
              className="h-16 flex flex-col items-center justify-center gap-1 text-center"
              variant="outline"
              onClick={() => window.location.href = '/files'}
            >
              <Upload className="h-4 w-4" />
              <div className="text-xs font-medium">Upload Files</div>
            </Button>
            
            <Button 
              className="h-16 flex flex-col items-center justify-center gap-1 text-center"
              variant="outline"
              onClick={() => window.location.href = '/record'}
            >
              <div className="h-4 w-4 rounded-full bg-red-500 flex items-center justify-center">
                <div className="h-2 w-2 rounded-full bg-white" />
              </div>
              <div className="text-xs font-medium">Record</div>
            </Button>
            
            <Button 
              className="h-16 flex flex-col items-center justify-center gap-1 text-center"
              variant="outline"
              onClick={() => window.location.href = '/transcripts'}
            >
              <FileText className="h-4 w-4" />
              <div className="text-xs font-medium">Transcripts</div>
              <div className="text-xs text-muted-foreground">{transcribedFiles}</div>
            </Button>
            
            <Button 
              className="h-16 flex flex-col items-center justify-center gap-1 text-center"
              variant="outline"
              onClick={() => window.location.href = '/ai/notes'}
            >
              <ListTodo className="h-4 w-4" />
              <div className="text-xs font-medium">AI Notes</div>
            </Button>
          </div>

          {/* Statistics - Simplified */}
          <div className={cn(
            "grid gap-3",
            isMobile ? "grid-cols-2" : "grid-cols-3"
          )}>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="text-xs">Total Files</CardDescription>
                <CardTitle className="text-2xl">{totalFiles}</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                {processingFiles > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {processingFiles} processing
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="text-xs">Transcribed</CardDescription>
                <CardTitle className="text-2xl">{transcribedFiles}</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <Progress value={(transcribedFiles / Math.max(totalFiles, 1)) * 100} className="h-1" />
                <p className="text-xs text-muted-foreground mt-1">
                  {Math.round((transcribedFiles / Math.max(totalFiles, 1)) * 100)}%
                </p>
              </CardContent>
            </Card>

            {processingFiles > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="text-xs">Processing</CardDescription>
                  <CardTitle className="text-2xl">{processingFiles}</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="text-xs text-muted-foreground">
                    In queue
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Recent Activity - Compact */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Recent Files</CardTitle>
              <CardDescription className="text-sm">Your latest transcriptions</CardDescription>
            </CardHeader>
            <CardContent>
              {recentFiles.length === 0 ? (
                <div className="text-center py-6">
                  <p className="text-muted-foreground text-sm">No files yet</p>
                  <Button 
                    className="mt-3" 
                    variant="outline"
                    size="sm"
                    onClick={() => window.location.href = '/files'}
                  >
                    Upload your first file
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {recentFiles.map((file) => (
                    <div 
                      key={file.id} 
                      className={cn(
                        "flex items-center justify-between p-3 rounded-lg border hover:bg-accent/50 transition-colors cursor-pointer",
                        isMobile && "min-h-[48px]"
                      )}
                      onClick={() => {
                        if (file.transcriptionStatus === 'completed') {
                          window.location.href = `/transcript/${file.id}`;
                        }
                      }}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="font-medium truncate text-sm">{file.originalName}</p>
                          <ClientOnly fallback={<p className="text-xs text-muted-foreground">Loading...</p>}>
                            <p className="text-xs text-muted-foreground">
                              {formatDate(file.updatedAt)} • {file.duration ? formatDuration(file.duration) : 'Processing...'}
                            </p>
                          </ClientOnly>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {file.transcriptionStatus === 'completed' && (
                          <Badge variant="secondary" className="text-xs px-2 py-0">Done</Badge>
                        )}
                        {file.transcriptionStatus === 'processing' && (
                          <Badge variant="secondary" className="text-xs px-2 py-0">Processing</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  );
}