import { NextRequest, NextResponse } from 'next/server';
import { getAudioRepository, getTranscriptionRepository, getErrorHandlingService } from '@/lib/di/containerSetup';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const errorHandler = getErrorHandlingService();
  const operation = 'GET /api/files/[id]';

  return await errorHandler.handleAsync(operation, async () => {
    const { id } = await params;
    
    // Validate ID using error handler's utility
    const { id: fileId, error } = errorHandler.extractAndValidateId([id], 'File ID');
    if (error) return error;

    // Get repositories using dependency injection
    const audioRepository = getAudioRepository();
    const transcriptRepository = getTranscriptionRepository();

    // Get the file
    const audioFile = await audioRepository.findById(fileId);
    if (!audioFile) {
      return errorHandler.handleNotFoundError('Audio file', fileId, operation);
    }

    // Get transcription information if available
    const latestTranscription = await transcriptRepository.findLatestByFileId(fileId);

    // Transform and return data
    const fileData = {
      id: audioFile.id,
      originalFileName: audioFile.original_file_name,
      fileName: audioFile.file_name,
      fileSize: audioFile.file_size,
      mimeType: audioFile.original_file_type,
      duration: audioFile.duration,
      uploadedAt: audioFile.uploaded_at
        ? new Date(audioFile.uploaded_at).toISOString()
        : null,
      updatedAt: audioFile.updated_at
        ? new Date(audioFile.updated_at).toISOString()
        : null,
      transcriptionStatus: latestTranscription?.status || 'pending',
      transcribedAt: latestTranscription?.completed_at
        ? new Date(latestTranscription.completed_at).toISOString()
        : null,
      language: latestTranscription?.language || 'auto',
      modelSize: latestTranscription?.model_size || 'large-v3',
      latitude: audioFile.latitude,
      longitude: audioFile.longitude,
      locationAccuracy: audioFile.location_accuracy,
      locationTimestamp: audioFile.location_timestamp
        ? new Date(audioFile.location_timestamp).toISOString()
        : null,
      locationProvider: audioFile.location_provider,
    };

    return fileData;
  });
}
