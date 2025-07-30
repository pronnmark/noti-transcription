import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '../../../../lib/database/client';
import { v4 as uuidv4 } from 'uuid';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  try {
    const { fileId } = await params;
    const fileIdInt = parseInt(fileId);
    const supabase = getSupabase();

    // Get file
    const { data: file, error: fileError } = await supabase
      .from('audio_files')
      .select('*')
      .eq('id', fileIdInt)
      .limit(1);

    if (fileError || !file || file.length === 0) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    // Get summarizations for this file with template details
    const { data: summaries, error: summariesError } = await supabase
      .from('summarizations')
      .select(
        `
        id,
        content,
        model,
        prompt,
        created_at,
        updated_at,
        template_id,
        summarization_prompts (
          id,
          name,
          description,
          is_default
        )
      `
      )
      .eq('file_id', fileIdInt)
      .order('created_at', { ascending: false });

    if (summariesError) {
      throw summariesError;
    }

    // Restructure summaries to include nested template objects
    const formattedSummaries = (summaries || []).map((summary: any) => ({
      id: summary.id,
      content: summary.content,
      model: summary.model,
      prompt: summary.prompt,
      createdAt: summary.created_at,
      updatedAt: summary.updated_at,
      template:
        summary.template_id && summary.summarization_prompts
          ? {
              id: summary.template_id,
              name: summary.summarization_prompts.name,
              description: summary.summarization_prompts.description,
              isDefault: summary.summarization_prompts.is_default,
            }
          : null,
    }));

    return NextResponse.json({
      file: {
        id: file[0].id,
        fileName: file[0].file_name,
        originalFileName: file[0].original_file_name,
      },
      summarizations: formattedSummaries,
      totalSummaries: formattedSummaries.length,
    });
  } catch (error) {
    console.error('Error fetching summarization:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  try {
    const { fileId } = await params;
    const fileIdInt = parseInt(fileId);
    const body = await request.json();
    const { templateId, customPrompt } = body;
    const supabase = getSupabase();

    // Get file
    const { data: file, error: fileError } = await supabase
      .from('audio_files')
      .select('*')
      .eq('id', fileIdInt)
      .limit(1);

    if (fileError || !file || file.length === 0) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    // Get transcript
    const { data: transcription, error: transcriptionError } = await supabase
      .from('transcription_jobs')
      .select('*')
      .eq('file_id', fileIdInt)
      .limit(1);

    if (
      transcriptionError ||
      !transcription ||
      transcription.length === 0 ||
      !transcription[0].transcript
    ) {
      return NextResponse.json(
        { error: 'File not transcribed yet' },
        { status: 400 }
      );
    }

    // Get template if provided
    let template = null;
    if (templateId) {
      const { data: templates, error: templateError } = await supabase
        .from('summarization_prompts')
        .select('*')
        .eq('id', templateId)
        .limit(1);

      if (!templateError && templates && templates.length > 0) {
        template = templates[0];
      }
    }

    // Use template prompt or custom prompt or default
    const prompt =
      customPrompt ||
      template?.prompt ||
      `
      Please provide a comprehensive summary of the following transcript:
      
      Guidelines:
      1. Identify key topics and themes
      2. Highlight important decisions made
      3. Note any action items or follow-ups
      4. Summarize the main outcomes
      5. Keep it concise but comprehensive
      
      Transcript:
      {transcript}
    `;

    try {
      // Format transcript - handle both string and already-parsed JSON
      let transcriptData;
      if (typeof transcription[0].transcript === 'string') {
        transcriptData = JSON.parse(transcription[0].transcript);
      } else {
        transcriptData = transcription[0].transcript;
      }

      const transcriptText = Array.isArray(transcriptData)
        ? transcriptData
            .map(
              (segment: any) =>
                `${segment.speaker || 'Speaker'}: ${segment.text}`
            )
            .join('\n')
        : String(transcriptData);

      // Try to use AI service for real summarization
      let summary: string;
      let model: string = 'unconfigured'; // Default value to prevent NOT NULL constraint error

      try {
        const { customAIService } = await import('@/lib/services/customAI');

        // Generate real AI summary
        summary = await customAIService.extractFromTranscript(
          transcriptText,
          prompt
        );

        const modelInfo = customAIService.getModelInfo();
        model = modelInfo.name || 'unknown-model';
      } catch (aiError) {
        console.error('AI summarization failed:', aiError);

        // Fallback to informative message when AI is not configured
        summary =
          `Summary of ${file[0].original_file_name}:\n\n` +
          `AI summarization is not available. Error: ${aiError instanceof Error ? aiError.message : 'Unknown error'}\n\n` +
          `To enable AI summarization, please:\n` +
          `1. Set CUSTOM_AI_BASE_URL, CUSTOM_AI_API_KEY, and CUSTOM_AI_MODEL environment variables, OR\n` +
          `2. Configure custom AI endpoint in Settings\n\n` +
          `Transcript length: ${transcriptText.length} characters\n` +
          `Number of segments: ${Array.isArray(transcriptData) ? transcriptData.length : 1}`;

        // Ensure model is set to fallback value
        model = 'unconfigured';
      }

      // Additional safety check to ensure model is never null/undefined
      if (!model || model.trim() === '') {
        model = 'unconfigured';
      }

      // Store in summarizations table
      const summaryId = uuidv4();
      const { error: insertError } = await supabase
        .from('summarizations')
        .insert({
          id: summaryId,
          file_id: fileIdInt,
          template_id: templateId || null,
          model: model,
          prompt: prompt.substring(0, 1000),
          content: summary,
        });

      if (insertError) {
        throw insertError;
      }

      return NextResponse.json({
        success: true,
        summary: summary,
        status: 'completed',
      });
    } catch (aiError) {
      console.error('Summarization error:', aiError);
      return NextResponse.json(
        {
          error: 'Failed to generate summary',
          details: String(aiError),
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error generating summarization:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
