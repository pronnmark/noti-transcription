import { NextRequest, NextResponse } from 'next/server';
import { db, eq } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { adaptiveAIService } from '@/lib/services/adaptiveAI';
import * as schema from '@/lib/db';

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
    // Check authentication
    const isAuthenticated = await requireAuth(request);
    if (!isAuthenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { fileId } = await params;
    const fileIdInt = parseInt(fileId);
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
      const { summarizationPrompts } = await import('@/lib/database/schema/system');
      const validTemplates = await db.select({ id: summarizationPrompts.id })
        .from(summarizationPrompts)
        .where(eq(summarizationPrompts.isActive, true));

      const validTemplateIds = new Set(validTemplates.map((t: { id: string }) => t.id));
      const invalidTemplateIds = templateIds.filter((id: string) => !validTemplateIds.has(id));

      if (invalidTemplateIds.length > 0) {
        console.error(`❌ Invalid template IDs provided: ${invalidTemplateIds.join(', ')}`);
        return NextResponse.json({
          error: 'Invalid template IDs provided',
          invalidTemplateIds,
          validTemplateIds: Array.from(validTemplateIds),
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

    debugLog(`🤖 Starting AI processing for file ${fileIdInt}, type: ${processType}`);

    let results: any = {};

    try {
      switch (processType) {
        case 'summarization':
          // Update file timestamp
          await db.update(schema.audioFiles)
            .set({
              updatedAt: new Date(),
            })
            .where(eq(schema.audioFiles.id, fileIdInt));

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
          await db.update(schema.audioFiles)
            .set({
              updatedAt: new Date(),
            })
            .where(eq(schema.audioFiles.id, fileIdInt));

          break;

        case 'extractions':
          if (templateIds.length === 0) {
            return NextResponse.json({ error: 'Template IDs required for extractions' }, { status: 400 });
          }

          // Update file timestamp
          await db.update(schema.audioFiles)
            .set({
              updatedAt: new Date(),
            })
            .where(eq(schema.audioFiles.id, fileIdInt));

          results.extractions = await adaptiveAIService.processExtractions(
            fileIdInt,
            transcriptionJob.transcript,
            templateIds,
            { model, temperature },
          );

          // Update file timestamp
          await db.update(schema.audioFiles)
            .set({
              updatedAt: new Date(),
            })
            .where(eq(schema.audioFiles.id, fileIdInt));

          break;

        case 'datapoints':
          if (templateIds.length === 0) {
            return NextResponse.json({ error: 'Template IDs required for data points' }, { status: 400 });
          }

          // Update file timestamp
          await db.update(schema.audioFiles)
            .set({
              updatedAt: new Date(),
            })
            .where(eq(schema.audioFiles.id, fileIdInt));

          results.dataPoints = await adaptiveAIService.processDataPoints(
            fileIdInt,
            transcriptionJob.transcript,
            templateIds,
            { model, temperature },
          );

          // Update file timestamp
          await db.update(schema.audioFiles)
            .set({
              updatedAt: new Date(),
            })
            .where(eq(schema.audioFiles.id, fileIdInt));

          break;

        case 'all':
          // Update file timestamp
          await db.update(schema.audioFiles)
            .set({
              updatedAt: new Date(),
            })
            .where(eq(schema.audioFiles.id, fileIdInt));

          // Process with default templates
          results = await adaptiveAIService.processFileWithDefaults(
            fileIdInt,
            transcriptionJob.transcript,
            { model, temperature },
          );

          // Update file timestamp
          await db.update(schema.audioFiles)
            .set({
              updatedAt: new Date(),
            })
            .where(eq(schema.audioFiles.id, fileIdInt));

          break;

        default:
          return NextResponse.json({ error: 'Invalid process type' }, { status: 400 });
      }

      debugLog(`✅ AI processing completed for file ${fileIdInt}`);

      return NextResponse.json({
        success: true,
        processType,
        results,
        fileId: fileIdInt,
      });

    } catch (aiError) {
      console.error('AI processing error:', aiError);

      // Update file timestamp
      await db.update(schema.audioFiles)
        .set({
          updatedAt: new Date(),
        })
        .where(eq(schema.audioFiles.id, fileIdInt));

      return NextResponse.json({
        error: 'Failed to process with AI',
        details: String(aiError),
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Error in AI processing:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
