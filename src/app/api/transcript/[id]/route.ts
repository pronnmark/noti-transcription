import { NextRequest, NextResponse } from 'next/server';
import { getTranscript } from '@/lib/services/transcription';
import { getSupabase } from '@/lib/database/client';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: fileId } = await params;
    const fileIdInt = parseInt(fileId);
    const transcript = await getTranscript(fileIdInt);

    if (!transcript) {
      return NextResponse.json(
        { error: 'Transcript not found' },
        { status: 404 }
      );
    }

    // Get speaker labels for this file
    const supabase = getSupabase();
    const { data: speakerLabelResult, error } = await supabase
      .from('speaker_labels')
      .select('*')
      .eq('file_id', fileIdInt)
      .limit(1);

    if (error) {
      console.error('Error fetching speaker labels:', error);
    }

    const customSpeakerNames = speakerLabelResult?.[0]?.labels || {};

    // Enhance segments with display names
    const enhancedSegments =
      transcript.segments?.map((segment: any) => ({
        ...segment,
        displayName:
          segment.speaker && customSpeakerNames[segment.speaker]
            ? customSpeakerNames[segment.speaker]
            : segment.speaker,
      })) || [];

    // Extract unique speakers with their display names
    const speakers = Array.from(
      new Set(
        transcript.segments?.map((s: any) => s.speaker).filter(Boolean) || []
      )
    ).map(speaker => ({
      id: speaker,
      displayName: customSpeakerNames[speaker] || speaker,
      hasCustomName: !!customSpeakerNames[speaker],
    }));

    return NextResponse.json({
      segments: enhancedSegments,
      speakers,
      hasSpeakers: transcript.segments?.some((s: any) => s.speaker) || false,
      customSpeakerNames,
    });
  } catch (error) {
    console.error('Get transcript error:', error);
    return NextResponse.json(
      { error: 'Failed to get transcript' },
      { status: 500 }
    );
  }
}
