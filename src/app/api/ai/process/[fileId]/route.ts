import { NextRequest, NextResponse } from 'next/server';
import { db, summarizationPrompts, audioFiles, transcriptionJobs, eq } from '@/lib/db';
import { adaptiveAIService } from '@/lib/services/adaptiveAI';
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

const debugLog = createDebugLogger('ai-process');

export const POST = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> },
) => {
  // Check authentication
  const authError = await handleAuthCheck(request);
  if (authError) return authError;

  const fileIdInt = await parseFileParams(params);
  const body = await request.json();

  const {
    processType, // 'summarization', 'extractions', 'datapoints', 'all'
    templateIds = [],
    customPrompt,
    model = 'anthropic/claude-sonnet-4',
    temperature = 0.3,
  } = body;

  // Validate template IDs exist in database before processing
  if (templateIds.length > 0) {
    const validTemplates = await db.select({ id: summarizationPrompts.id })
      .from(summarizationPrompts)
      .where(eq(summarizationPrompts.isActive, true));

    const validTemplateIds = new Set(validTemplates.map((t: { id: string }) => t.id));
    const invalidTemplateIds = templateIds.filter((id: string) => !validTemplateIds.has(id));

    if (invalidTemplateIds.length > 0) {
      debugLog(`❌ Invalid template IDs provided: ${invalidTemplateIds.join(', ')}`);
      return createErrorResponse(
        'Invalid template IDs provided',
        400,
        {
          invalidTemplateIds,
          validTemplateIds: Array.from(validTemplateIds),
        },
      );
    }
  }

  // Get file
  const fileResults = await db.select()
    .from(audioFiles)
    .where(eq(audioFiles.id, fileIdInt))
    .limit(1);

  const file = validateQueryResult(fileResults, 'File');
  if (file instanceof NextResponse) {
    return file;
  }

  // Get transcript from transcription jobs
  const transcriptionJobResults = await db.select()
    .from(transcriptionJobs)
    .where(eq(transcriptionJobs.fileId, fileIdInt))
    .limit(1);

  const transcriptionJob = validateQueryResult(transcriptionJobResults, 'Transcription job');
  if (transcriptionJob instanceof NextResponse) {
    return transcriptionJob;
  }

  if (!transcriptionJob.transcript) {
    return createErrorResponse('File not transcribed yet', 400);
  }

  debugLog(`🤖 Starting AI processing for file ${fileIdInt}, type: ${processType}`);

  let results: any = {};

  try {
    switch (processType) {
      case 'summarization':
        // Update file timestamp
        await updateFileTimestamp(fileIdInt);

        results.summarization = await adaptiveAIService.generateSummarization(
          fileIdInt,
          transcriptionJob.transcript,
          {
            templateId: templateIds[0],
            customPrompt,
            model,
          },
        );

        // Update file timestamp
        await updateFileTimestamp(fileIdInt);

        break;

      case 'extractions':
        if (templateIds.length === 0) {
          return createErrorResponse('Template IDs required for extractions', 400);
        }

        // Update file timestamp
        await updateFileTimestamp(fileIdInt);

        results.extractions = await adaptiveAIService.processExtractions(
          fileIdInt,
          transcriptionJob.transcript,
          templateIds,
          { model, temperature },
        );

        // Update file timestamp
        await updateFileTimestamp(fileIdInt);

        break;

      case 'datapoints':
        if (templateIds.length === 0) {
          return createErrorResponse('Template IDs required for data points', 400);
        }

        // Update file timestamp
        await updateFileTimestamp(fileIdInt);

        results.dataPoints = await adaptiveAIService.processDataPoints(
          fileIdInt,
          transcriptionJob.transcript,
          templateIds,
          { model, temperature },
        );

        // Update file timestamp
        await updateFileTimestamp(fileIdInt);

        break;

      case 'all':
        // Update file timestamp
        await updateFileTimestamp(fileIdInt);

        // Process with default templates
        results = await adaptiveAIService.processFileWithDefaults(
          fileIdInt,
          transcriptionJob.transcript,
          { model, temperature },
        );

        // Update file timestamp
        await updateFileTimestamp(fileIdInt);

        break;

      default:
        return createErrorResponse('Invalid process type', 400);
    }

    debugLog(`✅ AI processing completed for file ${fileIdInt}`);

    return createSuccessResponse({
      processType,
      results,
      fileId: fileIdInt,
    });

  } catch (aiError) {
    debugLog('AI processing error:', aiError);

    // Update file timestamp
    await updateFileTimestamp(fileIdInt);

    return createErrorResponse(
      'Failed to process with AI',
      500,
      String(aiError),
    );
  }
});
