import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { validateSession } from '../../../lib/auth';
import '../../../lib/logging/init'; // Initialize logger
import { SimpleFileUploadService } from '../../../lib/services/core/SimpleFileUploadService';

// Debug logging (can be disabled by setting DEBUG_API=false)
const DEBUG_API = process.env.DEBUG_API !== 'false';
const debugLog = (...args: unknown[]) => {
  if (DEBUG_API) {
    console.log(...args);
  }
};

// Direct upload using SimpleFileUploadService
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Check authentication
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value;
    const isValid = await validateSession(token);

    if (!isValid) {
      return NextResponse.json({
        error: 'Authentication required',
      }, { status: 401 });
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('audio') as File;

    if (!file) {
      return NextResponse.json({
        error: 'No file provided',
      }, { status: 400 });
    }

    // Parse options
    const speakerCountParam = formData.get('speakerCount') as string;
    const allowDuplicatesParam = formData.get('allowDuplicates') as string;
    const isDraftParam = formData.get('isDraft') as string;

    const options = {
      speakerCount: speakerCountParam ? parseInt(speakerCountParam) : 2,
      allowDuplicates: allowDuplicatesParam === 'true',
      isDraft: isDraftParam === 'true',
    };

    debugLog('Upload v2 request:', {
      fileName: file.name,
      fileSize: file.size,
      options,
    });

    // Create and initialize service
    const uploadService = new SimpleFileUploadService();
    await uploadService.initialize();

    try {
      // Upload file
      const result = await uploadService.uploadFile(file, options);

      const executionTime = Date.now() - startTime;

      return NextResponse.json({
        success: true,
        file: {
          id: result.fileId,
          transcriptionStatus: result.transcriptionStarted ? 'processing' : 'pending',
          message: result.message,
          isDraft: result.isDraft,
          duration: result.duration,
        },
        executionTime,
      });

    } finally {
      // Clean up service
      await uploadService.destroy();
    }

  } catch (error) {
    console.error('Upload v2 error:', error);

    return NextResponse.json({
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'Upload failed',
        details: error instanceof Error ? error.stack : undefined,
      },
    }, { status: 500 });
  }
}
