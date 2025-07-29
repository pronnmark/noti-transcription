import { NextRequest, NextResponse } from 'next/server';
import {
  withAuthMiddleware,
  createApiResponse,
  createErrorResponse,
} from '@/lib/middleware';
import { RepositoryFactory } from '@/lib/database/repositories';
import { apiDebug } from '@/lib/utils';
import { createId } from '@paralleldrive/cuid2';

/**
 * Refactored GET handler using middleware and repository pattern
 * Uses extractions table with 'note' template for simple notes functionality
 */
export async function GET(request: NextRequest) {
  const authenticatedHandler = withAuthMiddleware(
    async (request: NextRequest, context) => {
      const { searchParams } = new URL(request.url);
      const fileId = searchParams.get('fileId');

      apiDebug('Fetching notes', { fileId, requestId: context.requestId });

      try {
        const extractionRepo = RepositoryFactory.extractionRepository;

        let notes;
        if (fileId) {
          // Get notes for specific file (using extractions with templateId 'notes')
          notes = await extractionRepo.findByFileAndTemplate(
            parseInt(fileId),
            'notes',
          );
        } else {
          // Get all notes - we'll use a simple approach for now
          const audioRepo = RepositoryFactory.audioRepository;
          const allFiles = await audioRepo.findAll();
          notes = [];

          // Get notes for all files (simplified - in production we'd optimize this)
          for (const file of allFiles.slice(0, 20)) {
            // Limit to 20 files for performance
            const fileNotes = await extractionRepo.findByFileAndTemplate(
              file.id,
              'notes',
            );
            notes.push(
              ...fileNotes.map(
                note =>
                  ({
                    ...note,
                    original_file_name: file.originalFileName,
                  }) as any,
              ),
            );
          }

          // Sort by creation date
          notes.sort(
            (a, b) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
          );
          notes = notes.slice(0, 100); // Limit results
        }

        return NextResponse.json(
          createApiResponse(
            {
              notes: notes.map(note => ({
                id: note.id,
                file_id: note.fileId,
                content: note.content,
                created_at: note.createdAt,
                updated_at: note.updatedAt,
                original_file_name:
                  (note as any).original_file_name || 'Unknown File',
              })),
              total: notes.length,
            },
            {
              meta: {
                requestId: context.requestId,
              },
            },
          ),
        );
      } catch (error) {
        apiDebug('Error fetching notes', error);
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
    },
  );

  return authenticatedHandler(request);
}

/**
 * Refactored POST handler using middleware and repository pattern
 */
export async function POST(request: NextRequest) {
  const authenticatedHandler = withAuthMiddleware(
    async (request: NextRequest, context) => {
      const body = await request.json();
      const { fileId, content } = body;

      if (!fileId || !content) {
        return NextResponse.json(
          createErrorResponse(
            'fileId and content are required',
            'MISSING_FIELDS',
            400,
          ),
          { status: 400 },
        );
      }

      apiDebug('Creating note', {
        fileId,
        contentLength: content.length,
        requestId: context.requestId,
      });

      try {
        // Check if file exists
        const audioRepo = RepositoryFactory.audioRepository;
        const file = await audioRepo.findById(parseInt(fileId));

        if (!file) {
          return NextResponse.json(
            createErrorResponse('File not found', 'FILE_NOT_FOUND', 404),
            { status: 404 },
          );
        }

        // Create note using extractions table with 'notes' template
        const extractionRepo = RepositoryFactory.extractionRepository;
        const note = await extractionRepo.create({
          id: createId(),
          fileId: parseInt(fileId),
          templateId: 'notes', // Use 'notes' as template ID for simple notes
          content,
          status: 'active',
          priority: 'medium',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        return NextResponse.json(
          createApiResponse(
            {
              success: true,
              note: {
                id: note.id,
                file_id: note.fileId,
                content: note.content,
                created_at: note.createdAt,
                updated_at: note.updatedAt,
              },
            },
            {
              meta: {
                requestId: context.requestId,
              },
            },
          ),
        );
      } catch (error) {
        apiDebug('Error creating note', error);
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
    },
  );

  return authenticatedHandler(request);
}

/**
 * Refactored PATCH handler using middleware and repository pattern
 */
export async function PATCH(request: NextRequest) {
  const authenticatedHandler = withAuthMiddleware(
    async (request: NextRequest, context) => {
      const body = await request.json();
      const { id, content } = body;

      if (!id || !content) {
        return NextResponse.json(
          createErrorResponse(
            'id and content are required',
            'MISSING_FIELDS',
            400,
          ),
          { status: 400 },
        );
      }

      apiDebug('Updating note', {
        noteId: id,
        contentLength: content.length,
        requestId: context.requestId,
      });

      try {
        const extractionRepo = RepositoryFactory.extractionRepository;

        // Update note content
        const updatedNote = await extractionRepo.update(id, {
          content,
          updatedAt: new Date().toISOString(),
        });

        if (!updatedNote) {
          return NextResponse.json(
            createErrorResponse('Note not found', 'NOTE_NOT_FOUND', 404),
            { status: 404 },
          );
        }

        return NextResponse.json(
          createApiResponse(
            {
              success: true,
              note: {
                id: updatedNote.id,
                file_id: updatedNote.fileId,
                content: updatedNote.content,
                created_at: updatedNote.createdAt,
                updated_at: updatedNote.updatedAt,
              },
            },
            {
              meta: {
                requestId: context.requestId,
              },
            },
          ),
        );
      } catch (error: any) {
        if (error.message.includes('not found')) {
          return NextResponse.json(
            createErrorResponse('Note not found', 'NOTE_NOT_FOUND', 404),
            { status: 404 },
          );
        }
        apiDebug('Error updating note', error);
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
    },
  );

  return authenticatedHandler(request);
}

/**
 * Refactored DELETE handler using middleware and repository pattern
 */
export async function DELETE(request: NextRequest) {
  const authenticatedHandler = withAuthMiddleware(
    async (request: NextRequest, context) => {
      const { searchParams } = new URL(request.url);
      const id = searchParams.get('id');

      if (!id) {
        return NextResponse.json(
          createErrorResponse('id is required', 'MISSING_ID', 400),
          { status: 400 },
        );
      }

      apiDebug('Deleting note', { noteId: id, requestId: context.requestId });

      try {
        const extractionRepo = RepositoryFactory.extractionRepository;

        // Delete note
        const deleted = await extractionRepo.delete(id);

        if (!deleted) {
          return NextResponse.json(
            createErrorResponse('Note not found', 'NOTE_NOT_FOUND', 404),
            { status: 404 },
          );
        }

        return NextResponse.json(
          createApiResponse(
            {
              success: true,
              message: 'Note deleted successfully',
            },
            {
              meta: {
                requestId: context.requestId,
              },
            },
          ),
        );
      } catch (error: any) {
        if (error.message.includes('not found')) {
          return NextResponse.json(
            createErrorResponse('Note not found', 'NOTE_NOT_FOUND', 404),
            { status: 404 },
          );
        }
        apiDebug('Error deleting note', error);
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
    },
  );

  return authenticatedHandler(request);
}
