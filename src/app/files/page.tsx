'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { FileAudio, Plus, Loader2, Trash2, Download, MapPin, Smartphone, Tablet, Monitor } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useMediaQuery } from '@/hooks/use-media-query';
import { MultiFileUpload } from '@/components/ui/multi-file-upload';

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
  speakerCount?: number;
  diarizationStatus?:
    | 'not_attempted'
    | 'in_progress'
    | 'success'
    | 'failed'
    | 'no_speakers_detected';
  hasSpeakers?: boolean;
  latitude?: number;
  longitude?: number;
  locationAccuracy?: number;
  locationProvider?: string;
  deviceType?: string;
}

interface SummaryStatusProps {
  hasAiExtract: boolean;
  extractCount: number;
}

function SummaryStatus({ hasAiExtract, extractCount }: SummaryStatusProps) {
  if (!hasAiExtract || extractCount === 0) {
    // Hollow circle for no summaries
    return (
      <div className='flex items-center gap-1'>
        <div
          className='h-2 w-2 rounded-full border border-gray-400 bg-transparent'
          title='No summaries generated'
        />
      </div>
    );
  }

  // Filled circles for summaries - one per summary
  return (
    <div className='flex items-center gap-1'>
      {Array.from({ length: Math.min(extractCount, 5) }, (_, i) => (
        <div
          key={i}
          className='h-2 w-2 rounded-full bg-gray-800'
          title={`${extractCount} ${extractCount === 1 ? 'summary' : 'summaries'} generated`}
        />
      ))}
      {extractCount > 5 && (
        <span className='ml-1 text-xs text-gray-600'>+{extractCount - 5}</span>
      )}
    </div>
  );
}

function LocationDisplay({ file }: { file: AudioFile }) {
  const [locationText, setLocationText] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadLocation = async () => {
      if (!file.latitude || !file.longitude) {
        setIsLoading(false);
        return;
      }

      try {
        // Try to get city name using reverse geocoding
        const response = await fetch(
          `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${file.latitude}&longitude=${file.longitude}&localityLanguage=en`
        );
        
        if (response.ok) {
          const data = await response.json();
          const city = data.city || data.locality || data.principalSubdivision;
          const country = data.countryName;
          
          if (city && country) {
            const accuracy = file.locationAccuracy 
              ? ` (±${Math.round(file.locationAccuracy)}m)` 
              : '';
            setLocationText(`${city}, ${country}${accuracy}`);
            setIsLoading(false);
            return;
          }
        }
      } catch (error) {
        console.log('Geocoding failed, falling back to coordinates');
      }
      
      // Fallback to coordinates if geocoding fails
      const lat = file.latitude.toFixed(4);
      const lng = file.longitude.toFixed(4);
      const accuracy = file.locationAccuracy 
        ? ` (±${Math.round(file.locationAccuracy)}m)` 
        : '';
      
      setLocationText(`${lat}, ${lng}${accuracy}`);
      setIsLoading(false);
    };

    loadLocation();
  }, [file.latitude, file.longitude, file.locationAccuracy]);

  if (!file.latitude || !file.longitude) return null;

  return (
    <div className='flex items-center gap-1 text-xs text-gray-500'>
      <MapPin className='h-3 w-3' />
      <span title={`Location: ${locationText || 'Loading...'}\nProvider: ${file.locationProvider || 'unknown'}`}>
        {isLoading ? 'Loading...' : locationText}
      </span>
    </div>
  );
}

function DeviceTypeIcon({ deviceType }: { deviceType?: string }) {
  if (!deviceType || deviceType === 'unknown') return null;

  const getIcon = () => {
    switch (deviceType.toLowerCase()) {
      case 'mobile':
        return <Smartphone className='h-3 w-3' />;
      case 'tablet':
        return <Tablet className='h-3 w-3' />;
      case 'desktop':
        return <Monitor className='h-3 w-3' />;
      default:
        return null;
    }
  };

  const icon = getIcon();
  if (!icon) return null;

  return (
    <div className='flex items-center gap-1 text-xs text-gray-500'>
      {icon}
      <span title={`Device: ${deviceType}`}>
        {deviceType}
      </span>
    </div>
  );
}

export default function FilesPage() {
  const [files, setFiles] = useState<AudioFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const _isMobile = useMediaQuery('(max-width: 767px)');

  useEffect(() => {
    loadFiles();
    const interval = setInterval(loadFiles, 30000);
    return () => clearInterval(interval);
  }, []);

  async function loadFiles() {
    try {
      const response = await fetch('/api/files');
      if (response.ok) {
        const data = await response.json();
        setFiles(data.data?.files || []);
      } else {
        toast.error('Failed to load files');
        setFiles([]);
      }
    } catch (_error) {
      console.error('Failed to load files:', _error);
      toast.error('Failed to load files');
      setFiles([]);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleFileUpload(file: File) {
    setUploading(true);
    toast.info(`Uploading ${file.name}...`);

    const formData = new FormData();
    formData.append('audio', file);
    formData.append('speakerCount', '2'); // Default speaker count

    // Detect device type
    const getDeviceType = () => {
      const userAgent = navigator.userAgent.toLowerCase();
      const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
      const isTablet = /ipad|android(?!.*mobile)/i.test(userAgent) || 
                      (window.screen.width >= 768 && window.screen.width <= 1024);
      
      if (isTablet) return 'tablet';
      if (isMobile) return 'mobile';
      return 'desktop';
    };

    formData.append('deviceType', getDeviceType());

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (response.status === 409) {
        const duplicateData = await response.json();
        const shouldUpload = confirm(
          `File "${duplicateData.existingFile.originalFileName}" already exists.\n\nUpload anyway?`
        );

        if (shouldUpload) {
          formData.append('allowDuplicates', 'true');
          return handleFileUpload(file);
        } else {
          toast.info('Upload cancelled');
          return;
        }
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Upload failed');
      }

      toast.success(`${file.name} uploaded successfully`);
      await loadFiles();
    } catch (error) {
      toast.error(
        `Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    } finally {
      setUploading(false);
    }
  }

  async function handleDeleteFile(fileId: string, fileName: string) {
    if (!confirm(`Delete "${fileName}"? This cannot be undone.`)) return;

    setDeletingId(fileId);
    try {
      const response = await fetch(`/api/files/${fileId}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Delete failed');

      toast.success('File deleted');
      await loadFiles();
    } catch (error) {
      toast.error('Failed to delete file');
    } finally {
      setDeletingId(null);
    }
  }

  async function handleDownloadFile(fileId: string, fileName: string) {
    try {
      toast.info(`Preparing download for ${fileName}...`);
      
      // Verify download endpoint is accessible before opening
      const downloadUrl = `/api/files/${fileId}/download`;
      const response = await fetch(downloadUrl, { 
        method: 'HEAD',
        credentials: 'same-origin'
      });
      
      if (!response.ok) {
        // Handle specific error cases
        if (response.status === 404) {
          toast.error('File not found or no longer available');
        } else if (response.status === 500) {
          toast.error('Server error - unable to generate download link');
        } else if (response.status === 400) {
          toast.error('Invalid file - unable to download');
        } else {
          toast.error('Download failed - please try again');
        }
        return;
      }
      
      // Open download endpoint in new window/tab
      // The API will redirect to the signed URL for download
      window.open(downloadUrl, '_blank');
      
      toast.success(`Download started for ${fileName}`);
    } catch (error) {
      toast.error('Failed to initiate download');
      console.error('Download error:', error);
    }
  }

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };


  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const fileDate = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate()
    );

    if (fileDate.getTime() === today.getTime()) {
      return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
    }

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      ...(date.getFullYear() !== now.getFullYear() && { year: 'numeric' }),
    });
  };

  const getDateGroup = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const fileDate = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate()
    );

    if (fileDate.getTime() === today.getTime()) {
      return 'Today';
    } else if (fileDate.getTime() === yesterday.getTime()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
        ...(date.getFullYear() !== now.getFullYear() && { year: 'numeric' }),
      });
    }
  };

  // Group files by date
  const groupedFiles = files.reduce(
    (groups: Record<string, AudioFile[]>, file) => {
      const dateGroup = getDateGroup(file.recordedAt || file.createdAt);
      if (!groups[dateGroup]) {
        groups[dateGroup] = [];
      }
      groups[dateGroup].push(file);
      return groups;
    },
    {}
  );

  // Sort date groups (Today first, then Yesterday, then chronological)
  const sortedDateGroups = Object.keys(groupedFiles).sort((a, b) => {
    if (a === 'Today') return -1;
    if (b === 'Today') return 1;
    if (a === 'Yesterday') return -1;
    if (b === 'Yesterday') return 1;
    return new Date(b).getTime() - new Date(a).getTime();
  });

  if (isLoading) {
    return (
      <div className='flex h-screen items-center justify-center'>
        <Loader2 className='h-8 w-8 animate-spin text-gray-400' />
      </div>
    );
  }

  return (
    <div className='standard-page-bg'>
      <div className='safe-area-inset'>
        {/* Header */}
        <div className='standard-section-bg'>
          <div className='px-4 pb-4 pt-6'>
            <h1 className='text-2xl font-semibold text-gray-900'>Files</h1>
          </div>
        </div>

        {/* Content */}
        <div className='px-4 py-6'>
          {/* Multi-file Upload Component */}
          <div className='mb-6'>
            <MultiFileUpload
              onUploadComplete={results => {
                // Reload files after successful uploads
                const successCount = results.filter(r => r.success).length;
                if (successCount > 0) {
                  loadFiles();
                }
              }}
            />
          </div>

          {files.length === 0 ? (
            /* Empty State */
            <div className='py-20 text-center'>
              <div className='mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100'>
                <FileAudio className='h-8 w-8 text-gray-400' />
              </div>
              <h3 className='mb-2 text-lg font-medium text-gray-900'>
                No files yet
              </h3>
              <p className='mb-6 text-gray-500'>
                Upload your first audio file to get started
              </p>
            </div>
          ) : (
            /* Files List - Grouped by Date */
            <div className='space-y-6'>
              {sortedDateGroups.map(dateGroup => (
                <div key={dateGroup}>
                  {/* Date Header */}
                  <div className='mb-3 flex items-center'>
                    <h2 className='text-sm font-medium text-gray-600'>
                      {dateGroup}
                    </h2>
                    <div className='ml-3 flex-1 border-t border-gray-200' />
                  </div>

                  {/* Files for this date */}
                  <div className='space-y-2'>
                    {groupedFiles[dateGroup]
                      .sort(
                        (a, b) =>
                          new Date(b.recordedAt || b.createdAt).getTime() -
                          new Date(a.recordedAt || a.createdAt).getTime()
                      )
                      .map(file => (
                        <div
                          key={file.id}
                          className={cn(
                            'standard-card p-3',
                            file.transcriptionStatus === 'completed'
                              ? 'standard-card-hover cursor-pointer'
                              : ''
                          )}
                          onClick={() => {
                            if (file.transcriptionStatus === 'completed') {
                              window.location.href = `/transcript/${file.id}`;
                            }
                          }}
                        >
                          <div className='flex items-center justify-between'>
                            <div className='min-w-0 flex-1'>
                              <div className='flex items-center gap-2'>
                                <p className='truncate text-sm font-medium text-gray-900'>
                                  {file.originalName}
                                </p>
                                <SummaryStatus
                                  hasAiExtract={file.hasAiExtract || false}
                                  extractCount={file.extractCount || 0}
                                />
                              </div>
                              <div className='mt-1 flex items-center gap-3'>
                                <span className='text-xs text-gray-500'>
                                  {formatDate(
                                    file.recordedAt || file.createdAt
                                  )}
                                </span>
                                {file.duration && (
                                  <span className='text-xs text-gray-500'>
                                    {formatDuration(file.duration)}
                                  </span>
                                )}
                                <LocationDisplay file={file} />
                                <DeviceTypeIcon deviceType={file.deviceType} />
                                {file.transcriptionStatus === 'processing' && (
                                  <span className='text-xs text-blue-600'>
                                    Processing...
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className='flex items-center gap-1'>
                              <Button
                                size='sm'
                                variant='ghost'
                                className='h-8 w-8 p-0 text-gray-400 hover:text-blue-600'
                                onClick={e => {
                                  e.stopPropagation();
                                  handleDownloadFile(file.id, file.originalName);
                                }}
                                title={`Download ${file.originalName}`}
                              >
                                <Download className='h-3 w-3' />
                              </Button>
                              <Button
                                size='sm'
                                variant='ghost'
                                className='h-8 w-8 p-0 text-gray-400 hover:text-red-600'
                                onClick={e => {
                                  e.stopPropagation();
                                  handleDeleteFile(file.id, file.originalName);
                                }}
                                disabled={deletingId === file.id}
                                title={`Delete ${file.originalName}`}
                              >
                                {deletingId === file.id ? (
                                  <Loader2 className='h-3 w-3 animate-spin' />
                                ) : (
                                  <Trash2 className='h-3 w-3' />
                                )}
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Bottom Padding for Floating Button */}
          <div className='h-20' />
        </div>
      </div>

      {/* Floating Upload Button */}
      <div className='fixed bottom-20 right-4 z-50 md:bottom-6'>
        <label className='relative block'>
          <Button
            size='icon'
            className={cn(
              'h-14 w-14 rounded-full shadow-lg hover:shadow-xl',
              'bg-blue-600 text-white hover:bg-blue-700',
              'transition-all duration-200 active:scale-95',
              'flex items-center justify-center',
              uploading && 'pointer-events-none opacity-75'
            )}
            disabled={uploading}
            asChild
          >
            <span>
              {uploading ? (
                <Loader2 className='h-6 w-6 animate-spin' />
              ) : (
                <Plus className='h-6 w-6' />
              )}
            </span>
          </Button>
          <input
            type='file'
            accept='audio/*,.m4a,.mp3,.wav,.aac,.ogg,.flac'
            onChange={e => {
              const file = e.target.files?.[0];
              if (file) {
                handleFileUpload(file);
                e.target.value = '';
              }
            }}
            className='absolute inset-0 h-full w-full cursor-pointer opacity-0'
            disabled={uploading}
          />
        </label>
      </div>
    </div>
  );
}
