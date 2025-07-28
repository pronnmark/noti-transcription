import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import { join } from 'path';
import { withAuthMiddleware, createApiResponse, createErrorResponse } from '@/lib/middleware';
import { RepositoryFactory } from '@/lib/database/repositories';
import { apiDebug } from '@/lib/utils';

const DATA_DIR = process.env.DATA_DIR || join(process.cwd(), 'data');

/**
 * Refactored GET handler using middleware and repository pattern
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authenticatedHandler = withAuthMiddleware(
    async (request: NextRequest, context) => {
      const { id } = await params;
      const fileId = parseInt(id);
      
      if (isNaN(fileId)) {
        return NextResponse.json(
          createErrorResponse('Invalid file ID', 'INVALID_FILE_ID', 400),
          { status: 400 }
        );
      }

      apiDebug('Fetching file details', { fileId, requestId: context.requestId });

      try {
        // Get file using repository
        const audioRepo = RepositoryFactory.audioRepository;
        const file = await audioRepo.findById(fileId);
        
        if (!file) {
          return NextResponse.json(
            createErrorResponse('File not found', 'FILE_NOT_FOUND', 404),
            { status: 404 }
          );
        }

        // Get transcription status using repository
        const transcriptionRepo = RepositoryFactory.transcriptionRepository;
        const transcriptionJob = await transcriptionRepo.findLatestByFileId(fileId);
        
        const transcriptionStatus = transcriptionJob ? transcriptionJob.status : 'pending';

        return NextResponse.json(
          createApiResponse({
            id: file.id,
            originalFileName: file.originalFileName,
            fileName: file.fileName,
            fileSize: file.fileSize,
            mimeType: file.originalFileType,
            duration: file.duration || 0,
            uploadedAt: file.uploadedAt,
            updatedAt: file.updatedAt,
            transcriptionStatus,
            transcribedAt: transcriptionJob?.completedAt || null,
            language: transcriptionJob?.language || 'auto',
            modelSize: transcriptionJob?.modelSize || 'large-v3',
          }, {
            meta: {
              requestId: context.requestId,
            }
          })
        );
      } catch (error) {
        apiDebug('Error fetching file details', error);
        throw error; // Let middleware handle the error
      }
    },
    {
      logging: {
        enabled: true,
        logRequests: true,
        logResponses: false,
      },
      errorHandling: {
        enabled: true,
        sanitizeErrors: true,
      },
    }
  );

  return authenticatedHandler(request);
}

/**
 * Refactored PATCH handler using middleware and repository pattern
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authenticatedHandler = withAuthMiddleware(
    async (request: NextRequest, context) => {
      const { id } = await params;
      const fileId = parseInt(id);
      
      if (isNaN(fileId)) {
        return NextResponse.json(
          createErrorResponse('Invalid file ID', 'INVALID_FILE_ID', 400),
          { status: 400 }
        );
      }

      const body = await request.json();
      const { originalName } = body;

      if (!originalName || typeof originalName !== 'string') {
        return NextResponse.json(
          createErrorResponse('Original name is required', 'MISSING_ORIGINAL_NAME', 400),
          { status: 400 }
        );
      }

      apiDebug('Renaming file', { fileId, newName: originalName, requestId: context.requestId });

      try {
        // Update file using repository
        const audioRepo = RepositoryFactory.audioRepository;
        const updatedFile = await audioRepo.update(fileId, {
          originalFileName: originalName,
          updatedAt: new Date(),
        });

        if (!updatedFile) {
          return NextResponse.json(
            createErrorResponse('File not found', 'FILE_NOT_FOUND', 404),
            { status: 404 }
          );
        }

        return NextResponse.json(
          createApiResponse({
            success: true,
            message: 'File renamed successfully',
            file: {
              id: updatedFile.id,
              originalFileName: updatedFile.originalFileName,
              updatedAt: updatedFile.updatedAt,
            },
          }, {
            meta: {
              requestId: context.requestId,
            }
          })
        );
      } catch (error: any) {
        if (error.message.includes('not found')) {
          return NextResponse.json(
            createErrorResponse('File not found', 'FILE_NOT_FOUND', 404),
            { status: 404 }
          );
        }
        apiDebug('Error renaming file', error);
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

  return authenticatedHandler(request);
}

/**
 * Refactored DELETE handler using middleware and repository pattern
 * Note: File deletion logic will be updated for Supabase Storage later
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authenticatedHandler = withAuthMiddleware(
    async (request: NextRequest, context) => {
      const { id } = await params;
      const fileId = parseInt(id);
      
      if (isNaN(fileId)) {
        return NextResponse.json(
          createErrorResponse('Invalid file ID', 'INVALID_FILE_ID', 400),
          { status: 400 }
        );
      }

      apiDebug('Deleting file', { fileId, requestId: context.requestId });

      try {
        // Get file info first using repository
        const audioRepo = RepositoryFactory.audioRepository;
        const file = await audioRepo.findById(fileId);
        
        if (!file) {
          return NextResponse.json(
            createErrorResponse('File not found', 'FILE_NOT_FOUND', 404),
            { status: 404 }
          );
        }

        // Delete files from Supabase Storage
        try {
          // Get services
          const { getServiceLocator } = await import('@/lib/services/ServiceLocator');
          const { supabaseStorageService } = getServiceLocator();

          // Delete audio file from Supabase Storage
          if (file.fileName) {
            await supabaseStorageService.deleteFiles({
              bucket: 'audio-files',
              paths: [file.fileName], // fileName now contains the storage path
            });
            
            apiDebug('Deleted audio file from Supabase Storage', { 
              storagePath: file.fileName 
            });
          }

          // Delete any associated transcript files from Supabase Storage
          try {
            await supabaseStorageService.deleteFiles({
              bucket: 'transcripts',
              paths: [
                `${fileId}.json`,
                `${fileId}_metadata.json`,
              ],
            });
            
            apiDebug('Deleted transcript files from Supabase Storage', { fileId });
          } catch (transcriptError) {
            // Transcript files might not exist, which is fine
            apiDebug('No transcript files to delete (expected)', transcriptError);
          }

        } catch (storageError) {
          apiDebug('Error deleting files from Supabase Storage (continuing with DB deletion)', storageError);
          // Continue with database deletion even if file deletion fails
        }

        // Delete related records using repositories (order matters due to foreign key constraints)
        try {
          // Delete extractions
          const extractionRepo = RepositoryFactory.extractionRepository;
          const extractions = await extractionRepo.findByFileId(fileId);
          for (const extraction of extractions) {
            await extractionRepo.delete(extraction.id);
          }

          // Delete transcription jobs
          const transcriptionRepo = RepositoryFactory.transcriptionRepository;
          const transcriptionJobs = await transcriptionRepo.findByFileId(fileId);
          for (const job of transcriptionJobs) {
            await transcriptionRepo.delete(job.id);
          }

          // Delete the main audio file record
          await audioRepo.delete(fileId);

        } catch (dbError) {
          apiDebug('Error deleting database records', dbError);
          throw new Error('Failed to delete database records');
        }

        return NextResponse.json(
          createApiResponse({
            success: true,
            message: 'File and all related data deleted successfully',
            deletedFileId: fileId,
          }, {
            meta: {
              requestId: context.requestId,
            }
          })
        );
      } catch (error) {
        apiDebug('Error deleting file', error);
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

  return authenticatedHandler(request);
}
