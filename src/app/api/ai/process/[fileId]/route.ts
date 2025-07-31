import { NextRequest, NextResponse } from 'next/server';
import { withAuthMiddleware } from '@/lib/middleware';
import {
  getAudioRepository,
  getTranscriptionRepository,
  getSummarizationRepository,
  getSummarizationTemplateRepository,
  getValidationService,
  getErrorHandlingService
} from '@/lib/di/containerSetup';
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

        const validationService = getValidationService();
        const errorHandlingService = getErrorHandlingService();
        
        const idValidation = validationService.validateId(fileIdInt, 'File ID');
        if (!idValidation.isValid) {
          return errorHandlingService.handleValidationError(idValidation.errors, 'ai-process');
        }
        const body = await req.json();

        const {
          processType, // 'summarization', 'all'
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

        // Get repositories using DI container
        const audioRepo = getAudioRepository();
        const transcriptionRepo = getTranscriptionRepository();
        const summarizationTemplateRepo = getSummarizationTemplateRepository();

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
            return errorHandlingService.handleApiError(
              'INVALID_INPUT',
              'Invalid template IDs provided',
              {
                invalidTemplateIds,
                validTemplateIds: Array.from(validTemplateIds),
              }
            );
          }
        }

        // Get file using repository
        const file = await audioRepo.findById(fileIdInt);
        if (!file) {
          return errorHandlingService.handleNotFoundError('File', fileIdInt, 'ai-process');
        }

        // Get transcript from transcription jobs using repository
        const transcriptionJob =
          await transcriptionRepo.findLatestByFileId(fileIdInt);
        if (!transcriptionJob) {
          return errorHandlingService.handleApiError(
            'NOT_FOUND',
            'Transcription job not found',
            { fileId: fileIdInt }
          );
        }

        if (!transcriptionJob.transcript) {
          return errorHandlingService.handleApiError(
            'INVALID_STATE',
            'File not transcribed yet',
            { fileId: fileIdInt, transcriptionStatus: transcriptionJob.status }
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

              // Store the summarization using DI container
              const summarizationRepo = getSummarizationRepository();
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


            case 'all':
              // Update file timestamp
              await audioRepo.updateTimestamp(fileIdInt);

              // Process summarization
              const allSummaryResult =
                await adaptiveAIService.summarizeTranscript(
                  transcriptionJob.transcript,
                  {
                    model,
                  }
                );

              // Store the summarization using DI container
              const summarizationRepoAll = getSummarizationRepository();
              const savedSummaryAll = await summarizationRepoAll.create({
                file_id: fileIdInt,
                content: allSummaryResult.content,
                model: allSummaryResult.model,
                prompt: allSummaryResult.prompt,
                template_id: null,
              });

              results = {
                summarization: savedSummaryAll,
              };

              // Update file timestamp
              await audioRepo.updateTimestamp(fileIdInt);
              break;

            default:
              return errorHandlingService.handleApiError(
                'INVALID_INPUT',
                'Invalid process type',
                { processType, validTypes: ['summarization', 'all'] }
              );
          }

          debugLog('api', `AI processing completed for file ${fileIdInt}`, {
            processType,
          });

          return errorHandlingService.handleSuccess({
            processType,
            results,
            fileId: fileIdInt,
            meta: {
              requestId: context.requestId,
              duration: Date.now() - startTime,
            },
          }, 'ai-process-complete');
        } catch (aiError) {
          debugLog('api', 'AI processing error:', aiError);

          // Update file timestamp
          await audioRepo.updateTimestamp(fileIdInt);

          return errorHandlingService.handleApiError(aiError, 'ai-process');
        }
      } catch (error: any) {
        const errorHandlingService = getErrorHandlingService();
        return errorHandlingService.handleApiError(error, 'ai-process');
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
