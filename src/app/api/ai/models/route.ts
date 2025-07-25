import { NextResponse } from 'next/server';
import { getAvailableModels } from '@/lib/services/customAI';
import { createDebugLogger, createSuccessResponse, createErrorResponse, withErrorHandler } from '@/lib/api-utils';

const debugLog = createDebugLogger('ai-models');

export const GET = withErrorHandler(async () => {
  const modelDetails = getAvailableModels();
  const models = modelDetails.map((model: any) => model.id);

  return createSuccessResponse({
    models,
    modelDetails,
    configured: models.length > 0,
    message: models.length === 0 ? 'No AI models configured. Please configure custom AI endpoint in Settings or set environment variables.' : undefined,
  });
});
