import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { useFileValidation } from './useFileValidation';

export interface UploadResult {
  success: boolean;
  fileId?: number;
  fileName?: string;
  message?: string;
  duration?: number;
  error?: string;
  duplicateInfo?: any;
}

export interface UploadResponse {
  totalFiles: number;
  successCount: number;
  failureCount: number;
  results: UploadResult[];
  speakerCount?: number;
  speakerDetection?: string;
  locationCaptured?: boolean;
}

export interface UploadOptions {
  speakerCount?: number;
  includeLocation?: boolean;
}

/**
 * Custom hook for file upload functionality
 * Handles the upload process, progress tracking, and result management
 */
export function useFileUpload() {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadResults, setUploadResults] = useState<UploadResult[]>([]);
  
  const { validateFiles } = useFileValidation();

  const addFiles = useCallback(
    (files: File[]) => {
      const { validFiles, invalidFiles } = validateFiles(files);

      if (invalidFiles.length > 0) {
        const errorMessages = invalidFiles.map(
          ({ file, error }) => `${file.name}: ${error}`
        );
        toast.error(`Invalid files:\n${errorMessages.join('\n')}`);
      }

      if (validFiles.length > 0) {
        setSelectedFiles(prev => [...prev, ...validFiles]);
        toast.success(
          `Selected ${validFiles.length} valid audio file${
            validFiles.length > 1 ? 's' : ''
          }`
        );
      }

      return { validFiles, invalidFiles };
    },
    [validateFiles]
  );

  const removeFile = useCallback((index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

  const clearAllFiles = useCallback(() => {
    setSelectedFiles([]);
    setUploadResults([]);
  }, []);

  const getCurrentLocation = useCallback((): Promise<GeolocationPosition | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve(null);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => resolve(position),
        (error) => {
          console.warn('Failed to get location:', error);
          resolve(null);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000, // 5 minutes
        }
      );
    });
  }, []);

  const uploadFiles = useCallback(
    async (options: UploadOptions = {}): Promise<UploadResponse | null> => {
      if (selectedFiles.length === 0) {
        toast.error('Please select at least one file');
        return null;
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

        // Add speaker count if specified
        if (options.speakerCount) {
          formData.append('speakerCount', options.speakerCount.toString());
        }

        // Add location data if requested
        if (options.includeLocation) {
          const location = await getCurrentLocation();
          if (location) {
            formData.append('latitude', location.coords.latitude.toString());
            formData.append('longitude', location.coords.longitude.toString());
            formData.append('locationAccuracy', location.coords.accuracy.toString());
            formData.append('locationTimestamp', location.timestamp.toString());
            formData.append('locationProvider', 'browser');
          }
        }

        // Simulate progress updates
        const progressInterval = setInterval(() => {
          setUploadProgress(prev => Math.min(prev + 10, 90));
        }, 200);

        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        clearInterval(progressInterval);
        setUploadProgress(100);

        if (!response.ok) {
          throw new Error(`Upload failed: ${response.status}`);
        }

        const result: UploadResponse = await response.json();
        setUploadResults(result.results);

        // Show success/failure messages
        if (result.successCount > 0) {
          toast.success(
            `Successfully uploaded ${result.successCount} file${
              result.successCount > 1 ? 's' : ''
            }`
          );
        }

        if (result.failureCount > 0) {
          toast.error(
            `Failed to upload ${result.failureCount} file${
              result.failureCount > 1 ? 's' : ''
            }`
          );
        }

        return result;
      } catch (error) {
        console.error('Upload error:', error);
        toast.error(
          error instanceof Error
            ? `Upload failed: ${error.message}`
            : 'Upload failed. Please try again.'
        );
        return null;
      } finally {
        setUploading(false);
        setUploadProgress(0);
      }
    },
    [selectedFiles, getCurrentLocation]
  );

  const resetUpload = useCallback(() => {
    setSelectedFiles([]);
    setUploadResults([]);
    setUploadProgress(0);
    setUploading(false);
  }, []);

  return {
    // State
    selectedFiles,
    uploading,
    uploadProgress,
    uploadResults,

    // Actions
    addFiles,
    removeFile,
    clearAllFiles,
    uploadFiles,
    resetUpload,

    // Computed values
    hasFiles: selectedFiles.length > 0,
    fileCount: selectedFiles.length,
  };
}