'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { FileAudio, Plus, Loader2, Trash2, Download, MapPin, Smartphone, Tablet, Monitor, Clock, Edit3, Sparkles, Zap } from 'lucide-react';
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
  const router = useRouter();
  const [files, setFiles] = useState<AudioFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const _isMobile = useMediaQuery('(max-width: 767px)');

  // Debounced file loading to prevent rapid successive calls
  const [loadFilesTimeout, setLoadFilesTimeout] = useState<NodeJS.Timeout | null>(null);

  const debouncedLoadFiles = () => {
    if (loadFilesTimeout) {
      clearTimeout(loadFilesTimeout);
    }
    const timeout = setTimeout(() => {
      loadFiles();
    }, 300); // 300ms debounce
    setLoadFilesTimeout(timeout);
  };

  useEffect(() => {
    loadFiles();
    // Reduce polling to 2 minutes instead of 30 seconds
    const interval = setInterval(loadFiles, 120000);
    return () => {
      clearInterval(interval);
    };
  }, []);

  // Cleanup debounce timeout on unmount
  useEffect(() => {
    return () => {
      if (loadFilesTimeout) clearTimeout(loadFilesTimeout);
    };
  }, [loadFilesTimeout]);

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
      debouncedLoadFiles();
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
      debouncedLoadFiles();
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

  async function handleAutoRenameAll() {
    const transcribedFiles = files.filter(f => f.transcriptionStatus === 'completed' && !f.originalName.includes('_AI_'));
    
    if (transcribedFiles.length === 0) {
      toast.error('No files available for auto-rename');
      return;
    }

    const confirmed = window.confirm(`Auto-rename ${transcribedFiles.length} transcribed files? This will process them one by one.`);
    if (!confirmed) return;

    let successCount = 0;
    let errorCount = 0;

    for (const file of transcribedFiles) {
      try {
        setRenamingId(file.id);
        
        const response = await fetch(`/api/files/${file.id}/rename`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            useAI: true,
            options: { maxLength: 50, includeDate: false }
          })
        });

        if (response.ok) {
          successCount++;
          await new Promise(resolve => setTimeout(resolve, 1000)); // Rate limiting delay
        } else {
          errorCount++;
        }
      } catch (error) {
        errorCount++;
      }
    }

    setRenamingId(null);
    
    if (successCount > 0) {
      toast.success(`✨ Auto-renamed ${successCount} files successfully!`);
      debouncedLoadFiles();
    }
    if (errorCount > 0) {
      toast.error(`Failed to rename ${errorCount} files`);
    }
  }

  async function handleRenameFile(fileId: string, fileName: string) {
    if (renamingId === fileId) return; // Already processing

    setRenamingId(fileId);
    
    try {
      toast.info(`🤖 AI analyzing transcript...`, { duration: 2000 });
      
      // Call the rename API with enhanced options
      const response = await fetch(`/api/files/${fileId}/rename`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          options: {
            maxLength: 60,
            includeFileExtension: true,
            includeDatePrefix: false,
            generateAlternatives: false, // Just get the best suggestion
          },
          userId: 'current_user', // In production, get from auth
          metadata: {
            source: 'files_page',
            originalAction: 'quick_rename'
          }
        }),
      });

      const result = await response.json();

      // Enhanced error handling with specific error codes
      if (!response.ok || !result.success) {
        const errorCode = result.errorCode || 'UNKNOWN_ERROR';
        const errorMessage = result.error || 'Rename failed';
        
        // Handle specific error cases with user-friendly messages
        switch (errorCode) {
          case 'NO_TRANSCRIPT':
            toast.error('Cannot rename: file needs to be transcribed first');
            break;
          case 'RATE_LIMIT_EXCEEDED':
            toast.error('Too many rename requests. Please wait a minute.');
            break;
          case 'TRANSCRIPT_TOO_SHORT':
            toast.error('Transcript too short to generate meaningful name');
            break;
          case 'AI_SERVICE_UNAVAILABLE':
            toast.error('AI service temporarily unavailable. Try again later.');
            break;
          case 'AUTH_ERROR':
            toast.error('AI service not configured. Please check settings.');
            break;
          case 'CONTENT_FILTERED':
            toast.error('Content was filtered by AI safety policies');
            break;
          case 'DATABASE_ERROR':
            toast.error('Failed to save new filename. Please try again.');
            break;
          default:
            toast.error(`Rename failed: ${errorMessage}`);
        }
        
        console.error(`[Rename] Error ${errorCode}:`, errorMessage, result);
        return;
      }
      
      // Success handling with enhanced feedback
      const { newName, confidence, reasoning, wasRenamed, processingTime, metadata } = result;
      
      // Show success message with details
      let successMessage = `✨ Renamed to: ${newName}`;
      
      // Add confidence indicator
      if (confidence !== undefined) {
        const confidencePercent = Math.round(confidence * 100);
        if (confidencePercent >= 80) {
          successMessage = `✨ High confidence rename: ${newName}`;
        } else if (confidencePercent >= 60) {
          successMessage = `✨ Renamed to: ${newName} (${confidencePercent}% confidence)`;
        } else {
          successMessage = `⚠️ Low confidence rename: ${newName}`;
        }
      }
      
      // Show conflict resolution info
      if (wasRenamed) {
        successMessage += ` (renamed to avoid conflicts)`;
      }
      
      // Show cache hit info in dev mode
      if (process.env.NODE_ENV === 'development' && metadata?.cacheHit) {
        successMessage += ` (cached result)`;
      }
      
      toast.success(successMessage, { 
        duration: confidence && confidence < 0.6 ? 6000 : 4000 // Longer duration for low confidence
      });
      
      // Show reasoning if available (in a subtle way)
      if (reasoning && process.env.NODE_ENV === 'development') {
        console.log(`[Rename] AI reasoning: ${reasoning}`);
      }
      
      // Log performance info in dev mode
      if (process.env.NODE_ENV === 'development' && processingTime) {
        console.log(`[Rename] Processing time: ${processingTime}ms, Cache hit: ${metadata?.cacheHit || false}`);
      }
      
      // Reload files to show the new name
      debouncedLoadFiles();
      
    } catch (error) {
      console.error('Rename request failed:', error);
      
      // Network or parsing errors
      if (error instanceof TypeError && error.message.includes('fetch')) {
        toast.error('Network error. Please check your connection.');
      } else if (error instanceof SyntaxError) {
        toast.error('Server response error. Please try again.');
      } else if (error instanceof Error) {
        toast.error(`Unexpected error: ${error.message}`);
      } else {
        toast.error('Failed to rename file. Please try again.');
      }
    } finally {
      setRenamingId(null);
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
            <div className='flex items-center justify-between'>
              <h1 className='text-2xl font-semibold text-gray-900'>Files</h1>
              
              {/* Auto-rename button - only show if there are transcribed files */}
              {files.some(f => f.transcriptionStatus === 'completed' && !f.originalName.includes('_AI_')) && (
                <Button
                  size='sm'
                  variant='outline'
                  className='gap-2 text-purple-600 border-purple-200 hover:bg-purple-50'
                  onClick={handleAutoRenameAll}
                  disabled={!!renamingId}
                  title='Auto-rename all transcribed files using AI'
                >
                  {renamingId ? (
                    <Loader2 className='h-4 w-4 animate-spin' />
                  ) : (
                    <Zap className='h-4 w-4' />
                  )}
                  Auto Rename
                </Button>
              )}
            </div>
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
                  debouncedLoadFiles();
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
            <div className='space-y-8'>
              {sortedDateGroups.map(dateGroup => (
                <div key={dateGroup}>
                  {/* Date Header */}
                  <div className='mb-4 flex items-center'>
                    <h2 className='text-lg font-semibold text-gray-900'>
                      {dateGroup}
                    </h2>
                    <div className='ml-4 flex-1 border-t border-gray-200' />
                    <span className='ml-4 text-sm text-gray-500'>
                      {groupedFiles[dateGroup].length} file{groupedFiles[dateGroup].length !== 1 ? 's' : ''}
                    </span>
                  </div>

                  {/* Files Grid for this date */}
                  <div className='grid gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'>
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
                            'group relative rounded-md border border-gray-200 bg-white p-2 shadow-sm transition-all hover:shadow-md',
                            file.transcriptionStatus === 'completed'
                              ? 'cursor-pointer hover:border-blue-300'
                              : 'hover:border-gray-300'
                          )}
                          onClick={() => {
                            if (file.transcriptionStatus === 'completed') {
                              router.push(`/transcript/${file.id}`);
                            }
                          }}
                        >
                          {/* Status indicator */}
                          <div className='absolute right-1 top-1 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity'>
                            {file.transcriptionStatus === 'completed' && (
                              <Button
                                size='sm'
                                variant='ghost'
                                className='h-6 w-6 p-0 text-gray-400 hover:text-purple-600'
                                onClick={e => {
                                  e.stopPropagation();
                                  handleRenameFile(file.id, file.originalName);
                                }}
                                disabled={renamingId === file.id}
                                title={`AI Rename ${file.originalName}`}
                              >
                                {renamingId === file.id ? (
                                  <Loader2 className='h-2.5 w-2.5 animate-spin' />
                                ) : (
                                  <Sparkles className='h-2.5 w-2.5' />
                                )}
                              </Button>
                            )}
                            <Button
                              size='sm'
                              variant='ghost'
                              className='h-6 w-6 p-0 text-gray-400 hover:text-blue-600'
                              onClick={e => {
                                e.stopPropagation();
                                handleDownloadFile(file.id, file.originalName);
                              }}
                              title={`Download ${file.originalName}`}
                            >
                              <Download className='h-2.5 w-2.5' />
                            </Button>
                            <Button
                              size='sm'
                              variant='ghost'
                              className='h-6 w-6 p-0 text-gray-400 hover:text-red-600'
                              onClick={e => {
                                e.stopPropagation();
                                handleDeleteFile(file.id, file.originalName);
                              }}
                              disabled={deletingId === file.id}
                              title={`Delete ${file.originalName}`}
                            >
                              {deletingId === file.id ? (
                                <Loader2 className='h-2.5 w-2.5 animate-spin' />
                              ) : (
                                <Trash2 className='h-2.5 w-2.5' />
                              )}
                            </Button>
                          </div>

                          {/* File Icon */}
                          <div className='mb-2 flex items-center justify-center'>
                            <div className='flex h-8 w-8 items-center justify-center rounded-md bg-blue-50'>
                              <FileAudio className='h-4 w-4 text-blue-600' />
                            </div>
                          </div>

                          {/* File Name */}
                          <h3 className='mb-1 text-xs font-medium text-gray-900 pr-6 overflow-hidden text-center' style={{display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical'}}>
                            {file.originalName}
                          </h3>

                          {/* File Details */}
                          <div className='space-y-0.5 text-xs text-gray-500'>
                            <div className='flex items-center justify-center gap-1'>
                              <span className='text-xs'>{formatDate(file.recordedAt || file.createdAt)}</span>
                              {file.duration && (
                                <span className='font-medium text-xs'>
                                  • {formatDuration(file.duration)}
                                </span>
                              )}
                            </div>
                            
                            <div className='flex items-center justify-center gap-1'>
                              <SummaryStatus
                                hasAiExtract={file.hasAiExtract || false}
                                extractCount={file.extractCount || 0}
                              />
                              {file.transcriptionStatus === 'processing' && (
                                <div className='flex items-center gap-1'>
                                  <div className='h-1.5 w-1.5 animate-pulse rounded-full bg-blue-500' />
                                  <span className='text-xs text-blue-600'>
                                    Processing
                                  </span>
                                </div>
                              )}
                            </div>
                            
                            <div className='flex items-center justify-center gap-2 text-xs'>
                              <LocationDisplay file={file} />
                              <DeviceTypeIcon deviceType={file.deviceType} />
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
