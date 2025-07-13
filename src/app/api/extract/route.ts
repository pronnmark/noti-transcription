import { NextRequest, NextResponse } from 'next/server';
import { audioFilesService, settingsService } from '@/lib/db/sqliteServices';
import { createAIExtract } from '@/lib/services/openrouter';
import { requireAuth } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const isAuthenticated = await requireAuth(request);
    if (!isAuthenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { fileId, prompt, model } = await request.json();

    if (!fileId) {
      return NextResponse.json({ error: 'File ID is required' }, { status: 400 });
    }

    // Get file and transcript
    const file = await audioFilesService.findById(parseInt(fileId));
    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    if (!file.transcript || file.transcript.length === 0) {
      return NextResponse.json({ error: 'No transcript available for this file' }, { status: 400 });
    }

    // Get settings for default model and prompt
    const settings = await settingsService.get();
    const defaultModel = settings?.aiExtractModel || 'anthropic/claude-4';
    const defaultPrompt = settings?.aiExtractPrompt || 'Summarize the key points from this transcript.';

    // Convert transcript segments to text
    const transcriptText = file.transcript
      .map((segment: any) => {
        const speaker = segment.speaker ? `${segment.speaker}: ` : '';
        return `${speaker}${segment.text}`;
      })
      .join('\n');

    console.log(`🤖 Starting AI extraction for file ${fileId}...`);
    console.log(`Model: ${model || defaultModel}`);
    console.log(`Prompt: ${prompt || defaultPrompt}`);
    console.log(`Transcript length: ${transcriptText.length} characters`);

    // Update file status to processing
    await audioFilesService.update(parseInt(fileId), { 
      aiExtractStatus: 'processing' 
    });

    try {
      // Perform AI extraction
      const extractedContent = await createAIExtract(
        parseInt(fileId),
        transcriptText,
        prompt || defaultPrompt,
        model || defaultModel
      );

      console.log(`✅ AI extraction completed for file ${fileId}`);
      console.log(`Extracted content length: ${extractedContent.length} characters`);

      return NextResponse.json({
        success: true,
        content: extractedContent,
        model: model || defaultModel,
        prompt: prompt || defaultPrompt
      });

    } catch (extractError) {
      console.error('AI extraction failed:', extractError);
      
      // Update file status to failed
      await audioFilesService.update(parseInt(fileId), { 
        aiExtractStatus: 'failed',
        lastError: extractError instanceof Error ? extractError.message : 'AI extraction failed'
      });

      return NextResponse.json(
        { 
          error: 'AI extraction failed', 
          details: extractError instanceof Error ? extractError.message : 'Unknown error'
        }, 
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Extract API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}

// GET endpoint to retrieve existing extracts
export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const isAuthenticated = await requireAuth(request);
    if (!isAuthenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get('fileId');

    if (!fileId) {
      return NextResponse.json({ error: 'File ID is required' }, { status: 400 });
    }

    // Get file with AI extract
    const file = await audioFilesService.findById(parseInt(fileId));
    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    return NextResponse.json({
      hasExtract: !!file.aiExtract,
      content: file.aiExtract || null,
      status: file.aiExtractStatus || 'pending',
      extractedAt: file.aiExtractedAt || null
    });

  } catch (error) {
    console.error('Get extract API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}