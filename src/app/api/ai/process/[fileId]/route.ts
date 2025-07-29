import { NextRequest, NextResponse } from 'next/server';
import {
  withAuthMiddleware,
  createApiResponse,
  createErrorResponse,
} from '@/lib/middleware';
import { RepositoryFactory } from '@/lib/database/repositories';
import { debugLog } from '@/lib/utils/debug';
import { adaptiveAIService } from '@/lib/services/adaptiveAI';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> },
) {
  return withAuthMiddleware(
    async (req: NextRequest, context) => {
      const startTime = Date.now();

      try {
        const resolvedParams = await params;
        const fileIdInt = parseInt(resolvedParams.fileId);

        if (isNaN(fileIdInt)) {
          return NextResponse.json(
            createErrorResponse('Invalid file ID', 'INVALID_FILE_ID', 400),
            { status: 400 },
          );
        }
        const body = await req.json();

        const {
          processType, // 'summarization', 'extractions', 'datapoints', 'all'
          templateIds = [],
          customPrompt,
          model = 'anthropic/claude-sonnet-4',
          temperature = 0.3,
        } = body;

        debugLog('api', 'AI processing request', {
          fileId: fileIdInt,
          processType,
          templateIds: templateIds.length,
          requestId: context.requestId,
        });

        // Get repositories
        const audioRepo = RepositoryFactory.audioRepository;
        const transcriptionRepo = RepositoryFactory.transcriptionRepository;
        const summarizationTemplateRepo =
          RepositoryFactory.summarizationTemplateRepository;

        // Validate template IDs exist in database before processing
        if (templateIds.length > 0) {
          const validTemplates =
            await summarizationTemplateRepo.findActiveByIds(templateIds);
          const validTemplateIds = new Set(validTemplates.map(t => t.id));
          const invalidTemplateIds = templateIds.filter(
            (id: string) => !validTemplateIds.has(id),
          );

          if (invalidTemplateIds.length > 0) {
            debugLog('api', 'Invalid template IDs provided', {
              invalidTemplateIds,
              validTemplateIds: Array.from(validTemplateIds),
            });
            return NextResponse.json(
              createErrorResponse(
                'Invalid template IDs provided',
                'INVALID_TEMPLATE_IDS',
                400,
                {
                  invalidTemplateIds,
                  validTemplateIds: Array.from(validTemplateIds),
                },
              ),
              { status: 400 },
            );
          }
        }

        // Get file using repository
        const file = await audioRepo.findById(fileIdInt);
        if (!file) {
          return NextResponse.json(
            createErrorResponse('File not found', 'FILE_NOT_FOUND', 404),
            { status: 404 },
          );
        }

        // Get transcript from transcription jobs using repository
        const transcriptionJob =
          await transcriptionRepo.findLatestByFileId(fileIdInt);
        if (!transcriptionJob) {
          return NextResponse.json(
            createErrorResponse(
              'Transcription job not found',
              'TRANSCRIPTION_NOT_FOUND',
              404,
            ),
            { status: 404 },
          );
        }

        if (!transcriptionJob.transcript) {
          return NextResponse.json(
            createErrorResponse(
              'File not transcribed yet',
              'NOT_TRANSCRIBED',
              400,
            ),
            { status: 400 },
          );
        }

        debugLog(
          'api',
          `Starting AI processing for file ${fileIdInt}, type: ${processType}`,
        );

        let results: Record<string, unknown> = {};

        try {
          switch (processType) {
            case 'summarization':
              // Update file timestamp
              await audioRepo.updateTimestamp(fileIdInt);

              results.summarization =
                await adaptiveAIService.generateSummarization(
                  fileIdInt,
                  transcriptionJob.transcript,
                  {
                    templateId: templateIds[0],
                    customPrompt,
                    model,
                  },
                );

              // Update file timestamp
              await audioRepo.updateTimestamp(fileIdInt);
              break;

            case 'extractions':
              if (templateIds.length === 0) {
                return NextResponse.json(
                  createErrorResponse(
                    'Template IDs required for extractions',
                    'TEMPLATE_IDS_REQUIRED',
                    400,
                  ),
                  { status: 400 },
                );
              }

              // Update file timestamp
              await audioRepo.updateTimestamp(fileIdInt);

              results.extractions = await adaptiveAIService.processExtractions(
                fileIdInt,
                transcriptionJob.transcript,
                templateIds,
                { model, temperature },
              );

              // Update file timestamp
              await audioRepo.updateTimestamp(fileIdInt);
              break;

            case 'datapoints':
              if (templateIds.length === 0) {
                return NextResponse.json(
                  createErrorResponse(
                    'Template IDs required for data points',
                    'TEMPLATE_IDS_REQUIRED',
                    400,
                  ),
                  { status: 400 },
                );
              }

              // Update file timestamp
              await audioRepo.updateTimestamp(fileIdInt);

              results.dataPoints = await adaptiveAIService.processDataPoints(
                fileIdInt,
                transcriptionJob.transcript,
                templateIds,
                { model, temperature },
              );

              // Update file timestamp
              await audioRepo.updateTimestamp(fileIdInt);
              break;

            case 'all':
              // Update file timestamp
              await audioRepo.updateTimestamp(fileIdInt);

              // Process with default templates
              results = await adaptiveAIService.processFileWithDefaults(
                fileIdInt,
                transcriptionJob.transcript,
                { model, temperature },
              );

              // Update file timestamp
              await audioRepo.updateTimestamp(fileIdInt);
              break;

            default:
              return NextResponse.json(
                createErrorResponse(
                  'Invalid process type',
                  'INVALID_PROCESS_TYPE',
                  400,
                ),
                { status: 400 },
              );
          }

          debugLog('api', `AI processing completed for file ${fileIdInt}`, {
            processType,
          });

          return NextResponse.json(
            createApiResponse(
              {
                processType,
                results,
                fileId: fileIdInt,
              },
              {
                meta: {
                  requestId: context.requestId,
                  duration: Date.now() - startTime,
                },
              },
            ),
          );
        } catch (aiError) {
          debugLog('api', 'AI processing error:', aiError);

          // Update file timestamp
          await audioRepo.updateTimestamp(fileIdInt);

          throw aiError; // Let middleware handle the error
        }
      } catch (error: any) {
        debugLog('api', 'AI process route error:', error);
        throw error; // Let middleware handle the error
      }
    },
    {
      logging: {
        enabled: true,
        logRequests: true,
        logResponses: true,
      },
      errorHandling: {
        enabled: true,
        sanitizeErrors: true,
      },
    },
  )(request);
}
