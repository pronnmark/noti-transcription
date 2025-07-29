import { NextRequest, NextResponse } from 'next/server';
import { dynamicPromptGenerator } from '@/lib/services/dynamicPromptGenerator';
import { customAIService } from '@/lib/services/customAI';
import { createId } from '@paralleldrive/cuid2';
import { withAuthMiddleware } from '@/lib/middleware';
import {
  AudioRepository,
  TranscriptionRepository,
  SummarizationTemplateRepository,
} from '@/lib/database/repositories';
import { debugLog } from '@/lib/utils';
import { getDb } from '@/lib/database/client';
import { aiProcessingSessions } from '@/lib/database/schema';
import { eq } from 'drizzle-orm';

export const POST = withAuthMiddleware(
  async (request: NextRequest, context) => {
    try {
      // Extract params from the request URL
      const url = new URL(request.url);
      const pathSegments = url.pathname.split('/');
      const fileId = pathSegments[pathSegments.length - 2]; // Get fileId from URL path
      const fileIdInt = parseInt(fileId);
      if (isNaN(fileIdInt)) {
        return NextResponse.json({ error: 'Invalid file ID' }, { status: 400 });
      }

      const body = await request.json();

      const {
        summarizationPromptId,
        extractionDefinitionIds = [],
        customSummarizationPrompt,
      } = body;

      // Get repositories
      const audioRepo = new AudioRepository();
      const transcriptRepo = new TranscriptionRepository();
      const summarizationRepo = new SummarizationTemplateRepository();

      // Validate summarization template ID exists in database before processing
      if (summarizationPromptId) {
        const validTemplate = await summarizationRepo.findById(
          summarizationPromptId,
        );
        if (!validTemplate) {
          debugLog(
            'api',
            `❌ Invalid summarization template ID: ${summarizationPromptId}`,
          );
          return NextResponse.json(
            {
              error: 'Invalid summarization template ID provided',
              invalidTemplateId: summarizationPromptId,
            },
            { status: 400 },
          );
        }
      }

      // Get file
      const fileRecord = await audioRepo.findById(fileIdInt);
      if (!fileRecord) {
        return NextResponse.json({ error: 'File not found' }, { status: 404 });
      }

      // Get transcript from transcription jobs
      const transcriptionJobs = await transcriptRepo.findByFileId(fileIdInt);
      if (!transcriptionJobs || transcriptionJobs.length === 0) {
        return NextResponse.json(
          { error: 'Transcription job not found' },
          { status: 404 },
        );
      }

      const transcriptRecord = transcriptionJobs[0]; // Get the first/latest transcription job
      if (!transcriptRecord.transcript) {
        return NextResponse.json(
          { error: 'File not transcribed yet' },
          { status: 400 },
        );
      }

      debugLog(
        'api',
        `🤖 Starting dynamic AI processing for file ${fileIdInt}`,
      );
      debugLog(
        'api',
        `📝 Summarization prompt: ${summarizationPromptId || 'default'}`,
      );
      debugLog(
        'api',
        `🔍 Extraction definitions: ${extractionDefinitionIds.join(', ')}`,
      );

      // Create processing session
      const sessionId = createId();
      const startTime = Date.now();

      // Update file timestamp
      await audioRepo.updateTimestamp(fileIdInt);

      // Get the configured AI model outside try block for error handling access
      const configuredModel = await customAIService.getDefaultModel();
      let extractionMap: Record<string, unknown> = {};

      try {
        // Generate dynamic prompt
        const {
          systemPrompt,
          expectedJsonSchema,
          extractionMap: generatedExtractionMap,
        } = await dynamicPromptGenerator.generatePrompt({
          summarizationPromptId,
          extractionDefinitionIds,
          useCustomSummarizationPrompt: customSummarizationPrompt,
        });

        extractionMap = generatedExtractionMap;

        debugLog(
          'api',
          `📋 Generated system prompt (${systemPrompt.length} chars)`,
        );
        debugLog('api', `🔧 Extraction map:`, Object.keys(extractionMap));

        // Format transcript for AI
        const transcriptText = formatTranscriptForAI(
          transcriptRecord.transcript || [],
        );

        // Create AI processing session record
        await getDb()
          .insert(aiProcessingSessions)
          .values({
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

        debugLog('api', `🤖 AI response received (${aiResponse.length} chars)`);
        debugLog(
          'api',
          `📊 Sample response:`,
          aiResponse.substring(0, 200) + '...',
        );

        // Update session with AI response
        await getDb()
          .update(aiProcessingSessions)
          .set({
            aiResponse,
            status: 'completed',
            processingTime: Date.now() - startTime,
            completedAt: new Date(),
          })
          .where(eq(aiProcessingSessions.id, sessionId));

        // Parse and store results
        const { success, extractionResults, error } =
          await dynamicPromptGenerator.parseAndStoreResults(
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
        await audioRepo.updateTimestamp(fileIdInt);

        debugLog(
          'api',
          `✅ Dynamic AI processing completed for file ${fileIdInt}`,
        );
        debugLog(
          'api',
          `📊 Extracted ${extractionResults.length} result groups`,
        );

        return NextResponse.json({
          sessionId,
          extractionResults: extractionResults.length,
          processingTime: Date.now() - startTime,
          fileId: fileIdInt,
        });
      } catch (aiError) {
        debugLog('api', 'Dynamic AI processing error:', aiError);

        // Create graceful fallback with empty results
        try {
          const fallbackResponse =
            await dynamicPromptGenerator.parseAndStoreResults(
              fileIdInt,
              '', // Empty response triggers fallback behavior
              extractionMap,
              sessionId,
              configuredModel,
              summarizationPromptId,
            );

          // Update session with partial success
          await getDb()
            .update(aiProcessingSessions)
            .set({
              status: 'completed',
              error: `AI processing failed, fallback applied: ${String(aiError)}`,
              processingTime: Date.now() - startTime,
              completedAt: new Date(),
              aiResponse: 'Fallback response due to AI processing failure',
            })
            .where(eq(aiProcessingSessions.id, sessionId));

          // Update file timestamp
          await audioRepo.updateTimestamp(fileIdInt);

          return NextResponse.json({
            sessionId,
            extractionResults: fallbackResponse.extractionResults.length,
            processingTime: Date.now() - startTime,
            fileId: fileIdInt,
            warning:
              'AI processing failed, fallback response created with empty arrays/objects',
          });
        } catch (fallbackError) {
          debugLog('api', 'Fallback processing also failed:', fallbackError);

          // Update session with error
          await getDb()
            .update(aiProcessingSessions)
            .set({
              status: 'failed',
              error: String(aiError),
              processingTime: Date.now() - startTime,
              completedAt: new Date(),
            })
            .where(eq(aiProcessingSessions.id, sessionId));

          // Update file timestamp
          await audioRepo.updateTimestamp(fileIdInt);

          return NextResponse.json(
            {
              error: 'Failed to process with AI and fallback failed',
              details: String(aiError),
              sessionId,
            },
            { status: 500 },
          );
        }
      }
    } catch (error) {
      debugLog('api', 'Unexpected error:', error);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 },
      );
    }
  },
);

/**
 * Format transcript for AI processing
 */
function formatTranscriptForAI(
  transcript: string | Array<{ speaker?: string; start?: number; text: string }>,
): string {
  if (typeof transcript === 'string') {
    return transcript;
  }

  if (Array.isArray(transcript)) {
    return transcript
      .map(segment => {
        const speaker = segment.speaker ? `${segment.speaker}: ` : '';
        const timestamp = segment.start
          ? `[${Math.floor(segment.start / 60)}:${String(Math.floor(segment.start % 60)).padStart(2, '0')}] `
          : '';
        return `${timestamp}${speaker}${segment.text}`;
      })
      .join('\n');
  }

  return String(transcript);
}

/**
 * Get extraction results for a file
 */
export const GET = withAuthMiddleware(async (request: NextRequest, context) => {
  try {
    // Extract params from the request URL
    const url = new URL(request.url);
    const pathSegments = url.pathname.split('/');
    const fileId = pathSegments[pathSegments.length - 2]; // Get fileId from URL path
    const fileIdInt = parseInt(fileId);
    if (isNaN(fileIdInt)) {
      return NextResponse.json({ error: 'Invalid file ID' }, { status: 400 });
    }

    // Get extraction results
    const extractionResults =
      await dynamicPromptGenerator.getExtractionResults(fileIdInt);

    // Get file info
    const audioRepo = new AudioRepository();
    const fileInfo = await audioRepo.findById(fileIdInt);

    return NextResponse.json({
      fileId: fileIdInt,
      fileName: fileInfo?.fileName || 'Unknown',
      summarization: null, // Summarization would be fetched from summarizations table
      extractionResults,
    });
  } catch (error) {
    debugLog('api', 'GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
});
