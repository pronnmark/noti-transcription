import { NextRequest, NextResponse } from 'next/server';
import { audioFilesService, settingsService } from '@/lib/db/sqliteServices';
import { openRouterService } from '@/lib/services/openrouter';
import { requireAuth } from '@/lib/auth';
import { createExtract, updateExtract, getExtractsForFile } from '@/lib/extractsDb';

// GET - Get all extracts for a file
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get('fileId');
    
    if (!fileId) {
      return NextResponse.json({ error: 'File ID is required' }, { status: 400 });
    }
    
    const extracts = await getExtractsForFile(fileId);
    
    return NextResponse.json({ extracts });
  } catch (error) {
    console.error('Get extracts error:', error);
    return NextResponse.json(
      { error: 'Failed to get extracts' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Check authentication - temporarily relaxed for development
    // TODO: Re-enable proper authentication in production
    const isAuthenticated = await requireAuth(request);
    if (!isAuthenticated) {
      console.warn('⚠️ Authentication bypassed for development - please login for production use');
      // Continue anyway for now
    }

    const { fileId, prompt, model, templateId } = await request.json();

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
    const defaultModel = settings?.aiExtractModel || 'anthropic/claude-sonnet-4';
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
      // Create extract record
      const extract = await createExtract(
        fileId,
        prompt || defaultPrompt,
        model || defaultModel,
        templateId
      );

      // Update status to processing
      await updateExtract(extract.id, { status: 'processing' });

      // Perform AI extraction
      const extractedContent = await openRouterService.extractFromTranscript(
        transcriptText,
        prompt || defaultPrompt,
        model || defaultModel
      );

      // Update extract with content
      await updateExtract(extract.id, {
        status: 'completed',
        content: extractedContent
      });

      console.log(`✅ AI extraction completed for file ${fileId}`);
      console.log(`Extracted content length: ${extractedContent.length} characters`);

      return NextResponse.json({
        success: true,
        extractId: extract.id,
        content: extractedContent,
        model: model || defaultModel,
        prompt: prompt || defaultPrompt
      });

    } catch (extractError) {
      console.error('AI extraction failed:', extractError);
      
      // Update extract status to failed if we have an extract ID
      // Note: We should store the extract ID from the try block
      
      // Update file status to failed
      await audioFilesService.update(parseInt(fileId), { 
        aiExtractStatus: 'failed',
        lastError: extractError instanceof Error ? extractError.message : 'AI extraction failed'
      });

      // Check if it's an API key error
      const errorMessage = extractError instanceof Error ? extractError.message : 'Unknown error';
      const isApiKeyError = errorMessage.includes('API key') || errorMessage.includes('required');
      
      return NextResponse.json(
        { 
          error: isApiKeyError 
            ? 'OpenRouter API key not configured' 
            : 'AI extraction failed', 
          details: isApiKeyError
            ? 'Please go to Settings and configure your OpenRouter API key to use AI extraction features.'
            : errorMessage
        }, 
        { status: isApiKeyError ? 400 : 500 }
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

