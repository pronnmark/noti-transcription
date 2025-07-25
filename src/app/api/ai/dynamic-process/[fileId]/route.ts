import { NextRequest, NextResponse } from 'next/server';
import { db, summarizationPrompts, audioFiles, transcriptionJobs, aiProcessingSessions } from '@/lib/db';
import { dynamicPromptGenerator } from '@/lib/services/dynamicPromptGenerator';
import { customAIService } from '@/lib/services/customAI';
import { and, eq } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import {
  createDebugLogger,
  handleAuthCheck,
  parseFileParams,
  updateFileTimestamp,
  createErrorResponse,
  createSuccessResponse,
  validateQueryResult,
  withErrorHandler,
} from '@/lib/api-utils';

const debugLog = createDebugLogger('ai-dynamic-process');

export const POST = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> },
) => {
  const fileIdInt = await parseFileParams(params);
  const body = await request.json();

  const {
    summarizationPromptId,
    extractionDefinitionIds = [],
    customSummarizationPrompt,
  } = body;

  // Validate summarization template ID exists in database before processing
  if (summarizationPromptId) {
    const validTemplate = await db
      .select()
      .from(summarizationPrompts)
      .where(
        and(
          eq(summarizationPrompts.id, summarizationPromptId),
          eq(summarizationPrompts.isActive, true),
        ),
      )
      .limit(1);

    if (!validTemplate || validTemplate.length === 0) {
      debugLog(`❌ Invalid summarization template ID: ${summarizationPromptId}`);
      return createErrorResponse(
        'Invalid summarization template ID provided',
        400,
        { invalidTemplateId: summarizationPromptId },
      );
    }
  }

  // Get file
  const file = await db
    .select()
    .from(audioFiles)
    .where(eq(audioFiles.id, fileIdInt))
    .limit(1);

  const fileRecord = validateQueryResult(file, 'File');
  if (fileRecord instanceof NextResponse) {
    return fileRecord;
  }

  // Get transcript from transcription jobs
  const transcriptionJob = await db
    .select()
    .from(transcriptionJobs)
    .where(eq(transcriptionJobs.fileId, fileIdInt))
    .limit(1);

  const transcriptRecord = validateQueryResult(transcriptionJob, 'Transcription job');
  if (transcriptRecord instanceof NextResponse) {
    return transcriptRecord;
  }

  if (!transcriptRecord.transcript) {
    return createErrorResponse('File not transcribed yet', 400);
  }

  debugLog(`🤖 Starting dynamic AI processing for file ${fileIdInt}`);
  debugLog(`📝 Summarization prompt: ${summarizationPromptId || 'default'}`);
  debugLog(`🔍 Extraction definitions: ${extractionDefinitionIds.join(', ')}`);

  // Create processing session
  const sessionId = createId();
  const startTime = Date.now();

  // Update file timestamp
  await updateFileTimestamp(fileIdInt);

  // Get the configured AI model outside try block for error handling access
  const configuredModel = await customAIService.getDefaultModel();
  let extractionMap: Record<string, any> = {};

  try {
    // Generate dynamic prompt
    const { systemPrompt, expectedJsonSchema, extractionMap: generatedExtractionMap } = await dynamicPromptGenerator.generatePrompt({
      summarizationPromptId,
      extractionDefinitionIds,
      useCustomSummarizationPrompt: customSummarizationPrompt,
    });

    extractionMap = generatedExtractionMap;

    debugLog(`📋 Generated system prompt (${systemPrompt.length} chars)`);
    debugLog(`🔧 Extraction map:`, Object.keys(extractionMap));

    // Format transcript for AI
    const transcriptText = formatTranscriptForAI(transcriptRecord.transcript || []);

    // Create AI processing session record
    await db.insert(aiProcessingSessions).values({
      id: sessionId,
      fileId: fileIdInt,
      summarizationPromptId: summarizationPromptId || null,
      extractionDefinitionIds: extractionDefinitionIds,
      systemPrompt,
      aiResponse: '', // Will be updated after AI response
      status: 'processing',
      model: configuredModel,
    });

    // Call AI with dynamic prompt and structured JSON output
    const aiResponse = await customAIService.generateText(
      `Please analyze this transcript:\n\n${transcriptText}`,
      {
        model: configuredModel,
        maxTokens: 8000,
        temperature: 0.2,
        systemPrompt,
        jsonSchema: expectedJsonSchema,
      },
    );

    debugLog(`🤖 AI response received (${aiResponse.length} chars)`);
    debugLog(`📊 Sample response:`, aiResponse.substring(0, 200) + '...');

    // Update session with AI response
    await db.update(aiProcessingSessions)
      .set({
        aiResponse,
        status: 'completed',
        processingTime: Date.now() - startTime,
        completedAt: new Date(),
      })
      .where(eq(aiProcessingSessions.id, sessionId));

    // Parse and store results
    const { success, extractionResults, error } = await dynamicPromptGenerator.parseAndStoreResults(
      fileIdInt,
      aiResponse,
      extractionMap,
      sessionId,
      configuredModel,
      summarizationPromptId,
    );

    if (!success) {
      throw new Error(`Failed to parse AI response: ${error}`);
    }

    // Update file timestamp
    await updateFileTimestamp(fileIdInt);

    debugLog(`✅ Dynamic AI processing completed for file ${fileIdInt}`);
    debugLog(`📊 Extracted ${extractionResults.length} result groups`);

    return createSuccessResponse({
      sessionId,
      extractionResults: extractionResults.length,
      processingTime: Date.now() - startTime,
      fileId: fileIdInt,
    });

  } catch (aiError) {
    debugLog('Dynamic AI processing error:', aiError);

    // Create graceful fallback with empty results
    try {
      const fallbackResponse = await dynamicPromptGenerator.parseAndStoreResults(
        fileIdInt,
        '', // Empty response triggers fallback behavior
        extractionMap,
        sessionId,
        configuredModel,
        summarizationPromptId,
      );

      // Update session with partial success
      await db.update(aiProcessingSessions)
        .set({
          status: 'completed',
          error: `AI processing failed, fallback applied: ${String(aiError)}`,
          processingTime: Date.now() - startTime,
          completedAt: new Date(),
          aiResponse: 'Fallback response due to AI processing failure',
        })
        .where(eq(aiProcessingSessions.id, sessionId));

      // Update file timestamp
      await updateFileTimestamp(fileIdInt);

      return createSuccessResponse({
        sessionId,
        extractionResults: fallbackResponse.extractionResults.length,
        processingTime: Date.now() - startTime,
        fileId: fileIdInt,
        warning: 'AI processing failed, fallback response created with empty arrays/objects',
      });

    } catch (fallbackError) {
      debugLog('Fallback processing also failed:', fallbackError);

      // Update session with error
      await db.update(aiProcessingSessions)
        .set({
          status: 'failed',
          error: String(aiError),
          processingTime: Date.now() - startTime,
          completedAt: new Date(),
        })
        .where(eq(aiProcessingSessions.id, sessionId));

      // Update file timestamp
      await updateFileTimestamp(fileIdInt);

      return createErrorResponse(
        'Failed to process with AI and fallback failed',
        500,
        { details: String(aiError), sessionId },
      );
    }
  }

});

/**
 * Format transcript for AI processing
 */
function formatTranscriptForAI(transcript: string | any[]): string {
  if (typeof transcript === 'string') {
    return transcript;
  }

  if (Array.isArray(transcript)) {
    return transcript.map(segment => {
      const speaker = segment.speaker ? `${segment.speaker}: ` : '';
      const timestamp = segment.start ? `[${Math.floor(segment.start / 60)}:${String(Math.floor(segment.start % 60)).padStart(2, '0')}] ` : '';
      return `${timestamp}${speaker}${segment.text}`;
    }).join('\n');
  }

  return String(transcript);
}

/**
 * Get extraction results for a file
 */
export const GET = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> },
) => {
  const authError = await handleAuthCheck(request);
  if (authError) return authError;

  const fileIdInt = await parseFileParams(params);

  // Get extraction results
  const extractionResults = await dynamicPromptGenerator.getExtractionResults(fileIdInt);

  // Get file info
  const fileInfo = await db
    .select()
    .from(audioFiles)
    .where(eq(audioFiles.id, fileIdInt))
    .limit(1);

  return createSuccessResponse({
    fileId: fileIdInt,
    fileName: fileInfo?.[0]?.fileName || 'Unknown',
    summarization: null, // Summarization would be fetched from summarizations table
    extractionResults,
  });
});
