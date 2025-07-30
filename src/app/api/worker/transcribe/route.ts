import { NextRequest, NextResponse } from 'next/server';
import { processTranscriptionJobs } from '@/lib/services/transcriptionWorker';

// Simple worker endpoint to process pending transcriptions
// In production, this would be a proper background job queue
// NOTE: This endpoint bypasses auth for testing purposes

export async function GET(_request: NextRequest) {
  try {
    const result = await processTranscriptionJobs();
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Worker error:', error);
    return NextResponse.json(
      {
        error: error.message || 'Worker failed',
      },
      { status: 500 }
    );
  }
}

// POST to manually trigger processing of a specific job
export async function POST(request: NextRequest) {
  try {
    const { fileId } = await request.json();

    if (!fileId) {
      return NextResponse.json({ error: 'fileId required' }, { status: 400 });
    }

    // Trigger processing by calling GET
    return GET(request);
  } catch (error: any) {
    return NextResponse.json(
      {
        error: error.message || 'Failed to trigger worker',
      },
      { status: 500 }
    );
  }
}
