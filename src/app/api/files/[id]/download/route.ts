import { NextRequest, NextResponse } from 'next/server';
import { RepositoryFactory } from '@/lib/database/repositories';
import { SupabaseStorageService } from '@/lib/services/core/SupabaseStorageService';

/**
 * Shared logic for validating download request
 */
async function validateDownloadRequest(params: Promise<{ id: string }>) {
  const { id } = await params;
  const fileId = parseInt(id);

  if (isNaN(fileId)) {
    return {
      error: NextResponse.json(
        {
          success: false,
          error: { message: 'Invalid file ID', code: 'INVALID_ID' },
        },
        { status: 400 }
      )
    };
  }

  // Get the file from the database
  const audioRepository = RepositoryFactory.audioRepository;
  const audioFile = await audioRepository.findById(fileId);

  if (!audioFile) {
    return {
      error: NextResponse.json(
        {
          success: false,
          error: { message: 'File not found', code: 'NOT_FOUND' },
        },
        { status: 404 }
      )
    };
  }

  // Check if file has storage path
  if (!audioFile.file_name) {
    return {
      error: NextResponse.json(
        {
          success: false,
          error: { message: 'File storage path not found', code: 'NO_STORAGE_PATH' },
        },
        { status: 404 }
      )
    };
  }

  return { fileId, audioFile };
}

/**
 * HEAD /api/files/[id]/download - Verify download availability without generating URL
 */
export async function HEAD(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const validation = await validateDownloadRequest(params);
    
    if (validation.error) {
      // Return the same status code but without body for HEAD request
      return new NextResponse(null, { status: validation.error.status });
    }

    // File exists and has storage path - download should work
    return new NextResponse(null, { status: 200 });
  } catch (error) {
    console.error('Error in HEAD /api/files/[id]/download:', error);
    return new NextResponse(null, { status: 500 });
  }
}

/**
 * GET /api/files/[id]/download - Generate signed URL and initiate download
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const validation = await validateDownloadRequest(params);
    
    if (validation.error) {
      return validation.error;
    }

    const { fileId, audioFile } = validation;

    try {
      // Generate signed URL for download
      const storageService = new SupabaseStorageService();
      const downloadUrl = await storageService.getFileUrl(
        'audio-files',
        audioFile.file_name,
        3600 // 1 hour expiration
      );

      console.log(`Generated download URL for file ${fileId}: ${audioFile.original_file_name}`);

      // Redirect to the signed URL for immediate download
      return NextResponse.redirect(downloadUrl);
    } catch (storageError) {
      console.error(`Failed to generate download URL for file ${fileId}:`, storageError);
      
      return NextResponse.json(
        {
          success: false,
          error: { 
            message: 'Failed to generate download URL', 
            code: 'STORAGE_ERROR',
            details: storageError instanceof Error ? storageError.message : 'Unknown storage error'
          },
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error in GET /api/files/[id]/download:', error);
    return NextResponse.json(
      {
        success: false,
        error: { 
          message: 'Internal error', 
          code: 'INTERNAL_ERROR',
          details: error instanceof Error ? error.message : 'Unknown error'
        },
      },
      { status: 500 }
    );
  }
}