import { NextRequest, NextResponse } from 'next/server';
import {
  withAuthMiddleware,
  createApiResponse,
  createErrorResponse,
} from '@/lib/middleware';
import {
  RepositoryFactory,
  SummarizationRepository,
} from '@/lib/database/repositories';
import { debugLog } from '@/lib/utils/debug';
import { adaptiveAIService } from '@/lib/services/adaptiveAI';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
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
            { status: 400 }
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
            (id: string) => !validTemplateIds.has(id)
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
                }
              ),
              { status: 400 }
            );
          }
        }

        // Get file using repository
        const file = await audioRepo.findById(fileIdInt);
        if (!file) {
          return NextResponse.json(
            createErrorResponse('File not found', 'FILE_NOT_FOUND', 404),
            { status: 404 }
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
              404
            ),
            { status: 404 }
          );
        }

        if (!transcriptionJob.transcript) {
          return NextResponse.json(
            createErrorResponse(
              'File not transcribed yet',
              'NOT_TRANSCRIBED',
              400
            ),
            { status: 400 }
          );
        }

        debugLog(
          'api',
          `Starting AI processing for file ${fileIdInt}, type: ${processType}`
        );

        let results: Record<string, unknown> = {};

        try {
          switch (processType) {
            case 'summarization':
              // Update file timestamp
              await audioRepo.updateTimestamp(fileIdInt);

              const summaryResult = await adaptiveAIService.summarizeTranscript(
                transcriptionJob.transcript,
                {
                  templateId: templateIds[0],
                  customPrompt,
                  model,
                }
              );

              // Store the summarization
              const summarizationRepo =
                RepositoryFactory.summarizationRepository;
              const savedSummary = await summarizationRepo.create({
                file_id: fileIdInt,
                content: summaryResult.content,
                model: summaryResult.model,
                prompt: summaryResult.prompt,
                template_id: templateIds[0] || null,
              });

              results.summarization = savedSummary;

              // Update file timestamp
              await audioRepo.updateTimestamp(fileIdInt);
              break;

            case 'extractions':
              return NextResponse.json(
                createErrorResponse(
                  'Extractions feature has been removed',
                  'FEATURE_REMOVED',
                  501
                ),
                { status: 501 }
              );

            case 'datapoints':
              return NextResponse.json(
                createErrorResponse(
                  'Data points feature has been removed',
                  'FEATURE_REMOVED',
                  501
                ),
                { status: 501 }
              );

            case 'all':
              // Update file timestamp
              await audioRepo.updateTimestamp(fileIdInt);

              // Only process summarization since extractions and data points have been removed
              const allSummaryResult =
                await adaptiveAIService.summarizeTranscript(
                  transcriptionJob.transcript,
                  {
                    model,
                  }
                );

              // Store the summarization
              const summarizationRepoAll =
                RepositoryFactory.summarizationRepository;
              const savedSummaryAll = await summarizationRepoAll.create({
                file_id: fileIdInt,
                content: allSummaryResult.content,
                model: allSummaryResult.model,
                prompt: allSummaryResult.prompt,
                template_id: null,
              });

              results = {
                summarization: savedSummaryAll,
                // extractions and datapoints features have been removed
              };

              // Update file timestamp
              await audioRepo.updateTimestamp(fileIdInt);
              break;

            default:
              return NextResponse.json(
                createErrorResponse(
                  'Invalid process type',
                  'INVALID_PROCESS_TYPE',
                  400
                ),
                { status: 400 }
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
              }
            )
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
    }
  )(request);
}
