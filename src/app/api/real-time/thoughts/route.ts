import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/database/client';
import { createId } from '@paralleldrive/cuid2';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    if (!sessionId) {
      return NextResponse.json(
        { error: 'sessionId is required' },
        { status: 400 },
      );
    }

    // Get thoughts for a specific session, ordered by chunk number
    const supabase = getSupabase();
    const { data: thoughts, error } = await supabase
      .from('real_time_thoughts')
      .select('*')
      .eq('session_id', sessionId)
      .order('chunk_number', { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) {
      throw error;
    }

    return NextResponse.json({ thoughts });
  } catch (error) {
    console.error('Error fetching real-time thoughts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch thoughts' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const {
      sessionId,
      chunkNumber,
      chunkStartTime,
      chunkEndTime,
      transcriptText,
      aiThought,
      processingTimeMs,
      status = 'completed',
    } = await request.json();

    if (
      !sessionId ||
      chunkNumber === undefined ||
      !transcriptText ||
      !aiThought
    ) {
      return NextResponse.json(
        {
          error:
            'sessionId, chunkNumber, transcriptText, and aiThought are required',
        },
        { status: 400 },
      );
    }

    const thoughtId = createId();
    const supabase = getSupabase();
    const { data: newThought, error } = await supabase
      .from('real_time_thoughts')
      .insert({
        id: thoughtId,
        session_id: sessionId,
        chunk_number: chunkNumber,
        chunk_start_time: chunkStartTime ? parseInt(chunkStartTime) : 0,
        chunk_end_time: chunkEndTime ? parseInt(chunkEndTime) : 0,
        transcript_text: transcriptText,
        ai_thought: aiThought,
        processing_time_ms: processingTimeMs,
        status,
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({ thought: newThought }, { status: 201 });
  } catch (error) {
    console.error('Error creating real-time thought:', error);
    return NextResponse.json(
      { error: 'Failed to create thought' },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { thoughtId, status, aiThought, processingTimeMs } =
      await request.json();

    if (!thoughtId) {
      return NextResponse.json(
        { error: 'thoughtId is required' },
        { status: 400 },
      );
    }

    const supabase = getSupabase();
    const updateData: any = {};
    if (status) updateData.status = status;
    if (aiThought) updateData.ai_thought = aiThought;
    if (processingTimeMs !== undefined) updateData.processing_time_ms = processingTimeMs;

    const { data: updatedThought, error } = await supabase
      .from('real_time_thoughts')
      .update(updateData)
      .eq('id', thoughtId)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows updated - thought not found
        return NextResponse.json({ error: 'Thought not found' }, { status: 404 });
      }
      throw error;
    }

    return NextResponse.json({ thought: updatedThought });
  } catch (error) {
    console.error('Error updating real-time thought:', error);
    return NextResponse.json(
      { error: 'Failed to update thought' },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const thoughtId = searchParams.get('thoughtId');

    if (!thoughtId) {
      return NextResponse.json(
        { error: 'thoughtId is required' },
        { status: 400 },
      );
    }

    const supabase = getSupabase();
    const { data: deletedThought, error } = await supabase
      .from('real_time_thoughts')
      .delete()
      .eq('id', thoughtId)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows deleted - thought not found
        return NextResponse.json({ error: 'Thought not found' }, { status: 404 });
      }
      throw error;
    }

    return NextResponse.json({ message: 'Thought deleted successfully' });
  } catch (error) {
    console.error('Error deleting real-time thought:', error);
    return NextResponse.json(
      { error: 'Failed to delete thought' },
      { status: 500 },
    );
  }
}
