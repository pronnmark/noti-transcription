'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { FileAudio, Loader2, FileText, Sparkles, ListTodo, Mic, Clock, Upload, TrendingUp, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';
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
  duration?: number;
  notesStatus?: 'pending' | 'processing' | 'completed' | 'failed';
  notesCount?: any;
}

export default function HomePage() {
  const [files, setFiles] = useState<AudioFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [recentFiles, setRecentFiles] = useState<AudioFile[]>([]);

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
  const filesWithExtracts = files.filter(f => f.hasAiExtract).length;
  const totalNotes = files.reduce((acc, file) => {
    if (file.notesCount) {
      try {
        const counts = JSON.parse(file.notesCount);
        return acc + Object.values(counts).reduce((a: number, b: any) => a + b, 0);
      } catch (e) {
        console.error('Error parsing notesCount:', e);
        return acc;
      }
    }
    return acc;
  }, 0);
  const totalDuration = files.reduce((acc, file) => acc + (file.duration || 0), 0);

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
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b p-4 sm:p-6">
        <h1 className="text-2xl sm:text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Welcome to Noti - Your AI-powered transcription hub</p>
      </div>

      {/* Content */}
      <div className="flex-1 p-4 sm:p-6 overflow-auto">
        <div className="space-y-4 sm:space-y-6 max-w-7xl mx-auto">
          {/* Quick Actions */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <Button 
              className="h-auto p-4 sm:p-6 flex flex-col items-center gap-2"
              variant="outline"
              onClick={() => window.location.href = '/files'}
            >
              <Upload className="h-6 sm:h-8 w-6 sm:w-8" />
              <span className="text-base sm:text-lg font-medium">Upload</span>
              <span className="text-xs sm:text-sm text-muted-foreground hidden sm:block">Add new files</span>
            </Button>
            
            <Button 
              className="h-auto p-4 sm:p-6 flex flex-col items-center gap-2"
              variant="outline"
              onClick={() => window.location.href = '/record'}
            >
              <Mic className="h-6 sm:h-8 w-6 sm:w-8" />
              <span className="text-base sm:text-lg font-medium">Record</span>
              <span className="text-xs sm:text-sm text-muted-foreground hidden sm:block">Start recording</span>
            </Button>
            
            <Button 
              className="h-auto p-4 sm:p-6 flex flex-col items-center gap-2"
              variant="outline"
              onClick={() => window.location.href = '/transcripts'}
            >
              <FileText className="h-6 sm:h-8 w-6 sm:w-8" />
              <span className="text-base sm:text-lg font-medium">Transcripts</span>
              <span className="text-xs sm:text-sm text-muted-foreground">{transcribedFiles} available</span>
            </Button>
            
            <Button 
              className="h-auto p-4 sm:p-6 flex flex-col items-center gap-2"
              variant="outline"
              onClick={() => window.location.href = '/ai/notes'}
            >
              <ListTodo className="h-6 sm:h-8 w-6 sm:w-8" />
              <span className="text-base sm:text-lg font-medium">AI Notes</span>
              <span className="text-xs sm:text-sm text-muted-foreground">{totalNotes} notes</span>
            </Button>
          </div>

          {/* Statistics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2">
                  <FileAudio className="h-4 w-4" />
                  Total Files
                </CardDescription>
                <CardTitle className="text-3xl">{totalFiles}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {processingFiles > 0 && `${processingFiles} processing`}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Transcribed
                </CardDescription>
                <CardTitle className="text-3xl">{transcribedFiles}</CardTitle>
              </CardHeader>
              <CardContent>
                <Progress value={(transcribedFiles / Math.max(totalFiles, 1)) * 100} className="h-2" />
                <p className="text-sm text-muted-foreground mt-1">
                  {Math.round((transcribedFiles / Math.max(totalFiles, 1)) * 100)}% complete
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  AI Extracts
                </CardDescription>
                <CardTitle className="text-3xl">{filesWithExtracts}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Insights generated
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Total Audio
                </CardDescription>
                <CardTitle className="text-3xl">{formatDuration(totalDuration)}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Processed
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Recent Files
              </CardTitle>
              <CardDescription>Your latest transcriptions</CardDescription>
            </CardHeader>
            <CardContent>
              {recentFiles.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">No files yet</p>
                  <Button 
                    className="mt-4" 
                    variant="outline"
                    onClick={() => window.location.href = '/files'}
                  >
                    Upload your first file
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentFiles.map((file) => (
                    <div 
                      key={file.id} 
                      className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent/50 transition-colors cursor-pointer"
                      onClick={() => {
                        if (file.transcriptionStatus === 'completed') {
                          window.location.href = `/transcript/${file.id}`;
                        }
                      }}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <FileAudio className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="font-medium truncate">{file.originalName}</p>
                          <ClientOnly fallback={<p className="text-sm text-muted-foreground">Loading...</p>}>
                            <p className="text-sm text-muted-foreground">
                              {formatDate(file.updatedAt)} • {file.duration ? formatDuration(file.duration) : 'Processing...'}
                            </p>
                          </ClientOnly>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {file.transcriptionStatus === 'completed' && (
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">Transcribed</span>
                        )}
                        {file.transcriptionStatus === 'processing' && (
                          <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                        )}
                        {file.hasAiExtract && (
                          <Sparkles className="h-4 w-4 text-purple-500" />
                        )}
                        {file.notesCount && (
                          <ListTodo className="h-4 w-4 text-blue-500" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Activity Insights */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Processing Queue
                </CardTitle>
                <CardDescription>Files being transcribed</CardDescription>
              </CardHeader>
              <CardContent>
                {processingFiles === 0 ? (
                  <p className="text-sm text-muted-foreground">All files processed</p>
                ) : (
                  <div className="space-y-2">
                    {files.filter(f => f.transcriptionStatus === 'processing').slice(0, 3).map((file) => (
                      <div key={file.id} className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                        <span className="text-sm truncate">{file.originalName}</span>
                      </div>
                    ))}
                    {processingFiles > 3 && (
                      <p className="text-sm text-muted-foreground">
                        And {processingFiles - 3} more...
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Quick Stats</CardTitle>
                <CardDescription>Your transcription overview</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Success Rate</span>
                  <span className="font-medium">
                    {totalFiles > 0 ? Math.round((transcribedFiles / totalFiles) * 100) : 0}%
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Average Duration</span>
                  <span className="font-medium">
                    {totalFiles > 0 ? formatDuration(totalDuration / totalFiles) : '0s'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">AI Analysis</span>
                  <span className="font-medium">
                    {transcribedFiles > 0 ? Math.round((filesWithExtracts / transcribedFiles) * 100) : 0}%
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Notes Extracted</span>
                  <span className="font-medium">{totalNotes}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}