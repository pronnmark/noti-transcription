import { NextRequest, NextResponse } from 'next/server';
import { withAuthMiddleware } from '@/lib/middleware';
import { 
  getTranscriptionRepository,
  getValidationService,
  getErrorHandlingService
} from '@/lib/di/containerSetup';
import { debugLog } from '@/lib/utils';

/**
 * Refactored GET handler using repository pattern and authentication middleware
 * Demonstrates best practices:
 * - No direct DB queries (uses TranscriptionRepository)
 * - No manual auth checks (middleware handles it)
 * - Consistent error handling and response format
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Create the authenticated handler
  const authenticatedHandler = withAuthMiddleware(
    async (request: NextRequest, context) => {
      const resolvedParams = await params;
      const validationService = getValidationService();
      const errorHandlingService = getErrorHandlingService();
      
      const fileId = parseInt(resolvedParams.id);
      const idValidation = validationService.validateId(fileId, 'File ID');
      
      if (!idValidation.isValid) {
        return errorHandlingService.handleValidationError(idValidation.errors, 'transcription-status');
      }

      debugLog('api', 'Fetching transcription status', {
        fileId,
        requestId: context.requestId,
      });

      try {
        // Use repository from DI container
        const transcriptionRepo = getTranscriptionRepository();
        const job = await transcriptionRepo.findLatestByFileId(fileId);

        if (!job) {
          return errorHandlingService.handleSuccess({
            exists: false,
            message: 'No transcription job found for this file',
            meta: {
              requestId: context.requestId,
            },
          }, 'transcription-status-not-found');
        }

        return errorHandlingService.handleSuccess({
          exists: true,
          job: {
            id: job.id,
            status: job.status,
            progress: job.progress,
            modelSize: job.model_size,
            diarization: job.diarization,
            transcript: job.transcript,
            lastError: job.last_error,
            startedAt: job.started_at,
            completedAt: job.completed_at,
            speakerCount: job.speaker_count,
          },
          meta: {
            requestId: context.requestId,
          },
        }, 'transcription-status-found');
      } catch (error) {
        return errorHandlingService.handleApiError(error, 'transcription-status');
      }
    },
    {
      logging: {
        enabled: true,
        logRequests: true,
        logResponses: true,
      },
      errorHandling: {
        enabled: true,
        sanitizeErrors: true,
      },
    }
  );

  // Execute the authenticated handler
  return authenticatedHandler(request);
}
