import { NextRequest, NextResponse } from 'next/server';
import { db, summarizationPrompts, audioFiles, transcriptionJobs, aiProcessingSessions } from '@/lib/db';
import { dynamicPromptGenerator } from '@/lib/services/dynamicPromptGenerator';
import { customAIService } from '@/lib/services/customAI';
import { requireAuth } from '@/lib/auth';
import { and, eq } from 'drizzle-orm';
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
      const validTemplate = await db()
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
        return NextResponse.json({
          error: 'Invalid summarization template ID provided',
          invalidTemplateId: summarizationPromptId,
        }, { status: 400 });
      }
    }

    // Get file
    const file = await db()
      .select()
      .from(audioFiles)
      .where(eq(audioFiles.id, fileIdInt))
      .limit(1);

    if (!file || file.length === 0) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    const fileRecord = file[0];

    // Get transcript from transcription jobs
    const transcriptionJob = await db()
      .select()
      .from(transcriptionJobs)
      .where(eq(transcriptionJobs.fileId, fileIdInt))
      .limit(1);

    if (!transcriptionJob || transcriptionJob.length === 0 || !transcriptionJob[0].transcript) {
      return NextResponse.json({ error: 'File not transcribed yet' }, { status: 400 });
    }

    const transcriptRecord = transcriptionJob[0];

    debugLog(`🤖 Starting dynamic AI processing for file ${fileIdInt}`);
    debugLog(`📝 Summarization prompt: ${summarizationPromptId || 'default'}`);
    debugLog(`🔍 Extraction definitions: ${extractionDefinitionIds.join(', ')}`);

    // Create processing session
    const sessionId = createId();
    const startTime = Date.now();

    // Update file timestamp
    await db().update(audioFiles)
      .set({
        updatedAt: new Date(),
      })
      .where(eq(audioFiles.id, fileIdInt));

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
      await db().insert(aiProcessingSessions).values({
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
      await db().update(aiProcessingSessions)
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
      await db().update(audioFiles)
        .set({
          updatedAt: new Date(),
        })
        .where(eq(audioFiles.id, fileIdInt));

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
        await db().update(aiProcessingSessions)
          .set({
            status: 'completed',
            error: `AI processing failed, fallback applied: ${String(aiError)}`,
            processingTime: Date.now() - startTime,
            completedAt: new Date(),
            aiResponse: 'Fallback response due to AI processing failure',
          })
          .where(eq(aiProcessingSessions.id, sessionId));

        // Update file timestamp
        await db().update(audioFiles)
          .set({
            updatedAt: new Date(),
          })
          .where(eq(audioFiles.id, fileIdInt));

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
        await db().update(aiProcessingSessions)
          .set({
            status: 'failed',
            error: String(aiError),
            processingTime: Date.now() - startTime,
            completedAt: new Date(),
          })
          .where(eq(aiProcessingSessions.id, sessionId));

        // Update file timestamp
        await db().update(audioFiles)
          .set({
            updatedAt: new Date(),
          })
          .where(eq(audioFiles.id, fileIdInt));

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
    const fileInfo = await db()
      .select()
      .from(audioFiles)
      .where(eq(audioFiles.id, fileIdInt))
      .limit(1);

    return NextResponse.json({
      fileId: fileIdInt,
      fileName: fileInfo?.[0]?.fileName || 'Unknown',
      summarization: null, // Summarization would be fetched from summarizations table
      extractionResults,
    });

  } catch (error) {
    debugLog('Error fetching extraction results:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
