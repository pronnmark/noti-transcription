import { NextRequest, NextResponse } from 'next/server';
import { RepositoryFactory } from '@/lib/database/repositories';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const fileId = parseInt(id);

    if (isNaN(fileId)) {
      return NextResponse.json(
        {
          success: false,
          error: { message: 'Invalid file ID', code: 'INVALID_ID' },
        },
        { status: 400 }
      );
    }

    // Get the file from the database using real repository
    const audioRepository = RepositoryFactory.audioRepository;
    const audioFile = await audioRepository.findById(fileId);

    if (!audioFile) {
      return NextResponse.json(
        {
          success: false,
          error: { message: 'File not found', code: 'NOT_FOUND' },
        },
        { status: 404 }
      );
    }

    // Get transcription information if available
    const transcriptRepository = RepositoryFactory.transcriptionRepository;
    const latestTranscription =
      await transcriptRepository.findLatestByFileId(fileId);

    // Return the actual file data with proper field mapping
    return NextResponse.json({
      success: true,
      data: {
        id: audioFile.id,
        originalFileName: audioFile.original_file_name,
        fileName: audioFile.file_name, // This is the Supabase storage path
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
        // Include location data if present
        latitude: audioFile.latitude,
        longitude: audioFile.longitude,
        locationAccuracy: audioFile.location_accuracy,
        locationTimestamp: audioFile.location_timestamp
          ? new Date(audioFile.location_timestamp).toISOString()
          : null,
        locationProvider: audioFile.location_provider,
      },
    });
  } catch (error) {
    console.error('Error in GET /api/files/[id]:', error);
    return NextResponse.json(
      {
        success: false,
        error: { message: 'Internal error', code: 'INTERNAL_ERROR' },
      },
      { status: 500 }
    );
  }
}
