import { NextRequest } from 'next/server';
import { 
  getAudioRepository, 
  getValidationService, 
  getErrorHandlingService 
} from '@/lib/di/containerSetup';
import { debugLog } from '@/lib/utils';

/**
 * GET /api/files - List all audio files
 */
export async function GET(request: NextRequest) {
  const errorHandlingService = getErrorHandlingService();
  
  try {
    // Get query parameters
    const { searchParams } = new URL(request.url);
    const limitStr = searchParams.get('limit') || '50';
    const offsetStr = searchParams.get('offset') || '0';
    
    // Validate pagination parameters
    const validationService = getValidationService();
    const limitValidation = validationService.validateNumber(
      parseInt(limitStr), 
      'limit', 
      { min: 1, max: 100 }
    );
    const offsetValidation = validationService.validateNumber(
      parseInt(offsetStr), 
      'offset', 
      { min: 0 }
    );
    
    if (!limitValidation.isValid || !offsetValidation.isValid) {
      const errors = [...limitValidation.errors, ...offsetValidation.errors];
      return errorHandlingService.handleValidationError(errors, 'get-files');
    }
    
    const limit = parseInt(limitStr);
    const offset = parseInt(offsetStr);

    // Get repository using DI container
    const audioRepository = getAudioRepository();

    // Get files from database
    const files = await audioRepository.findAll({ limit, offset });
    const totalCount = await audioRepository.count();

    // Map to expected format for frontend
    const formattedFiles = files.map(file => ({
      id: file.id.toString(), // Ensure ID is string
      filename: file.file_name, // Supabase storage path
      originalName: file.original_file_name,
      size: file.file_size,
      mimeType: file.original_file_type,
      duration: file.duration,
      createdAt: file.uploaded_at
        ? new Date(file.uploaded_at).toISOString()
        : new Date().toISOString(),
      updatedAt: file.updated_at
        ? new Date(file.updated_at).toISOString()
        : new Date().toISOString(),
      recordedAt: file.uploaded_at
        ? new Date(file.uploaded_at).toISOString()
        : null,
      transcriptionStatus: 'completed' as const, // Default status
      hasTranscript: true, // Assume transcribed
      hasAiExtract: false,
      extractCount: 0,
      labels: [],
      speakerCount: 2, // Default
      diarizationStatus: 'success' as const,
      hasSpeakers: false,
      // Include location data if present
      latitude: file.latitude,
      longitude: file.longitude,
      locationAccuracy: file.location_accuracy,
      locationTimestamp: file.location_timestamp
        ? new Date(file.location_timestamp).toISOString()
        : null,
      locationProvider: file.location_provider,
    }));

    debugLog('api', `✅ Retrieved ${formattedFiles.length} files`);

    return errorHandlingService.handleSuccess({
      files: formattedFiles,
      meta: {
        total: totalCount,
        limit,
        offset,
      },
    }, 'get-files');
  } catch (error) {
    return errorHandlingService.handleApiError(error, 'get-files');
  }
}
