import { NextRequest, NextResponse } from 'next/server';
import { dynamicPromptGenerator } from '@/lib/services/dynamicPromptGenerator';
import { customAIService } from '@/lib/services/customAI';
import { createId } from '@paralleldrive/cuid2';
import { withAuthMiddleware } from '@/lib/middleware';
import {
  getAudioRepository,
  getTranscriptionRepository,
  getValidationService,
  getErrorHandlingService,
} from '@/lib/di/containerSetup';
import { debugLog } from '@/lib/utils';
import { getSupabase } from '@/lib/database/client';

export const POST = withAuthMiddleware(
  async (request: NextRequest, context) => {
    try {
      // Extract params from the request URL
      const url = new URL(request.url);
      const pathSegments = url.pathname.split('/');
      const fileId = pathSegments[pathSegments.length - 2]; // Get fileId from URL path
      
      // Use validation service
      const validationService = getValidationService();
      const errorHandlingService = getErrorHandlingService();
      
      const fileIdValidation = validationService.validateId(fileId, 'File ID');
      if (!fileIdValidation.isValid) {
        return errorHandlingService.handleValidationError(fileIdValidation.errors);
      }
      const fileIdInt = parseInt(fileId);

      const body = await request.json();

      const {
        summarizationPromptId,
        customSummarizationPrompt,
      } = body;

      // Get repositories using DI container
      const audioRepo = getAudioRepository();
      const transcriptRepo = getTranscriptionRepository();

      // TODO: Re-implement validation once SummarizationTemplateRepository has findById method
      // Validate summarization template ID exists in database before processing
      // if (summarizationPromptId) {
      //   const validTemplate = await summarizationRepo.findById(
      //     summarizationPromptId,
      //   );
      //   if (!validTemplate) {
      //     debugLog(
      //       'api',
      //       `❌ Invalid summarization template ID: ${summarizationPromptId}`,
      //     );
      //     return NextResponse.json(
      //       {
      //         error: 'Invalid summarization template ID provided',
      //         invalidTemplateId: summarizationPromptId,
      //       },
      //       { status: 400 },
      //     );
      //   }
      // }

      // Get file
      const fileRecord = await audioRepo.findById(fileIdInt);
      if (!fileRecord) {
        return errorHandlingService.handleApiError('NOT_FOUND', 'File not found');
      }

      // Get transcript from transcription jobs
      const transcriptionJobs = await transcriptRepo.findByFileId(fileIdInt);
      if (!transcriptionJobs || transcriptionJobs.length === 0) {
        return errorHandlingService.handleApiError('NOT_FOUND', 'Transcription job not found');
      }

      const transcriptRecord = transcriptionJobs[0]; // Get the first/latest transcription job
      if (!transcriptRecord.transcript) {
        return errorHandlingService.handleApiError('INVALID_INPUT', 'File not transcribed yet');
      }

      debugLog(
        'api',
        `🤖 Starting dynamic AI processing for file ${fileIdInt}`
      );
      debugLog(
        'api',
        `📝 Summarization prompt: ${summarizationPromptId || 'default'}`
      );

      // Create processing session
      const sessionId = createId();
      const startTime = Date.now();

      // Update file timestamp
      // TODO: Re-implement updateTimestamp method in repository
      // await audioRepo.updateTimestamp(fileIdInt);

      // Get the configured AI model outside try block for error handling access
      const configuredModel = await customAIService.getDefaultModel();

      try {
        // Generate dynamic prompt
        const {
          systemPrompt,
          expectedJsonSchema,
        } = await dynamicPromptGenerator.generatePrompt({
          summarizationPromptId,
          useCustomSummarizationPrompt: customSummarizationPrompt,
        });

        debugLog(
          'api',
          `📋 Generated system prompt (${systemPrompt.length} chars)`
        );

        // Format transcript for AI
        const transcriptText = formatTranscriptForAI(
          transcriptRecord.transcript || []
        );

        // Create AI processing session record using Supabase
        const supabase = getSupabase();
        const { error: insertError } = await supabase
          .from('ai_processing_sessions')
          .insert({
            id: sessionId,
            file_id: fileIdInt,
            summarization_prompt_id: summarizationPromptId || null,
            extraction_definition_ids: null,
            system_prompt: systemPrompt,
            ai_response: '', // Will be updated after AI response
            status: 'processing',
            model: configuredModel,
          });

        if (insertError) {
          throw new Error(
            `Failed to create processing session: ${insertError.message}`
          );
        }

        // Call AI with dynamic prompt and structured JSON output
        const aiResponse = await customAIService.generateText(
          `Please analyze this transcript:\n\n${transcriptText}`,
          {
            model: configuredModel,
            maxTokens: 8000,
            temperature: 0.2,
            systemPrompt,
            jsonSchema: expectedJsonSchema,
          }
        );

        debugLog('api', `🤖 AI response received (${aiResponse.length} chars)`);
        debugLog(
          'api',
          `📊 Sample response:`,
          aiResponse.substring(0, 200) + '...'
        );

        // Update session with AI response
        const { error: updateError } = await supabase
          .from('ai_processing_sessions')
          .update({
            ai_response: aiResponse,
            status: 'completed',
            processing_time: Date.now() - startTime,
            completed_at: new Date().toISOString(),
          })
          .eq('id', sessionId);

        if (updateError) {
          console.error('Failed to update processing session:', updateError);
        }

        // Parse and store results
        const { success, summarizationResult, error } =
          await dynamicPromptGenerator.parseAndStoreResults(
            fileIdInt,
            aiResponse,
            sessionId,
            configuredModel,
            summarizationPromptId
          );

        if (!success) {
          throw new Error(`Failed to parse AI response: ${error}`);
        }

        // Update file timestamp
        // TODO: Re-implement updateTimestamp method in repository
        // await audioRepo.updateTimestamp(fileIdInt);

        debugLog(
          'api',
          `✅ Dynamic AI processing completed for file ${fileIdInt}`
        );

        return errorHandlingService.handleSuccess({
          sessionId,
          summarizationResult,
          processingTime: Date.now() - startTime,
          fileId: fileIdInt,
        }, 'dynamic-process');
      } catch (aiError) {
        debugLog('api', 'Dynamic AI processing error:', aiError);

        // Create graceful fallback with empty results
        try {
          const fallbackResponse =
            await dynamicPromptGenerator.parseAndStoreResults(
              fileIdInt,
              '', // Empty response triggers fallback behavior
              sessionId,
              configuredModel,
              summarizationPromptId
            );

          // Update session with partial success
          const supabase = getSupabase();
          await supabase
            .from('ai_processing_sessions')
            .update({
              status: 'completed',
              error: `AI processing failed, fallback applied: ${String(aiError)}`,
              processing_time: Date.now() - startTime,
              completed_at: new Date().toISOString(),
              ai_response: 'Fallback response due to AI processing failure',
            })
            .eq('id', sessionId);

          // Update file timestamp
          // TODO: Re-implement updateTimestamp method in repository
          // await audioRepo.updateTimestamp(fileIdInt);

          return errorHandlingService.handleSuccess({
            sessionId,
            summarizationResult: fallbackResponse.summarizationResult,
            processingTime: Date.now() - startTime,
            fileId: fileIdInt,
            warning:
              'AI processing failed, fallback response created',
          }, 'dynamic-process', 'Fallback response created');
        } catch (fallbackError) {
          debugLog('api', 'Fallback processing also failed:', fallbackError);

          // Update session with error
          const supabase = getSupabase();
          await supabase
            .from('ai_processing_sessions')
            .update({
              status: 'failed',
              error: String(aiError),
              processing_time: Date.now() - startTime,
              completed_at: new Date().toISOString(),
            })
            .eq('id', sessionId);

          // Update file timestamp
          // TODO: Re-implement updateTimestamp method in repository
          // await audioRepo.updateTimestamp(fileIdInt);

          return errorHandlingService.handleApiError(
            'INTERNAL_ERROR',
            'Failed to process with AI and fallback failed',
            { details: String(aiError), sessionId }
          );
        }
      }
    } catch (error) {
      debugLog('api', 'Unexpected error:', error);
      const errorHandlingService = getErrorHandlingService();
      return errorHandlingService.handleApiError('INTERNAL_ERROR', 'Internal server error');
    }
  }
);

/**
 * Format transcript for AI processing
 */
function formatTranscriptForAI(
  transcript: string | Array<{ speaker?: string; start?: number; text: string }>
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
 * Get AI processing results for a file
 */
export const GET = withAuthMiddleware(async (request: NextRequest, context) => {
  try {
    // Extract params from the request URL
    const url = new URL(request.url);
    const pathSegments = url.pathname.split('/');
    const fileId = pathSegments[pathSegments.length - 2]; // Get fileId from URL path
    
    // Use validation and error handling services
    const validationService = getValidationService();
    const errorHandlingService = getErrorHandlingService();
    
    const fileIdValidation = validationService.validateId(fileId, 'File ID');
    if (!fileIdValidation.isValid) {
      return errorHandlingService.handleValidationError(fileIdValidation.errors);
    }
    const fileIdInt = parseInt(fileId);

    // Get file info using DI container
    const audioRepo = getAudioRepository();
    const fileInfo = await audioRepo.findById(fileIdInt);

    // TODO: Get summarization results from Supabase
    const summarization = null; // Would be fetched from summarizations table

    return errorHandlingService.handleSuccess({
      fileId: fileIdInt,
      fileName: fileInfo?.file_name || 'Unknown',
      summarization,
    }, 'get-dynamic-process-results');
  } catch (error) {
    debugLog('api', 'GET error:', error);
    const errorHandlingService = getErrorHandlingService();
    return errorHandlingService.handleApiError('INTERNAL_ERROR', 'Internal server error');
  }
});
