import { NextRequest, NextResponse } from 'next/server';
import { db, eq } from '@/lib/db/sqlite';
import { requireAuth } from '@/lib/auth';
import { adaptiveAIService } from '@/lib/services/adaptiveAI';
import * as schema from '@/lib/db/sqliteSchema';

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
    
    const { 
      processType, // 'summarization', 'extractions', 'datapoints', 'all'
      templateIds = [],
      customPrompt,
      model = 'anthropic/claude-sonnet-4',
      temperature = 0.3
    } = body;

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

    console.log(`🤖 Starting AI processing for file ${fileIdInt}, type: ${processType}`);

    let results: any = {};

    try {
      switch (processType) {
        case 'summarization':
          // Update file status
          await db.update(schema.audioFiles)
            .set({ 
              summarizationStatus: 'processing',
              updatedAt: new Date() 
            })
            .where(eq(schema.audioFiles.id, fileIdInt));

          results.summarization = await adaptiveAIService.generateSummarization(
            fileIdInt,
            file.transcript,
            {
              templateId: templateIds[0],
              customPrompt,
              model
            }
          );

          // Update file status to completed
          await db.update(schema.audioFiles)
            .set({ 
              summarizationStatus: 'completed',
              summarizationContent: results.summarization.content,
              updatedAt: new Date() 
            })
            .where(eq(schema.audioFiles.id, fileIdInt));

          break;

        case 'extractions':
          if (templateIds.length === 0) {
            return NextResponse.json({ error: 'Template IDs required for extractions' }, { status: 400 });
          }

          // Update file status
          await db.update(schema.audioFiles)
            .set({ 
              extractionStatus: 'processing',
              extractionTemplatesUsed: JSON.stringify(templateIds),
              updatedAt: new Date() 
            })
            .where(eq(schema.audioFiles.id, fileIdInt));

          results.extractions = await adaptiveAIService.processExtractions(
            fileIdInt,
            file.transcript,
            templateIds,
            { model, temperature }
          );

          // Update file status to completed
          await db.update(schema.audioFiles)
            .set({ 
              extractionStatus: 'completed',
              updatedAt: new Date() 
            })
            .where(eq(schema.audioFiles.id, fileIdInt));

          break;

        case 'datapoints':
          if (templateIds.length === 0) {
            return NextResponse.json({ error: 'Template IDs required for data points' }, { status: 400 });
          }

          // Update file status
          await db.update(schema.audioFiles)
            .set({ 
              dataPointStatus: 'processing',
              dataPointTemplatesUsed: JSON.stringify(templateIds),
              updatedAt: new Date() 
            })
            .where(eq(schema.audioFiles.id, fileIdInt));

          results.dataPoints = await adaptiveAIService.processDataPoints(
            fileIdInt,
            file.transcript,
            templateIds,
            { model, temperature }
          );

          // Update file status to completed
          await db.update(schema.audioFiles)
            .set({ 
              dataPointStatus: 'completed',
              updatedAt: new Date() 
            })
            .where(eq(schema.audioFiles.id, fileIdInt));

          break;

        case 'all':
          // Update all statuses to processing
          await db.update(schema.audioFiles)
            .set({ 
              summarizationStatus: 'processing',
              extractionStatus: 'processing',
              dataPointStatus: 'processing',
              updatedAt: new Date() 
            })
            .where(eq(schema.audioFiles.id, fileIdInt));

          // Process with default templates
          results = await adaptiveAIService.processFileWithDefaults(
            fileIdInt,
            file.transcript,
            { model, temperature }
          );

          // Update all statuses to completed
          await db.update(schema.audioFiles)
            .set({ 
              summarizationStatus: 'completed',
              summarizationContent: results.summarization?.content || null,
              extractionStatus: 'completed',
              dataPointStatus: 'completed',
              updatedAt: new Date() 
            })
            .where(eq(schema.audioFiles.id, fileIdInt));

          break;

        default:
          return NextResponse.json({ error: 'Invalid process type' }, { status: 400 });
      }

      console.log(`✅ AI processing completed for file ${fileIdInt}`);

      return NextResponse.json({
        success: true,
        processType,
        results,
        fileId: fileIdInt
      });

    } catch (aiError) {
      console.error('AI processing error:', aiError);
      
      // Update file statuses to failed
      const updateData: any = {
        lastError: String(aiError),
        updatedAt: new Date()
      };

      if (processType === 'summarization' || processType === 'all') {
        updateData.summarizationStatus = 'failed';
      }
      if (processType === 'extractions' || processType === 'all') {
        updateData.extractionStatus = 'failed';
      }
      if (processType === 'datapoints' || processType === 'all') {
        updateData.dataPointStatus = 'failed';
      }

      await db.update(schema.audioFiles)
        .set(updateData)
        .where(eq(schema.audioFiles.id, fileIdInt));

      return NextResponse.json({ 
        error: 'Failed to process with AI',
        details: String(aiError)
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Error in AI processing:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}