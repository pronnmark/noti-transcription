import { NextRequest, NextResponse } from 'next/server';
import { getTranscript } from '@/lib/transcription';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: fileId } = await params;
    const transcript = await getTranscript(parseInt(fileId));
    
    if (!transcript) {
      return NextResponse.json(
        { error: 'Transcript not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      segments: transcript.segments || [],
      // Check if we have speaker information
      hasSpeakers: transcript.segments?.some((s: { speaker?: string }) => s.speaker) || false
    });
  } catch (error) {
    console.error('Get transcript error:', error);
    return NextResponse.json(
      { error: 'Failed to get transcript' },
      { status: 500 }
    );
  }
}