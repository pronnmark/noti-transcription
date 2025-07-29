import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '../../../../lib/database/client';
import { audioFiles } from '../../../../lib/database/schema/audio';
import { transcriptionJobs } from '../../../../lib/database/schema/transcripts';
import {
  summarizations,
  summarizationPrompts,
} from '../../../../lib/database/schema';
import { eq, desc } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> },
) {
  try {
    const { fileId } = await params;
    const fileIdInt = parseInt(fileId);
    const db = getDb();

    // Get file
    const file = await db
      .select()
      .from(audioFiles)
      .where(eq(audioFiles.id, fileIdInt))
      .limit(1);

    if (!file.length) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    // Get summarizations for this file with template details
    const summaries = await db
      .select({
        id: summarizations.id,
        content: summarizations.content,
        model: summarizations.model,
        prompt: summarizations.prompt,
        createdAt: summarizations.createdAt,
        updatedAt: summarizations.updatedAt,
        templateId: summarizations.templateId,
        templateName: summarizationPrompts.name,
        templateDescription: summarizationPrompts.description,
        templateIsDefault: summarizationPrompts.isDefault,
      })
      .from(summarizations)
      .leftJoin(
        summarizationPrompts,
        eq(summarizations.templateId, summarizationPrompts.id),
      )
      .where(eq(summarizations.fileId, fileIdInt))
      .orderBy(desc(summarizations.createdAt));

    // Restructure summaries to include nested template objects
    const formattedSummaries = summaries.map(summary => ({
      id: summary.id,
      content: summary.content,
      model: summary.model,
      prompt: summary.prompt,
      createdAt: summary.createdAt,
      updatedAt: summary.updatedAt,
      template: summary.templateId
        ? {
          id: summary.templateId,
          name: summary.templateName,
          description: summary.templateDescription,
          isDefault: summary.templateIsDefault,
        }
        : null,
    }));

    return NextResponse.json({
      file: {
        id: file[0].id,
        fileName: file[0].fileName,
        originalFileName: file[0].originalFileName,
      },
      summarizations: formattedSummaries,
      totalSummaries: formattedSummaries.length,
    });
  } catch (error) {
    console.error('Error fetching summarization:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> },
) {
  try {
    const { fileId } = await params;
    const fileIdInt = parseInt(fileId);
    const body = await request.json();
    const { templateId, customPrompt } = body;
    const db = getDb();

    // Get file
    const file = await db
      .select()
      .from(audioFiles)
      .where(eq(audioFiles.id, fileIdInt))
      .limit(1);

    if (!file.length) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    // Get transcript
    const transcription = await db
      .select()
      .from(transcriptionJobs)
      .where(eq(transcriptionJobs.fileId, fileIdInt))
      .limit(1);

    if (!transcription.length || !transcription[0].transcript) {
      return NextResponse.json(
        { error: 'File not transcribed yet' },
        { status: 400 },
      );
    }

    // Get template if provided
    let template = null;
    if (templateId) {
      const templates = await db
        .select()
        .from(summarizationPrompts)
        .where(eq(summarizationPrompts.id, templateId))
        .limit(1);

      if (templates.length) {
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
              `${segment.speaker || 'Speaker'}: ${segment.text}`,
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
          prompt,
        );

        const modelInfo = customAIService.getModelInfo();
        model = modelInfo.name || 'unknown-model';
      } catch (aiError) {
        console.error('AI summarization failed:', aiError);

        // Fallback to informative message when AI is not configured
        summary =
          `Summary of ${file[0].originalFileName}:\n\n` +
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
      await db.insert(summarizations).values({
        id: summaryId,
        fileId: fileIdInt,
        templateId: templateId || null,
        model: model,
        prompt: prompt.substring(0, 1000),
        content: summary,
      });

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
        { status: 500 },
      );
    }
  } catch (error) {
    console.error('Error generating summarization:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
