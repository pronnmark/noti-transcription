'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useMediaQuery } from '@/hooks/use-media-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Loader2, FileText, Clock, CheckCircle, AlertCircle, Eye, Copy, RefreshCw, Calendar, Clock3, MoreHorizontal, Settings, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import TemplateManagementModal from '@/components/TemplateManagementModal';
import { LabelBadge } from '@/components/ui/label-badge';
import { TemplateSelector, Template } from '@/components/ui/template-selector';
import { cn } from '@/lib/utils';

interface AudioFile {
  id: string;
  filename: string;
  originalName: string;
  createdAt: string;
  updatedAt: string;
  recordedAt?: string;
  duration?: number;
  transcriptionStatus: 'pending' | 'processing' | 'completed' | 'failed';
  hasTranscript: boolean;
  hasAiExtract: boolean;
  extractCount: number;
  size: number;
  mimeType: string;
  speakerCount: number;
  diarizationStatus: string;
  hasSpeakers: boolean;
  labels: string[];
}

interface DateGroup {
  date: string;
  displayDate: string;
  files: AudioFile[];
  count: number;
  hasTimeData?: boolean;
}

interface SummaryContent {
  file: {
    id: number;
    fileName: string;
    originalFileName: string;
    summarizationStatus: string;
    summarizationContent: string | null;
  };
  summarizations: Array<{
    id: string;
    content: string;
    model: string;
    prompt: string;
    createdAt: string;
    updatedAt: string;
    template: {
      id: string;
      name: string;
      description: string;
      isDefault: boolean;
    } | null;
  }>;
  totalSummaries: number;
}

export default function SummarizationPage() {
  const router = useRouter();
  const isMobile = useMediaQuery('(max-width: 767px)');
  const [files, setFiles] = useState<AudioFile[]>([]);
  const [groupedFiles, setGroupedFiles] = useState<DateGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingFileId, setProcessingFileId] = useState<string | null>(null);
  const [regeneratingSummary, setRegeneratingSummary] = useState(false);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [fileSummaries, setFileSummaries] = useState<Record<string, any[]>>({});
  const [sortBy, setSortBy] = useState<'date' | 'duration' | 'name' | 'speakers' | 'status' | 'labels'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [deletingSummary, setDeletingSummary] = useState<string | null>(null);

  // Sorting logic
  const sortFiles = (files: AudioFile[]) => {
    return [...files].sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'date':
          const dateA = new Date(a.recordedAt || a.createdAt).getTime();
          const dateB = new Date(b.recordedAt || b.createdAt).getTime();
          comparison = dateA - dateB;
          break;
        case 'duration':
          comparison = (a.duration || 0) - (b.duration || 0);
          break;
        case 'name':
          comparison = a.originalName.localeCompare(b.originalName);
          break;
        case 'speakers':
          comparison = (a.speakerCount || 0) - (b.speakerCount || 0);
          break;
        case 'status':
          const statusOrder = { 'completed': 4, 'processing': 3, 'pending': 2, 'failed': 1 };
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

  const applySortingToGroups = (groups: DateGroup[]) => {
    return groups.map(group => ({
      ...group,
      files: sortFiles(group.files),
    }));
  };

  // Load files with summarization data
  useEffect(() => {
    const loadFiles = async () => {
      try {
        const response = await fetch('/api/files?groupByDate=true');
        const data = await response.json();
        const filesData = data.files || [];
        setFiles(filesData);
        if (data.groupedFiles) {
          const sortedGroups = applySortingToGroups(data.groupedFiles);
          setGroupedFiles(sortedGroups);
        }

        // Load summaries for all files that have them
        await loadAllSummaries(filesData);
      } catch (error) {
        // Error loading files - already shown via toast
      } finally {
        setLoading(false);
      }
    };

    loadFiles();
  }, []);

  // Re-sort files when sort options change
  useEffect(() => {
    if (files.length > 0) {
      // Re-group and sort from original files data
      const groupedFiles = files.reduce((groups, file) => {
        if (!file || (!file.recordedAt && !file.createdAt)) {
          return groups;
        }

        const dateToUse = file.recordedAt || file.createdAt;
        const dateKey = new Date(dateToUse).toISOString().split('T')[0];

        if (!groups[dateKey]) {
          groups[dateKey] = {
            date: dateKey,
            displayDate: new Date(dateKey).toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            }),
            files: [],
            count: 0,
            hasTimeData: false,
          };
        }

        groups[dateKey].files.push(file);
        groups[dateKey].count++;
        if (file.recordedAt) {
          groups[dateKey].hasTimeData = true;
        }

        return groups;
      }, {} as Record<string, DateGroup>);

      const groupsArray = Object.values(groupedFiles).sort((a, b) =>
        new Date(b.date).getTime() - new Date(a.date).getTime(),
      );

      const sortedGroups = applySortingToGroups(groupsArray);
      setGroupedFiles(sortedGroups);
    }
  }, [sortBy, sortOrder, files]);

  // Function to refresh page after template changes
  const handleTemplatesUpdated = () => {
    // Trigger a page refresh to reload files and update the template selector
    window.location.reload();
  };

  // Utility functions for formatting dates and times
  function formatRecordingDate(dateString?: string) {
    if (!dateString) return null;
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  function formatRecordingTime(dateString?: string) {
    if (!dateString) return null;
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  }

  function formatDuration(seconds?: number) {
    if (!seconds) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  const getTranscriptionStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'processing':
        return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
      case 'failed':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'processing':
        return 'bg-blue-100 text-blue-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const handleGenerateSummary = async (fileId: string, template?: Template) => {
    if (!template && !selectedTemplate) {
      toast.error('Please select a template first');
      return;
    }

    const templateToUse = template || selectedTemplate;
    setIsProcessing(true);
    setProcessingFileId(fileId);

    try {
      const response = await fetch(`/api/ai/dynamic-process/${fileId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          summarizationPromptId: templateToUse?.id,
        }),
      });

      if (response.ok) {
        toast.success('Summary generated successfully');

        // Update only the specific file's hasAiExtract status
        const updatedFiles = files.map(file =>
          file.id === fileId
            ? { ...file, hasAiExtract: true, extractCount: (file.extractCount || 0) + 1 }
            : file,
        );
        setFiles(updatedFiles);

        // Update grouped files with the same change
        const updatedGroupedFiles = groupedFiles.map(group => ({
          ...group,
          files: group.files.map(file =>
            file.id === fileId
              ? { ...file, hasAiExtract: true, extractCount: (file.extractCount || 0) + 1 }
              : file,
          ),
        }));
        setGroupedFiles(updatedGroupedFiles);

        // Load summary only for this specific file
        try {
          const summaryResponse = await fetch(`/api/summarization/${fileId}`);
          if (summaryResponse.ok) {
            const summaryData = await summaryResponse.json();
            setFileSummaries(prev => ({
              ...prev,
              [fileId]: summaryData.summarizations || [],
            }));
          }
        } catch (summaryError) {
          // Error loading new summary - will retry on next load
        }
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'Failed to generate summary');
      }
    } catch (error) {
      // Error generating summary - already shown via toast
      toast.error('Failed to generate summary');
    } finally {
      setIsProcessing(false);
      setProcessingFileId(null);
    }
  };

  // Load summaries for all files that have them upfront
  const loadAllSummaries = async (files: AudioFile[]) => {
    const filesWithSummaries = files.filter(file => file.hasAiExtract);

    if (filesWithSummaries.length === 0) return;

    try {
      const summaryPromises = filesWithSummaries.map(async (file) => {
        const response = await fetch(`/api/summarization/${file.id}`);
        if (response.ok) {
          const data = await response.json();
          return { fileId: file.id, summaries: data.summarizations || [] };
        }
        return { fileId: file.id, summaries: [] };
      });

      const results = await Promise.all(summaryPromises);
      const summariesMap = results.reduce((acc, result) => {
        acc[result.fileId] = result.summaries;
        return acc;
      }, {} as Record<string, any[]>);

      setFileSummaries(summariesMap);
    } catch (error) {
      // Error loading summaries - already shown via toast
    }
  };

  const formatRelativeDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));

    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffHours < 48) return 'Yesterday';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const handleRegenerateSummary = async (fileId: string) => {
    setRegeneratingSummary(true);
    setProcessingFileId(fileId);

    try {
      const response = await fetch(`/api/ai/dynamic-process/${fileId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          templateId: 'prompt-general', // Use default template
        }),
      });

      if (response.ok) {
        toast.success('Summary regenerated successfully');

        // Load summary only for this specific file
        try {
          const summaryResponse = await fetch(`/api/summarization/${fileId}`);
          if (summaryResponse.ok) {
            const summaryData = await summaryResponse.json();
            setFileSummaries(prev => ({
              ...prev,
              [fileId]: summaryData.summarizations || [],
            }));
          }
        } catch (summaryError) {
          // Error loading regenerated summary - will retry on next load
        }
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'Failed to regenerate summary');
      }
    } catch (error) {
      // Error regenerating summary - already shown via toast
      toast.error('Failed to regenerate summary');
    } finally {
      setRegeneratingSummary(false);
      setProcessingFileId(null);
    }
  };

  const handleDeleteSummary = async (summaryId: string, fileId: string) => {
    const confirmed = window.confirm('Are you sure you want to delete this summary? This action cannot be undone.');

    if (!confirmed) return;

    setDeletingSummary(summaryId);
    try {
      const response = await fetch(`/api/summary/${summaryId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast.success('Summary deleted successfully');

        // Remove the summary from local state immediately
        setFileSummaries(prev => ({
          ...prev,
          [fileId]: prev[fileId]?.filter(summary => summary.id !== summaryId) || [],
        }));

        // Refresh files to update hasAiExtract status
        const filesResponse = await fetch('/api/files?groupByDate=true');
        const data = await filesResponse.json();
        setFiles(data.files || []);
        if (data.groupedFiles) {
          const sortedGroups = applySortingToGroups(data.groupedFiles);
          setGroupedFiles(sortedGroups);
        }
        await loadAllSummaries(data.files || []);
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'Failed to delete summary');
      }
    } catch (error) {
      // Error deleting summary - already shown via toast
      toast.error('Failed to delete summary');
    } finally {
      setDeletingSummary(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className={
      // Mobile: Full screen natural scrolling
      // Desktop: Fixed viewport height with internal scrolling
      isMobile ? 'min-h-screen' : 'h-full'
    }>
      {/* Header - Hidden on mobile as it's handled by responsive layout */}
      {!isMobile && (
        <div className="border-b p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="ios-title1 text-foreground">AI Summaries</h1>
              <p className="text-muted-foreground text-sm mt-2 font-light">Generate summaries from your recordings</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsTemplateModalOpen(true)}
              className="flex items-center gap-2 font-medium"
            >
              <Settings className="w-4 h-4" />
              Templates
            </Button>
          </div>
        </div>
      )}

      {/* Content */}
      <div className={cn(
        'flex-1',
        isMobile ? 'p-4 pb-safe' : 'p-6 overflow-y-auto',
      )}>
        {/* Sort Controls */}
        {(groupedFiles.length > 0 || files.length > 0) && (
          <div className="mb-6 p-4 bg-gray-50 rounded-lg border">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <h3 className="text-sm font-medium text-gray-700">Sort by:</h3>
                <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="date">Date</SelectItem>
                    <SelectItem value="duration">Duration</SelectItem>
                    <SelectItem value="name">File Name</SelectItem>
                    <SelectItem value="speakers">Speaker Count</SelectItem>
                    <SelectItem value="status">Status</SelectItem>
                    <SelectItem value="labels">Labels</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={sortOrder} onValueChange={(value: any) => setSortOrder(value)}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="desc">
                      {sortBy === 'date' ? 'Newest First' :
                        sortBy === 'duration' ? 'Longest First' :
                          sortBy === 'name' ? 'Z-A' :
                            sortBy === 'speakers' ? 'Most First' :
                              sortBy === 'labels' ? 'Z-A' :
                                'Completed First'}
                    </SelectItem>
                    <SelectItem value="asc">
                      {sortBy === 'date' ? 'Oldest First' :
                        sortBy === 'duration' ? 'Shortest First' :
                          sortBy === 'name' ? 'A-Z' :
                            sortBy === 'speakers' ? 'Fewest First' :
                              sortBy === 'labels' ? 'A-Z' :
                                'Pending First'}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="text-sm text-gray-600">
                {files.length} file{files.length !== 1 ? 's' : ''} • {Math.round((files.reduce((total, file) => total + (file.duration || 0), 0)) / 60)} min total
              </div>
            </div>
          </div>
        )}

        <div className="space-y-4">{groupedFiles.length === 0 && files.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No files found</h3>
              <p className="text-gray-600 mb-4">
                Upload audio files to start generating summaries
              </p>
              <Button onClick={() => window.location.href = '/files'}>
                Upload Files
              </Button>
            </CardContent>
          </Card>
        ) : (
          // Date-based Accordion Grouping
          <Accordion type="multiple" className="w-full">
            {groupedFiles.map((group) => (
              <AccordionItem key={group.date} value={group.date}>
                <AccordionTrigger className="hover:no-underline py-4 touch-manipulation min-h-[48px]">
                  <div className="flex items-center justify-between w-full pr-4">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      <span className="font-medium">{group.displayDate}</span>
                      {group.hasTimeData && (
                        <Clock3 className="h-3 w-3 text-blue-500" aria-label="Contains recordings with specific times" />
                      )}
                    </div>
                    <Badge variant="secondary" className="ml-auto">
                      {group.count} file{group.count !== 1 ? 's' : ''}
                    </Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-3">
                    {group.files.map((file) => (
                      <Card
                        key={file.id}
                        className={`transition-all duration-200 touch-manipulation ${
                          processingFileId === file.id
                            ? 'shadow-md bg-gray-50 border-gray-200'
                            : 'hover:shadow-sm border-gray-100 bg-white'
                        }`}
                      >
                        <CardContent className="p-4 sm:p-5">
                          {/* File Header */}
                          <div className="mb-3">
                            <div className="flex items-center gap-2 mb-2">
                              <h3 className="font-medium text-sm text-gray-900">{file.originalName}</h3>
                              {processingFileId === file.id && (
                                <div className="flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs font-medium">
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                  Processing
                                </div>
                              )}
                            </div>

                            {/* File Metadata Row */}
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                {/* Duration - Prominent */}
                                <div className="flex items-center gap-1 text-sm font-medium text-gray-700">
                                  <Clock className="h-3 w-3" />
                                  {formatDuration(file.duration)}
                                </div>

                                {/* Speaker Count */}
                                {file.transcriptionStatus === 'completed' && (
                                  <div className="flex items-center gap-1 text-sm">
                                    {file.hasSpeakers && file.speakerCount > 0 ? (
                                      <span className="text-green-600">
                                        👥 {file.speakerCount} speaker{file.speakerCount !== 1 ? 's' : ''}
                                      </span>
                                    ) : file.diarizationStatus === 'failed' ? (
                                      <span className="text-orange-600 text-xs">
                                        👥 No speakers detected
                                      </span>
                                    ) : (
                                      <span className="text-gray-500 text-xs">
                                        👥 Single speaker
                                      </span>
                                    )}
                                  </div>
                                )}

                                {/* Recording Time */}
                                {file.recordedAt && (
                                  <div className="flex items-center gap-1 text-xs text-gray-500">
                                    <Clock3 className="h-3 w-3" />
                                    {formatRecordingTime(file.recordedAt)}
                                  </div>
                                )}
                              </div>

                              {/* Status Badge */}
                              <div className="flex items-center gap-2">
                                {getTranscriptionStatusIcon(file.transcriptionStatus)}
                                <Badge
                                  variant="secondary"
                                  className={getStatusColor(file.transcriptionStatus)}
                                >
                                  {file.transcriptionStatus}
                                </Badge>
                              </div>
                            </div>
                          </div>

                          {/* Labels */}
                          {file.labels && file.labels.length > 0 && (
                            <div className="mt-2">
                              <LabelBadge labels={file.labels} maxVisible={3} size="sm" />
                            </div>
                          )}

                          {/* AI Summaries - Clean Clickable Cards */}
                          {file.hasAiExtract && fileSummaries[file.id] && fileSummaries[file.id].length > 0 && (
                            <div className="mt-4 space-y-3">
                              <h4 className="text-sm font-medium text-gray-900 mb-3">
                                AI Summaries ({fileSummaries[file.id].length})
                              </h4>

                              {fileSummaries[file.id].map((summary: any, index: number) => (
                                <div
                                  key={summary.id}
                                  onClick={() => router.push(`/summary/${summary.id}`)}
                                  className="group relative p-4 bg-white border border-gray-100 rounded-lg cursor-pointer transition-all duration-200 hover:shadow-sm hover:border-gray-200"
                                >
                                  {/* Header with metadata */}
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs text-gray-500 font-medium">
                                        {formatRelativeDate(summary.createdAt)}
                                      </span>

                                      {summary.template && (
                                        <span className="text-xs text-gray-400 bg-gray-50 px-2 py-0.5 rounded">
                                          {summary.template.name}
                                        </span>
                                      )}

                                      {index === 0 && (
                                        <span className="text-xs text-gray-600 bg-gray-100 px-2 py-0.5 rounded font-medium">
                                          Latest
                                        </span>
                                      )}
                                    </div>

                                    {/* Delete action - only visible on hover */}
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteSummary(summary.id, file.id);
                                      }}
                                      disabled={deletingSummary === summary.id}
                                      className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-1 hover:bg-red-50 rounded text-gray-400 hover:text-red-600"
                                      title="Delete summary"
                                    >
                                      {deletingSummary === summary.id ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                      ) : (
                                        <Trash2 className="w-4 h-4" />
                                      )}
                                    </button>
                                  </div>

                                  {/* Summary preview */}
                                  <p className="text-sm text-gray-700 leading-relaxed">
                                    {summary.content.length > 120
                                      ? `${summary.content.substring(0, 120)}...`
                                      : summary.content
                                    }
                                  </p>

                                  {/* Subtle click indicator */}
                                  <div className="absolute inset-0 rounded-lg ring-1 ring-transparent group-hover:ring-gray-200 transition-all duration-200"></div>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Action Buttons */}
                          <div className="mt-5 pt-4 border-t border-gray-100">
                            {file.transcriptionStatus === 'completed' && (
                              <div className="space-y-3">
                                {/* Template Selection */}
                                <div className="space-y-2">
                                  <TemplateSelector
                                    templateType="summarization"
                                    selectedTemplateId={selectedTemplate?.id}
                                    onTemplateSelect={setSelectedTemplate}
                                    placeholder={file.hasAiExtract ? 'Choose template for new summary...' : 'Choose template for summary...'}
                                    size="sm"
                                    showManagement={true}
                                    onManagementClick={() => setIsTemplateModalOpen(true)}
                                    className="w-full"
                                  />

                                  {/* Generate Button */}
                                  <Button
                                    onClick={() => handleGenerateSummary(file.id)}
                                    disabled={processingFileId === file.id || !selectedTemplate}
                                    size="sm"
                                    className="w-full bg-gray-900 hover:bg-gray-800 text-white border-0"
                                  >
                                    {processingFileId === file.id ? (
                                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                    ) : (
                                      <FileText className="w-4 h-4 mr-2" />
                                    )}
                                    {processingFileId === file.id ?
                                      'Generating...' :
                                      (file.hasAiExtract ? 'Generate New Summary' : 'Generate Summary')
                                    }
                                  </Button>
                                </div>

                                {/* Multi-summary indicator */}
                                {file.hasAiExtract && (
                                  <p className="text-xs text-gray-400 text-center font-medium">
                                    Multiple summaries supported with different templates
                                  </p>
                                )}
                              </div>
                            )}

                            {/* Secondary Actions - Simplified */}
                            {file.hasTranscript && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => window.location.href = `/transcript/${file.id}`}>
                                    <FileText className="h-4 w-4 mr-2" />
                                    View Transcript
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </div>

                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}
        </div>
      </div>

      {/* Template Management Modal */}
      <TemplateManagementModal
        isOpen={isTemplateModalOpen}
        onOpenChange={setIsTemplateModalOpen}
        onTemplatesUpdated={handleTemplatesUpdated}
      />
    </div>
  );
}
