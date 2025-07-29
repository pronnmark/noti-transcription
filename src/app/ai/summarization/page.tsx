'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useMediaQuery } from '@/hooks/use-media-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Loader2,
  FileText,
  Clock,
  Calendar,
  Clock3,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { TelegramShareButton } from '@/components/ui/telegram-share-button';

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

interface SummaryItem {
  id: string;
  content: string;
  createdAt: string;
  // Add other summary properties as needed
}

interface _SummaryFile {
  id: number;
  fileName: string;
  originalFileName: string;
  summarizationStatus: string;
  summarizationContent: string | null;
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

interface DateGroupSummaryDotsProps {
  files: AudioFile[];
}

function DateGroupSummaryDots({ files }: DateGroupSummaryDotsProps) {
  return (
    <div className="ml-2 flex items-center gap-1">
      {files.map(file => (
        <div
          key={file.id}
          className={cn(
            'h-2 w-2 rounded-full',
            file.hasAiExtract && file.extractCount > 0
              ? 'bg-gray-800'
              : 'border border-gray-400 bg-transparent',
          )}
          title={`${file.originalName}: ${
            file.hasAiExtract && file.extractCount > 0
              ? `${file.extractCount} ${file.extractCount === 1 ? 'summary' : 'summaries'}`
              : 'No summaries'
          }`}
        />
      ))}
    </div>
  );
}

export default function SummarizationPage() {
  const router = useRouter();
  const isMobile = useMediaQuery('(max-width: 767px)');
  const [files, setFiles] = useState<AudioFile[]>([]);
  const [groupedFiles, setGroupedFiles] = useState<DateGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [fileSummaries, setFileSummaries] = useState<
    Record<string, SummaryItem[]>
  >({});
  const [sortBy, setSortBy] = useState<
    'date' | 'duration' | 'name' | 'speakers' | 'status' | 'labels'
  >('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [deletingSummary, setDeletingSummary] = useState<string | null>(null);

  // Sorting logic
  const sortFiles = useCallback(
    (files: AudioFile[]) => {
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
            const statusOrder = {
              completed: 4,
              processing: 3,
              pending: 2,
              failed: 1,
            };
            comparison =
              (statusOrder[a.transcriptionStatus as keyof typeof statusOrder] ||
                0) -
              (statusOrder[b.transcriptionStatus as keyof typeof statusOrder] ||
                0);
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
    },
    [sortBy, sortOrder],
  );

  const applySortingToGroups = useCallback(
    (groups: DateGroup[]) => {
      return groups.map(group => ({
        ...group,
        files: sortFiles(group.files),
      }));
    },
    [sortFiles],
  );

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
      } catch {
        // Error loading files - already shown via toast
      } finally {
        setLoading(false);
      }
    };

    loadFiles();
  }, [applySortingToGroups]); // Added missing dependency

  // Re-sort files when sort options change
  useEffect(() => {
    if (files.length > 0) {
      // Re-group and sort from original files data
      const groupedFiles = files.reduce(
        (groups, file) => {
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
        },
        {} as Record<string, DateGroup>,
      );

      const groupsArray = Object.values(groupedFiles).sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      );

      const sortedGroups = applySortingToGroups(groupsArray);
      setGroupedFiles(sortedGroups);
    }
  }, [sortBy, sortOrder, files, applySortingToGroups]); // Added missing dependency

  // Utility functions for formatting dates and times
  // Note: formatRecordingDate and formatRecordingTime functions removed as they are unused
  // They can be restored if needed for future functionality

  function formatDuration(seconds?: number) {
    if (!seconds) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  // Load summaries for all files that have them upfront
  const loadAllSummaries = async (files: AudioFile[]) => {
    const filesWithSummaries = files.filter(file => file.hasAiExtract);

    if (filesWithSummaries.length === 0) return;

    try {
      const summaryPromises = filesWithSummaries.map(async file => {
        const response = await fetch(`/api/summarization/${file.id}`);
        if (response.ok) {
          const data = await response.json();
          return { fileId: file.id, summaries: data.summarizations || [] };
        }
        return { fileId: file.id, summaries: [] };
      });

      const results = await Promise.all(summaryPromises);
      const summariesMap = results.reduce(
        (acc, result) => {
          acc[result.fileId] = result.summaries;
          return acc;
        },
        {} as Record<string, SummaryItem[]>,
      );

      setFileSummaries(summariesMap);
    } catch (_error) {
      // Error loading summaries - already shown via toast
    }
  };

  const formatRelativeDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffHours = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60 * 60),
    );

    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffHours < 48) return 'Yesterday';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const handleDeleteSummary = async (summaryId: string, fileId: string) => {
    const confirmed = window.confirm(
      'Are you sure you want to delete this summary? This action cannot be undone.',
    );

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
          [fileId]:
            prev[fileId]?.filter(summary => summary.id !== summaryId) || [],
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
    } catch (_error) {
      // Error deleting summary - already shown via toast
      toast.error('Failed to delete summary');
    } finally {
      setDeletingSummary(null);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div
      className={
        // Mobile: Full screen natural scrolling
        // Desktop: Fixed viewport height with internal scrolling
        isMobile ? 'min-h-screen' : 'h-full'
      }
    >
      {/* Header - Hidden on mobile as it's handled by responsive layout */}
      {!isMobile && (
        <div className="border-b p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="ios-title1 text-foreground">Summaries</h1>
              <p className="mt-2 text-sm font-light text-muted-foreground">
                View summaries from your recordings
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div
        className={cn(
          'flex-1',
          isMobile ? 'pb-safe p-4' : 'overflow-y-auto p-6',
        )}
      >
        {/* Sort Controls */}
        {(groupedFiles.length > 0 || files.length > 0) && (
          <div className="mb-6 rounded-lg border bg-gray-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <h3 className="text-sm font-medium text-gray-700">Sort by:</h3>
                <Select
                  value={sortBy}
                  onValueChange={(value: typeof sortBy) => setSortBy(value)}
                >
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

                <Select
                  value={sortOrder}
                  onValueChange={(value: typeof sortOrder) =>
                    setSortOrder(value)
                  }
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="desc">
                      {sortBy === 'date'
                        ? 'Newest First'
                        : sortBy === 'duration'
                          ? 'Longest First'
                          : sortBy === 'name'
                            ? 'Z-A'
                            : sortBy === 'speakers'
                              ? 'Most First'
                              : sortBy === 'labels'
                                ? 'Z-A'
                                : 'Completed First'}
                    </SelectItem>
                    <SelectItem value="asc">
                      {sortBy === 'date'
                        ? 'Oldest First'
                        : sortBy === 'duration'
                          ? 'Shortest First'
                          : sortBy === 'name'
                            ? 'A-Z'
                            : sortBy === 'speakers'
                              ? 'Fewest First'
                              : sortBy === 'labels'
                                ? 'A-Z'
                                : 'Pending First'}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="text-sm text-gray-600">
                {files.length} file{files.length !== 1 ? 's' : ''} •{' '}
                {Math.round(
                  files.reduce(
                    (total, file) => total + (file.duration || 0),
                    0,
                  ) / 60,
                )}{' '}
                min total
              </div>
            </div>
          </div>
        )}

        <div className="space-y-4">
          {groupedFiles.length === 0 && files.length === 0 ? (
            <Card className="py-12 text-center">
              <CardContent>
                <FileText className="mx-auto mb-4 h-12 w-12 text-gray-400" />
                <h3 className="mb-2 text-lg font-medium text-gray-900">
                  No files found
                </h3>
                <p className="mb-4 text-gray-600">
                  Upload audio files to start generating summaries
                </p>
                <Button onClick={() => (window.location.href = '/files')}>
                  Upload Files
                </Button>
              </CardContent>
            </Card>
          ) : (
            // Date-based Accordion Grouping
            <Accordion type="multiple" className="w-full">
              {groupedFiles.map(group => (
                <AccordionItem key={group.date} value={group.date}>
                  <AccordionTrigger className="min-h-[48px] touch-manipulation py-4 hover:no-underline">
                    <div className="flex w-full items-center justify-between pr-4">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        <span className="font-medium">{group.displayDate}</span>
                        {group.hasTimeData && (
                          <Clock3
                            className="h-3 w-3 text-blue-500"
                            aria-label="Contains recordings with specific times"
                          />
                        )}
                        <DateGroupSummaryDots files={group.files} />
                      </div>
                      <Badge variant="secondary" className="ml-auto">
                        {group.count} file{group.count !== 1 ? 's' : ''}
                      </Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-3">
                      {group.files.map(file => (
                        <Card
                          key={file.id}
                          className="touch-manipulation border-gray-100 bg-white transition-all duration-200 hover:shadow-sm"
                        >
                          <CardContent className="p-4 sm:p-5">
                            {/* File Header */}
                            <div className="mb-3">
                              <div className="mb-2 flex items-center gap-2">
                                <h3 className="text-sm font-medium text-gray-900">
                                  {file.originalName}
                                </h3>
                              </div>

                              {/* Simplified File Info */}
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  {/* Duration */}
                                  <div className="flex items-center gap-1 text-sm text-gray-600">
                                    <Clock className="h-3 w-3" />
                                    {formatDuration(file.duration)}
                                  </div>

                                  {/* Creation Date */}
                                  <div className="text-xs text-gray-500">
                                    {formatRelativeDate(
                                      file.recordedAt || file.createdAt,
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Summaries - Clean Clickable Cards */}
                            {file.hasAiExtract &&
                              fileSummaries[file.id] &&
                              fileSummaries[file.id].length > 0 && (
                              <div className="mt-4 space-y-3">
                                <h4 className="mb-3 text-sm font-medium text-gray-900">
                                    Summaries ({fileSummaries[file.id].length})
                                </h4>

                                {fileSummaries[file.id].map(
                                  (summary: SummaryItem, _index: number) => (
                                    <div
                                      key={summary.id}
                                      onClick={() =>
                                        router.push(`/summary/${summary.id}`)
                                      }
                                      className="group relative cursor-pointer rounded-lg border border-gray-100 bg-white p-4 transition-all duration-200 hover:border-gray-200 hover:shadow-sm"
                                    >
                                      {/* Header with actions */}
                                      <div className="mb-2 flex items-center justify-between">
                                        <div className="flex items-center gap-2 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                                          {/* Telegram share button */}
                                          <div
                                            onClick={e => e.stopPropagation()}
                                          >
                                            <TelegramShareButton
                                              fileId={parseInt(file.id)}
                                              fileName={file.originalName}
                                              content={summary.content}
                                              summarizationId={summary.id}
                                              size="sm"
                                              variant="ghost"
                                            />
                                          </div>
                                        </div>

                                        <div className="flex items-center gap-1">
                                          {/* Delete action - only visible on hover */}
                                          <button
                                            onClick={e => {
                                              e.stopPropagation();
                                              handleDeleteSummary(
                                                summary.id,
                                                file.id,
                                              );
                                            }}
                                            disabled={
                                              deletingSummary === summary.id
                                            }
                                            className="rounded p-1 text-gray-400 opacity-0 transition-opacity duration-200 hover:bg-red-50 hover:text-red-600 group-hover:opacity-100"
                                            title="Delete summary"
                                          >
                                            {deletingSummary ===
                                              summary.id ? (
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                              ) : (
                                                <Trash2 className="h-4 w-4" />
                                              )}
                                          </button>
                                        </div>
                                      </div>

                                      {/* Summary preview */}
                                      <p className="text-sm leading-relaxed text-gray-700">
                                        {summary.content.length > 120
                                          ? `${summary.content.substring(0, 120)}...`
                                          : summary.content}
                                      </p>

                                      {/* Subtle click indicator */}
                                      <div className="absolute inset-0 rounded-lg ring-1 ring-transparent transition-all duration-200 group-hover:ring-gray-200"></div>
                                    </div>
                                  ),
                                )}
                              </div>
                            )}

                            {/* Simple Actions */}
                            {file.hasTranscript && (
                              <div className="mt-4 border-t border-gray-100 pt-3">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    (window.location.href = `/transcript/${file.id}`)
                                  }
                                  className="w-full"
                                >
                                  <FileText className="mr-2 h-4 w-4" />
                                  View Transcript
                                </Button>
                              </div>
                            )}
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
    </div>
  );
}
