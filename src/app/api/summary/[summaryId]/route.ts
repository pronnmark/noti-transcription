import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '../../../../lib/database/client';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ summaryId: string }> }
) {
  try {
    const { summaryId } = await params;
    const supabase = getSupabase();

    // Get the specific summary with related file and template info
    const { data: summaryResults, error } = await supabase
      .from('summarizations')
      .select(
        `
        id,
        content,
        model,
        prompt,
        created_at,
        updated_at,
        file_id,
        template_id,
        audio_files (
          file_name,
          original_file_name
        ),
        summarization_prompts (
          id,
          name,
          description,
          is_default
        )
      `
      )
      .eq('id', summaryId)
      .limit(1);

    if (error || !summaryResults || summaryResults.length === 0) {
      return NextResponse.json({ error: 'Summary not found' }, { status: 404 });
    }

    const result: any = summaryResults[0];

    // Format the response
    const summary = {
      id: result.id,
      content: result.content,
      model: result.model,
      prompt: result.prompt,
      createdAt: result.created_at,
      updatedAt: result.updated_at,
      file: {
        id: result.file_id,
        fileName: result.audio_files?.file_name,
        originalFileName: result.audio_files?.original_file_name,
      },
      template:
        result.template_id && result.summarization_prompts
          ? {
              id: result.template_id,
              name: result.summarization_prompts.name,
              description: result.summarization_prompts.description,
              isDefault: result.summarization_prompts.is_default,
            }
          : null,
    };

    return NextResponse.json({
      summary,
      success: true,
    });
  } catch (error) {
    console.error('Error fetching summary:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ summaryId: string }> }
) {
  try {
    const { summaryId } = await params;
    const supabase = getSupabase();

    // First check if the summary exists
    const { data: existingSummary, error: checkError } = await supabase
      .from('summarizations')
      .select('id')
      .eq('id', summaryId)
      .limit(1);

    if (checkError || !existingSummary || existingSummary.length === 0) {
      return NextResponse.json({ error: 'Summary not found' }, { status: 404 });
    }

    // Delete the summary
    const { error: deleteError } = await supabase
      .from('summarizations')
      .delete()
      .eq('id', summaryId);

    if (deleteError) {
      throw deleteError;
    }

    return NextResponse.json({
      success: true,
      message: 'Summary deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting summary:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
