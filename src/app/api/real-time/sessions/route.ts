import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/database/client';
import { createId } from '@paralleldrive/cuid2';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get('fileId');
    const supabase = getSupabase();

    if (fileId) {
      // Get sessions for a specific file
      const { data: sessions, error } = await supabase
        .from('real_time_sessions')
        .select('*')
        .eq('file_id', parseInt(fileId))
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      return NextResponse.json({ sessions });
    } else {
      // Get all sessions
      const { data: sessions, error } = await supabase
        .from('real_time_sessions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        throw error;
      }

      return NextResponse.json({ sessions });
    }
  } catch (error) {
    console.error('Error fetching real-time sessions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sessions' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { fileId, chunkIntervalMs, aiInstruction } = await request.json();

    if (!fileId || !chunkIntervalMs || !aiInstruction) {
      return NextResponse.json(
        { error: 'fileId, chunkIntervalMs, and aiInstruction are required' },
        { status: 400 }
      );
    }

    const supabase = getSupabase();

    // Check if there's already an active session for this file
    const { data: existingSession, error: checkError } = await supabase
      .from('real_time_sessions')
      .select('*')
      .eq('file_id', fileId)
      .order('created_at', { ascending: false })
      .limit(1);

    if (checkError) {
      throw checkError;
    }

    if (
      existingSession &&
      existingSession.length > 0 &&
      existingSession[0].status === 'active'
    ) {
      return NextResponse.json(
        { error: 'An active real-time session already exists for this file' },
        { status: 409 }
      );
    }

    const sessionId = createId();
    const { data: newSession, error: insertError } = await supabase
      .from('real_time_sessions')
      .insert({
        id: sessionId,
        file_id: fileId,
        chunk_interval_ms: chunkIntervalMs,
        ai_instruction: aiInstruction,
        status: 'active',
        total_chunks: 0,
      })
      .select()
      .single();

    if (insertError) {
      throw insertError;
    }

    return NextResponse.json({ session: newSession }, { status: 201 });
  } catch (error) {
    console.error('Error creating real-time session:', error);
    return NextResponse.json(
      { error: 'Failed to create session' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { sessionId, status, endedAt, totalChunks } = await request.json();

    if (!sessionId) {
      return NextResponse.json(
        { error: 'sessionId is required' },
        { status: 400 }
      );
    }

    const supabase = getSupabase();
    const updateData: any = {};
    if (status) updateData.status = status;
    if (endedAt) updateData.ended_at = new Date(endedAt).toISOString();
    if (totalChunks !== undefined) updateData.total_chunks = totalChunks;

    const { data: updatedSession, error: updateError } = await supabase
      .from('real_time_sessions')
      .update(updateData)
      .eq('id', sessionId)
      .select()
      .single();

    if (updateError) {
      if (updateError.code === 'PGRST116') {
        // No rows updated - session not found
        return NextResponse.json(
          { error: 'Session not found' },
          { status: 404 }
        );
      }
      throw updateError;
    }

    return NextResponse.json({ session: updatedSession });
  } catch (error) {
    console.error('Error updating real-time session:', error);
    return NextResponse.json(
      { error: 'Failed to update session' },
      { status: 500 }
    );
  }
}
