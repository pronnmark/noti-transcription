import { NextRequest, NextResponse } from 'next/server';
import { 
  getAudioRepository, 
  getValidationService, 
  getErrorHandlingService 
} from '@/lib/di/containerSetup';
import { SupabaseStorageService } from '@/lib/services/core/SupabaseStorageService';
import { debugLog } from '@/lib/utils';

/**
 * Shared logic for validating download request
 */
async function validateDownloadRequest(params: Promise<{ id: string }>) {
  const { id } = await params;
  const validationService = getValidationService();
  const errorHandlingService = getErrorHandlingService();
  
  const fileId = parseInt(id);
  const idValidation = validationService.validateId(fileId, 'File ID');
  
  if (!idValidation.isValid) {
    return {
      error: errorHandlingService.handleValidationError(idValidation.errors, 'file-download')
    };
  }

  // Get the file from the database using DI container
  const audioRepository = getAudioRepository();
  const audioFile = await audioRepository.findById(fileId);

  if (!audioFile) {
    return {
      error: errorHandlingService.handleNotFoundError('File', fileId, 'file-download')
    };
  }

  // Check if file has storage path
  if (!audioFile.file_name) {
    return {
      error: errorHandlingService.handleApiError(
        'NOT_FOUND', 
        'File storage path not found',
        { fileId, operation: 'file-download' }
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
  const errorHandlingService = getErrorHandlingService();
  
  try {
    const validation = await validateDownloadRequest(params);
    
    if (validation.error) {
      // Return the same status code but without body for HEAD request
      return new NextResponse(null, { status: validation.error.status });
    }

    // File exists and has storage path - download should work
    debugLog('api', `HEAD request successful for file ${validation.fileId}`);
    return new NextResponse(null, { status: 200 });
  } catch (error) {
    debugLog('api', 'Error in HEAD /api/files/[id]/download:', error);
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
  const errorHandlingService = getErrorHandlingService();
  
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

      debugLog('api', `Generated download URL for file ${fileId}: ${audioFile.original_file_name}`);

      // Redirect to the signed URL for immediate download
      return NextResponse.redirect(downloadUrl);
    } catch (storageError) {
      debugLog('api', `Failed to generate download URL for file ${fileId}:`, storageError);
      
      return errorHandlingService.handleApiError(
        'EXTERNAL_SERVICE_ERROR',
        'Failed to generate download URL',
        { 
          fileId, 
          fileName: audioFile.original_file_name,
          storageError: storageError instanceof Error ? storageError.message : 'Unknown storage error'
        }
      );
    }
  } catch (error) {
    return errorHandlingService.handleApiError(error, 'file-download');
  }
}