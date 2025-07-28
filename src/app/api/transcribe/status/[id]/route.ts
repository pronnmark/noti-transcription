import { NextRequest, NextResponse } from 'next/server';
import { withAuthMiddleware, createApiResponse, createErrorResponse } from '@/lib/middleware';
import { RepositoryFactory } from '@/lib/database/repositories';
import { apiDebug } from '@/lib/utils';

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
      const fileId = parseInt(resolvedParams.id);
      
      if (isNaN(fileId)) {
        return NextResponse.json(
          createErrorResponse('Invalid file ID', 'INVALID_FILE_ID', 400),
          { status: 400 }
        );
      }

      apiDebug('Fetching transcription status', { fileId, requestId: context.requestId });

      try {
        // Use repository instead of direct DB query
        const transcriptionRepo = RepositoryFactory.transcriptionRepository;
        const job = await transcriptionRepo.findLatestByFileId(fileId);

        if (!job) {
          return NextResponse.json(
            createApiResponse({
              exists: false,
              message: 'No transcription job found for this file',
            }, {
              meta: {
                requestId: context.requestId,
              }
            })
          );
        }

        return NextResponse.json(
          createApiResponse({
            exists: true,
            job: {
              id: job.id,
              status: job.status,
              progress: job.progress,
              modelSize: job.modelSize,
              diarization: job.diarization,
              transcript: job.transcript,
              lastError: job.lastError,
              startedAt: job.startedAt,
              completedAt: job.completedAt,
              speakerCount: job.speakerCount,
            },
          }, {
            meta: {
              requestId: context.requestId,
            }
          })
        );
      } catch (error) {
        apiDebug('Error fetching transcription status', error);
        throw error; // Let middleware handle the error
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