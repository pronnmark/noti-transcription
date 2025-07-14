'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, FileAudio, Loader2, Plus, Clock, CheckCircle, XCircle, Sparkles, Trash2, Edit3, Check, X } from 'lucide-react';
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
  extractCount?: number;
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
  const [editingFile, setEditingFile] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [extractModalOpen, setExtractModalOpen] = useState(false);
  const [extractFileId, setExtractFileId] = useState<string | null>(null);
  const [extractFileName, setExtractFileName] = useState('');
  const [customPrompt, setCustomPrompt] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [extractTemplates, setExtractTemplates] = useState<Array<{
    id: string;
    name: string;
    prompt: string;
    model?: string;
  }>>([]);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');

  useEffect(() => {
    loadFiles();
    loadExtractTemplates();
    // Poll for updates every 5 seconds
    const interval = setInterval(loadFiles, 5000);
    return () => clearInterval(interval);
  }, []);

  async function loadExtractTemplates() {
    try {
      const response = await fetch('/api/extract/templates');
      if (response.ok) {
        const templates = await response.json();
        setExtractTemplates(templates);
      }
    } catch (error) {
      console.error('Failed to load extract templates:', error);
    }
  }

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
    // Show immediate feedback
    toast.info(`Starting upload for ${file.name}...`);
    
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
    setSelectedTemplate('custom');
    setExtractModalOpen(true);
  }

  function closeExtractModal() {
    setExtractModalOpen(false);
    setExtractFileId(null);
    setExtractFileName('');
    setCustomPrompt('');
    setSelectedTemplate('');
  }

  function selectTemplate(templateId: string) {
    setSelectedTemplate(templateId);
    
    if (templateId === 'custom') {
      // User selected "Custom prompt" - clear the prompt to allow custom input
      setCustomPrompt('');
    } else {
      // User selected a template - populate the prompt
      const template = extractTemplates.find(t => t.id === templateId);
      if (template) {
        setCustomPrompt(template.prompt);
      }
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
          templateId: selectedTemplate === 'custom' ? undefined : selectedTemplate
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.details || error.error || 'AI extraction failed');
      }

      const result = await response.json();
      toast.success(`AI extraction completed for ${extractFileName}`);
      await loadFiles();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Check if it's an API key configuration issue
      if (errorMessage.includes('API key') || errorMessage.includes('Settings')) {
        toast.error('OpenRouter API key not configured', {
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
              isDragging && "border-primary bg-primary/5",
              uploadingFiles.size > 0 && "border-primary bg-primary/5"
            )}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <CardContent className="flex flex-col items-center justify-center py-8 sm:py-12">
              {uploadingFiles.size > 0 ? (
                <>
                  <Loader2 className="h-8 w-8 sm:h-12 sm:w-12 text-primary mb-4 animate-spin" />
                  <p className="text-base sm:text-lg font-medium mb-2 text-center">Uploading {uploadingFiles.size} file{uploadingFiles.size > 1 ? 's' : ''}...</p>
                  <p className="text-sm text-muted-foreground text-center">Please wait while we process your audio</p>
                </>
              ) : (
                <>
                  <Upload className="h-8 w-8 sm:h-12 sm:w-12 text-muted-foreground mb-4" />
                  <p className="text-base sm:text-lg font-medium mb-2 text-center">Drop audio files here or click to upload</p>
                  <p className="text-sm text-muted-foreground mb-4 text-center">Supports MP3, WAV, M4A, and more</p>
                  <Button variant="outline" className="relative">
                    <Plus className="mr-2 h-4 w-4" />
                    Choose Files
                    <input
                      type="file"
                      accept="audio/*,.m4a,.mp3,.wav,.aac,.ogg,.flac,.wma,.amr"
                      onChange={handleFileSelect}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                      disabled={uploadingFiles.size > 0}
                      multiple
                    />
                  </Button>
                </>
              )}
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
                          className="h-6 w-6 p-0 text-muted-foreground hover:text-blue-600"
                          onClick={() => startEditing(file.id, file.originalName)}
                          disabled={editingFile === file.id}
                        >
                          <Edit3 className="h-3 w-3" />
                        </Button>
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
                    {editingFile === file.id ? (
                      <div className="flex items-center gap-2 mt-2">
                        <Input
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          className="text-sm"
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
                          className="h-6 w-6 p-0 text-green-600"
                          onClick={() => saveRename(file.id)}
                        >
                          <Check className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0 text-red-600"
                          onClick={cancelEditing}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <CardTitle className="text-sm font-medium truncate mt-2">
                        {file.originalName}
                      </CardTitle>
                    )}
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
                            onClick={() => openExtractModal(file.id, file.originalName)}
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
              {extractTemplates.length > 0 && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Use Template</label>
                  <Select value={selectedTemplate} onValueChange={selectTemplate}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a template or write custom prompt..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="custom">Custom prompt</SelectItem>
                      {extractTemplates.map((template) => (
                        <SelectItem key={template.id} value={template.id}>
                          {template.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

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

              {/* Example Templates */}
              {extractTemplates.length === 0 && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Quick Templates</label>
                  <div className="grid grid-cols-2 sm:grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setCustomPrompt("Summarize the key points from this transcript in bullet points.")}
                      className="text-xs sm:text-sm h-auto py-2 px-3"
                    >
                      Summary
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setCustomPrompt("Extract all action items, decisions, and next steps mentioned in this transcript.")}
                      className="text-xs sm:text-sm h-auto py-2 px-3"
                    >
                      Action Items
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setCustomPrompt("Identify and list the main topics and themes discussed in this transcript.")}
                      className="text-xs sm:text-sm h-auto py-2 px-3"
                    >
                      Topics
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setCustomPrompt("Create a detailed meeting summary including participants, agenda items, decisions made, and follow-up actions.")}
                      className="text-xs sm:text-sm h-auto py-2 px-3"
                    >
                      Meeting Summary
                    </Button>
                  </div>
                </div>
              )}
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