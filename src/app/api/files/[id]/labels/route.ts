import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '../../../../../lib/database/client';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const fileId = parseInt(id);
    const supabase = getSupabase();

    // Get labels for this file
    const { data: labelRecord, error } = await supabase
      .from('file_labels')
      .select('labels')
      .eq('file_id', fileId)
      .limit(1);

    if (error) {
      console.error('Error fetching file labels:', error);
      return NextResponse.json(
        { error: 'Failed to fetch labels' },
        { status: 500 },
      );
    }

    const labels = labelRecord && labelRecord.length > 0 ? labelRecord[0].labels || [] : [];

    return NextResponse.json({
      fileId,
      labels,
      success: true,
    });
  } catch (error) {
    console.error('Error fetching file labels:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
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
    const { labels } = await request.json();
    const supabase = getSupabase();

    // Validate that file exists
    const { data: file, error: fileError } = await supabase
      .from('audio_files')
      .select('id')
      .eq('id', fileId)
      .limit(1);

    if (fileError || !file || file.length === 0) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    // Validate labels format
    if (
      !Array.isArray(labels) ||
      !labels.every(label => typeof label === 'string')
    ) {
      return NextResponse.json(
        { error: 'Labels must be an array of strings' },
        { status: 400 },
      );
    }

    // Clean and deduplicate labels
    const processedLabels = labels
      .map(label => label.trim())
      .filter(label => label.length > 0 && label.length <= 50);
    const cleanLabels = Array.from(new Set(processedLabels));

    // Check if labels record exists
    const { data: existingRecord, error: checkError } = await supabase
      .from('file_labels')
      .select('id')
      .eq('file_id', fileId)
      .limit(1);

    if (checkError) {
      console.error('Error checking existing labels:', checkError);
      return NextResponse.json(
        { error: 'Failed to check existing labels' },
        { status: 500 },
      );
    }

    if (existingRecord && existingRecord.length > 0) {
      // Update existing record
      const { error: updateError } = await supabase
        .from('file_labels')
        .update({
          labels: cleanLabels,
          updated_at: new Date().toISOString(),
        })
        .eq('file_id', fileId);

      if (updateError) {
        console.error('Error updating file labels:', updateError);
        return NextResponse.json(
          { error: 'Failed to update labels' },
          { status: 500 },
        );
      }
    } else {
      // Create new record
      const { error: insertError } = await supabase
        .from('file_labels')
        .insert({
          file_id: fileId,
          labels: cleanLabels,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

      if (insertError) {
        console.error('Error creating file labels:', insertError);
        return NextResponse.json(
          { error: 'Failed to create labels' },
          { status: 500 },
        );
      }
    }

    return NextResponse.json({
      fileId,
      labels: cleanLabels,
      success: true,
    });
  } catch (error) {
    console.error('Error updating file labels:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}