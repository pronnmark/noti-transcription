'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, CheckCircle, Sparkles, ListTodo, HelpCircle, Gavel, CalendarDays, AtSign } from 'lucide-react';
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
  const [activeNoteTypes, setActiveNoteTypes] = useState<Set<string>>(new Set(['task', 'question', 'decision', 'followup', 'mention']));

  useEffect(() => {
    loadFiles();
  }, []);

  useEffect(() => {
    // Check URL params for pre-selected file
    const params = new URLSearchParams(window.location.search);
    const fileId = params.get('file');
    if (fileId && !selectedFileId) {
      setSelectedFileId(fileId);
      loadNotes(fileId);
    }
  }, [files]);

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
        throw new Error(error.error || 'Notes extraction failed');
      }

      const result = await response.json();
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
            note.id === noteId ? { ...note, status } : note
          );
        });
        return updated;
      });
      
      toast.success(`Note marked as ${status}`);
    } catch (error) {
      toast.error('Failed to update note');
      console.error('Update note error:', error);
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
      {/* Header */}
      <div className="border-b p-4 sm:p-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <ListTodo className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
            AI Notes Librarian
          </h1>
          <p className="text-muted-foreground mt-1">Extract tasks, questions, decisions, and more from your transcripts</p>
        </div>
      </div>

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
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Note type filters */}
          {selectedFileId && notes[selectedFileId] && (
            <div className="flex gap-2 flex-wrap">
              {['task', 'question', 'decision', 'followup', 'mention'].map(type => (
                <Button
                  key={type}
                  size="sm"
                  variant={activeNoteTypes.has(type) ? "default" : "outline"}
                  onClick={() => {
                    const newTypes = new Set(activeNoteTypes);
                    if (newTypes.has(type)) {
                      newTypes.delete(type);
                    } else {
                      newTypes.add(type);
                    }
                    setActiveNoteTypes(newTypes);
                  }}
                  className="flex items-center gap-1"
                >
                  {getNoteIcon(type)}
                  {type.charAt(0).toUpperCase() + type.slice(1)}s
                  <span className="ml-1 text-xs">
                    ({notes[selectedFileId]?.filter(n => n.noteType === type).length || 0})
                  </span>
                </Button>
              ))}
            </div>
          )}

          {/* Notes display */}
          {loadingNotes.has(selectedFileId || '') ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              <span>Loading notes...</span>
            </div>
          ) : selectedFileId && notes[selectedFileId] ? (
            <ScrollArea className="h-[calc(100vh-480px)]">
              <div className="space-y-3">
                {notes[selectedFileId]
                  .filter(note => activeNoteTypes.has(note.noteType))
                  .filter(note => note.status !== 'archived')
                  .map(note => (
                    <Card
                      key={note.id}
                      className={cn(
                        "border p-4 transition-all",
                        getNoteColor(note.noteType),
                        note.status === 'completed' && "opacity-60"
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-1">{getNoteIcon(note.noteType)}</div>
                        <div className="flex-1 space-y-2">
                          <p className={cn(
                            "text-sm",
                            note.status === 'completed' && "line-through"
                          )}>
                            {note.content}
                          </p>
                          {note.speaker && (
                            <p className="text-xs text-muted-foreground">
                              Speaker: {note.speaker}
                              {note.timestamp && ` • ${formatTime(note.timestamp)}`}
                            </p>
                          )}
                          {note.context && (
                            <details className="text-xs text-muted-foreground">
                              <summary className="cursor-pointer hover:text-foreground">View context</summary>
                              <p className="mt-1 pl-4 border-l-2">{note.context}</p>
                            </details>
                          )}
                          <div className="flex gap-2 mt-2">
                            {note.noteType === 'task' && note.status === 'active' && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 text-xs"
                                onClick={() => updateNoteStatus(note.id, 'completed')}
                              >
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Complete
                              </Button>
                            )}
                            {note.noteType === 'question' && note.status === 'active' && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 text-xs"
                                onClick={() => updateNoteStatus(note.id, 'completed')}
                              >
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Answered
                              </Button>
                            )}
                            {note.status === 'completed' && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 text-xs"
                                onClick={() => updateNoteStatus(note.id, 'active')}
                              >
                                Reopen
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 text-xs"
                              onClick={() => updateNoteStatus(note.id, 'archived')}
                            >
                              Archive
                            </Button>
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
              </div>
            </ScrollArea>
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