import { NextRequest } from 'next/server';
import { createApiHandler, ApiServices } from '../../../lib/api/ApiHandler';

// Configure route to handle large file uploads
export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes timeout

export const POST = createApiHandler(async (request: NextRequest) => {
  console.log('Upload-fixed handler started');

  // Parse form data
  let formData;
  try {
    formData = await request.formData();
    console.log('FormData parsed successfully');
  } catch (e) {
    console.error('Failed to parse formData:', e);
    throw e;
  }

  const file = formData.get('audio') as File;
  console.log('File extracted:', { hasFile: !!file, name: file?.name, size: file?.size });

  if (!file) {
    throw new Error('No file provided');
  }

  // Parse upload options
  const speakerCountParam = formData.get('speakerCount') as string;
  const allowDuplicatesParam = formData.get('allowDuplicates') as string;
  const isDraftParam = formData.get('isDraft') as string;

  const speakerCount = speakerCountParam ? parseInt(speakerCountParam) : 2;
  const allowDuplicates = allowDuplicatesParam === 'true';
  const isDraft = isDraftParam === 'true';

  console.log('Upload fixed - file info:', {
    name: file.name,
    size: file.size,
    type: file.type,
  });

  // Upload file using the service
  const result = await ApiServices.fileUpload.uploadFile(file, {
    speakerCount,
    allowDuplicates,
    isDraft,
  });

  console.log('Upload fixed - result:', result);

  return {
    success: true,
    file: {
      id: result.fileId,
      transcriptionStatus: result.transcriptionStarted ? 'processing' : 'pending',
      message: result.message,
      isDraft: result.isDraft,
      duration: result.duration,
    },
  };
});
