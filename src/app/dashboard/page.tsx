'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { RecordingCalendar } from '@/components/ui/recording-calendar';
import { Calendar, X, Loader2, FileAudio } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useMediaQuery } from '@/hooks/use-media-query';
import { MobileFileCard } from '@/components/ui/mobile-file-card';

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
  speakerCount?: number;
  diarizationStatus?: 'not_attempted' | 'in_progress' | 'success' | 'failed' | 'no_speakers_detected';
  hasSpeakers?: boolean;
  diarizationError?: string;
}

interface DashboardStats {
  totalFiles: number;
  totalDuration: number;
  thisMonthFiles: number;
  completedTranscriptions: number;
  recordingDates: string[];
}

export default function DashboardPage() {
  const [recordingDates, setRecordingDates] = useState<string[]>([]);
  const [dateFileCounts, setDateFileCounts] = useState<Record<string, number>>({});
  const [selectedDateFiles, setSelectedDateFiles] = useState<AudioFile[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showDateModal, setShowDateModal] = useState(false);
  const isMobile = useMediaQuery('(max-width: 767px)');

  useEffect(() => {
    loadDashboardData();
  }, []);

  async function loadDashboardData() {
    try {
      // Load files and extract dashboard stats
      const response = await fetch('/api/files?includeDates=true');
      if (response.ok) {
        const data = await response.json();
        const files: AudioFile[] = data.files || [];

        // Dashboard data loaded successfully

        // Calculate stats
        const totalFiles = files.length;
        const totalDuration = files.reduce((sum, file) => sum + (file.duration || 0), 0);
        const completedTranscriptions = files.filter(file => file.transcriptionStatus === 'completed').length;

        // Files from this month
        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();
        const thisMonthFiles = files.filter(file => {
          const fileDate = new Date(file.recordedAt || file.createdAt);
          return fileDate.getMonth() === currentMonth && fileDate.getFullYear() === currentYear;
        }).length;

        // Dashboard stats calculated

        // State will be updated with calculated stats

        // Extract unique recording dates and count files per date
        const dateSet = new Set<string>();
        const fileCounts: Record<string, number> = {};

        files.forEach(file => {
          const date = file.recordedAt || file.createdAt;
          if (date) {
            const dateStr = new Date(date).toISOString().split('T')[0];
            dateSet.add(dateStr);
            fileCounts[dateStr] = (fileCounts[dateStr] || 0) + 1;
          }
        });

        setRecordingDates(Array.from(dateSet));
        setDateFileCounts(fileCounts);

      } else {
        toast.error('Failed to load dashboard data');
      }
    } catch (error) {
      // Dashboard load error - already shown via toast
      toast.error('Failed to load dashboard data');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDateSelect(date: string) {
    setSelectedDate(date);
    setShowDateModal(true);

    try {
      // Load files for the selected date
      const response = await fetch(`/api/files?date=${date}`);
      if (response.ok) {
        const data = await response.json();
        setSelectedDateFiles(data.files || []);
      } else {
        toast.error('Failed to load files for selected date');
        setSelectedDateFiles([]);
      }
    } catch (error) {
      // Date files load error - already shown via toast
      toast.error('Failed to load files for selected date');
      setSelectedDateFiles([]);
    }
  }

  function formatDuration(seconds: number) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  }

  function formatDate(dateString: string) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
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
    <>
      <div className="min-h-full">
        <div className={cn(
          'overflow-y-auto min-h-screen',
          isMobile ? 'px-4 py-6 space-y-6' : 'p-6 space-y-6',
        )}>
          {/* Header - Now part of scrollable content */}
          <div className={cn(
            'space-y-2 mb-8',
            !isMobile && 'buzz-header-desktop',
          )}>
            <h1 className="text-3xl font-semibold text-foreground">Dashboard</h1>
            <p className="text-muted-foreground text-base">Recording calendar</p>
          </div>

          {/* Calendar Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-blue-600" />
              <h3 className="text-lg font-semibold text-gray-900">Recording Calendar</h3>
            </div>

            <RecordingCalendar
              recordingDates={recordingDates}
              dateFileCounts={dateFileCounts}
              onDateSelect={handleDateSelect}
            />
          </div>

        </div>
      </div>

      {/* Date Files Modal */}
      {showDateModal && selectedDate && (
        <div className="fixed inset-0 bg-black/50 flex items-end justify-center p-0 z-50 sm:items-center sm:p-4">
          <div className={cn(
            'bg-white w-full max-h-[80vh] overflow-hidden flex flex-col',
            isMobile
              ? 'rounded-t-2xl'
              : 'standard-modal max-w-2xl',
          )}>
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {formatDate(selectedDate)}
                </h3>
                <p className="text-sm text-gray-600">
                  {selectedDateFiles.length} recording{selectedDateFiles.length !== 1 ? 's' : ''}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowDateModal(false)}
                className="h-8 w-8 p-0"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* Files List */}
            <div className="flex-1 overflow-y-auto p-4">
              {selectedDateFiles.length === 0 ? (
                <div className="text-center py-8">
                  <FileAudio className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No recordings found for this date</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {selectedDateFiles.map((file) => (
                    <MobileFileCard
                      key={file.id}
                      file={file}
                      onExtract={() => {}}
                      onDelete={() => {}}
                      onRename={() => {}}
                      onLabelsUpdate={() => {}}
                      isExtracting={false}
                      isDeleting={false}
                      showActions={false}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
