import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '../../../../lib/database/client';
import { transcriptionJobs } from '../../../../lib/database/schema/transcripts';
import { eq } from 'drizzle-orm';
import { detectAndApplySpeakerNames } from '../../../../lib/services/speakerDetectionService';

// GET /api/test-speaker-detection/[fileId] - Test speaker detection on existing transcript
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  try {
    const { fileId } = await params;
    const fileIdInt = parseInt(fileId);
    const db = getDb();
    
    if (isNaN(fileIdInt)) {
      return NextResponse.json({ error: 'Invalid file ID' }, { status: 400 });
    }

    // Get existing transcript
    const transcriptionJob = await db
      .select()
      .from(transcriptionJobs)
      .where(eq(transcriptionJobs.fileId, fileIdInt))
      .limit(1);

    if (!transcriptionJob.length || !transcriptionJob[0].transcript) {
      return NextResponse.json(
        { error: 'No transcript found for this file' },
        { status: 404 }
      );
    }

    const transcript = transcriptionJob[0].transcript;
    
    console.log(`🧪 Testing speaker detection for file ${fileId} with ${transcript.length} segments`);

    // Run speaker detection
    const result = await detectAndApplySpeakerNames(transcript);
    
    if (result.success) {
      return NextResponse.json({
        success: true,
        originalSegments: transcript.length,
        detectionStats: result.stats,
        sampleUpdatedSegments: result.updatedTranscript?.slice(0, 10).map(segment => ({
          speaker: segment.speaker,
          text: segment.text.substring(0, 100) + (segment.text.length > 100 ? '...' : ''),
          start: segment.start
        })) || [],
        message: 'Speaker detection completed successfully'
      });
    } else {
      return NextResponse.json({
        success: false,
        error: result.error,
        originalSegments: transcript.length,
        message: 'Speaker detection failed'
      });
    }

  } catch (error) {
    console.error('Test speaker detection error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// POST /api/test-speaker-detection/[fileId] - Apply speaker detection results to transcript
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  try {
    const { fileId } = await params;
    const fileIdInt = parseInt(fileId);
    const db = getDb();
    
    if (isNaN(fileIdInt)) {
      return NextResponse.json({ error: 'Invalid file ID' }, { status: 400 });
    }

    // Get existing transcript
    const transcriptionJob = await db
      .select()
      .from(transcriptionJobs)
      .where(eq(transcriptionJobs.fileId, fileIdInt))
      .limit(1);

    if (!transcriptionJob.length || !transcriptionJob[0].transcript) {
      return NextResponse.json(
        { error: 'No transcript found for this file' },
        { status: 404 }
      );
    }

    const originalTranscript = transcriptionJob[0].transcript;
    
    console.log(`🔄 Applying speaker detection for file ${fileId}...`);

    // Run speaker detection
    const result = await detectAndApplySpeakerNames(originalTranscript);
    
    if (result.success && result.updatedTranscript) {
      // Update the transcript in the database
      await db
        .update(transcriptionJobs)
        .set({ transcript: result.updatedTranscript })
        .where(eq(transcriptionJobs.id, transcriptionJob[0].id));

      console.log(`✅ Updated transcript for file ${fileId} with speaker names`);

      return NextResponse.json({
        success: true,
        message: 'Speaker names applied to transcript successfully',
        stats: result.stats,
        updatedSegments: result.updatedTranscript.length
      });
    } else {
      return NextResponse.json({
        success: false,
        error: result.error || 'Speaker detection failed',
        message: 'Could not apply speaker names'
      });
    }

  } catch (error) {
    console.error('Apply speaker detection error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}