'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { UnibodyCard } from '@/components/ui/unibody-card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RecordingCalendar } from '@/components/ui/recording-calendar';
import { MobileFileCard } from '@/components/ui/mobile-file-card';
import { Upload, FileAudio, Loader2, Plus, Calendar, Clock, Mic, TrendingUp, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useMediaQuery } from '@/hooks/use-media-query';

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

interface DashboardStats {
  totalFiles: number;
  totalDuration: number;
  thisMonthFiles: number;
  completedTranscriptions: number;
  recordingDates: string[];
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    totalFiles: 0,
    totalDuration: 0,
    thisMonthFiles: 0,
    completedTranscriptions: 0,
    recordingDates: []
  });
  const [recentFiles, setRecentFiles] = useState<AudioFile[]>([]);
  const [selectedDateFiles, setSelectedDateFiles] = useState<AudioFile[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploadingFiles, setIsUploadingFiles] = useState<Set<string>>(new Set());
  const [speakerCount, setSpeakerCount] = useState<number>(2);
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
        
        // Extract unique recording dates
        const dateSet = new Set<string>();
        files.forEach(file => {
          const date = file.recordedAt || file.createdAt;
          if (date) {
            const dateStr = new Date(date).toISOString().split('T')[0];
            dateSet.add(dateStr);
          }
        });
        
        setStats({
          totalFiles,
          totalDuration,
          thisMonthFiles,
          completedTranscriptions,
          recordingDates: Array.from(dateSet)
        });
        
        // Set recent files (last 5)
        const sortedFiles = [...files].sort((a, b) => 
          new Date(b.recordedAt || b.createdAt).getTime() - new Date(a.recordedAt || a.createdAt).getTime()
        );
        setRecentFiles(sortedFiles.slice(0, 5));
        
      } else {
        toast.error('Failed to load dashboard data');
      }
    } catch (error) {
      console.error('Dashboard load error:', error);
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
      console.error('Date files load error:', error);
      toast.error('Failed to load files for selected date');
      setSelectedDateFiles([]);
    }
  }

  async function handleFileUpload(file: File) {
    toast.info(`Starting upload for ${file.name}...`);
    
    const tempId = Math.random().toString();
    setIsUploadingFiles(prev => new Set(prev).add(tempId));
    
    const formData = new FormData();
    formData.append('audio', file);
    formData.append('speakerCount', speakerCount.toString());

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (response.status === 409) {
        // Handle duplicate file
        const duplicateData = await response.json();
        const existingFile = duplicateData.existingFile;
        
        const shouldUpload = confirm(
          `This file already exists (uploaded ${new Date(existingFile.uploadedAt).toLocaleDateString()})\n\n` +
          `Do you want to upload anyway?`
        );
        
        if (shouldUpload) {
          formData.append('allowDuplicates', 'true');
          return handleFileUpload(file);
        } else {
          toast.info(`Upload cancelled - ${file.name} already exists`);
          return;
        }
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Upload failed');
      }

      toast.success(`${file.name} uploaded successfully!`);
      await loadDashboardData(); // Refresh dashboard data
    } catch (error) {
      toast.error(`Failed to upload ${file.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      console.error('Upload error:', error);
    } finally {
      setIsUploadingFiles(prev => {
        const newSet = new Set(prev);
        newSet.delete(tempId);
        return newSet;
      });
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (files && files.length > 0) {
      Array.from(files).forEach(file => {
        handleFileUpload(file);
      });
    }
    e.target.value = '';
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
      {/* Header - Hidden on mobile */}
      {!isMobile && (
        <div className="border-b buzz-header-desktop">
          <h1 className="text-3xl font-semibold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-2 text-base">Overview of your recordings and transcriptions</p>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        <div className={cn(
          "h-full overflow-y-auto",
          isMobile ? "px-4 py-6 buzz-section-gap flex flex-col" : "p-6 buzz-section-gap flex flex-col"
        )}>
          
          {/* Welcome Section */}
          <UnibodyCard className="py-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 rounded-xl">
                <Mic className="h-6 w-6 text-blue-600" />
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-gray-900">Welcome back!</h2>
                <p className="text-sm text-gray-600 mt-0.5">
                  You have {stats.totalFiles} recordings with {formatDuration(stats.totalDuration)} of total content
                </p>
              </div>
            </div>
          </UnibodyCard>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 gap-4">
            <UnibodyCard className="py-3">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{stats.thisMonthFiles}</div>
                <div className="text-xs text-gray-600 mt-1">This month</div>
              </div>
            </UnibodyCard>
            <UnibodyCard className="py-3">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{stats.completedTranscriptions}</div>
                <div className="text-xs text-gray-600 mt-1">Transcribed</div>
              </div>
            </UnibodyCard>
          </div>

          {/* Quick Upload */}
          <UnibodyCard className="py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-green-50 rounded-lg">
                  <Upload className="h-4 w-4 text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">Quick Upload</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <label className="text-xs text-gray-500">Speakers:</label>
                    <Select value={speakerCount.toString()} onValueChange={(value) => setSpeakerCount(parseInt(value))}>
                      <SelectTrigger className="w-14 h-6 text-xs border-gray-200">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[1,2,3,4,5,6,7,8,9,10].map(num => (
                          <SelectItem key={num} value={num.toString()}>{num}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              
              <Button 
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-xl font-medium relative"
                disabled={isUploadingFiles.size > 0}
              >
                {isUploadingFiles.size > 0 ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Files
                  </>
                )}
                <input
                  type="file"
                  accept="audio/*,.m4a,.mp3,.wav,.aac,.ogg,.flac,.wma,.amr"
                  onChange={handleFileSelect}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  disabled={isUploadingFiles.size > 0}
                  multiple
                />
              </Button>
            </div>
          </UnibodyCard>

          {/* Calendar Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-blue-600" />
              <h3 className="text-lg font-semibold text-gray-900">Recording Calendar</h3>
            </div>
            
            <RecordingCalendar
              recordingDates={stats.recordingDates}
              onDateSelect={handleDateSelect}
            />
          </div>

          {/* Recent Files */}
          {recentFiles.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-purple-600" />
                  <h3 className="text-lg font-semibold text-gray-900">Recent Recordings</h3>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => window.location.href = '/files'}
                  className="text-blue-600"
                >
                  View All
                </Button>
              </div>
              
              <div className="space-y-3">
                {recentFiles.map((file) => (
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
            </div>
          )}
        </div>
      </div>

      {/* Date Files Modal */}
      {showDateModal && selectedDate && (
        <div className="fixed inset-0 bg-black/50 flex items-end justify-center p-0 z-50 sm:items-center sm:p-4">
          <div className={cn(
            "bg-white w-full max-h-[80vh] overflow-hidden flex flex-col",
            isMobile 
              ? "rounded-t-2xl" 
              : "rounded-2xl max-w-2xl border border-gray-200 shadow-2xl"
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
    </div>
  );
}