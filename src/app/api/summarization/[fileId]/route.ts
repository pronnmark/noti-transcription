import { NextRequest, NextResponse } from 'next/server';
import { db, schema, eq } from '@/lib/db/sqlite';
import { requireAuth } from '@/lib/auth';
import { openRouterService } from '@/lib/services/openrouter';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  try {
    // Check authentication
    const isAuthenticated = await requireAuth(request);
    if (!isAuthenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { fileId } = await params;
    const fileIdInt = parseInt(fileId);
    
    // Get file with summarization data
    const file = await db.query.audioFiles.findFirst({
      where: (audioFiles, { eq }) => eq(audioFiles.id, fileIdInt),
    });

    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    // Get summarizations for this file
    const summarizations = await db.query.summarizations?.findMany({
      where: (summarizations, { eq }) => eq(summarizations.fileId, fileIdInt),
      orderBy: (summarizations, { desc }) => [desc(summarizations.createdAt)],
    }) || [];

    return NextResponse.json({
      file: {
        id: file.id,
        fileName: file.fileName,
        originalFileName: file.originalFileName,
        summarizationStatus: file.summarizationStatus || 'pending',
        summarizationContent: file.summarizationContent,
        transcript: file.transcript,
      },
      summarizations: summarizations,
    });
  } catch (error) {
    console.error('Error fetching summarization:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  try {
    // Check authentication
    const isAuthenticated = await requireAuth(request);
    if (!isAuthenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { fileId } = await params;
    const fileIdInt = parseInt(fileId);
    const body = await request.json();
    const { templateId, customPrompt } = body;

    // Get file with transcript
    const file = await db.query.audioFiles.findFirst({
      where: (audioFiles, { eq }) => eq(audioFiles.id, fileIdInt),
    });

    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    if (!file.transcript) {
      return NextResponse.json({ error: 'File not transcribed yet' }, { status: 400 });
    }

    // Get template if provided
    let template = null;
    if (templateId) {
      template = await db.query.summarizationTemplates?.findFirst({
        where: (templates, { eq }) => eq(templates.id, templateId),
      });
    }

    // Use template prompt or custom prompt or default
    const prompt = customPrompt || template?.prompt || `
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

    // Update file status to processing
    await db.update(schema.audioFiles)
      .set({ 
        summarizationStatus: 'processing',
        updatedAt: new Date() 
      })
      .where(eq(schema.audioFiles.id, fileIdInt));

    try {
      // Format transcript for AI processing
      const transcriptText = Array.isArray(file.transcript) 
        ? file.transcript.map(segment => 
            `${segment.speaker || 'Speaker'}: ${segment.text}`
          ).join('\n')
        : String(file.transcript);

      // Generate summary using AI
      const finalPrompt = prompt.replace('{transcript}', transcriptText);
      const summary = await openRouterService.generateText(finalPrompt);

      // Update file with summarization results
      await db.update(schema.audioFiles)
        .set({ 
          summarizationStatus: 'completed',
          summarizationContent: summary,
          updatedAt: new Date() 
        })
        .where(eq(schema.audioFiles.id, fileIdInt));

      // Store in summarizations table
      await db.insert(schema.summarizations).values({
        id: `sum_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        fileId: fileIdInt,
        templateId: templateId || null,
        model: 'openrouter/auto',
        prompt: finalPrompt,
        content: summary,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      return NextResponse.json({
        success: true,
        summary: summary,
        status: 'completed'
      });

    } catch (aiError) {
      console.error('AI summarization error:', aiError);
      
      // Update file status to failed
      await db.update(schema.audioFiles)
        .set({ 
          summarizationStatus: 'failed',
          lastError: String(aiError),
          updatedAt: new Date() 
        })
        .where(eq(schema.audioFiles.id, fileIdInt));

      return NextResponse.json({ 
        error: 'Failed to generate summary',
        details: String(aiError)
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Error generating summarization:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}