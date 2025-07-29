import { NextRequest, NextResponse } from 'next/server';
import { RepositoryFactory } from '@/lib/database/repositories';

/**
 * GET /api/files - List all audio files
 */
export async function GET(request: NextRequest) {
  try {
    // Get query parameters
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // Get repositories
    const audioRepository = RepositoryFactory.audioRepository;

    // Get files from database
    const files = await audioRepository.findAll(limit, offset);
    const totalCount = await audioRepository.count();

    // Map to expected format
    const formattedFiles = files.map(file => ({
      id: file.id,
      originalFileName: file.original_file_name,
      fileName: file.file_name, // Supabase storage path
      fileSize: file.file_size,
      mimeType: file.original_file_type,
      duration: file.duration,
      uploadedAt: file.created_at ? new Date(file.created_at).toISOString() : null,
      updatedAt: file.updated_at ? new Date(file.updated_at).toISOString() : null,
      // Include location data if present
      latitude: file.latitude,
      longitude: file.longitude,
      locationAccuracy: file.location_accuracy,
      locationTimestamp: file.location_timestamp ? new Date(file.location_timestamp).toISOString() : null,
      locationProvider: file.location_provider,
    }));

    return NextResponse.json({
      success: true,
      data: formattedFiles,
      meta: {
        total: totalCount,
        limit,
        offset,
      }
    });
  } catch (error) {
    console.error('Error fetching files:', error);
    return NextResponse.json({
      success: false,
      error: { message: 'Internal error', code: 'INTERNAL_ERROR' }
    }, { status: 500 });
  }
}

