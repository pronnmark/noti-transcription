import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/database/client';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const fileId = parseInt(id);

    if (isNaN(fileId)) {
      return NextResponse.json({ error: 'Invalid file ID' }, { status: 400 });
    }

    const supabase = getSupabase();

    // Get speaker labels for this file
    const { data: result, error } = await supabase
      .from('speaker_labels')
      .select('labels')
      .eq('file_id', fileId)
      .limit(1);

    if (error) {
      console.error('Failed to get speaker labels:', error);
      return NextResponse.json(
        { error: 'Failed to get speaker labels' },
        { status: 500 },
      );
    }

    const labels = result && result[0]?.labels || {};

    return NextResponse.json({
      fileId,
      labels,
      hasCustomNames: Object.keys(labels).length > 0,
    });
  } catch (error) {
    console.error('Failed to get speaker labels:', error);
    return NextResponse.json(
      { error: 'Failed to get speaker labels' },
      { status: 500 },
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const fileId = parseInt(id);

    if (isNaN(fileId)) {
      return NextResponse.json({ error: 'Invalid file ID' }, { status: 400 });
    }

    const body = await request.json();
    const { labels } = body;

    if (!labels || typeof labels !== 'object') {
      return NextResponse.json(
        { error: 'Invalid labels format' },
        { status: 400 },
      );
    }

    // Validate that speaker IDs follow expected format
    for (const speakerId of Object.keys(labels)) {
      if (!speakerId.startsWith('SPEAKER_')) {
        return NextResponse.json(
          {
            error: `Invalid speaker ID format: ${speakerId}. Expected format: SPEAKER_XX`,
          },
          { status: 400 },
        );
      }
    }

    const supabase = getSupabase();
    const now = new Date().toISOString();

    // Check if labels already exist for this file
    const { data: existing, error: checkError } = await supabase
      .from('speaker_labels')
      .select('file_id')
      .eq('file_id', fileId)
      .limit(1);

    if (checkError) {
      console.error('Failed to check existing speaker labels:', checkError);
      return NextResponse.json(
        { error: 'Failed to check existing labels' },
        { status: 500 },
      );
    }

    if (existing && existing.length > 0) {
      // Update existing labels
      const { error: updateError } = await supabase
        .from('speaker_labels')
        .update({
          labels: labels,
          updated_at: now,
        })
        .eq('file_id', fileId);

      if (updateError) {
        console.error('Failed to update speaker labels:', updateError);
        return NextResponse.json(
          { error: 'Failed to update speaker labels' },
          { status: 500 },
        );
      }
    } else {
      // Insert new labels
      const { error: insertError } = await supabase
        .from('speaker_labels')
        .insert({
          file_id: fileId,
          labels: labels,
          created_at: now,
          updated_at: now,
        });

      if (insertError) {
        console.error('Failed to insert speaker labels:', insertError);
        return NextResponse.json(
          { error: 'Failed to save speaker labels' },
          { status: 500 },
        );
      }
    }

    return NextResponse.json({
      success: true,
      fileId,
      labels,
      updatedAt: now,
    });
  } catch (error) {
    console.error('Failed to save speaker labels:', error);
    return NextResponse.json(
      { error: 'Failed to save speaker labels' },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const fileId = parseInt(id);

    if (isNaN(fileId)) {
      return NextResponse.json({ error: 'Invalid file ID' }, { status: 400 });
    }

    const supabase = getSupabase();

    // Delete speaker labels for this file
    const { error } = await supabase
      .from('speaker_labels')
      .delete()
      .eq('file_id', fileId);

    if (error) {
      console.error('Failed to delete speaker labels:', error);
      return NextResponse.json(
        { error: 'Failed to reset speaker labels' },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Speaker labels reset successfully',
    });
  } catch (error) {
    console.error('Failed to delete speaker labels:', error);
    return NextResponse.json(
      { error: 'Failed to reset speaker labels' },
      { status: 500 },
    );
  }
}