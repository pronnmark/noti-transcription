import { NextRequest, NextResponse } from 'next/server';
import {
  withMiddleware,
  createApiResponse,
  createErrorResponse,
} from '@/lib/middleware';
import { FileUploadService } from '@/lib/services/core/FileUploadService';
import { apiDebug, debugPerformance } from '@/lib/utils';
import { ValidationError } from '@/lib/errors';
import { processTranscriptionJobs } from '@/lib/services/transcriptionWorker';

export const runtime = 'nodejs';
export const maxDuration = 60; // 60 seconds

/**
 * Refactored upload endpoint using FileUploadService and middleware
 * This replaces the duplicate upload logic across multiple endpoints
 */
/**
 * POST handler with middleware for error handling and logging
 * Authentication is optional for upload endpoint
 */
export const POST = withMiddleware(
  async (request: NextRequest, context) => {
    const startTime = Date.now();
    apiDebug('Upload request received', { requestId: context.requestId });

    try {
      // Parse form data
      const formData = await request.formData();

      // Get all files from formData (support both single and multiple files)
      const files: File[] = [];

      // Check for multiple files (files[] format)
      const multipleFiles = formData.getAll('files');
      if (multipleFiles.length > 0) {
        multipleFiles.forEach(item => {
          if (item instanceof File) {
            files.push(item);
          }
        });
      }

      // Check for single file (backward compatibility)
      if (files.length === 0) {
        const singleFile = formData.get('file') || formData.get('audio');
        if (singleFile instanceof File) {
          files.push(singleFile);
        }
      }

      if (files.length === 0) {
        return NextResponse.json(
          createErrorResponse('No files provided', 'NO_FILES', 400, {
            receivedFields: Array.from(formData.keys()),
            hint: 'Expected field name: files[] for multiple files or file/audio for single file',
          }),
          { status: 400 }
        );
      }

      // Extract upload options from form data
      let speakerCount: number | undefined;
      const speakerCountField = formData.get('speakerCount');
      if (speakerCountField) {
        speakerCount = parseInt(speakerCountField.toString());
        if (isNaN(speakerCount)) {
          return NextResponse.json(
            createErrorResponse(
              'Invalid speaker count',
              'INVALID_SPEAKER_COUNT',
              400
            ),
            { status: 400 }
          );
        }
      }

      // Extract location data
      const locationData: any = {};
      const latitudeField = formData.get('latitude');
      const longitudeField = formData.get('longitude');

      if (latitudeField && longitudeField) {
        locationData.latitude = parseFloat(latitudeField.toString());
        locationData.longitude = parseFloat(longitudeField.toString());

        const accuracyField = formData.get('locationAccuracy');
        if (accuracyField) {
          locationData.accuracy = parseInt(accuracyField.toString());
        }

        const timestampField = formData.get('locationTimestamp');
        if (timestampField) {
          locationData.timestamp = parseInt(timestampField.toString());
        }

        const providerField = formData.get('locationProvider');
        if (providerField) {
          locationData.provider = providerField.toString();
        }
      }

      // Create FileUploadService instance directly
      const fileUploadService = new FileUploadService();

      // Process each file using the service
      const results = await Promise.all(
        files.map(async file => {
          try {
            const result = await fileUploadService.uploadFile(file, {
              speakerCount,
              location: locationData.latitude ? locationData : undefined,
            });

            return {
              success: true,
              fileId: result.fileId,
              fileName: file.name,
              message: result.message,
              duration: result.duration,
            };
          } catch (error) {
            if (error instanceof ValidationError) {
              const metadata = error.metadata as any;
              if (metadata?.duplicateType) {
                return {
                  success: false,
                  fileName: file.name,
                  error: error.message,
                  duplicateInfo: metadata,
                };
              }
            }

            return {
              success: false,
              fileName: file.name,
              error: error instanceof Error ? error.message : 'Unknown error',
            };
          }
        })
      );

      // Auto-trigger transcription worker for successful uploads (non-blocking)
      const successfulUploads = results.filter(r => r.success).length;
      if (successfulUploads > 0) {
        setImmediate(async () => {
          try {
            apiDebug(
              `Starting transcription worker for ${successfulUploads} newly uploaded files...`
            );
            const result = await processTranscriptionJobs();
            apiDebug('Transcription worker completed:', result);
          } catch (error) {
            console.error('Error in transcription worker:', error);
          }
        });
      }

      // Prepare response
      const successCount = results.filter(r => r.success).length;
      const failureCount = results.filter(r => !r.success).length;

      debugPerformance('Upload endpoint', startTime, 'api');

      // If all files failed, return 400 status
      if (successCount === 0 && failureCount > 0) {
        const firstError = results.find(r => !r.success)?.error;
        return NextResponse.json(
          createErrorResponse(
            firstError || 'All files failed validation',
            'VALIDATION_ERROR',
            400,
            {
              totalFiles: files.length,
              failureCount,
              results,
            }
          ),
          { status: 400 }
        );
      }

      return NextResponse.json(
        createApiResponse(
          {
            totalFiles: files.length,
            successCount,
            failureCount,
            results,
            speakerCount: speakerCount || null,
            speakerDetection: speakerCount ? 'user_specified' : 'auto_detect',
            locationCaptured: !!(
              locationData.latitude && locationData.longitude
            ),
          },
          {
            meta: {
              requestId: context.requestId,
              duration: Date.now() - startTime,
            },
          }
        )
      );
    } catch (error) {
      apiDebug('Upload error:', error);
      return NextResponse.json(
        createErrorResponse(
          error instanceof Error ? error.message : 'Unknown error',
          'UPLOAD_ERROR',
          500,
          { stack: error instanceof Error ? error.stack : undefined }
        ),
        { status: 500 }
      );
    }
  },
  {
    // Middleware configuration
    logging: {
      enabled: true,
      logRequests: true,
      logResponses: true,
      logBody: false, // Don't log file content
    },
    rateLimit: {
      enabled: true,
      maxRequests: 50,
      windowMs: 60000, // 1 minute
    },
    errorHandling: {
      enabled: true,
      includeStackTrace: process.env.NODE_ENV === 'development',
      sanitizeErrors: true,
    },
  }
);
