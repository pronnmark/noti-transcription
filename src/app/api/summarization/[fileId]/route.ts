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
import { customAIService } from '@/lib/services/customAI';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  return withAuthMiddleware(
    async (req: NextRequest, context) => {
      const validationService = getValidationService();
      const errorHandlingService = getErrorHandlingService();

      try {
        const { fileId } = await params;
        const fileIdInt = parseInt(fileId);

        // Validate file ID
        const idValidation = validationService.validateId(fileIdInt, 'File ID');
        if (!idValidation.isValid) {
          return errorHandlingService.handleValidationError(idValidation.errors, 'get-summarizations');
        }

        debugLog('api', 'Fetching summarizations for file', {
          fileId: fileIdInt,
          requestId: context.requestId,
        });

        // Get repositories using DI container
        const audioRepo = getAudioRepository();
        const summarizationRepo = getSummarizationRepository();

        // Get file using repository
        const file = await audioRepo.findById(fileIdInt);
        if (!file) {
          return errorHandlingService.handleNotFoundError('File', fileIdInt, 'get-summarizations');
        }

        // Get summarizations using repository
        const summaries = await summarizationRepo.findByFileId(fileIdInt);

        return errorHandlingService.handleSuccess({
          file: {
            id: file.id,
            fileName: file.file_name,
            originalFileName: file.original_file_name,
          },
          summarizations: summaries,
          totalSummaries: summaries.length,
          meta: {
            requestId: context.requestId,
          },
        }, 'get-summarizations');
      } catch (error) {
        return errorHandlingService.handleApiError(error, 'get-summarizations');
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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  return withAuthMiddleware(
    async (req: NextRequest, context) => {
      const validationService = getValidationService();
      const errorHandlingService = getErrorHandlingService();
      const startTime = Date.now();

      try {
        const { fileId } = await params;
        const fileIdInt = parseInt(fileId);
        const body = await req.json();
        const { templateId, customPrompt } = body;

        // Validate file ID
        const idValidation = validationService.validateId(fileIdInt, 'File ID');
        if (!idValidation.isValid) {
          return errorHandlingService.handleValidationError(idValidation.errors, 'create-summarization');
        }

        debugLog('api', 'Creating summarization for file', {
          fileId: fileIdInt,
          templateId,
          hasCustomPrompt: !!customPrompt,
          requestId: context.requestId,
        });

        // Get repositories using DI container
        const audioRepo = getAudioRepository();
        const transcriptionRepo = getTranscriptionRepository();
        const summarizationRepo = getSummarizationRepository();
        const templateRepo = getSummarizationTemplateRepository();

        // Get file using repository
        const file = await audioRepo.findById(fileIdInt);
        if (!file) {
          return errorHandlingService.handleNotFoundError('File', fileIdInt, 'create-summarization');
        }

        // Get transcript using repository
        const transcriptionJob = await transcriptionRepo.findLatestByFileId(fileIdInt);
        if (!transcriptionJob || !transcriptionJob.transcript) {
          return errorHandlingService.handleApiError(
            'INVALID_STATE',
            'File not transcribed yet',
            { fileId: fileIdInt }
          );
        }

        // Get template if provided
        let template = null;
        if (templateId) {
          template = await templateRepo.findById(templateId);
        }

        // Use template prompt or custom prompt or default
        const prompt = customPrompt ||
          template?.template ||
          `Please provide a comprehensive summary of the following transcript:
          
Guidelines:
1. Identify key topics and themes
2. Highlight important decisions made
3. Note any action items or follow-ups
4. Summarize the main outcomes
5. Keep it concise but comprehensive

Transcript:
{transcript}`;

        // Format transcript text
        let transcriptText: string;
        const transcriptData = transcriptionJob.transcript;
        
        if (Array.isArray(transcriptData)) {
          transcriptText = transcriptData
            .map((segment: any) => `${segment.speaker || 'Speaker'}: ${segment.text}`)
            .join('\n');
        } else {
          transcriptText = String(transcriptData);
        }

        // Generate AI summary
        let summary: string;
        let model: string = 'unconfigured';

        try {
          // Generate real AI summary
          summary = await customAIService.extractFromTranscript(
            transcriptText,
            prompt
          );

          const modelInfo = customAIService.getModelInfo();
          model = modelInfo.name || 'unknown-model';
        } catch (aiError) {
          debugLog('api', 'AI summarization failed, using fallback:', aiError);

          // Fallback to informative message when AI is not configured
          summary = 
            `Summary of ${file.original_file_name}:\n\n` +
            `AI summarization is not available. Error: ${aiError instanceof Error ? aiError.message : 'Unknown error'}\n\n` +
            `To enable AI summarization, please configure AI settings.\n\n` +
            `Transcript length: ${transcriptText.length} characters\n` +
            `Number of segments: ${Array.isArray(transcriptData) ? transcriptData.length : 1}`;

          model = 'unconfigured';
        }

        // Store summarization using repository
        const savedSummary = await summarizationRepo.create({
          file_id: fileIdInt,
          template_id: templateId || null,
          model: model,
          prompt: prompt.substring(0, 1000),
          content: summary,
        });

        return errorHandlingService.handleSuccess({
          success: true,
          summary: savedSummary,
          status: 'completed',
          meta: {
            requestId: context.requestId,
            duration: Date.now() - startTime,
          },
        }, 'create-summarization');
      } catch (error) {
        return errorHandlingService.handleApiError(error, 'create-summarization');
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
