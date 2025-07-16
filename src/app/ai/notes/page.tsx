'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, CheckCircle, Sparkles, ListTodo, HelpCircle, Gavel, CalendarDays, AtSign, Bug, Eye, EyeOff, BarChart3 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useMediaQuery } from '@/hooks/use-media-query';
import { TaskItem } from '@/components/tasks/task-item';
import { ProgressIndicator } from '@/components/tasks/progress-indicator';

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

interface Note {
  id: string;
  fileId: number;
  noteType: 'task' | 'question' | 'decision' | 'followup' | 'mention';
  content: string;
  context?: string;
  speaker?: string;
  timestamp?: number;
  priority: 'high' | 'medium' | 'low';
  status: 'active' | 'completed' | 'archived';
  metadata?: any;
  comments?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export default function AINotesPage() {
  const [files, setFiles] = useState<AudioFile[]>([]);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, Note[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [loadingNotes, setLoadingNotes] = useState<Set<string>>(new Set());
  const [extractingNotes, setExtractingNotes] = useState<Set<string>>(new Set());
  const [activeNoteTypes, setActiveNoteTypes] = useState<Set<string>>(new Set(['task', 'question', 'decision', 'followup']));
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [showDebugInfo, setShowDebugInfo] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const isMobile = useMediaQuery('(max-width: 767px)');

  useEffect(() => {
    loadFiles();
    
    // Check URL params for pre-selected file on mount only
    const params = new URLSearchParams(window.location.search);
    const fileId = params.get('file');
    if (fileId) {
      setSelectedFileId(fileId);
      // Load notes after a short delay to ensure files are loaded
      setTimeout(() => loadNotes(fileId), 100);
    }
  }, []); // Only run on mount

  async function loadFiles() {
    try {
      const response = await fetch('/api/files');
      if (response.ok) {
        const data = await response.json();
        const transcribedFiles = data.files.filter((f: AudioFile) => f.transcriptionStatus === 'completed');
        setFiles(transcribedFiles);
      }
    } catch (error) {
      console.error('Failed to load files:', error);
    } finally {
      setIsLoading(false);
    }
  }

  async function loadNotes(fileId: string) {
    setLoadingNotes(prev => new Set(prev).add(fileId));

    try {
      const response = await fetch(`/api/notes?fileId=${fileId}`);
      if (!response.ok) throw new Error('Failed to load notes');
      
      const data = await response.json();
      setNotes(prev => ({ ...prev, [fileId]: data.notes }));
      
      // Load stats for this file
      loadStats(fileId);
    } catch (error) {
      console.error('Failed to load notes:', error);
      toast.error('Failed to load notes');
    } finally {
      setLoadingNotes(prev => {
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
        // Store debug info even from error response
        if (error.debugInfo) {
          setDebugInfo(error.debugInfo);
          console.log('Debug info from error response:', error.debugInfo);
        }
        throw new Error(error.error || 'Notes extraction failed');
      }

      const result = await response.json();
      
      // Store debug info
      if (result.debugInfo) {
        setDebugInfo(result.debugInfo);
        console.log('Debug info received:', result.debugInfo);
      }
      
      toast.success(`Extracted ${result.notesCount} notes from ${fileName}`);
      await loadFiles();
      await loadNotes(fileId);
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

  async function updateNoteStatus(noteId: string, status: 'active' | 'completed' | 'archived') {
    try {
      const response = await fetch(`/api/notes/${noteId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status }),
      });

      if (!response.ok) throw new Error('Failed to update note');
      
      // Update local state
      setNotes(prev => {
        const updated = { ...prev };
        Object.keys(updated).forEach(fileId => {
          updated[fileId] = updated[fileId].map(note =>
            note.id === noteId ? { 
              ...note, 
              status,
              completedAt: status === 'completed' ? new Date().toISOString() : note.completedAt
            } : note
          );
        });
        return updated;
      });
      
      // Refresh stats
      if (selectedFileId) {
        loadStats(selectedFileId);
      }
      
      toast.success(`Note marked as ${status}`);
    } catch (error) {
      toast.error('Failed to update note');
      console.error('Update note error:', error);
    }
  }

  async function toggleNoteStatus(noteId: string, completed: boolean) {
    try {
      const response = await fetch(`/api/notes/${noteId}/toggle`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: completed ? 'completed' : 'active' }),
      });

      if (!response.ok) throw new Error('Failed to toggle note status');
      
      // Update local state
      setNotes(prev => {
        const updated = { ...prev };
        Object.keys(updated).forEach(fileId => {
          updated[fileId] = updated[fileId].map(note =>
            note.id === noteId ? { 
              ...note, 
              status: completed ? 'completed' : 'active',
              completedAt: completed ? new Date().toISOString() : undefined
            } : note
          );
        });
        return updated;
      });
      
      // Refresh stats
      if (selectedFileId) {
        loadStats(selectedFileId);
      }
      
      toast.success(completed ? 'Task completed' : 'Task reopened');
    } catch (error) {
      toast.error('Failed to update task status');
      console.error('Toggle note error:', error);
    }
  }

  async function updateNoteComment(noteId: string, comment: string) {
    try {
      const response = await fetch(`/api/notes/${noteId}/comment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ comment }),
      });

      if (!response.ok) throw new Error('Failed to update comment');
      
      // Update local state
      setNotes(prev => {
        const updated = { ...prev };
        Object.keys(updated).forEach(fileId => {
          updated[fileId] = updated[fileId].map(note =>
            note.id === noteId ? { ...note, comments: comment } : note
          );
        });
        return updated;
      });
      
      toast.success('Comment updated');
    } catch (error) {
      toast.error('Failed to update comment');
      console.error('Update comment error:', error);
    }
  }

  async function loadStats(fileId: string) {
    try {
      const response = await fetch(`/api/notes/stats?fileId=${fileId}`);
      if (!response.ok) throw new Error('Failed to load stats');
      
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  }

  function getNoteIcon(noteType: string) {
    switch (noteType) {
      case 'task': return <ListTodo className="h-4 w-4" />;
      case 'question': return <HelpCircle className="h-4 w-4" />;
      case 'decision': return <Gavel className="h-4 w-4" />;
      case 'followup': return <CalendarDays className="h-4 w-4" />;
      case 'mention': return <AtSign className="h-4 w-4" />;
      default: return null;
    }
  }

  function getNoteColor(noteType: string) {
    switch (noteType) {
      case 'task': return 'text-green-600 bg-green-50 border-green-200';
      case 'question': return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'decision': return 'text-purple-600 bg-purple-50 border-purple-200';
      case 'followup': return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'mention': return 'text-gray-600 bg-gray-50 border-gray-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  }

  function formatTime(seconds: number): string {
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
      {/* Header - Hidden on mobile */}
      {!isMobile && (
        <div className="border-b p-4 sm:p-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
              <ListTodo className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
              AI Task Manager
            </h1>
            <p className="text-muted-foreground mt-1">Extract and manage tasks, questions, decisions, and more from your transcripts</p>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 p-4 sm:p-6 overflow-hidden">
        <div className="space-y-6">
          {/* File selector */}
          <Card>
            <CardHeader>
              <CardTitle>Select a Transcript</CardTitle>
              <CardDescription>
                Choose a file to view or extract actionable notes
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <select
                    className="w-full px-3 py-2 border rounded-lg"
                    value={selectedFileId || ''}
                    onChange={(e) => {
                      const fileId = e.target.value;
                      setSelectedFileId(fileId);
                      if (fileId) loadNotes(fileId);
                    }}
                  >
                    <option value="">Choose a file...</option>
                    {files.map(file => (
                      <option key={file.id} value={file.id}>
                        {file.originalName} 
                        {file.notesCount && (() => {
                          try {
                            const counts = JSON.parse(file.notesCount);
                            const total = Object.values(counts).reduce((a: number, b: any) => a + b, 0);
                            return ` (${total} notes)`;
                          } catch (e) {
                            return '';
                          }
                        })()}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedFileId && (
                  <div className="flex gap-2">
                    <Button
                      onClick={() => {
                        const file = files.find(f => f.id === selectedFileId);
                        if (file) handleExtractNotes(file.id, file.originalName);
                      }}
                      disabled={extractingNotes.has(selectedFileId)}
                    >
                      {extractingNotes.has(selectedFileId) ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Sparkles className="h-4 w-4 mr-2" />
                      )}
                      Extract Notes
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => window.location.href = `/transcript/${selectedFileId}`}
                    >
                      View Transcript
                    </Button>
                    {debugInfo && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowDebugInfo(!showDebugInfo)}
                      >
                        <Bug className="h-4 w-4 mr-2" />
                        {showDebugInfo ? 'Hide' : 'Show'} Debug
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Debug Info */}
          {debugInfo && showDebugInfo && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bug className="h-5 w-5 text-orange-500" />
                  AI Response Debug Info
                </CardTitle>
                <CardDescription>
                  Raw AI responses from the notes extraction process
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Object.entries(debugInfo).map(([noteType, info]: [string, any]) => (
                    <div key={noteType} className="border rounded-lg p-4">
                      <h4 className="font-semibold mb-2 capitalize">
                        {noteType} ({info.extractedCount} items)
                        {info.parseError && (
                          <span className="text-red-500 ml-2 text-sm">
                            Parse Error: {info.parseError}
                          </span>
                        )}
                      </h4>
                      
                      <div className="space-y-2">
                        <details className="bg-gray-50 rounded p-2">
                          <summary className="cursor-pointer text-sm font-medium">
                            Raw AI Response ({info.rawResponse?.length || 0} chars)
                          </summary>
                          <pre className="text-xs mt-2 whitespace-pre-wrap overflow-x-auto">
                            {info.rawResponse || 'No response'}
                          </pre>
                        </details>
                        
                        <details className="bg-gray-100 rounded p-2">
                          <summary className="cursor-pointer text-sm font-medium">
                            Cleaned Response ({info.cleanedResponse?.length || 0} chars)
                          </summary>
                          <pre className="text-xs mt-2 whitespace-pre-wrap overflow-x-auto">
                            {info.cleanedResponse || 'No cleaned response'}
                          </pre>
                        </details>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Stats Display */}
          {selectedFileId && stats && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Progress Overview
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2">
                  <ProgressIndicator
                    completed={stats.completion.tasks.completed}
                    total={stats.completion.tasks.total}
                    label="Tasks"
                  />
                  <ProgressIndicator
                    completed={stats.completion.questions.completed}
                    total={stats.completion.questions.total}
                    label="Questions"
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Note type filters */}
          {selectedFileId && notes[selectedFileId] && (
            <div className={cn(
              "grid gap-3",
              isMobile ? "grid-cols-2" : "grid-cols-4"
            )}>
              {[
                { type: 'task', label: 'Tasks', icon: ListTodo, color: 'bg-blue-500' },
                { type: 'question', label: 'Questions', icon: HelpCircle, color: 'bg-orange-500' },
                { type: 'decision', label: 'Decisions', icon: Gavel, color: 'bg-green-500' },
                { type: 'followup', label: 'Follow-ups', icon: CalendarDays, color: 'bg-purple-500' }
              ].map(({ type, label, icon: Icon, color }) => {
                const count = notes[selectedFileId].filter(n => n.noteType === type).length;
                const isActive = activeNoteTypes.has(type);
                return (
                  <Button
                    key={type}
                    variant={isActive ? "default" : "outline"}
                    onClick={() => {
                      const newTypes = new Set(activeNoteTypes);
                      if (newTypes.has(type)) {
                        newTypes.delete(type);
                      } else {
                        newTypes.add(type);
                      }
                      setActiveNoteTypes(newTypes);
                    }}
                    className={cn(
                      "h-auto p-4 flex flex-col items-center gap-2",
                      isMobile && "p-3"
                    )}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isActive ? 'bg-white/20' : color}`}>
                      <Icon className={`h-4 w-4 ${isActive ? 'text-white' : 'text-white'}`} />
                    </div>
                    <span className={cn("font-medium", isMobile ? "text-xs" : "text-sm")}>{label}</span>
                    <span className="text-xs bg-white/20 px-2 py-1 rounded-full">{count}</span>
                  </Button>
                );
              })}
            </div>
          )}

          {/* Notes display */}
          {loadingNotes.has(selectedFileId || '') ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              <span>Loading notes...</span>
            </div>
          ) : selectedFileId && notes[selectedFileId] ? (
            <div className="space-y-6">
              {[
                { type: 'task', label: 'Tasks', icon: ListTodo, color: 'border-blue-200 bg-blue-50' },
                { type: 'question', label: 'Questions', icon: HelpCircle, color: 'border-orange-200 bg-orange-50' },
                { type: 'decision', label: 'Decisions', icon: Gavel, color: 'border-green-200 bg-green-50' },
                { type: 'followup', label: 'Follow-ups', icon: CalendarDays, color: 'border-purple-200 bg-purple-50' }
              ].map(({ type, label, icon: Icon, color }) => {
                const notesOfType = notes[selectedFileId]
                  .filter(note => note.noteType === type)
                  .filter(note => note.status !== 'archived')
                  .filter(note => activeNoteTypes.has(note.noteType));
                
                if (notesOfType.length === 0) return null;
                
                return (
                  <Card key={type} className={`${color} border-2`}>
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <Icon className="h-5 w-5" />
                        {label}
                        <span className="text-sm font-normal text-muted-foreground">({notesOfType.length})</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {notesOfType.map((note, index) => (
                          <TaskItem
                            key={note.id}
                            note={note}
                            index={index}
                            onToggleStatus={toggleNoteStatus}
                            onUpdateComment={updateNoteComment}
                          />
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : selectedFileId ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">
                No notes extracted yet for this file.
              </p>
              <p className="text-sm text-muted-foreground">
                Click "Extract Notes" to analyze the transcript for tasks, questions, and more.
              </p>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground">
                Select a file above to view or extract notes.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}