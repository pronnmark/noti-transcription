import { NextRequest, NextResponse } from 'next/server';
import {
  withMiddleware,
  createApiResponse,
  createErrorResponse,
  createPaginatedResponse,
} from '@/lib/middleware';
import { RepositoryFactory } from '@/lib/database/repositories';
import { apiDebug, debugPerformance } from '@/lib/utils';
import { sql } from 'drizzle-orm';

/**
 * GET /api/files - List all audio files with pagination
 * Refactored to use repositories and middleware
 */
export const GET = withMiddleware(
  async (request: NextRequest, context) => {
    const startTime = Date.now();

    try {
      // Get query parameters
      const { searchParams } = new URL(request.url);
      const page = parseInt(searchParams.get('page') || '1', 10);
      const limit = parseInt(searchParams.get('limit') || '50', 10);
      const offset = (page - 1) * limit;
      const includeDates = searchParams.get('includeDates') === 'true';
      const dateFilter = searchParams.get('date'); // YYYY-MM-DD format

      apiDebug('Fetching files', {
        page,
        limit,
        includeDates,
        dateFilter,
        requestId: context.requestId,
      });

      // Get repositories
      const audioRepo = RepositoryFactory.audioRepository;
      const transcriptionRepo = RepositoryFactory.transcriptionRepository;
      const summarizationRepo = RepositoryFactory.summarizationRepository;

      // For now, use the audioRepo's findAll with pagination
      // In a full implementation, we'd add a custom method to handle the complex joins
      const files = await audioRepo.findAll(limit, offset);

      // Get total count for pagination
      const totalCount = await audioRepo.count();

      // Enrich files with related data (in production, this would be a single query)
      const enrichedFiles = await Promise.all(
        files.map(async file => {
          const transcriptionJob = await transcriptionRepo.findLatestByFileId(
            file.id,
          );
          const summarizationCount = await summarizationRepo.countByFileId(
            file.id,
          );

          return {
            id: file.id,
            filename: file.fileName,
            originalName: file.originalFileName,
            size: file.fileSize,
            mimeType: file.originalFileType,
            createdAt: file.uploadedAt,
            updatedAt: file.updatedAt,
            recordedAt: file.recordedAt,
            duration: file.duration,
            transcriptionStatus: transcriptionJob?.status || 'pending',
            hasTranscript: transcriptionJob?.status === 'completed',
            speakerCount: transcriptionJob?.speakerCount || 0,
            diarizationStatus:
              transcriptionJob?.diarizationStatus || 'not_attempted',
            summarizationCount,
            labels: [], // Would need to implement label repository
          };
        }),
      );

      // Get unique dates if requested
      let availableDates: string[] = [];
      if (includeDates) {
        // This would be a custom repository method in production
        availableDates = await audioRepo.getUniqueDates();
      }

      debugPerformance('Files fetched', startTime, 'api');

      // Use the pagination helper
      return NextResponse.json(
        createPaginatedResponse(
          enrichedFiles,
          {
            page,
            limit,
            total: totalCount,
            totalPages: Math.ceil(totalCount / limit),
            hasNext: page < Math.ceil(totalCount / limit),
            hasPrev: page > 1,
          },
          {
            requestId: context.requestId,
            duration: Date.now() - startTime,
            availableDates: includeDates ? availableDates : undefined,
          },
        ),
      );
    } catch (error) {
      apiDebug('Error fetching files', error);
      throw error; // Let middleware handle it
    }
  },
  {
    logging: {
      enabled: true,
      logRequests: true,
      logResponses: false, // Don't log large file lists
    },
    errorHandling: {
      enabled: true,
      sanitizeErrors: true,
    },
  },
);

/**
 * DELETE /api/files - Delete a file
 * Uses repository pattern and middleware
 */
export const DELETE = withMiddleware(
  async (request: NextRequest, context) => {
    try {
      const { fileId } = await request.json();

      if (!fileId || typeof fileId !== 'number') {
        return NextResponse.json(
          createErrorResponse('Invalid file ID', 'INVALID_FILE_ID', 400),
          { status: 400 },
        );
      }

      apiDebug('Deleting file', { fileId, requestId: context.requestId });

      const audioRepo = RepositoryFactory.audioRepository;

      // Check if file exists
      const file = await audioRepo.findById(fileId);
      if (!file) {
        return NextResponse.json(
          createErrorResponse('File not found', 'FILE_NOT_FOUND', 404),
          { status: 404 },
        );
      }

      // Delete the file
      const deleted = await audioRepo.delete(fileId);

      if (!deleted) {
        throw new Error('Failed to delete file');
      }

      // Delete the physical file
      const { unlink } = await import('fs/promises');
      const { join } = await import('path');
      const filePath = join(
        process.cwd(),
        'data',
        'audio_files',
        file.fileName,
      );

      try {
        await unlink(filePath);
        apiDebug('Physical file deleted', { filePath });
      } catch (error) {
        apiDebug('Failed to delete physical file', { filePath, error });
        // Continue even if physical file deletion fails
      }

      return NextResponse.json(
        createApiResponse(
          {
            success: true,
            fileId,
            message: 'File deleted successfully',
          },
          {
            meta: {
              requestId: context.requestId,
            },
          },
        ),
      );
    } catch (error) {
      apiDebug('Error deleting file', error);
      throw error;
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
  },
);
