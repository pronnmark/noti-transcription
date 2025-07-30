'use client';

import { useState, useRef } from 'react';
import { Button } from './button';
import { Card, CardContent } from './card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './select';
import { Badge } from './badge';
import { Progress } from './progress';
import {
  FileAudio,
  Upload,
  X,
  CheckCircle,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface UploadResult {
  success: boolean;
  fileId?: number;
  fileName?: string;
  error?: string;
}

interface MultiFileUploadProps {
  onUploadComplete?: (results: UploadResult[]) => void;
  className?: string;
}

const SUPPORTED_FORMATS = [
  'flac',
  'm4a',
  'mp3',
  'mp4',
  'mpeg',
  'mpga',
  'oga',
  'ogg',
  'wav',
  'webm',
];

function getFileExtension(filename: string): string {
  return filename.toLowerCase().split('.').pop() || '';
}

function validateAudioFormat(file: File): { valid: boolean; error?: string } {
  const extension = getFileExtension(file.name);

  if (!SUPPORTED_FORMATS.includes(extension)) {
    return {
      valid: false,
      error: `Unsupported format: .${extension}`,
    };
  }

  return { valid: true };
}

export function MultiFileUpload({
  onUploadComplete,
  className,
}: MultiFileUploadProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [speakerCount, setSpeakerCount] = useState<number>(2);
  const [uploadResults, setUploadResults] = useState<UploadResult[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);

    // Validate all files
    const validFiles: File[] = [];
    const invalidFiles: string[] = [];

    files.forEach(file => {
      const validation = validateAudioFormat(file);
      if (validation.valid) {
        validFiles.push(file);
      } else {
        invalidFiles.push(`${file.name}: ${validation.error}`);
      }
    });

    if (invalidFiles.length > 0) {
      toast.error(`Invalid files:\n${invalidFiles.join('\n')}`);
    }

    if (validFiles.length > 0) {
      setSelectedFiles(prev => [...prev, ...validFiles]);
      toast.success(
        `Selected ${validFiles.length} valid audio file${validFiles.length > 1 ? 's' : ''}`
      );
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const clearAllFiles = () => {
    setSelectedFiles([]);
    setUploadResults([]);
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      toast.error('Please select at least one file');
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setUploadResults([]);

    try {
      const formData = new FormData();

      // Add all files
      selectedFiles.forEach(file => {
        formData.append('files', file);
      });

      // Add speaker count
      formData.append('speakerCount', speakerCount.toString());

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        toast.success(
          `Successfully uploaded ${result.successCount} of ${result.totalFiles} files`
        );
        if (result.failureCount > 0) {
          toast.warning(`${result.failureCount} files failed to upload`);
        }
        setUploadResults(result.results || []);
        onUploadComplete?.(result.results || []);

        // Clear files after successful upload
        setSelectedFiles([]);
      } else {
        throw new Error(result.error || 'Upload failed');
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast.error(
        `Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const formatFileSize = (bytes: number): string => {
    const mb = bytes / (1024 * 1024);
    if (mb >= 1) {
      return `${mb.toFixed(1)} MB`;
    }
    const kb = bytes / 1024;
    return `${kb.toFixed(1)} KB`;
  };

  return (
    <Card className={cn('w-full', className)}>
      <CardContent className='p-6'>
        <div className='space-y-4'>
          {/* Header */}
          <div className='flex items-center gap-2'>
            <Upload className='h-5 w-5 text-blue-600' />
            <h3 className='text-lg font-semibold'>Upload Multiple Files</h3>
          </div>

          {/* File Selection */}
          <div className='space-y-3'>
            <div className='flex items-center gap-4'>
              <Button
                type='button'
                variant='outline'
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className='flex items-center gap-2'
              >
                <FileAudio className='h-4 w-4' />
                Select Audio Files
              </Button>

              <div className='flex items-center gap-2'>
                <label htmlFor='speakerCount' className='text-sm font-medium'>
                  Speakers:
                </label>
                <Select
                  value={speakerCount.toString()}
                  onValueChange={value => setSpeakerCount(parseInt(value))}
                  disabled={uploading}
                >
                  <SelectTrigger className='w-20'>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 10 }, (_, i) => i + 1).map(num => (
                      <SelectItem key={num} value={num.toString()}>
                        {num}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <input
              ref={fileInputRef}
              type='file'
              multiple
              accept='.flac,.m4a,.mp3,.mp4,.mpeg,.mpga,.oga,.ogg,.wav,.webm'
              onChange={handleFileSelect}
              className='hidden'
            />

            <div className='text-sm text-muted-foreground'>
              Supported formats: {SUPPORTED_FORMATS.join(', ')}
            </div>
          </div>

          {/* Selected Files */}
          {selectedFiles.length > 0 && (
            <div className='space-y-3'>
              <div className='flex items-center justify-between'>
                <span className='text-sm font-medium'>
                  Selected Files ({selectedFiles.length})
                </span>
                <Button
                  variant='ghost'
                  size='sm'
                  onClick={clearAllFiles}
                  disabled={uploading}
                  className='text-red-600 hover:text-red-700'
                >
                  Clear All
                </Button>
              </div>

              <div className='max-h-48 space-y-2 overflow-y-auto'>
                {selectedFiles.map((file, index) => (
                  <div
                    key={`${file.name}-${index}`}
                    className='flex items-center justify-between rounded-lg bg-muted/30 p-3'
                  >
                    <div className='flex min-w-0 flex-1 items-center gap-3'>
                      <FileAudio className='h-4 w-4 flex-shrink-0 text-muted-foreground' />
                      <div className='min-w-0 flex-1'>
                        <div className='truncate text-sm font-medium'>
                          {file.name}
                        </div>
                        <div className='text-xs text-muted-foreground'>
                          {formatFileSize(file.size)} •{' '}
                          {getFileExtension(file.name).toUpperCase()}
                        </div>
                      </div>
                    </div>
                    <Button
                      variant='ghost'
                      size='sm'
                      onClick={() => removeFile(index)}
                      disabled={uploading}
                      className='h-8 w-8 flex-shrink-0 p-0'
                    >
                      <X className='h-4 w-4' />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Upload Progress */}
          {uploading && (
            <div className='space-y-2'>
              <div className='flex items-center gap-2'>
                <Loader2 className='h-4 w-4 animate-spin' />
                <span className='text-sm'>Uploading files...</span>
              </div>
              <Progress value={uploadProgress} className='h-2' />
            </div>
          )}

          {/* Upload Results */}
          {uploadResults.length > 0 && (
            <div className='space-y-2'>
              <h4 className='text-sm font-medium'>Upload Results</h4>
              <div className='space-y-1'>
                {uploadResults.map((result, index) => (
                  <div key={index} className='flex items-center gap-2 text-sm'>
                    {result.success ? (
                      <CheckCircle className='h-4 w-4 text-green-600' />
                    ) : (
                      <AlertCircle className='h-4 w-4 text-red-600' />
                    )}
                    <span className='flex-1 truncate'>{result.fileName}</span>
                    {result.success ? (
                      <Badge
                        variant='secondary'
                        className='bg-green-100 text-green-800'
                      >
                        Success
                      </Badge>
                    ) : (
                      <Badge variant='destructive'>Failed</Badge>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Upload Button */}
          <Button
            onClick={handleUpload}
            disabled={selectedFiles.length === 0 || uploading}
            className='w-full'
          >
            {uploading ? (
              <>
                <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                Uploading...
              </>
            ) : (
              <>
                <Upload className='mr-2 h-4 w-4' />
                Upload {selectedFiles.length} File
                {selectedFiles.length !== 1 ? 's' : ''}
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
