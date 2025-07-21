'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { UnibodyCard } from '@/components/ui/unibody-card';
import { MobileFileCard } from '@/components/ui/mobile-file-card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Switch } from '@/components/ui/switch';
import { Upload, FileAudio, Loader2, Plus, Clock, CheckCircle, XCircle, Sparkles, Trash2, Edit3, Check, X, MoreHorizontal, Calendar, List, Clock3, ListTodo } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useMediaQuery } from '@/hooks/use-media-query';
import { LabelEditor } from '@/components/ui/label-editor';
import { LabelBadge } from '@/components/ui/label-badge';
import { TemplateSelector, Template } from '@/components/ui/template-selector';

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
  notesStatus?: 'pending' | 'processing' | 'completed' | 'failed';
  notesCount?: any;
}

interface DateGroup {
  date: string;
  displayDate: string;
  files: AudioFile[];
  count: number;
  hasTimeData?: boolean;
}

export default function FilesPage() {
  const [files, setFiles] = useState<AudioFile[]>([]);
  const [groupedFiles, setGroupedFiles] = useState<DateGroup[]>([]);
  const [isGroupedView, setIsGroupedView] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [uploadingFiles, setUploadingFiles] = useState<Set<string>>(new Set());
  const [deletingFiles, setDeletingFiles] = useState<Set<string>>(new Set());
  const [extractingFiles, setExtractingFiles] = useState<Set<string>>(new Set());
  const [editingFile, setEditingFile] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [speakerCount, setSpeakerCount] = useState<number>(2);
  const [extractModalOpen, setExtractModalOpen] = useState(false);
  const [extractFileId, setExtractFileId] = useState<string | null>(null);
  const [extractFileName, setExtractFileName] = useState('');
  const [customPrompt, setCustomPrompt] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'name' | 'duration' | 'status' | 'labels'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [filterLabel, setFilterLabel] = useState<string>('');
  const [availableLabels, setAvailableLabels] = useState<string[]>([]);
  const isMobile = useMediaQuery('(max-width: 767px)');

  useEffect(() => {
    loadFiles();
    loadAvailableLabels();
    // Poll for updates every 30 seconds to reduce server load
    const interval = setInterval(loadFiles, 30000);
    return () => clearInterval(interval);
  }, [isGroupedView]);

  // Load available labels for filtering
  async function loadAvailableLabels() {
    try {
      const response = await fetch('/api/labels');
      if (response.ok) {
        const data = await response.json();
        setAvailableLabels(data.labels.map((l: any) => l.label));
      }
    } catch (error) {
      console.error('Failed to load labels:', error);
    }
  }

  // Update file labels
  async function updateFileLabels(fileId: string, labels: string[]) {
    try {
      const response = await fetch(`/api/files/${fileId}/labels`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ labels })
      });

      if (response.ok) {
        // Update local state
        setFiles(prevFiles => 
          prevFiles.map(file => 
            file.id === fileId ? { ...file, labels } : file
          )
        );
        setGroupedFiles(prevGroups =>
          prevGroups.map(group => ({
            ...group,
            files: group.files.map(file => 
              file.id === fileId ? { ...file, labels } : file
            )
          }))
        );
        // Refresh available labels
        loadAvailableLabels();
      } else {
        toast.error('Failed to update labels');
      }
    } catch (error) {
      console.error('Error updating labels:', error);
      toast.error('Error updating labels');
    }
  }

  // Sorting and filtering logic
  const sortFiles = (files: AudioFile[]) => {
    return [...files].sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'date':
          const dateA = new Date(a.recordedAt || a.createdAt).getTime();
          const dateB = new Date(b.recordedAt || b.createdAt).getTime();
          comparison = dateA - dateB;
          break;
        case 'name':
          comparison = a.originalName.localeCompare(b.originalName);
          break;
        case 'duration':
          comparison = (a.duration || 0) - (b.duration || 0);
          break;
        case 'status':
          const statusOrder = { 'completed': 4, 'processing': 3, 'pending': 2, 'error': 1 };
          comparison = (statusOrder[a.transcriptionStatus as keyof typeof statusOrder] || 0) - 
                      (statusOrder[b.transcriptionStatus as keyof typeof statusOrder] || 0);
          break;
        case 'labels':
          const labelsA = (a.labels || []).join(',').toLowerCase();
          const labelsB = (b.labels || []).join(',').toLowerCase();
          comparison = labelsA.localeCompare(labelsB);
          break;
        default:
          comparison = 0;
      }
      
      return sortOrder === 'desc' ? -comparison : comparison;
    });
  };

  const filterFiles = (files: AudioFile[]) => {
    if (!filterLabel) return files;
    return files.filter(file => 
      file.labels?.some(label => 
        label.toLowerCase().includes(filterLabel.toLowerCase())
      )
    );
  };

  const processedFiles = sortFiles(filterFiles(files));
  const processedGroups = groupedFiles.map(group => ({
    ...group,
    files: sortFiles(filterFiles(group.files))
  })).filter(group => group.files.length > 0);


  async function loadFiles() {
    try {
      const url = `/api/files${isGroupedView ? '?groupByDate=true' : ''}`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setFiles(data.files || []);
        if (data.groupedFiles) {
          setGroupedFiles(data.groupedFiles);
        }
      } else {
        console.error('Failed to load files: HTTP', response.status);
        toast.error(`Failed to load files: ${response.statusText}`);
        setFiles([]);
        setGroupedFiles([]);
      }
    } catch (error) {
      console.error('Failed to load files:', error);
      toast.error('Failed to load files. Please check your connection and try again.');
      setFiles([]);
      setGroupedFiles([]);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleFileUpload(file: File, allowDuplicates: boolean = false) {
    // Show immediate feedback
    toast.info(`Starting upload for ${file.name}...`);
    
    const tempId = Math.random().toString();
    setUploadingFiles(prev => new Set(prev).add(tempId));
    
    const formData = new FormData();
    formData.append('audio', file);
    formData.append('speakerCount', speakerCount.toString());
    if (allowDuplicates) {
      formData.append('allowDuplicates', 'true');
    }

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (response.status === 409) {
        // Handle duplicate file
        const duplicateData = await response.json();
        const existingFile = duplicateData.existingFile;
        
        const duplicateMessage = duplicateData.duplicateType === 'hash' 
          ? `This file already exists (uploaded ${new Date(existingFile.uploadedAt).toLocaleDateString()})`
          : `A file with the same name and size already exists`;
        
        // Show duplicate confirmation
        const shouldUpload = confirm(
          `${duplicateMessage}\n\nExisting file: "${existingFile.originalFileName}"\n` +
          `Status: ${existingFile.transcriptionStatus}\n` +
          `Duration: ${existingFile.duration ? Math.round(existingFile.duration / 60) + 'm' : 'Unknown'}\n\n` +
          `Do you want to upload anyway?`
        );
        
        if (shouldUpload) {
          // Retry upload with allowDuplicates = true
          return handleFileUpload(file, true);
        } else {
          toast.info(`Upload cancelled - ${file.name} already exists`);
          return;
        }
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Upload failed');
      }

      const result = await response.json();
      toast.success(`${file.name} uploaded successfully!`);
      await loadFiles();
    } catch (error) {
      toast.error(`Failed to upload ${file.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      console.error('Upload error:', error);
    } finally {
      setUploadingFiles(prev => {
        const newSet = new Set(prev);
        newSet.delete(tempId);
        return newSet;
      });
    }
  }


  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (files && files.length > 0) {
      // Handle multiple files
      Array.from(files).forEach(file => {
        handleFileUpload(file);
      });
    }
    // Reset the input value to allow selecting the same file again
    e.target.value = '';
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

  function openExtractModal(fileId: string, fileName: string) {
    setExtractFileId(fileId);
    setExtractFileName(fileName);
    setCustomPrompt('');
    setSelectedTemplate(null);
    setExtractModalOpen(true);
  }

  function closeExtractModal() {
    setExtractModalOpen(false);
    setExtractFileId(null);
    setExtractFileName('');
    setCustomPrompt('');
    setSelectedTemplate(null);
  }

  function handleTemplateSelect(template: Template | null) {
    setSelectedTemplate(template);
    
    if (template) {
      // User selected a template - populate the prompt
      setCustomPrompt(template.prompt);
    } else {
      // User selected "Custom prompt" - clear the prompt to allow custom input
      setCustomPrompt('');
    }
  }

  async function handleCustomExtract() {
    if (!extractFileId || !customPrompt.trim()) {
      toast.error('Please enter a prompt for the extraction');
      return;
    }

    setExtractingFiles(prev => new Set(prev).add(extractFileId));
    closeExtractModal();

    try {
      const response = await fetch('/api/extract', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          fileId: extractFileId,
          prompt: customPrompt.trim(),
          templateId: selectedTemplate?.id
        }),
      });

      if (!response.ok) {
        let errorMessage = 'AI extraction failed';
        try {
          const error = await response.json();
          // Handle AppError structure (message field) and legacy formats (error/details fields)
          errorMessage = error.message || error.error || error.details || `HTTP ${response.status}: ${response.statusText}`;
        } catch (jsonError) {
          // Fallback if response isn't valid JSON
          errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();
      toast.success(`AI extraction completed for ${extractFileName}`);
      await loadFiles();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Check if it's an API key configuration issue
      if (errorMessage.includes('API key') || errorMessage.includes('Settings')) {
        toast.error('Gemini API key not configured', {
          description: 'Go to Settings to add your API key',
          action: {
            label: 'Go to Settings',
            onClick: () => window.location.href = '/settings'
          }
        });
      } else if (errorMessage.includes('Unauthorized')) {
        toast.error('Session expired', {
          description: 'Please log in again',
          action: {
            label: 'Log in',
            onClick: () => window.location.href = '/login'
          }
        });
      } else {
        toast.error(`Failed to extract AI summary: ${errorMessage}`);
      }
      console.error('Extract error:', error);
    } finally {
      setExtractingFiles(prev => {
        const newSet = new Set(prev);
        newSet.delete(extractFileId);
        return newSet;
      });
    }
  }

  function openTemplateDialog() {
    if (!customPrompt.trim()) {
      toast.error('Please enter a prompt first');
      return;
    }
    setShowTemplateDialog(true);
    setNewTemplateName('');
  }

  function closeTemplateDialog() {
    setShowTemplateDialog(false);
    setNewTemplateName('');
  }

  async function saveAsTemplate() {
    if (!newTemplateName.trim()) {
      toast.error('Please enter a template name');
      return;
    }

    try {
      const response = await fetch('/api/extract/templates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newTemplateName.trim(),
          prompt: customPrompt.trim()
        }),
      });

      if (response.ok) {
        toast.success('Template saved successfully');
        await loadExtractTemplates();
        closeTemplateDialog();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save template');
      }
    } catch (error) {
      toast.error(`Failed to save template: ${error instanceof Error ? error.message : 'Unknown error'}`);
      console.error('Save template error:', error);
    }
  }

  function startEditing(fileId: string, currentName: string) {
    setEditingFile(fileId);
    setEditingName(currentName);
  }

  function cancelEditing() {
    setEditingFile(null);
    setEditingName('');
  }

  async function saveRename(fileId: string) {
    if (!editingName.trim()) {
      toast.error('File name cannot be empty');
      return;
    }

    try {
      const response = await fetch(`/api/files/${fileId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ originalName: editingName.trim() }),
      });

      if (!response.ok) {
        throw new Error('Failed to rename file');
      }

      toast.success('File renamed successfully');
      setEditingFile(null);
      setEditingName('');
      await loadFiles();
    } catch (error) {
      toast.error('Failed to rename file');
      console.error('Rename error:', error);
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

  function formatRecordingDate(dateString?: string) {
    if (!dateString) return null;
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }

  function formatRecordingTime(dateString?: string) {
    if (!dateString) return null;
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  }

  function formatFullRecordingDateTime(dateString?: string) {
    if (!dateString) return null;
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  }

  function renderFileRow(file: AudioFile) {
    return (
      <TableRow key={file.id}>
        <TableCell>
          <div className="flex items-center gap-3">
            <FileAudio className="h-4 w-4 text-primary flex-shrink-0" />
            <div className="min-w-0 flex-1">
              {editingFile === file.id ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    className="text-sm h-8"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        saveRename(file.id);
                      } else if (e.key === 'Escape') {
                        cancelEditing();
                      }
                    }}
                    autoFocus
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0 text-green-600"
                    onClick={() => saveRename(file.id)}
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0 text-red-600"
                    onClick={cancelEditing}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div>
                  {file.transcriptionStatus === 'completed' ? (
                    <button 
                      onClick={() => window.location.href = `/transcript/${file.id}`}
                      className="text-left w-full group"
                    >
                      <p className="font-medium text-sm truncate text-primary group-hover:underline cursor-pointer">
                        {file.originalName}
                      </p>
                    </button>
                  ) : (
                    <p className="font-medium text-sm truncate">{file.originalName}</p>
                  )}
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {file.recordedAt && (
                      <>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatRecordingDate(file.recordedAt)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock3 className="h-3 w-3" />
                          {formatRecordingTime(file.recordedAt)}
                        </span>
                      </>
                    )}
                    {file.transcriptionStatus === 'completed' && (
                      <div className="flex items-center gap-2">
                        <span className="flex items-center gap-1 text-green-600">
                          <CheckCircle className="h-3 w-3" />
                          Transcript
                        </span>
                        {file.extractCount && file.extractCount > 0 && (
                          <span className="flex items-center gap-1 text-blue-600">
                            <Sparkles className="h-3 w-3" />
                            {file.extractCount} AI Summary{file.extractCount > 1 ? 'ies' : 'y'}
                          </span>
                        )}
                        {file.notesCount && (
                          <span className="flex items-center gap-1 text-purple-600">
                            {(() => {
                              try {
                                const counts = JSON.parse(file.notesCount);
                                const total = Object.values(counts).reduce((a: number, b: any) => a + b, 0);
                                return total > 0 ? (
                                  <>
                                    <ListTodo className="h-3 w-3" />
                                    {total} Note{total > 1 ? 's' : ''}
                                  </>
                                ) : null;
                              } catch (e) {
                                return null;
                              }
                            })()}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  
                  {/* Labels Section */}
                  <div className="mt-2">
                    <LabelEditor
                      labels={file.labels || []}
                      onChange={(labels) => updateFileLabels(file.id, labels)}
                      placeholder="Add labels..."
                      className="w-full"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </TableCell>
        <TableCell>
          <span className="text-sm">{formatFileSize(file.size)}</span>
        </TableCell>
        <TableCell>
          <span className="text-sm">{formatDuration(file.duration)}</span>
        </TableCell>
        <TableCell>
          {file.recordedAt ? (
            <div className="flex flex-col text-xs">
              <span className="text-sm">{formatRecordingDate(file.recordedAt)}</span>
              <span className="text-muted-foreground">{formatRecordingTime(file.recordedAt)}</span>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">Unknown</span>
          )}
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-2">
            {getStatusIcon(file.transcriptionStatus)}
            <Badge variant={file.transcriptionStatus === 'completed' ? 'default' : 'secondary'}>
              {file.transcriptionStatus || 'pending'}
            </Badge>
          </div>
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-2">
            {file.transcriptionStatus === 'completed' && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => openExtractModal(file.id, file.originalName)}
                disabled={extractingFiles.has(file.id)}
                title="Generate AI summary"
              >
                {extractingFiles.has(file.id) ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => startEditing(file.id, file.originalName)}>
                  <Edit3 className="h-4 w-4 mr-2" />
                  Rename
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
    );
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
        <div className="border-b buzz-header-desktop">
          <h1 className="text-3xl font-semibold text-foreground">Files</h1>
          <p className="text-muted-foreground mt-2 text-base">Upload and manage your audio files</p>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        <div className={cn(
          "h-full overflow-y-auto",
          // iOS-style spacing system - generous padding following 8pt grid
          isMobile ? "px-4 py-6 space-y-6" : "p-6 space-y-6"
        )}>
          {/* Upload Section - Desktop only */}
          {!isMobile && (
            /* Compact desktop upload section */
            <Card>
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <Upload className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium">Upload Audio Files</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <label htmlFor="speakerCount" className="text-xs text-muted-foreground">
                        Speakers:
                      </label>
                      <Select value={speakerCount.toString()} onValueChange={(value) => setSpeakerCount(parseInt(value))}>
                        <SelectTrigger className="w-16 h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">1</SelectItem>
                          <SelectItem value="2">2</SelectItem>
                          <SelectItem value="3">3</SelectItem>
                          <SelectItem value="4">4</SelectItem>
                          <SelectItem value="5">5</SelectItem>
                          <SelectItem value="6">6</SelectItem>
                          <SelectItem value="7">7</SelectItem>
                          <SelectItem value="8">8</SelectItem>
                          <SelectItem value="9">9</SelectItem>
                          <SelectItem value="10">10</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  <Button 
                    size="sm"
                    className="relative"
                    disabled={uploadingFiles.size > 0}
                  >
                    {uploadingFiles.size > 0 ? (
                      <>
                        <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Plus className="mr-2 h-3 w-3" />
                        Choose Files
                      </>
                    )}
                    <input
                      type="file"
                      accept="audio/*,.m4a,.mp3,.wav,.aac,.ogg,.flac,.wma,.amr"
                      onChange={handleFileSelect}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                      disabled={uploadingFiles.size > 0}
                      multiple
                    />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Files Section - Mobile vs Desktop */}
          {isMobile ? (
            /* iOS-native mobile files section */
            <div className="space-y-4">
              {/* 1. Upload Section - Always at top */}
              <UnibodyCard className="py-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-blue-50 rounded-lg">
                        <Upload className="h-4 w-4 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">Upload Audio Files</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <label htmlFor="mobile-speakerCount" className="text-xs text-gray-500">
                            Speakers:
                          </label>
                          <Select value={speakerCount.toString()} onValueChange={(value) => setSpeakerCount(parseInt(value))}>
                            <SelectTrigger className="w-14 h-6 text-xs border-gray-200">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="1">1</SelectItem>
                              <SelectItem value="2">2</SelectItem>
                              <SelectItem value="3">3</SelectItem>
                              <SelectItem value="4">4</SelectItem>
                              <SelectItem value="5">5</SelectItem>
                              <SelectItem value="6">6</SelectItem>
                              <SelectItem value="7">7</SelectItem>
                              <SelectItem value="8">8</SelectItem>
                              <SelectItem value="9">9</SelectItem>
                              <SelectItem value="10">10</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                    
                    <Button 
                      className="relative bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl font-medium touch-target-44"
                      disabled={uploadingFiles.size > 0}
                    >
                      {uploadingFiles.size > 0 ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Plus className="mr-2 h-4 w-4" />
                          Choose Files
                        </>
                      )}
                      <input
                        type="file"
                        accept="audio/*,.m4a,.mp3,.wav,.aac,.ogg,.flac,.wma,.amr"
                        onChange={handleFileSelect}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                        disabled={uploadingFiles.size > 0}
                        multiple
                      />
                    </Button>
                  </div>
              </UnibodyCard>

              {/* 2. Filter Section - Only show if files exist */}
              {files.length > 0 && (
                <UnibodyCard className="py-3">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700">Sort & Filter</span>
                        <div className="flex items-center gap-2">
                          <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
                            <SelectTrigger className="w-20 h-8 text-xs border-gray-200">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="date">Date</SelectItem>
                              <SelectItem value="name">Name</SelectItem>
                              <SelectItem value="duration">Duration</SelectItem>
                              <SelectItem value="status">Status</SelectItem>
                              <SelectItem value="labels">Labels</SelectItem>
                            </SelectContent>
                          </Select>
                          <Select value={sortOrder} onValueChange={(value: any) => setSortOrder(value)}>
                            <SelectTrigger className="w-16 h-8 text-xs border-gray-200">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="desc">↓</SelectItem>
                              <SelectItem value="asc">↑</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      
                      {/* Label filter if available */}
                      {availableLabels.length > 0 && (
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-500">Filter by label:</span>
                          <Select value={filterLabel || "all"} onValueChange={(value) => setFilterLabel(value === "all" ? "" : value)}>
                            <SelectTrigger className="w-32 h-8 text-xs border-gray-200">
                              <SelectValue placeholder="All files" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All files</SelectItem>
                              {availableLabels.map((label) => (
                                <SelectItem key={label} value={label}>
                                  {label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                </UnibodyCard>
              )}

              {/* 3. Files Summary - Simple stats */}
              {files.length > 0 && (
                <UnibodyCard className="py-3">
                    <div className="flex items-center gap-3">
                      <div className="p-1.5 bg-gray-100 rounded-lg">
                        <FileAudio className="h-4 w-4 text-gray-600" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-gray-900">
                            {(isGroupedView ? processedGroups.reduce((total, group) => total + group.files.length, 0) : processedFiles.length)} of {files.length} files
                          </p>
                          <p className="text-xs text-gray-500">
                            {Math.round((files.reduce((total, file) => total + (file.duration || 0), 0)) / 60)} min total
                          </p>
                        </div>
                      </div>
                    </div>
                </UnibodyCard>
              )}

              {/* 4. Files Grid */}
              {files.length === 0 ? (
                <UnibodyCard className="text-center py-8">
                    <div className="p-3 bg-gray-50 rounded-2xl w-fit mx-auto mb-3">
                      <FileAudio className="h-6 w-6 text-gray-400" />
                    </div>
                    <h3 className="text-base font-semibold text-gray-900 mb-1">No files yet</h3>
                    <p className="text-sm text-gray-600">
                      Upload your first audio file to get started
                    </p>
                </UnibodyCard>
              ) : (
                <div className="space-y-4">
                  {(isGroupedView ? processedGroups.flatMap(group => group.files) : processedFiles).map((file) => (
                    <MobileFileCard
                      key={file.id}
                      file={file}
                      onExtract={openExtractModal}
                      onDelete={handleDeleteFile}
                      onRename={startEditing}
                      onLabelsUpdate={updateFileLabels}
                      isExtracting={extractingFiles.has(file.id)}
                      isDeleting={deletingFiles.has(file.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* Desktop files section remains as table */
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Audio Files</CardTitle>
                    <CardDescription>
                      Manage your uploaded audio files and their transcriptions
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <Switch
                      checked={isGroupedView}
                      onCheckedChange={setIsGroupedView}
                      className="data-[state=checked]:bg-primary"
                    />
                    <List className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground ml-2">
                      {isGroupedView ? 'Date Groups' : 'List View'}
                    </span>
                  </div>
                </div>
                
                {/* Sort and Filter Controls */}
                {files.length > 0 && (
                  <div className="mt-4 p-4 bg-gray-50 rounded-lg border">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div className="flex flex-wrap items-center gap-3">
                        <h3 className="text-sm font-medium text-gray-700">Sort by:</h3>
                        <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="date">Date</SelectItem>
                            <SelectItem value="name">Name</SelectItem>
                            <SelectItem value="duration">Duration</SelectItem>
                            <SelectItem value="status">Status</SelectItem>
                            <SelectItem value="labels">Labels</SelectItem>
                          </SelectContent>
                        </Select>
                        
                        <Select value={sortOrder} onValueChange={(value: any) => setSortOrder(value)}>
                          <SelectTrigger className="w-28">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="desc">
                              {sortBy === 'date' ? 'Newest' : 
                               sortBy === 'duration' ? 'Longest' :
                               sortBy === 'name' ? 'Z-A' :
                               sortBy === 'labels' ? 'Z-A' :
                               'Completed'}
                            </SelectItem>
                            <SelectItem value="asc">
                              {sortBy === 'date' ? 'Oldest' : 
                               sortBy === 'duration' ? 'Shortest' :
                               sortBy === 'name' ? 'A-Z' :
                               sortBy === 'labels' ? 'A-Z' :
                               'Pending'}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <h3 className="text-sm font-medium text-gray-700">Filter by label:</h3>
                        <Select value={filterLabel || "all"} onValueChange={(value) => setFilterLabel(value === "all" ? "" : value)}>
                          <SelectTrigger className="w-40">
                            <SelectValue placeholder="All files" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All files</SelectItem>
                            {availableLabels.map((label) => (
                              <SelectItem key={label} value={label}>
                                {label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="text-sm text-gray-600">
                        {(isGroupedView ? processedGroups.reduce((total, group) => total + group.files.length, 0) : processedFiles.length)} of {files.length} files
                      </div>
                    </div>
                  </div>
                )}
              </CardHeader>
              <CardContent>
              {files.length === 0 ? (
                <div className="text-center py-12">
                  <FileAudio className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No files uploaded yet</p>
                  <p className="text-sm text-muted-foreground mt-2">Upload your first audio file to get started</p>
                </div>
              ) : isGroupedView && processedGroups.length > 0 ? (
                // Accordion view grouped by date
                <Accordion type="multiple" className="w-full">
                  {processedGroups.map((group) => (
                    <AccordionItem key={group.date} value={group.date}>
                      <AccordionTrigger className="hover:no-underline">
                        <div className="flex items-center justify-between w-full pr-4">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4" />
                            <span className="font-medium">{group.displayDate}</span>
                            {group.hasTimeData && (
                              <Clock3 className="h-3 w-3 text-blue-500" title="Contains recordings with specific times" />
                            )}
                          </div>
                          <Badge variant="secondary" className="ml-auto">
                            {group.count} file{group.count !== 1 ? 's' : ''}
                          </Badge>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>File</TableHead>
                              <TableHead>Size</TableHead>
                              <TableHead>Duration</TableHead>
                              <TableHead>Recorded</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead>Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {group.files.map(renderFileRow)}
                          </TableBody>
                        </Table>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              ) : (
                // Regular table view
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>File</TableHead>
                      <TableHead>Size</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Recorded</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {processedFiles.map(renderFileRow)}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
          )}
        </div>
      </div>

      {/* Extract Modal */}
      {extractModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-2 sm:p-4 z-50">
          <Card className="w-full max-w-2xl max-h-[95vh] sm:max-h-[90vh] overflow-hidden bg-white shadow-2xl border-0">
            <CardHeader className="bg-white border-b">
              <CardTitle className="text-lg sm:text-xl">AI Extraction for {extractFileName}</CardTitle>
              <CardDescription className="text-sm">
                Create a custom AI analysis of this transcript. You can use templates or write your own prompt.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 bg-white overflow-y-auto max-h-[calc(95vh-200px)] sm:max-h-[calc(90vh-200px)]">
              {/* Template Selection */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Use Template</label>
                <TemplateSelector
                  templateType="summarization"
                  selectedTemplateId={selectedTemplate?.id}
                  onTemplateSelect={handleTemplateSelect}
                  placeholder="Choose a template or write custom prompt..."
                  size="md"
                  className="w-full"
                />
              </div>

              {/* Custom Prompt */}
              <div className="space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <label className="text-sm font-medium">Prompt</label>
                  {customPrompt.trim() && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={openTemplateDialog}
                      className="self-start sm:self-auto"
                    >
                      Save as Template
                    </Button>
                  )}
                </div>
                <Textarea
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  placeholder="Enter your extraction prompt here... For example:
- Summarize the key points from this transcript
- Extract action items and decisions made
- Identify the main topics discussed
- Create a meeting summary with participants and outcomes"
                  rows={6}
                  className="resize-none text-sm"
                />
              </div>

            </CardContent>
            <div className="flex flex-col sm:flex-row justify-end gap-2 p-4 sm:p-6 pt-0 bg-white border-t">
              <Button 
                variant="outline" 
                onClick={closeExtractModal}
                className="order-2 sm:order-1"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleCustomExtract}
                disabled={!customPrompt.trim()}
                className="order-1 sm:order-2"
              >
                <Sparkles className="h-4 w-4 mr-2" />
                Extract
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Template Creation Dialog */}
      {showTemplateDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[60]">
          <Card className="w-full max-w-md bg-white shadow-2xl border-0">
            <CardHeader className="bg-white border-b">
              <CardTitle className="text-lg">Save as Template</CardTitle>
              <CardDescription className="text-sm">
                Give this prompt a name so you can reuse it later.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 bg-white p-6">
              <div className="space-y-2">
                <label className="text-sm font-medium">Template Name</label>
                <Input
                  value={newTemplateName}
                  onChange={(e) => setNewTemplateName(e.target.value)}
                  placeholder="e.g. Meeting Summary, Action Items, etc."
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      saveAsTemplate();
                    } else if (e.key === 'Escape') {
                      closeTemplateDialog();
                    }
                  }}
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Preview</label>
                <div className="text-xs bg-gray-50 p-3 rounded border max-h-20 overflow-y-auto">
                  {customPrompt}
                </div>
              </div>
            </CardContent>
            <div className="flex justify-end gap-2 p-6 pt-0 bg-white border-t">
              <Button variant="outline" onClick={closeTemplateDialog}>
                Cancel
              </Button>
              <Button 
                onClick={saveAsTemplate}
                disabled={!newTemplateName.trim()}
              >
                Save Template
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}