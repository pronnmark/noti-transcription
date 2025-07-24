import { NextRequest, NextResponse } from 'next/server';
import { db, eq } from '@/lib/db';
import { dynamicPromptGenerator } from '@/lib/services/dynamicPromptGenerator';
import { customAIService } from '@/lib/services/customAI';
import { requireAuth } from '@/lib/auth';
import * as schema from '@/lib/db';
import { createId } from '@paralleldrive/cuid2';

// Debug logging (can be disabled by setting DEBUG_API=false)
const DEBUG_API = process.env.DEBUG_API !== 'false';
const debugLog = (...args: unknown[]) => {
  if (DEBUG_API) {
    console.log(...args);
  }
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> },
) {
  try {
    const { fileId } = await params;
    const fileIdInt = parseInt(fileId);
    const body = await request.json();

    const {
      summarizationPromptId,
      extractionDefinitionIds = [],
      customSummarizationPrompt,
    } = body;

    // Validate summarization template ID exists in database before processing
    if (summarizationPromptId) {
      const { summarizationPrompts: _summarizationPrompts } = await import('@/lib/database/schema/system');
      const validTemplate = await db.query.summarizationPrompts.findFirst({
        where: (prompts: any, { eq, and }: any) => and(
          eq(prompts.id, summarizationPromptId),
          eq(prompts.isActive, true),
        ),
      });

      if (!validTemplate) {
        debugLog(`❌ Invalid summarization template ID: ${summarizationPromptId}`);
        return NextResponse.json({
          error: 'Invalid summarization template ID provided',
          invalidTemplateId: summarizationPromptId,
        }, { status: 400 });
      }
    }

    // Get file
    const file = await db.query.audioFiles.findFirst({
      where: (audioFiles: any, { eq }: any) => eq(audioFiles.id, fileIdInt),
    });

    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    // Get transcript from transcription jobs
    const transcriptionJob = await db.query.transcriptionJobs.findFirst({
      where: (transcriptionJobs: any, { eq }: any) => eq(transcriptionJobs.fileId, fileIdInt),
    });

    if (!transcriptionJob || !transcriptionJob.transcript) {
      return NextResponse.json({ error: 'File not transcribed yet' }, { status: 400 });
    }

    debugLog(`🤖 Starting dynamic AI processing for file ${fileIdInt}`);
    debugLog(`📝 Summarization prompt: ${summarizationPromptId || 'default'}`);
    debugLog(`🔍 Extraction definitions: ${extractionDefinitionIds.join(', ')}`);

    // Create processing session
    const sessionId = createId();
    const startTime = Date.now();

    // Update file timestamp
    await db.update(schema.audioFiles)
      .set({
        updatedAt: new Date(),
      })
      .where(eq(schema.audioFiles.id, fileIdInt));

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
      const transcriptText = formatTranscriptForAI(transcriptionJob.transcript);

      // Create AI processing session record
      await db.insert(schema.aiProcessingSessions).values({
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
      await db.update(schema.aiProcessingSessions)
        .set({
          aiResponse,
          status: 'completed',
          processingTime: Date.now() - startTime,
          completedAt: new Date(),
        })
        .where(eq(schema.aiProcessingSessions.id, sessionId));

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
      await db.update(schema.audioFiles)
        .set({
          updatedAt: new Date(),
        })
        .where(eq(schema.audioFiles.id, fileIdInt));

      debugLog(`✅ Dynamic AI processing completed for file ${fileIdInt}`);
      debugLog(`📊 Extracted ${extractionResults.length} result groups`);

      return NextResponse.json({
        success: true,
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
        await db.update(schema.aiProcessingSessions)
          .set({
            status: 'completed',
            error: `AI processing failed, fallback applied: ${String(aiError)}`,
            processingTime: Date.now() - startTime,
            completedAt: new Date(),
            aiResponse: 'Fallback response due to AI processing failure',
          })
          .where(eq(schema.aiProcessingSessions.id, sessionId));

        // Update file timestamp
        await db.update(schema.audioFiles)
          .set({
            updatedAt: new Date(),
          })
          .where(eq(schema.audioFiles.id, fileIdInt));

        return NextResponse.json({
          success: true,
          sessionId,
          extractionResults: fallbackResponse.extractionResults.length,
          processingTime: Date.now() - startTime,
          fileId: fileIdInt,
          warning: 'AI processing failed, fallback response created with empty arrays/objects',
        });

      } catch (fallbackError) {
        debugLog('Fallback processing also failed:', fallbackError);

        // Update session with error
        await db.update(schema.aiProcessingSessions)
          .set({
            status: 'failed',
            error: String(aiError),
            processingTime: Date.now() - startTime,
            completedAt: new Date(),
          })
          .where(eq(schema.aiProcessingSessions.id, sessionId));

        // Update file timestamp
        await db.update(schema.audioFiles)
          .set({
            updatedAt: new Date(),
          })
          .where(eq(schema.audioFiles.id, fileIdInt));

        return NextResponse.json({
          error: 'Failed to process with AI and fallback failed',
          details: String(aiError),
          sessionId,
        }, { status: 500 });
      }
    }

  } catch (error) {
    debugLog('Error in dynamic AI processing:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

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
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> },
) {
  try {
    const isAuthenticated = await requireAuth(request);
    if (!isAuthenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { fileId } = await params;
    const fileIdInt = parseInt(fileId);

    // Get extraction results
    const extractionResults = await dynamicPromptGenerator.getExtractionResults(fileIdInt);

    // Get file info
    const file = await db.query.audioFiles.findFirst({
      where: (audioFiles: any, { eq }: any) => eq(audioFiles.id, fileIdInt),
    });

    return NextResponse.json({
      fileId: fileIdInt,
      fileName: file?.fileName || 'Unknown',
      summarization: null, // Summarization would be fetched from summarizations table
      extractionResults,
    });

  } catch (error) {
    debugLog('Error fetching extraction results:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
